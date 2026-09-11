#!/usr/bin/env python3
"""Create a static figure from the saved summary; never run during timed trials."""
import json
from pathlib import Path
import sys

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

source = Path(sys.argv[1]).resolve()
data = json.loads(source.read_text())
fig, axes = plt.subplots(2, 2, figsize=(10, 7.3))
colors = ['#60666D', '#087F8C']
for col, profile in enumerate(['native', 'constrained']):
    group = data['groups'][profile]
    trials = {v: sorted([r for r in data['runs'] if r['profile'] == profile and r['variant'] == v], key=lambda r: r['repetition']) for v in ['baseline', 'current']}
    for row, metric in enumerate(['inp', 'modelSwitchMs']):
        ax = axes[row, col]
        get = (lambda r: r['inp']) if metric == 'inp' else (lambda r: r['modelSwitchMs']['p50'])
        for before, after in zip(trials['baseline'], trials['current']):
            ax.plot([0, 1], [get(before), get(after)], color='#C2C7CC', linewidth=1, zorder=1)
        for idx, variant in enumerate(['baseline', 'current']):
            values = [get(r) for r in trials[variant]]
            ax.scatter([idx] * len(values), values, s=30, color=colors[idx], label=variant.title(), zorder=2)
        title = 'INP per scripted session' if metric == 'inp' else 'Median model-switch readiness per session'
        ax.set_title(title, fontsize=10, loc='left', pad=10)
        ax.set_xticks([0, 1], ['Committed baseline', 'Existing local changes'])
        ax.set_xlim(-.3, 1.3)
        ax.set_ylim(bottom=0)
        ax.set_ylabel('Latency (ms)' if metric == 'inp' else 'Input-to-ready proxy (ms)')
        ax.set_xlabel('Frontend version')
        ax.grid(axis='y', alpha=.2)
        ax.spines[['top', 'right']].set_visible(False)
    profile_label = 'Native desktop' if profile == 'native' else '4× CPU / 10 Mbps / 40 ms configured latency'
    axes[0, col].text(0, 1.20, profile_label, transform=axes[0, col].transAxes, fontsize=11, fontweight='bold')
fig.suptitle('MUC: paired frontend benchmark', fontsize=16, x=.08, ha='left', y=.995)
fig.text(.08, .02, 'Source: saved Chromium traces and Web Vitals observations · 2026-09-11 · 10 paired sessions per condition\nLines connect matched trials. Headless lab results on Apple M1; no production-user performance claim.', fontsize=9, color='#454A50')
fig.tight_layout(rect=[.035, .08, .995, .95], h_pad=2.2)
target = source.parent / 'benchmark-overview.png'
fig.savefig(target, dpi=180)
print(target)
