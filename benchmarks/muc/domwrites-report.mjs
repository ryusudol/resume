// Renders REPORT.md from a domwrites.mjs summary.json.
// Usage: node benchmarks/muc/domwrites-report.mjs results/<dir>/summary.json
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.argv[2] || 'summary.json');
const { environment, groups, definitions } = JSON.parse(fs.readFileSync(file));
const phases = Object.keys(groups.baseline.phases).filter(n => !n.endsWith('-idle'));
const keys = [['attributeWrites', 'Attribute writes'], ['styleWrites', 'of which style'], ['childListRecords', 'Child-list records'], ['nodesAdded', 'Nodes added'], ['nodesRemoved', 'Nodes removed'], ['reactCommits', 'React commits']];
const fmt = n => n == null ? '–' : Number.isInteger(n) ? n.toLocaleString('en-US') : n.toFixed(1);
const pct = (b, c) => b ? `${(100 * (c - b) / b).toFixed(0)}%` : '–';
const lines = [];
lines.push('# Machine Unlearning Comparator: DOM writes per interaction', '');
lines.push(`Measured ${environment.time}. ${environment.runs} sessions per version, alternating order; ${environment.hoversPerSession} hover pairs and ${environment.dragStepsPerSession} drag steps per session; ${environment.settleMs} ms settle after each interaction. Chromium ${environment.browser}, ${environment.cpus[0]}, ${environment.platform} ${environment.os}, headless.`, '');
lines.push('The comparison is the committed frontend (baseline) versus the pre-existing local frontend edits (current), using the same frozen production builds and fixtures as the timing benchmark. Values are medians of per-interaction MutationObserver counts across all sessions; counts were deterministic (min = max) unless a range is shown. This measures DOM work issued per interaction, not user-visible latency; see the timing report for INP and frame pacing.', '');
lines.push(`Sessions: baseline ${groups.baseline.sessions}, current ${groups.current.sessions}; captured browser errors: ${groups.baseline.errors} → ${groups.current.errors}.`, '');
for (const phase of phases) {
  const b = groups.baseline.phases[phase], c = groups.current.phases[phase];
  lines.push(`## ${phase}`, '', `Observations: ${b.observations} → ${c.observations}.`, '', '| Metric | Baseline | Current | Change |', '| --- | ---: | ---: | ---: |');
  for (const [k, label] of keys) {
    const range = s => s.min === s.max ? fmt(s.p50) : `${fmt(s.p50)} (${fmt(s.min)}–${fmt(s.max)})`;
    lines.push(`| ${label} | ${range(b[k])} | ${range(c[k])} | ${pct(b[k].p50, c[k].p50)} |`);
  }
  lines.push('');
}
lines.push('## Definitions', '');
for (const [k, v] of Object.entries(definitions)) lines.push(`- **${k}:** ${v}`);
lines.push('', '## Limits', '', '- Counts include every attribute set during the settle window, including sets whose value did not change and unrelated React updates (for example the connection line and status polling).', '- Equal React commit counts mean the change did not alter React rendering; the difference is in D3 work per commit.', '- These are lab counts on fixed fixtures (two 2,000-point plots, 800 attack samples) and do not describe production usage.');
fs.writeFileSync(path.join(path.dirname(file), 'REPORT.md'), lines.join('\n') + '\n');
console.log('wrote', path.join(path.dirname(file), 'REPORT.md'));
