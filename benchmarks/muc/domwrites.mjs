// Counts DOM writes and React commits per discrete interaction in the two
// frozen MUC builds. This is a mechanism measurement (how much work each hover
// or drag step causes), not a timing benchmark; MutationObserver overhead is
// identical in both versions and is not timed.
//
// Usage:
//   MUC_BENCH_WORKSPACE=/abs/path/to/results/<date>/frozen-runtime \
//   node benchmarks/muc/domwrites.mjs --label=dom-writes [--runs=5]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startServers } from './server.mjs';
import { stats } from './metrics.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(process.env.MUC_BENCH_WORKSPACE || path.join(dir, '../../.build/muc-benchmark'));
const label = process.argv.find(a => a.startsWith('--label='))?.slice(8) || 'dom-writes';
if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error('Invalid label');
const runs = Number(process.argv.find(a => a.startsWith('--runs='))?.slice(7) || 5);
const output = path.resolve(process.env.MUC_BENCH_OUTPUT || path.join(workspace, label));
fs.mkdirSync(output, { recursive: true });
const browserPath = process.env.MUC_CHROMIUM || chromium.executablePath();
const HOVERS = 20;
const DRAG_STEPS = 20;
const SETTLE_MS = 200;

function instrument() {
  const b = window.__dom = { phases: [], active: null };
  // Minimal React DevTools hook: production React calls onCommitFiberRoot on
  // every committed root when this global exists before the bundle loads.
  if (!window.__DOM_NO_HOOK) window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    isDisabled: false, supportsFiber: true, renderers: new Map(),
    inject() { return 1; }, checkDCE() {}, on() {}, off() {}, emit() {}, sub() { return () => {}; },
    onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
    onCommitFiberRoot() { if (b.active) b.active.reactCommits++; },
  };
  const observer = new MutationObserver(records => {
    const p = b.active; if (!p) return;
    for (const r of records) {
      if (r.type === 'attributes') { p.attributeWrites++; if (r.attributeName === 'style') p.styleWrites++; }
      else if (r.type === 'childList') { p.childListRecords++; p.nodesAdded += r.addedNodes.length; p.nodesRemoved += r.removedNodes.length; }
      else p.characterDataWrites++;
    }
  });
  b.start = name => {
    b.active = { name, start: performance.now(), attributeWrites: 0, styleWrites: 0, childListRecords: 0, nodesAdded: 0, nodesRemoved: 0, characterDataWrites: 0, reactCommits: 0 };
    observer.observe(document.documentElement, { subtree: true, attributes: true, childList: true, characterData: true });
  };
  b.end = () => new Promise(resolve => {
    // Deliver any queued records before disconnecting.
    setTimeout(() => { observer.takeRecords().length; observer.disconnect(); const p = b.active; p.end = performance.now(); b.phases.push(p); b.active = null; resolve(p); }, 0);
  });
  b.plots = () => [...document.querySelectorAll('svg')].filter(s => [...s.querySelectorAll('circle,path')].filter(e => Array.isArray(e.__data__) && e.__data__.length === 7).length === 2000);
}

