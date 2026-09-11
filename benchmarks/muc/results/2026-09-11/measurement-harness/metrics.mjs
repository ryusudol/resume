// Nearest-rank percentiles: a reported percentile is always an observed value.
export function quantile(values, p) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}

export function stats(values) {
  const usable = values.filter(Number.isFinite);
  return { n: usable.length, p50: quantile(usable, .5), p75: quantile(usable, .75), p95: quantile(usable, .95), min: usable.length ? Math.min(...usable) : null, max: usable.length ? Math.max(...usable) : null };
}

// A minimum resolution rule, not a claim of statistical precision. Sparse
// callbacks during a stall cannot support a useful tail-percentile comparison.
export function eligibleFrameP95(intervalStats) {
  return intervalStats.n >= 20 ? intervalStats.p95 : null;
}

export function frameCounts(events, phaseName) {
  const start = events.find(e => e.name === 'muc-start-' + phaseName);
  const end = events.find(e => e.name === 'muc-end-' + phaseName);
  if (!start || !end) return null;
  const frames = new Map();
  for (const e of events) {
    if (e.pid !== start.pid || e.ts < start.ts || e.ts > end.ts || !['DrawFrame', 'DroppedFrame'].includes(e.name)) continue;
    const a = e.args || {};
    if (a.layerTreeId == null || a.frameSeqId == null) continue;
    const key = `${a.layerTreeId}:${a.frameSeqId}`;
    const frame = frames.get(key) || { drawn: false, dropped: false, partial: false };
    if (e.name === 'DrawFrame') frame.drawn = true;
    else if (a.hasPartialUpdate) frame.partial = true;
    else frame.dropped = true;
    frames.set(key, frame);
  }
  // Partial frames are not counted as fully dropped, even when Chrome emits
  // both DrawFrame and DroppedFrame(hasPartialUpdate=true) for the same ID.
  const values = [...frames.values()];
  const partial = values.filter(f => f.partial).length;
  const dropped = values.filter(f => f.dropped && !f.drawn && !f.partial).length;
  return { total: frames.size, dropped, partial, droppedPercent: frames.size ? 100 * dropped / frames.size : null, partialPercent: frames.size ? 100 * partial / frames.size : null, missedOrPartialPercent: frames.size ? 100 * (dropped + partial) / frames.size : null };
}

// Bootstrap paired per-run differences, keeping the two versions in each pair.
// Small-n lab intervals indicate variability; they are not field guarantees.
export function pairedBootstrap(baseline, current, seed = 2789) {
  if (baseline.length !== current.length || baseline.length < 2 || [...baseline, ...current].some(v => !Number.isFinite(v))) return null;
  let state = seed >>> 0;
  const random = () => { state = (1664525 * state + 1013904223) >>> 0; return state / 2 ** 32; };
  const samples = [];
  for (let i = 0; i < 4000; i++) {
    const differences = [];
    for (let j = 0; j < baseline.length; j++) {
      const idx = Math.floor(random() * baseline.length);
      differences.push(baseline[idx] - current[idx]);
    }
    samples.push(quantile(differences, .5));
  }
  return { pairs: baseline.length, medianImprovement: quantile(baseline.map((v, i) => v - current[i]), .5), low95: quantile(samples, .025), high95: quantile(samples, .975), resamples: 4000, seed };
}
