import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { performance } from 'node:perf_hooks';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const plotSelector = 'svg';

export async function runScenario({ browser, metadata, profile, variant, id, output, workspace, initScript, trace }) {
  const context = await browser.newContext({ viewport: metadata.viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const cdp = await context.newCDPSession(page);
  const errors = [], network = [], actions = [], inputs = [];
  const requests = new Map();
  page.on('pageerror', e => errors.push({ type: 'pageerror', message: e.message }));
  page.on('console', msg => { if (msg.type() === 'error') errors.push({ type: 'console', message: msg.text() }); });
  page.on('requestfailed', req => errors.push({ type: 'requestfailed', url: req.url(), message: req.failure()?.errorText }));
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.setBlockedURLs', { urls: ['https://*'] });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: profile.latency, downloadThroughput: profile.download, uploadThroughput: profile.upload });
  cdp.on('Network.requestWillBeSent', e => requests.set(e.requestId, { url: e.request.url, type: e.type, started: e.timestamp }));
  cdp.on('Network.responseReceived', e => Object.assign(requests.get(e.requestId) || {}, { status: e.response.status, mime: e.response.mimeType, protocol: e.response.protocol, fromDiskCache: e.response.fromDiskCache }));
  cdp.on('Network.loadingFinished', e => { const request = requests.get(e.requestId); if (request) network.push({ ...request, finished: e.timestamp, encodedBytes: e.encodedDataLength }); });
  await page.addInitScript({ content: initScript });
  const data = Object.fromEntries(['0000', 'a000', 'd641'].map(name => [name, JSON.parse(fs.readFileSync(path.join(workspace, 'fixtures/0', name + '.json')))]));
  const url = variant === 'baseline' ? 'http://127.0.0.1:4173' : 'http://127.0.0.1:4174';
  let tracing = false;
  try {
    if (trace) {
      await cdp.send('Tracing.start', { categories: 'blink.user_timing,disabled-by-default-devtools.timeline.frame', transferMode: 'ReturnAsStream' });
      tracing = true;
    }
    await page.goto(url, { waitUntil: 'load' });
    await page.getByRole('button', { name: 'APPLY', exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(2000);
    const shell = await page.evaluate(() => ({ time: performance.now(), vitals: __bench.vitals, rawLCP: __bench.rawLCP, visibility: document.visibilityState, supported: PerformanceObserver.supportedEntryTypes, resources: performance.getEntriesByType('resource').map(e => e.toJSON()) }));
    const coldNetwork = network.slice();

    async function action(name, locator, readiness) {
      // Let the previous hover card close before targeting another control.
      await page.mouse.move(10, 10);
      await page.waitForTimeout(200);
      if (readiness) await page.evaluate(task => { __bench.pending = task; }, { name, ...readiness });
      const before = await page.evaluate(() => performance.now());
      await locator.click();
      if (readiness) await page.waitForFunction(name => __bench.ready.some(r => r.name === name), name);
      await page.waitForTimeout(250);
      actions.push({ name, start: before, end: await page.evaluate(() => performance.now()) });
    }
    await action('initial-data-load', page.getByRole('button', { name: 'APPLY', exact: true }), { point: data.a000.points[0] });
    await page.waitForFunction(() => __bench.plots().length === 2);
    await page.waitForTimeout(700);
    const initialDataNetwork = network.slice(coldNetwork.length);
    const row = name => page.getByRole('row').filter({ has: page.getByText(name, { exact: true }) });
    for (let i = 0; i < 5; i++) {
      const model = i % 2 === 0 ? 'd641' : 'a000';
      await action(`model-switch-${i + 1}-${model}`, row(model).getByRole('radio').nth(1), { point: data[model].points[0] });
    }
    for (const name of ['Target to Forget', 'Correctly Forgotten', 'Not Forgotten', 'Overly Forgotten', 'All']) {
      await action('highlight-' + name, page.getByRole('tab', { name, exact: true }));
    }
    await action('model-a-retrained', row('a000').getByRole('radio').nth(0), { modelIndex: 0, point: data.a000.points[0] });
    await page.waitForTimeout(700);

    async function paced(name, points, kind = 'move') {
      const phaseInput = { name, kind, scheduledHz: 60, sent: [] };
      await page.evaluate(name => __bench.startPhase(name), name);
      const start = performance.now();
      const pending = [];
      for (let i = 0; i < points.length; i++) {
        const deadline = start + i * (1000 / 60);
        if (deadline > performance.now()) await sleep(deadline - performance.now());
        const p = points[i];
        phaseInput.sent.push(performance.now() - start);
        const event = kind === 'wheel' ? { type: 'mouseWheel', x: p.x, y: p.y, deltaX: 0, deltaY: p.deltaY } : { type: 'mouseMoved', x: p.x, y: p.y, button: kind === 'drag' ? 'left' : 'none', buttons: kind === 'drag' ? 1 : 0 };
        pending.push(cdp.send('Input.dispatchMouseEvent', { ...event, timestamp: Date.now() / 1000 }));
      }
      await Promise.all(pending);
      await sleep(100);
      await page.evaluate(() => __bench.endPhase());
      inputs.push(phaseInput);
      await page.waitForTimeout(250);
    }
    const getMarks = () => page.evaluate(() => [...__bench.plots()[0].querySelectorAll('circle,path')].filter(e => Array.isArray(e.__data__) && e.__data__.length === 7).map(e => {
      const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }).filter(p => p.x > 30 && p.x < 650 && p.y > 520 && p.y < 1120));
    let marks = await getMarks();
    await paced('embedding-hover', Array.from({ length: 120 }, (_, i) => marks[(i * 31) % marks.length]));
    const plot = await page.evaluate(() => { const r = __bench.plots()[0].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await paced('embedding-zoom', Array.from({ length: 120 }, (_, i) => ({ ...plot, deltaY: i < 60 ? -3 : 3 })), 'wheel');
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...plot, button: 'left', buttons: 1, clickCount: 1 });
    await paced('embedding-pan', Array.from({ length: 120 }, (_, i) => ({ x: plot.x + 60 * Math.sin(i / 119 * Math.PI * 2), y: plot.y + 30 * Math.sin(i / 119 * Math.PI * 2) })), 'drag');
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...plot, button: 'left', buttons: 0, clickCount: 1 });
    await page.screenshot({ path: path.join(output, id + '-embedding.png') });

    await action('open-attack', page.getByText('Attack Simulation', { exact: true }));
    await page.waitForFunction(() => document.querySelectorAll('.retrain-circle, .unlearn-circle').length === 800);
    await page.waitForFunction(() => [...document.querySelectorAll('img')].every(i => i.complete));
    await page.waitForTimeout(500);
    const attackPoints = await page.locator('.retrain-circle,.unlearn-circle').evaluateAll(nodes => nodes.map(e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }).filter(p => p.x > 30 && p.x < 400 && p.y > 500 && p.y < 990));
    await paced('attack-hover', Array.from({ length: 120 }, (_, i) => attackPoints[(i * 13) % attackPoints.length]));
    for (const name of ['Max Attack Score', 'Max Success Rate', 'Common Threshold', 'Custom Threshold']) {
      await action('attack-strategy-' + name, page.getByRole('tab', { name: new RegExp('^' + name) }));
    }
    const threshold = await page.locator('.threshold-group rect').first().boundingBox();
    const handle = { x: threshold.x + threshold.width * 0.7, y: threshold.y + threshold.height / 2 };
    const thresholdText = page.locator('svg text').filter({ hasText: /^Threshold:/ }).first();
    const beforeThreshold = await thresholdText.textContent();
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...handle, button: 'left', buttons: 1, clickCount: 1 });
    await paced('attack-threshold-drag', Array.from({ length: 120 }, (_, i) => ({ x: handle.x, y: handle.y + 70 * Math.sin(i / 119 * Math.PI * 1.5) })), 'drag');
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: handle.x, y: handle.y - 70, button: 'left', buttons: 0, clickCount: 1 });
    const afterThreshold = await thresholdText.textContent();
    if (beforeThreshold === afterThreshold) throw new Error('Threshold drag did not change its value');
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(output, id + '-attack.png') });
    const measurements = await page.evaluate(() => ({ ...__bench, resources: performance.getEntriesByType('resource').map(e => e.toJSON()), navigation: performance.getEntriesByType('navigation')[0].toJSON(), interactionCount: performance.interactionCount }));
    return { id, variant, profile, shell, coldNetwork, initialDataNetwork, network, actions, inputs, errors, measurements, validation: { embeddingPointCount: 4000, attackPointCount: 800, beforeThreshold, afterThreshold } };
  } catch (error) {
    await page.screenshot({ path: path.join(output, id + '-failed.png') }).catch(() => {});
    fs.writeFileSync(path.join(output, id + '-failed.json'), JSON.stringify({ message: error.stack, errors, network, actions, measurements: await page.evaluate(() => window.__bench).catch(() => null) }, null, 2));
    throw error;
  } finally {
    if (tracing) {
      const complete = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
      await cdp.send('Tracing.end');
      const { stream } = await complete;
      const chunks = [];
      for (;;) {
        const part = await cdp.send('IO.read', { handle: stream });
        chunks.push(Buffer.from(part.data, part.base64Encoded ? 'base64' : 'utf8'));
        if (part.eof) break;
      }
      await cdp.send('IO.close', { handle: stream });
      fs.writeFileSync(path.join(output, id + '-trace.json.gz'), zlib.gzipSync(Buffer.concat(chunks)));
    }
    await context.close();
  }
}