async function session({ browser, variant, id }) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1200 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const cdp = await context.newCDPSession(page);
  const errors = [];
  page.on('pageerror', e => errors.push({ type: 'pageerror', message: e.message }));
  page.on('console', msg => { if (msg.type() === 'error') errors.push({ type: 'console', message: msg.text() }); });
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.setBlockedURLs', { urls: ['https://*'] });
  await page.addInitScript({ content: (process.env.DOM_NO_HOOK ? 'window.__DOM_NO_HOOK = true;' : '') + '(' + instrument.toString() + ')();' });
  if (process.env.DOM_DEBUG) page.on('console', msg => console.log('[console:' + msg.type() + ']', msg.text().slice(0, 300)));
  const url = variant === 'baseline' ? 'http://127.0.0.1:4173' : 'http://127.0.0.1:4174';
  const phases = [];
  const measure = async (name, act, settle = SETTLE_MS) => {
    await page.evaluate(name => __dom.start(name), name);
    await act();
    await page.waitForTimeout(settle);
    phases.push(await page.evaluate(() => __dom.end()));
  };
  const row = name => page.getByRole('row').filter({ has: page.getByText(name, { exact: true }) });
  try {
    await page.goto(url, { waitUntil: 'load' });
    await page.getByRole('button', { name: 'APPLY', exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'APPLY', exact: true }).click();
    await page.waitForFunction(() => __dom.plots().length === 2);
    await page.waitForTimeout(1000);
    const marks = await page.evaluate(() => [...__dom.plots()[0].querySelectorAll('circle,path')].filter(e => Array.isArray(e.__data__) && e.__data__.length === 7).map(e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }).filter(p => p.x > 30 && p.x < 650 && p.y > 520 && p.y < 1120));
    const away = { x: 10, y: 10 };
    await page.mouse.move(away.x, away.y);
    await page.waitForTimeout(SETTLE_MS);
    await measure('embedding-idle', async () => { await page.waitForTimeout(500); });
    for (let i = 0; i < HOVERS; i++) {
      const m = marks[(i * 31) % marks.length];
      await measure('embedding-hover-enter', () => page.mouse.move(m.x, m.y));
      await measure('embedding-hover-leave', () => page.mouse.move(away.x, away.y));
    }
    for (const name of ['Target to Forget', 'All']) {
      await measure('embedding-highlight-' + name, () => page.getByRole('tab', { name, exact: true }).click());
      await page.mouse.move(away.x, away.y);
      await page.waitForTimeout(SETTLE_MS);
    }
    // Both attack panels need non-original models: B = unlearned d641, A = retrained a000.
    await measure('model-switch-B-d641', () => row('d641').getByRole('radio').nth(1).click(), 1500);
    await page.waitForFunction(() => __dom.plots().length === 2);
    await measure('model-switch-A-a000', () => row('a000').getByRole('radio').nth(0).click(), 1500);
    await page.waitForFunction(() => __dom.plots().length === 2);
    await page.mouse.move(away.x, away.y);
    await page.waitForTimeout(SETTLE_MS);
    await page.getByText('Attack Simulation', { exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.retrain-circle, .unlearn-circle').length === 800);
    await page.waitForFunction(() => [...document.querySelectorAll('img')].every(i => i.complete));
    await page.waitForTimeout(800);
    await page.mouse.move(away.x, away.y);
    await page.waitForTimeout(SETTLE_MS);
    const attackPoints = await page.locator('.retrain-circle,.unlearn-circle').evaluateAll(nodes => nodes.map(e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }).filter(p => p.x > 30 && p.x < 400 && p.y > 500 && p.y < 990));
    await measure('attack-idle', async () => { await page.waitForTimeout(500); });
    for (let i = 0; i < HOVERS; i++) {
      const m = attackPoints[(i * 13) % attackPoints.length];
      await measure('attack-hover-enter', () => page.mouse.move(m.x, m.y));
      await measure('attack-hover-leave', () => page.mouse.move(away.x, away.y));
    }
    const threshold = await page.locator('.threshold-group rect').first().boundingBox();
    const handle = { x: threshold.x + threshold.width * 0.7, y: threshold.y + threshold.height / 2 };
    const thresholdText = page.locator('svg text').filter({ hasText: /^Threshold:/ }).first();
    const before = await thresholdText.textContent();
    await page.mouse.move(handle.x, handle.y);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.down();
    for (let i = 1; i <= DRAG_STEPS; i++) {
      const y = handle.y + 4 * i;
      await measure('attack-threshold-drag-step', () => page.mouse.move(handle.x, y));
    }
    await page.mouse.up();
    const after = await thresholdText.textContent();
    if (before === after) throw new Error('Threshold drag did not change its value');
    const domSize = await page.evaluate(() => ({ elements: document.getElementsByTagName('*').length, svgMarks: document.querySelectorAll('svg circle, svg path').length }));
    return { id, variant, phases, errors, domSize, validation: { marks: marks.length, attackPoints: attackPoints.length, before, after } };
  } catch (error) {
    await page.screenshot({ path: path.join(output, id + '-failed.png') }).catch(() => {});
    const state = await page.evaluate(() => ({ svgs: document.querySelectorAll('svg').length, bound: [...document.querySelectorAll('svg circle, svg path')].filter(e => Array.isArray(e.__data__)).length, plots: __dom.plots().length, text: document.body.innerText.slice(0, 400) })).catch(e => String(e));
    console.error('Session failed', id, JSON.stringify({ errors, state }, null, 2));
    throw error;
  } finally {
    await context.close();
  }
}

const servers = await startServers(workspace);
let browser;
const results = [];
try {
  browser = await chromium.launch({ executablePath: browserPath, headless: true });
  const environment = { time: new Date().toISOString(), browser: browser.version(), node: process.version, os: os.release(), platform: os.platform(), architecture: os.arch(), cpus: os.cpus().map(c => c.model), workspace, runs, hoversPerSession: HOVERS, dragStepsPerSession: DRAG_STEPS, settleMs: SETTLE_MS };
  fs.writeFileSync(path.join(output, 'environment.json'), JSON.stringify(environment, null, 2));
  for (let repetition = 0; repetition < runs; repetition++) {
    const variants = repetition % 2 ? ['current', 'baseline'] : ['baseline', 'current'];
    for (const variant of variants) {
      const id = `${String(repetition + 1).padStart(2, '0')}-${variant}`;
      const result = await session({ browser, variant, id });
      fs.writeFileSync(path.join(output, id + '.json'), JSON.stringify(result, null, 2));
      results.push(result);
      const summary = {};
      for (const p of result.phases) { (summary[p.name] ||= []).push(p.attributeWrites); }
      console.log(id, 'errors=' + result.errors.length, JSON.stringify(Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, stats(v).p50]))));
    }
  }
  const groups = {};
  const keys = ['attributeWrites', 'styleWrites', 'childListRecords', 'nodesAdded', 'nodesRemoved', 'reactCommits'];
  for (const variant of ['baseline', 'current']) {
    const list = results.filter(r => r.variant === variant);
    const byPhase = {};
    for (const r of list) for (const p of r.phases) (byPhase[p.name] ||= []).push(p);
    groups[variant] = { sessions: list.length, errors: list.reduce((s, r) => s + r.errors.length, 0), domSize: list[0]?.domSize, phases: Object.fromEntries(Object.entries(byPhase).map(([name, list]) => [name, { observations: list.length, ...Object.fromEntries(keys.map(k => [k, stats(list.map(p => p[k]))])) }])) };
  }
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify({ environment, groups, definitions: { attributeWrites: 'MutationObserver attribute records in the whole document during the interaction plus a settle window; setAttribute with an unchanged value still produces a record', styleWrites: 'Subset of attributeWrites where attributeName is style', childListRecords: 'MutationObserver childList records; nodesAdded/nodesRemoved count nodes in those records', reactCommits: 'onCommitFiberRoot calls across all React roots' } }, null, 2));
  console.log(JSON.stringify(groups, null, 2));
} finally {
  await browser?.close();
  await servers.close();
}
