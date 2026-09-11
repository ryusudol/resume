# Machine Unlearning Comparator: frontend benchmark

Measured 2026-09-11T18:58:21.539Z. Source commit: `0e3ce99d1000adc416b9f63ea3113ede97e63da9`.

The comparison is the committed frontend versus the existing local frontend edits. No application optimization was added during this benchmark. Results are synthetic lab measurements on fixed repository data, not production-user metrics.

Environment: Apple M1, 16 GiB RAM, darwin 25.6.0, Chromium 151.0.7922.34, headless, 1920 x 1200 viewport, device scale factor 1.

Both versions render two 2,000-point embedding plots and two 400-sample privacy comparisons. Production assets use gzip and a frozen copy of the production font. API responses replay real repository JSON, without model training. HTTP cache and session storage start fresh in every trial.

The strongest repeatable improvement is interaction responsiveness. Loading time and payload size do not show a meaningful improvement. Continuous-interaction results depend on the gesture; constrained panning still produces heavy stalls in both versions.

[Paired trial chart](benchmark-overview.png)

## Native desktop

10 baseline sessions and 10 current sessions; alternating execution order within pairs. Values below show baseline → current.

- **INP, p75 of lab sessions:** 120 → 88 ms (26.7% lower).
- **LCP, p75 of lab sessions:** 144 → 148 ms (2.8% higher). This is the initial header/dialog, not the fully populated dashboard.
- **FCP, p75:** 144 → 148 ms.
- **CLS, p75:** 0.000 → 0.000.
- **Initial data ready after APPLY, p75:** 271.9 → 264.4 ms.
- **Model-B switch readiness, p50:** 110.5 → 63.6 ms (42.4% lower).
- **Model-B switch readiness, p95:** 124.6 → 85.2 ms (31.6% lower), from 50 and 50 switches respectively. This is a readiness/paint proxy, not INP.
- **Captured browser errors:** 0 → 0.

### Repeatability

- inpMs: median paired improvement 32.0 ms; 95% paired-bootstrap interval [16.0, 32.0] ms. Positive values favor current.
- lcpMs: median paired improvement 0.0 ms; 95% paired-bootstrap interval [-8.0, 8.0] ms. Positive values favor current.
- initialDataReadyMs: median paired improvement -0.8 ms; 95% paired-bootstrap interval [-58.7, 15.8] ms. Positive values favor current.
- medianModelSwitchMs: median paired improvement 47.3 ms; 95% paired-bootstrap interval [43.8, 48.8] ms. Positive values favor current.

These intervals summarize this small paired lab sample. An interval crossing zero is not persuasive evidence of a directional improvement.

### Continuous interactions

**embedding-hover**

- Median of per-run p95 animation-frame intervals: 17.3 → 17.2 ms (10 and 10 eligible trials).
- Observed animation-frame intervals per trial, min–max: 125–126 → 125–126. Trials need at least 20 intervals for the p95 comparison.
- Fully dropped Chrome frames: 6/1207 (0.5%) → 3/1208 (0.2%).
- Partially presented Chrome frames: 0/1207 (0.0%) → 0/1208 (0.0%).
- Median long-animation-frame count per run: 0 → 0.

**embedding-zoom**

- Median of per-run p95 animation-frame intervals: 17.5 → 17.5 ms (10 and 10 eligible trials).
- Observed animation-frame intervals per trial, min–max: 126–127 → 123–127. Trials need at least 20 intervals for the p95 comparison.
- Fully dropped Chrome frames: 1/1130 (0.1%) → 0/1169 (0.0%).
- Partially presented Chrome frames: 224/1130 (19.8%) → 252/1169 (21.6%).
- Median long-animation-frame count per run: 0 → 0.

**embedding-pan**

- Median of per-run p95 animation-frame intervals: 17.4 → 17.5 ms (10 and 10 eligible trials).
- Observed animation-frame intervals per trial, min–max: 124–127 → 121–126. Trials need at least 20 intervals for the p95 comparison.
- Fully dropped Chrome frames: 0/1213 (0.0%) → 0/1208 (0.0%).
- Partially presented Chrome frames: 71/1213 (5.9%) → 61/1208 (5.0%).
- Median long-animation-frame count per run: 0 → 0.

**attack-hover**

