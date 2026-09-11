import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startServers } from './server.mjs';
import { runScenario } from './scenarios.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(process.env.MUC_BENCH_WORKSPACE || path.join(dir, '../../.build/muc-benchmark'));
const runLabel = process.argv.find(a => a.startsWith('--label='))?.slice(8) || 'pilot';
if (!/^[a-zA-Z0-9_-]+$/.test(runLabel)) throw new Error('Invalid run label');
const output = path.resolve(process.env.MUC_BENCH_OUTPUT || path.join(workspace, runLabel));
fs.mkdirSync(output, { recursive: true });
const browserPath = process.env.MUC_CHROMIUM || chromium.executablePath();

async function freezeFonts() {
  const fontDir = path.join(workspace, 'fixtures/benchmark-font');
  fs.mkdirSync(fontDir, { recursive: true });
  if (fs.existsSync(path.join(fontDir, 'font.css'))) return;
  const url = 'https://fonts.googleapis.com/css2?family=Roboto+Condensed:ital,wght@0,100..900;1,100..900&display=swap';
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/133.0.0.0 Safari/537.36' } });
  if (!response.ok) throw new Error('Could not freeze production font: ' + response.status);
  let css = await response.text();
  const manifest = [];
  for (const [i, url] of [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]))].entries()) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Font download failed');
    const data = Buffer.from(await response.arrayBuffer());
    const name = `font-${i}.woff2`;
    fs.writeFileSync(path.join(fontDir, name), data);
    css = css.replaceAll(url, '/benchmark-font/' + name);
    manifest.push({ url, name, bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex') });
  }
  fs.writeFileSync(path.join(fontDir, 'font.css'), css);
  fs.writeFileSync(path.join(fontDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

function instrument() {
  const b = window.__bench = { events: [], longTasks: [], longFrames: [], rawLCP: [], vitals: {}, phases: [], active: null, marks: [], ready: [], errors: [] };
  const targetName = target => target ? `${target.tagName} ${target.getAttribute?.('role') || ''} ${(target.textContent || '').slice(0, 80)}` : null;
  const observe = (type, callback, options = {}) => {
    if (!PerformanceObserver.supportedEntryTypes.includes(type)) return;
    new PerformanceObserver(list => list.getEntries().forEach(callback)).observe({ type, buffered: true, ...options });
  };
  observe('event', e => b.events.push({ name: e.name, startTime: e.startTime, duration: e.duration, processingStart: e.processingStart, processingEnd: e.processingEnd, interactionId: e.interactionId, target: targetName(e.target) }), { durationThreshold: 16 });
  observe('longtask', e => b.longTasks.push(e.toJSON()));
  observe('long-animation-frame', e => b.longFrames.push({ startTime: e.startTime, duration: e.duration, blockingDuration: e.blockingDuration, renderStart: e.renderStart, styleAndLayoutStart: e.styleAndLayoutStart }));
  observe('largest-contentful-paint', e => b.rawLCP.push({ ...e.toJSON(), element: targetName(e.element) }));
  const report = m => { b.vitals[m.name] = { value: m.value, rating: m.rating, delta: m.delta, navigationType: m.navigationType, entries: m.entries.map(e => ({ name: e.name, startTime: e.startTime, duration: e.duration, size: e.size, element: targetName(e.element) })) }; };
  webVitals.onINP(report, { reportAllChanges: true, durationThreshold: 16 });
  webVitals.onLCP(report, { reportAllChanges: true });
  webVitals.onCLS(report, { reportAllChanges: true });
  webVitals.onFCP(report, { reportAllChanges: true });
  webVitals.onTTFB(report, { reportAllChanges: true });
  b.startPhase = name => {
    const phase = { name, start: performance.now(), end: null, frames: [] };
    b.active = phase; b.phases.push(phase);
    performance.mark('muc-start-' + name);
    let last;
    const tick = time => { if (b.active !== phase) return; if (last !== undefined) phase.frames.push({ time, interval: time - last }); last = time; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  };
  b.endPhase = () => { if (b.active) { b.active.end = performance.now(); performance.mark('muc-end-' + b.active.name); b.active = null; } };
  document.addEventListener('click', e => b.marks.push({ name: 'click', time: performance.now(), target: targetName(e.target) }), true);
  b.plots = () => [...document.querySelectorAll('svg')].filter(s => [...s.querySelectorAll('circle,path')].filter(e => Array.isArray(e.__data__) && e.__data__.length === 7).length === 2000);
  document.addEventListener('pointerdown', () => {
    if (!b.pending) return;
    const task = b.pending; b.pending = null;
    const start = performance.now();
    const check = () => {
      const plots = b.plots();
      const modelIndex = task.modelIndex ?? 1;
      const ready = plots.length === 2 && (!task.point || [...plots[modelIndex].querySelectorAll('circle,path')].some(e => e.__data__?.[2] === task.point[2] && e.__data__?.[4] === task.point[4] && e.__data__?.[5] === task.point[5]));
      if (ready) requestAnimationFrame(() => b.ready.push({ name: task.name, start, end: performance.now(), duration: performance.now() - start }));
      else if (performance.now() - start < 30000) requestAnimationFrame(check);
      else b.errors.push('Readiness timeout: ' + task.name);
    };
    requestAnimationFrame(check);
  }, true);
}

await freezeFonts();
const servers = await startServers(workspace);
let browser;
try {
  browser = await chromium.launch({ executablePath: browserPath, headless: true });
  const metadata = { time: new Date().toISOString(), browser: browser.version(), executable: browserPath, node: process.version, os: os.release(), platform: os.platform(), architecture: os.arch(), cpus: os.cpus().map(c => c.model), memoryBytes: os.totalmem(), viewport: { width: 1920, height: 1200 }, deviceScaleFactor: 1, headless: true, api: 'Read-only replay of real checked-in data, no artificial API latency; uncompressed API bodies as in FastAPI source', assets: 'gzip; frozen production Roboto Condensed font; browser HTTP cache disabled' };
  fs.writeFileSync(path.join(output, 'environment.json'), JSON.stringify(metadata, null, 2));
  const vitals = fs.readFileSync(path.join(dir, 'node_modules/web-vitals/dist/web-vitals.iife.js'), 'utf8');
  const smoke = process.argv.includes('--smoke');
  const runs = Number(process.env.MUC_RUNS || (smoke ? 1 : 10));
  const profiles = smoke ? [{ name: 'native', cpu: 1, latency: 0, download: -1, upload: -1 }] : [
    { name: 'native', cpu: 1, latency: 0, download: -1, upload: -1 },
    { name: 'constrained', cpu: 4, latency: 40, download: 1250000, upload: 125000 },
  ];
  metadata.profiles = profiles;
  metadata.runsPerVariantPerProfile = runs;
  metadata.webVitalsVersion = '5.1.0';
  metadata.playwrightVersion = '1.62.1';
  fs.writeFileSync(path.join(output, 'environment.json'), JSON.stringify(metadata, null, 2));
  for (const profile of profiles) {
    for (let repetition = 0; repetition < runs; repetition++) {
      // Alternate order within each paired repetition to limit ordering bias.
      const variants = repetition % 2 ? ['current', 'baseline'] : ['baseline', 'current'];
      for (const variant of variants) {
        const id = `${profile.name}-${String(repetition + 1).padStart(2, '0')}-${variant}`;
        const result = await runScenario({ browser, metadata, profile, variant, id, output, workspace, initScript: vitals + '\n;(' + instrument.toString() + ')();', trace: smoke || process.argv.includes('--trace') });
        fs.writeFileSync(path.join(output, id + '.json'), JSON.stringify(result, null, 2));
        console.log(JSON.stringify({ id, vitals: Object.fromEntries(Object.entries(result.measurements.vitals).map(([k, v]) => [k, v.value])), readiness: result.measurements.ready.map(r => ({ name: r.name, ms: +r.duration.toFixed(1) })), errors: result.errors.length, phases: result.measurements.phases.length }));
      }
    }
  }
} finally {
  await browser?.close();
  await servers.close();
}
