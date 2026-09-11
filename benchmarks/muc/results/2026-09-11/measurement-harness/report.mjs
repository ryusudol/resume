import fs from 'node:fs';
import path from 'node:path';

const input = path.resolve(process.argv[2]);
const summary = JSON.parse(fs.readFileSync(input));
const output = path.join(path.dirname(input), 'REPORT.md');
const n = (x, digits = 1) => Number.isFinite(x) ? x.toFixed(digits) : 'not observed';
const change = (a, b) => !Number.isFinite(a) || !Number.isFinite(b) || a === 0 ? 'not estimable' : `${n(Math.abs((a-b)/a)*100)}% ${b <= a ? 'lower' : 'higher'}`;
const lines = [
  '# Machine Unlearning Comparator: frontend benchmark',
  '',
  `Measured ${summary.environment.time}. Source commit: \`${summary.source.head}\`.`,
  '',
  'The comparison is the committed frontend versus the existing local frontend edits. No application optimization was added during this benchmark. Results are synthetic lab measurements on fixed repository data, not production-user metrics.',
  '',
  `Environment: ${summary.environment.cpus[0]}, ${n(summary.environment.memoryBytes / 2 ** 30, 0)} GiB RAM, ${summary.environment.platform} ${summary.environment.os}, Chromium ${summary.environment.browser}, headless, 1920 x 1200 viewport, device scale factor 1.`,
  '',
  'Both versions render two 2,000-point embedding plots and two 400-sample privacy comparisons. Production assets use gzip and a frozen copy of the production font. API responses replay real repository JSON, without model training. HTTP cache and session storage start fresh in every trial.',
  '',
  'The strongest repeatable improvement is interaction responsiveness. Loading time and payload size do not show a meaningful improvement. Continuous-interaction results depend on the gesture; constrained panning still produces heavy stalls in both versions.',
  '',
  '[Paired trial chart](benchmark-overview.png)',
  '',
];
for (const [profile, group] of Object.entries(summary.groups)) {
  const a = group.baseline, b = group.current;
  if (!a || !b) continue;
  lines.push(
    `## ${profile === 'native' ? 'Native desktop' : 'Constrained desktop: 4x CPU slowdown, 40 ms latency, 10 Mbps download'}`,
    '',
    `${a.runs} baseline sessions and ${b.runs} current sessions; alternating execution order within pairs. Values below show baseline → current.`,
    '',
    `- **INP, p75 of lab sessions:** ${n(a.inp.p75,0)} → ${n(b.inp.p75,0)} ms (${change(a.inp.p75,b.inp.p75)}).`,
    `- **LCP, p75 of lab sessions:** ${n(a.lcp.p75,0)} → ${n(b.lcp.p75,0)} ms (${change(a.lcp.p75,b.lcp.p75)}). This is the initial header/dialog, not the fully populated dashboard.`,
    `- **FCP, p75:** ${n(a.fcp.p75,0)} → ${n(b.fcp.p75,0)} ms.`,
    `- **CLS, p75:** ${n(a.cls.p75,3)} → ${n(b.cls.p75,3)}.`,
    `- **Initial data ready after APPLY, p75:** ${n(a.initialDataReadyMs.p75)} → ${n(b.initialDataReadyMs.p75)} ms.`,
    `- **Model-B switch readiness, p50:** ${n(a.modelSwitchMs.p50)} → ${n(b.modelSwitchMs.p50)} ms (${change(a.modelSwitchMs.p50,b.modelSwitchMs.p50)}).`,
    `- **Model-B switch readiness, p95:** ${n(a.modelSwitchMs.p95)} → ${n(b.modelSwitchMs.p95)} ms (${change(a.modelSwitchMs.p95,b.modelSwitchMs.p95)}), from ${a.modelSwitchMs.n} and ${b.modelSwitchMs.n} switches respectively. This is a readiness/paint proxy, not INP.`,
    `- **Captured browser errors:** ${a.errors} → ${b.errors}.`,
    '',
    '### Repeatability',
    '',
  );
  for (const key of ['inpMs','lcpMs','initialDataReadyMs','medianModelSwitchMs']) {
    const ci=group.paired[key];
    if (ci) lines.push(`- ${key}: median paired improvement ${n(ci.medianImprovement)} ms; 95% paired-bootstrap interval [${n(ci.low95)}, ${n(ci.high95)}] ms. Positive values favor current.`);
  }
  lines.push('', 'These intervals summarize this small paired lab sample. An interval crossing zero is not persuasive evidence of a directional improvement.', '', '### Continuous interactions', '');
  for (const [name, p] of Object.entries(a.phases)) {
    const q=b.phases[name];
    lines.push(
      `**${name}**`, '',
      p.perRunP95RafIntervalMs.n && q.perRunP95RafIntervalMs.n
        ? `- Median of per-run p95 animation-frame intervals: ${n(p.perRunP95RafIntervalMs.p50)} → ${n(q.perRunP95RafIntervalMs.p50)} ms (${p.perRunP95RafIntervalMs.n} and ${q.perRunP95RafIntervalMs.n} eligible trials).`
        : '- Insufficient frame samples for a reliable p95 comparison. The synthetic 60 Hz panning stress caused heavy stalls and partial-frame presentation in both versions.',
      `- Observed animation-frame intervals per trial, min–max: ${p.perRunIntervalSampleCount.min}–${p.perRunIntervalSampleCount.max} → ${q.perRunIntervalSampleCount.min}–${q.perRunIntervalSampleCount.max}. Trials need at least 20 intervals for the p95 comparison.`,
      `- Fully dropped Chrome frames: ${p.frames.dropped}/${p.frames.total} (${n(p.frames.droppedPercent)}%) → ${q.frames.dropped}/${q.frames.total} (${n(q.frames.droppedPercent)}%).`,
      `- Partially presented Chrome frames: ${p.frames.partial}/${p.frames.total} (${n(p.frames.partialPercent)}%) → ${q.frames.partial}/${q.frames.total} (${n(q.frames.partialPercent)}%).`,
      `- Median long-animation-frame count per run: ${n(p.perRunLongAnimationFrames.p50,0)} → ${n(q.perRunLongAnimationFrames.p50,0)}.`,
      '',
    );
  }
  lines.push('### Network', '',
    `- Initial page HTTP requests, median: ${a.network.coldRequests.p50} → ${b.network.coldRequests.p50}.`,
    `- Initial page encoded transfer, median: ${n(a.network.coldEncodedBytes.p50/1024)} → ${n(b.network.coldEncodedBytes.p50/1024)} KiB.`,
    `- Initial data-load HTTP requests, median: ${a.network.initialDataRequests.p50} → ${b.network.initialDataRequests.p50}.`,
    `- Initial data-load encoded transfer, median: ${n(a.network.initialDataEncodedBytes.p50/1024)} → ${n(b.network.initialDataEncodedBytes.p50/1024)} KiB.`,
    `- Whole scripted session HTTP requests, median: ${a.network.totalRequests.p50} → ${b.network.totalRequests.p50}.`,
    `- Whole scripted session encoded transfer, median: ${n(a.network.totalEncodedBytes.p50/1024)} → ${n(b.network.totalEncodedBytes.p50/1024)} KiB.`, '',
  );
}
lines.push('## Production entrypoint sizes', '');
for (const [variant, assets] of Object.entries(summary.assets)) for (const asset of assets) lines.push(`- ${variant}, \`${asset.file}\`: ${n(asset.rawBytes/1024)} KiB raw, ${n(asset.gzipBytes/1024)} KiB gzip, ${n(asset.brotliBytes/1024)} KiB Brotli. The server uses gzip; Brotli is an offline size calculation.`);
lines.push('', '## Interpretation for resume wording', '',
  'Use an improvement only when its metric, workload, comparison, and lab conditions are named. Prefer a repeatable INP or model-switch improvement over a generalized claim about every frontend interaction. Smoothness and loading results must be assessed separately.', '',
  `Suggested performance bullet: “Optimized React/D3 rendering for 4,000-point model comparisons, reducing lab p75 INP by ${n((summary.groups.native.baseline.inp.p75-summary.groups.native.current.inp.p75)/summary.groups.native.baseline.inp.p75*100,0)}% (${n(summary.groups.native.baseline.inp.p75,0)} → ${n(summary.groups.native.current.inp.p75,0)} ms) across 10 paired Chromium trials.” This attributes the improvement to the recorded local changes; use it only if those changes are your work.`, '',
  'These experiments do not validate the earlier “p95 ≤ 11 ms interaction latency” statement, which had no saved protocol or traces. They also do not measure a migration to Zustand: both versions already use it, so “30% fewer re-renders from Zustand” remains unsupported.', '',
  'No user-count, production-performance, maximum-capacity, or backend-training claim follows from these results.', '',
  '## Evidence', '',
  '- `summary.json`: full aggregated and per-session measurements, source hashes, definitions, and confidence intervals.',
  '- `runs.csv`: one row per session for headline timing metrics.',
  '- `raw/`: original session JSON, Chrome traces, screenshots, and environment metadata.',
  '- `existing-frontend-changes.patch`: exact pre-existing code changes being compared.',
  '- `manifest.json`: source and data SHA-256 identifiers.',
  '- `measurement-harness/`: runtime scripts and dependency lock used for this measurement, plus the final analysis scripts.',
  '- `frozen-runtime/`: both production builds, real API fixtures, and frozen fonts for reruns.',
  '- `evidence-sha256.json`: integrity hashes for the saved evidence and derived artifacts.',
  '- The parent benchmark README documents setup, workload, percentiles, trace classification, and limitations.', '',
);
fs.writeFileSync(output,lines.join('\n'));
console.log(output);