- Median of per-run p95 animation-frame intervals: 33.4 → 33.4 ms (10 and 10 eligible trials).
- Observed animation-frame intervals per trial, min–max: 85–102 → 86–110. Trials need at least 20 intervals for the p95 comparison.
- Fully dropped Chrome frames: 291/1211 (24.0%) → 242/1184 (20.4%).
- Partially presented Chrome frames: 37/1211 (3.1%) → 49/1184 (4.1%).
- Median long-animation-frame count per run: 0 → 0.

**attack-threshold-drag**

- Median of per-run p95 animation-frame intervals: 17.3 → 17.2 ms (10 and 10 eligible trials).
- Observed animation-frame intervals per trial, min–max: 125–126 → 125–126. Trials need at least 20 intervals for the p95 comparison.
- Fully dropped Chrome frames: 0/595 (0.0%) → 0/598 (0.0%).
- Partially presented Chrome frames: 5/595 (0.8%) → 0/598 (0.0%).
- Median long-animation-frame count per run: 0 → 0.

### Network

- Initial page HTTP requests, median: 8 → 8.
- Initial page encoded transfer, median: 498.0 → 498.8 KiB.
- Initial data-load HTTP requests, median: 9 → 9.
- Initial data-load encoded transfer, median: 1478.5 → 1478.5 KiB.
- Whole scripted session HTTP requests, median: 32 → 32.
- Whole scripted session encoded transfer, median: 4711.3 → 4712.1 KiB.

## Constrained desktop: 4x CPU slowdown, 40 ms latency, 10 Mbps download

10 baseline sessions and 10 current sessions; alternating execution order within pairs. Values below show baseline → current.

- **INP, p75 of lab sessions:** 288 → 200 ms (30.6% lower).
- **LCP, p75 of lab sessions:** 608 → 596 ms (2.0% lower). This is the initial header/dialog, not the fully populated dashboard.
- **FCP, p75:** 608 → 596 ms.
- **CLS, p75:** 0.004 → 0.004.
- **Initial data ready after APPLY, p75:** 1873.9 → 1876.1 ms.
- **Model-B switch readiness, p50:** 710.1 → 522.3 ms (26.4% lower).
- **Model-B switch readiness, p95:** 752.5 → 560.4 ms (25.5% lower), from 50 and 50 switches respectively. This is a readiness/paint proxy, not INP.
- **Captured browser errors:** 0 → 0.

### Repeatability

- inpMs: median paired improvement 120.0 ms; 95% paired-bootstrap interval [80.0, 128.0] ms. Positive values favor current.
- lcpMs: median paired improvement 4.0 ms; 95% paired-bootstrap interval [0.0, 8.0] ms. Positive values favor current.
- initialDataReadyMs: median paired improvement -10.1 ms; 95% paired-bootstrap interval [-26.8, 14.0] ms. Positive values favor current.
- medianModelSwitchMs: median paired improvement 189.7 ms; 95% paired-bootstrap interval [171.3, 203.1] ms. Positive values favor current.

These intervals summarize this small paired lab sample. An interval crossing zero is not persuasive evidence of a directional improvement.

### Continuous interactions

**embedding-hover**

- Median of per-run p95 animation-frame intervals: 67.4 → 66.8 ms (10 and 10 eligible trials).
- Observed animation-frame intervals per trial, min–max: 41–50 → 39–51. Trials need at least 20 intervals for the p95 comparison.
- Fully dropped Chrome frames: 6/1225 (0.5%) → 9/1239 (0.7%).
- Partially presented Chrome frames: 826/1225 (67.4%) → 824/1239 (66.5%).
- Median long-animation-frame count per run: 5 → 4.

**embedding-zoom**

- Median of per-run p95 animation-frame intervals: 117.5 → 132.4 ms (10 and 10 eligible trials).
- Observed animation-frame intervals per trial, min–max: 29–35 → 27–35. Trials need at least 20 intervals for the p95 comparison.
- Fully dropped Chrome frames: 2/1357 (0.1%) → 3/1359 (0.2%).
- Partially presented Chrome frames: 1066/1357 (78.6%) → 1077/1359 (79.2%).
- Median long-animation-frame count per run: 21 → 22.

**embedding-pan**

