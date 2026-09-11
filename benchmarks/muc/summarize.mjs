import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { stats, frameCounts, pairedBootstrap, eligibleFrameP95 } from './metrics.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(process.env.MUC_BENCH_WORKSPACE || path.join(dir, '../../.build/muc-benchmark'));
const input = path.resolve(process.argv[2] || path.join(workspace, 'measured'));
const destination = path.resolve(process.argv[3] || input);
fs.mkdirSync(destination, { recursive: true });
const files = fs.readdirSync(input).filter(f => /^(native|constrained)-\d+-(baseline|current)\.json$/.test(f)).sort();
const runs = [];
for (const name of files) {
  const raw = JSON.parse(fs.readFileSync(path.join(input, name)));
  const { measurements: m } = raw;
  const readiness = m.ready.map(r => {
    const matches = m.events.filter(e => e.name === 'pointerdown' && e.processingStart <= r.start && e.processingEnd >= r.start);
    return { ...r, eventTimingMatched: matches.length === 1, inputStart: matches.length === 1 ? matches[0].startTime : null, inputToReadyMs: matches.length === 1 ? r.end - matches[0].startTime : null };
  });
  const network = raw.network.filter(r => /^https?:/.test(r.url));
  const coldNetwork = raw.coldNetwork.filter(r => /^https?:/.test(r.url));
  const initialDataNetwork = raw.initialDataNetwork.filter(r => /^https?:/.test(r.url));
  const tracePath = path.join(input, raw.id + '-trace.json.gz');
  const trace = fs.existsSync(tracePath) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(tracePath))).traceEvents : null;
  const phases = Object.fromEntries(m.phases.map(phase => {
    const longFrames = m.longFrames.filter(e => e.startTime >= phase.start && e.startTime < phase.end);
    return [phase.name, { rafIntervalMs: stats(phase.frames.map(f => f.interval)), traceFrames: trace ? frameCounts(trace, phase.name) : null, longAnimationFrames: longFrames.length, blockingDurationMs: longFrames.reduce((sum, e) => sum + e.blockingDuration, 0), wallDurationMs: phase.end - phase.start }];
  }));
  runs.push({
    id: raw.id, variant: raw.variant, profile: raw.profile.name,
    repetition: Number(raw.id.split('-')[1]),
    inp: m.vitals.INP?.value ?? null, lcp: m.vitals.LCP?.value ?? null,
    lcpElement: m.vitals.LCP?.entries?.at(-1)?.element,
    cls: m.vitals.CLS?.value ?? null, fcp: m.vitals.FCP?.value ?? null,
    initialDataReady: readiness.find(r => r.name === 'initial-data-load')?.inputToReadyMs,
    modelSwitchMs: stats(readiness.filter(r => r.name.startsWith('model-switch')).map(r => r.inputToReadyMs)),
    modelSwitchObservations: readiness.filter(r => r.name.startsWith('model-switch')).map(r => r.inputToReadyMs).filter(Number.isFinite),
    readiness,
    phases, errors: raw.errors.length + m.errors.length,
    network: { coldRequests: coldNetwork.length, coldEncodedBytes: coldNetwork.reduce((s, r) => s + r.encodedBytes, 0), initialDataRequests: initialDataNetwork.length, initialDataEncodedBytes: initialDataNetwork.reduce((s, r) => s + r.encodedBytes, 0), totalRequests: network.length, totalEncodedBytes: network.reduce((s, r) => s + r.encodedBytes, 0), failedHTTP: network.filter(r => r.status >= 400) },
    discreteActions: Object.fromEntries(raw.actions.map(action => {
      const interactions = new Map();
      for (const e of m.events) {
        if (e.startTime < action.start || e.startTime > action.end || !e.interactionId) continue;
        interactions.set(e.interactionId, Math.max(interactions.get(e.interactionId) || 0, e.duration));
      }
      return [action.name, { observed: [...interactions.values()], note: 'Event Timing is quantized; interactions below the 16ms reporting threshold may be absent.' }];
    })),
  });
}
const groups = {};
for (const profile of ['native', 'constrained']) {
  const variants = {};
  for (const variant of ['baseline', 'current']) {
    const list = runs.filter(r => r.profile === profile && r.variant === variant);
    if (!list.length) continue;
    const phases = {};
    for (const name of Object.keys(list[0].phases)) {
      const values = list.map(r => r.phases[name]);
      const frames = values.map(v => v.traceFrames).filter(Boolean);
      const total = frames.reduce((s, f) => s + f.total, 0);
      const dropped = frames.reduce((s, f) => s + f.dropped, 0);
      const partial = frames.reduce((s, f) => s + f.partial, 0);
      phases[name] = { perRunIntervalSampleCount: stats(values.map(v => v.rafIntervalMs.n)), perRunP95RafIntervalMs: stats(values.map(v => eligibleFrameP95(v.rafIntervalMs))), frames: { total, dropped, partial, droppedPercent: total ? 100 * dropped / total : null, partialPercent: total ? 100 * partial / total : null }, perRunDroppedPercent: stats(frames.map(f => f.droppedPercent)), perRunPartialPercent: stats(frames.map(f => f.partialPercent)), perRunLongAnimationFrames: stats(values.map(v => v.longAnimationFrames)), perRunBlockingMs: stats(values.map(v => v.blockingDurationMs)) };
    }
    variants[variant] = { runs: list.length, inp: stats(list.map(r => r.inp)), lcp: stats(list.map(r => r.lcp)), cls: stats(list.map(r => r.cls)), fcp: stats(list.map(r => r.fcp)), initialDataReadyMs: stats(list.map(r => r.initialDataReady)), modelSwitchMs: stats(list.flatMap(r => r.modelSwitchObservations)), perRunMedianModelSwitchMs: stats(list.map(r => r.modelSwitchMs.p50)), errors: list.reduce((s, r) => s + r.errors, 0), phases, network: Object.fromEntries(['coldRequests', 'coldEncodedBytes', 'initialDataRequests', 'initialDataEncodedBytes', 'totalRequests', 'totalEncodedBytes'].map(k => [k, stats(list.map(r => r.network[k]))])) };
  }
  const baseline = runs.filter(r => r.profile === profile && r.variant === 'baseline').sort((a,b) => a.repetition-b.repetition);
  const current = runs.filter(r => r.profile === profile && r.variant === 'current').sort((a,b) => a.repetition-b.repetition);
  const paired = {};
  if (baseline.length === current.length && baseline.length > 1) {
    for (const [name, select] of [['inpMs', r => r.inp], ['lcpMs', r => r.lcp], ['initialDataReadyMs', r => r.initialDataReady], ['medianModelSwitchMs', r => r.modelSwitchMs.p50]]) paired[name] = pairedBootstrap(baseline.map(select), current.map(select));
    for (const phase of Object.keys(baseline[0].phases)) {
      paired[phase + '-p95RafIntervalMs'] = pairedBootstrap(baseline.map(r => eligibleFrameP95(r.phases[phase].rafIntervalMs)), current.map(r => eligibleFrameP95(r.phases[phase].rafIntervalMs)));
    }
  }
  groups[profile] = { ...variants, paired };
}
const assets = {};
for (const variant of ['baseline', 'current']) {
  const root = path.join(workspace, variant, 'frontend/build');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'asset-manifest.json')));
  assets[variant] = manifest.entrypoints.map(file => {
    const data = fs.readFileSync(path.join(root, file));
    return { file, rawBytes: data.length, gzipBytes: zlib.gzipSync(data).length, brotliBytes: zlib.brotliCompressSync(data).length };
  });
}
const summary = { environment: JSON.parse(fs.readFileSync(path.join(input, 'environment.json'))), source: JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'))), assets, groups, runs, conventions: { percentiles: 'Nearest-rank on observed samples; no interpolation', modelSwitch: 'Event Timing pointerdown startTime to first animation-frame callback after the selected model data is verified in both 2000-point SVG plots; includes input queuing, but the end is a readiness/paint proxy, not exact screen presentation or INP. Missing Event Timing matches are excluded and recorded.', framePacing: 'rAF intervals during scripted 60Hz input; per-run p95 is summarized across runs, not pooled', droppedFrames: 'Chrome DrawFrame/DroppedFrame events within each marked phase and renderer PID, deduplicated by layerTreeId/frameSeqId; partial updates reported separately', vitals: 'web-vitals 5.1.0 in synthetic fresh-browser sessions; not field Core Web Vitals', lcp: 'Initial selection-dialog/header content, not completed SVG dashboard', pairing: 'Alternating variant order within each repetition; 4000-resample paired bootstrap of median improvements; positive means current is faster', timing: 'Same lightweight browser observers and trace categories in both variants; no screenshots during continuous interaction phases' } };
fs.writeFileSync(path.join(destination, 'summary.json'), JSON.stringify(summary, null, 2));
const csv = ['profile,variant,repetition,inp_ms,lcp_ms,initial_data_ready_ms,model_switch_median_ms,model_switch_p95_ms,errors'];
for (const r of runs) csv.push([r.profile, r.variant, r.repetition, r.inp, r.lcp, r.initialDataReady, r.modelSwitchMs.p50, r.modelSwitchMs.p95, r.errors].join(','));
fs.writeFileSync(path.join(destination, 'runs.csv'), csv.join('\n') + '\n');
console.log(JSON.stringify({ runs: runs.length, destination, groups }, null, 2));