- Insufficient frame samples for a reliable p95 comparison. The synthetic 60 Hz panning stress caused heavy stalls and partial-frame presentation in both versions.
- Observed animation-frame intervals per trial, min–max: 2–7 → 4–7. Trials need at least 20 intervals for the p95 comparison.
- Fully dropped Chrome frames: 0/1257 (0.0%) → 0/1254 (0.0%).
- Partially presented Chrome frames: 1230/1257 (97.9%) → 1222/1254 (97.4%).
- Median long-animation-frame count per run: 1 → 1.

**attack-hover**

- Median of per-run p95 animation-frame intervals: 67.7 → 34.2 ms (10 and 10 eligible trials).
- Observed animation-frame intervals per trial, min–max: 34–41 → 77–90. Trials need at least 20 intervals for the p95 comparison.
- Fully dropped Chrome frames: 8/1269 (0.6%) → 164/1228 (13.4%).
- Partially presented Chrome frames: 879/1269 (69.3%) → 260/1228 (21.2%).
- Median long-animation-frame count per run: 4 → 1.

**attack-threshold-drag**

- Median of per-run p95 animation-frame intervals: 50.0 → 17.7 ms (10 and 10 eligible trials).
- Observed animation-frame intervals per trial, min–max: 91–104 → 111–122. Trials need at least 20 intervals for the p95 comparison.
- Fully dropped Chrome frames: 3/956 (0.3%) → 3/864 (0.3%).
- Partially presented Chrome frames: 535/956 (56.0%) → 310/864 (35.9%).
- Median long-animation-frame count per run: 13 → 0.

### Network

- Initial page HTTP requests, median: 8 → 8.
- Initial page encoded transfer, median: 498.0 → 498.8 KiB.
- Initial data-load HTTP requests, median: 9 → 9.
- Initial data-load encoded transfer, median: 1478.5 → 1478.5 KiB.
- Whole scripted session HTTP requests, median: 32 → 32.
- Whole scripted session encoded transfer, median: 4711.3 → 4712.1 KiB.

## Production entrypoint sizes

- baseline, `static/css/main.7ce3865f.css`: 38.4 KiB raw, 8.3 KiB gzip, 7.2 KiB Brotli. The server uses gzip; Brotli is an offline size calculation.
- baseline, `static/js/main.e39e5a1b.js`: 988.2 KiB raw, 283.4 KiB gzip, 226.7 KiB Brotli. The server uses gzip; Brotli is an offline size calculation.
- current, `static/css/main.7ce3865f.css`: 38.4 KiB raw, 8.3 KiB gzip, 7.2 KiB Brotli. The server uses gzip; Brotli is an offline size calculation.
- current, `static/js/main.63b5f49d.js`: 991.3 KiB raw, 284.2 KiB gzip, 227.5 KiB Brotli. The server uses gzip; Brotli is an offline size calculation.

## Interpretation for resume wording

Use an improvement only when its metric, workload, comparison, and lab conditions are named. Prefer a repeatable INP or model-switch improvement over a generalized claim about every frontend interaction. Smoothness and loading results must be assessed separately.

Suggested performance bullet: “Optimized React/D3 rendering for 4,000-point model comparisons, reducing lab p75 INP by 27% (120 → 88 ms) across 10 paired Chromium trials.” This attributes the improvement to the recorded local changes; use it only if those changes are your work.

These experiments do not validate the earlier “p95 ≤ 11 ms interaction latency” statement, which had no saved protocol or traces. They also do not measure a migration to Zustand: both versions already use it, so “30% fewer re-renders from Zustand” remains unsupported.

No user-count, production-performance, maximum-capacity, or backend-training claim follows from these results.

## Evidence

- `summary.json`: full aggregated and per-session measurements, source hashes, definitions, and confidence intervals.
- `runs.csv`: one row per session for headline timing metrics.
- `raw/`: original session JSON, Chrome traces, screenshots, and environment metadata.
- `existing-frontend-changes.patch`: exact pre-existing code changes being compared.
- `manifest.json`: source and data SHA-256 identifiers.
- `measurement-harness/`: runtime scripts and dependency lock used for this measurement, plus the final analysis scripts.
- `frozen-runtime/`: both production builds, real API fixtures, and frozen fonts for reruns.
- `evidence-sha256.json`: integrity hashes for the saved evidence and derived artifacts.
- The parent benchmark README documents setup, workload, percentiles, trace classification, and limitations.
