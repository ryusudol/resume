# MUC frontend benchmark

This harness measures the existing Machine Unlearning Comparator frontend for
resume evidence. It compares the last committed frontend with the pre-existing
local frontend changes. It does not change MUC's application code, train models,
or revise the resume automatically.

## Reproduce

Run from this resume repository with Node.js 20+, Python 3, and the MUC frontend's
dependencies installed in `../projects/Machine-Unlearning-Comparator/frontend`.

```sh
npm --prefix benchmarks/muc ci
npm --prefix benchmarks/muc exec -- playwright-core install chromium
python3 benchmarks/muc/prepare.py
node benchmarks/muc/build.mjs
node benchmarks/muc/run.mjs --smoke --label=pilot
node benchmarks/muc/run.mjs --trace --label=measured
node benchmarks/muc/summarize.mjs
npm --prefix benchmarks/muc test
```

After a successful full run, preserve its evidence outside `.build/`:

```sh
python3 benchmarks/muc/archive.py --output benchmarks/muc/results/2026-09-11
node benchmarks/muc/summarize.mjs .build/muc-benchmark/measured benchmarks/muc/results/2026-09-11
node benchmarks/muc/report.mjs benchmarks/muc/results/2026-09-11/summary.json
```

Use a fresh output directory for a later experiment. The archive includes a
`frozen-runtime` directory with the two compiled frontends, API data, and font.
To rerun those exact bundles without rebuilding the source, set
`MUC_BENCH_WORKSPACE` to the absolute path of `frozen-runtime` and run `run.mjs`
with a fresh label. The optional `plot.py summary.json` creates a static figure
and requires Matplotlib; run it after all timed sessions have finished.

`prepare.py` refuses to overwrite existing snapshots. For a new experiment, pass
`--output /absolute/path/to/new-workspace` to it and set `MUC_BENCH_WORKSPACE` to
that same directory for subsequent commands. Use `--source` if MUC lives
elsewhere. `MUC_CHROMIUM` overrides the browser executable, and `MUC_RUNS`
overrides the default 10 paired repetitions per profile. A new label selects a
separate results directory; do not reuse labels for unrelated experiments.

The benchmark serves frontend builds on `127.0.0.1:4173` and `:4174`, and
read-only API fixtures on `127.0.0.1:8000`. These ports must be free. The
frontend's existing localhost API URL is unchanged. The harness shuts down its
servers and browser when finished, including on ordinary test failures.

The first run downloads the production Roboto Condensed font and freezes it
locally. The browser itself is blocked from contacting external HTTPS origins.
Subsequent runs reuse the frozen font. Measurement data stays local.

## Comparison and build conditions

- **Baseline:** frontend files at the Git commit recorded in `manifest.json`.
- **Current:** a snapshot of the working frontend, including local edits already
  present before benchmarking. The original checkout remains unchanged.
- Source hashes and the exact existing frontend patch identify the comparison.
- Both snapshots use the same installed frontend dependencies and production
  compiler. Source maps are disabled in both. ESLint's build plugin is disabled
  because its config resolution fails in the isolated symlinked pnpm layout;
  TypeScript compilation remains enabled. This is not a lint validation run.
- Both builds use the original font, served from a fixed local copy. HTTP asset
  compression is gzip. The API replays compact JSON without compression, matching
  the absence of compression middleware in the inspected backend.
- The payloads are actual repository data: three class-0 experiments, each with
  2,000 embedding points, plus the repository's cached CIFAR-10 sample images.
  API file listings are derived from available fixture JSON filenames, so model
  checkpoints and the PyTorch runtime are not required.

## Profiles and workload

The default run executes 40 fresh-browser-context sessions: 10 paired repetitions
of two versions under each of two conditions. Version order alternates within
pairs. Trials run sequentially in one isolated Chromium browser. The pilot is
separate and excluded from reported results.

- **Native desktop:** no CPU or network throttling; loopback API and assets.
- **Constrained desktop:** 4x DevTools CPU slowdown, 40 ms configured network
  latency, 10 Mbps download, and 1 Mbps upload. This is a synthetic condition,
  not a claim to emulate a particular phone or user's hardware.
- Viewport: 1920 x 1200 CSS pixels, device scale factor 1, headless Chromium.
- Fresh session storage and disabled browser HTTP cache in every trial.
- The browser version, operating system, CPU, and conditions are saved in
  `environment.json`.

Each session:

1. Loads the initial selection dialog and waits for the font and initial paint.
2. Applies the airplane forget class and verifies both 2,000-point plots.
3. Switches model B between retrained and unlearned results five times, checking
   that the bound SVG data actually matches the requested model.
4. Exercises all five embedding highlight modes.
5. Sets model A to retrained and model B to the unlearned model.
6. Exercises embedding hover, wheel zoom, and panning at 60 scheduled input
   events per second for two seconds each.
7. Opens privacy analysis, checks all 800 plotted attack samples, and waits for
   the sample images to load.
8. Exercises attack hover, all four threshold strategies, and threshold dragging;
   verifies that dragging changes the displayed threshold.

Input acknowledgements are not awaited individually during continuous gestures;
the harness records actual dispatch times and waits for all acknowledgements at
the end. The prior hover card is allowed to close before discrete clicks. This
uses normal pointer input rather than programmatically changing application
state. Screenshots are taken outside continuous-interaction windows.

## What the measurements mean

**INP, LCP, FCP, CLS, TTFB:** collected using the pinned official `web-vitals`
5.1.0 library. A reported p75 summarizes the synthetic sessions in one profile.
These are lab measurements, not field Core Web Vitals or production-user
percentiles. This workload's LCP element is saved explicitly; the application
header/dialog can be the LCP rather than its SVG charts.

**Initial data and model-switch readiness:** the raw collector starts a watch in
the pointerdown handler. The summarizer matches that handler to its Event Timing
entry, then measures from the entry's input `startTime` until an animation-frame
callback after both full SVG plots and the selected model's coordinates are
verified. This includes input queuing, API transfer, and frontend work, excluding
the automation's pre-click waits. The end is a custom readiness and paint proxy,
not an exact screen-presentation timestamp or INP. Missing Event Timing matches
are explicitly excluded, never silently replaced with handler timing. Five
model-B switches per trial provide up to 50 observations per version/profile.

**Frame pacing:** animation-frame callback intervals during each continuous
gesture. Compute p95 separately in each trial, then summarize the per-trial
p95 values. This measures main-thread frame pacing; it is not a measurement of
every physical monitor presentation. It is deliberately not called a hover
response-time metric.

A trial needs at least 20 observed intervals to enter a p95 comparison; sparse
trials remain in the raw data and sample counts are reported. This minimum is an
analysis resolution rule, not a precision guarantee. In this experiment every
constrained panning trial had only 2–7 intervals, so its p95 comparison is
excluded. Heavy main-thread stalls can delay the first callback and leave the
observer with only a post-stall tail. Trace frame diagnostics remain available.

**Dropped and partially presented frames:** taken from Chrome's `DrawFrame` and
`DroppedFrame` trace events within the marked gesture and renderer process.
Deduplicate by layer-tree ID and frame sequence ID. Chrome's
`hasPartialUpdate=true` is reported separately, not counted as a fully dropped
frame. A frame reported as both drawn and partial counts once. The denominator
is the union of drawn/dropped frame IDs in that window. These are Chrome trace
diagnostics under headless lab conditions, not real-user dropped-frame rates.

**Long animation frames:** the browser's Long Animation Frames observer records
long frames and their blocking durations. Trace categories and observers are
identical in both versions; their overhead is part of the lab setup.

**Network and bundle size:** CDP encoded transfer bytes include response headers
and compressed bodies where enabled. Request totals count HTTP(S) only, excluding
inline data images. Static entrypoint sizes are also recorded as raw, gzip, and
Brotli bytes; the test server uses gzip, not Brotli.

**Statistics:** nearest-rank percentiles of observed samples. Paired-bootstrap
intervals resample whole baseline/current pairs with a fixed seed. Positive
paired differences indicate an improvement in the current version. With only
10 pairs, these intervals describe local repeatability and cannot establish
results for a production population.

Event Timing values are browser-quantized. Per-action entries below the 16 ms
observer threshold can be absent; missing entries are never treated as zero.

## Evidence and limits

Raw per-session JSON, compressed Chrome traces, screenshots, environment details,
source hashes, and the existing patch allow results to be audited. Open an
unzipped trace JSON in Chrome DevTools Performance to inspect it. Preserve a
results directory outside `.build/` before running the resume's `make clean`.

Do not convert results into an unqualified production claim. In particular:

- A local LCP below 2.5 seconds does not prove production LCP passes.
- A 2,000-point fixture is a tested workload, not a maximum capacity.
- A before/after percentage applies to these two recorded source snapshots.
- Both versions already use Zustand; this comparison cannot establish the old
  claim that migrating to Zustand reduced re-renders by 30%.
- This harness does not measure React render counts, backend training, production
  latency, accessibility compliance, or cross-browser behavior.
- Headless Chromium and fixed local payloads favor reproducibility; validate
  representative real devices and deployed conditions before making user-wide
  claims.

Metric references: [Web Vitals library](https://github.com/GoogleChrome/web-vitals),
[INP](https://web.dev/articles/inp),
[LCP](https://web.dev/articles/lcp),
[rendering performance](https://web.dev/articles/rendering-performance), and
[Chrome Performance tools](https://developer.chrome.com/docs/devtools/performance/reference).

## Follow-up: DOM writes and React commits per interaction

`domwrites.mjs` reruns the two frozen production builds and counts, per
discrete interaction, MutationObserver attribute records, child-list records
(nodes added/removed), and React root commits (via a minimal
`__REACT_DEVTOOLS_GLOBAL_HOOK__` stub that production React calls on every
commit). It is a mechanism measurement of how much DOM work each hover, drag
step, highlight switch, and model switch causes; it is not a timing benchmark,
and observer overhead is identical in both versions.

```sh
MUC_BENCH_WORKSPACE=/abs/path/benchmarks/muc/results/2026-09-11/frozen-runtime \
MUC_BENCH_OUTPUT=/abs/path/benchmarks/muc/results/2026-09-11-dom-writes \
node benchmarks/muc/domwrites.mjs --label=dom-writes --runs=5
```

Each session: APPLY the airplane class, 20 discrete hover enter/leave pairs on
embedding marks, two highlight-mode switches, model B to `d641` and model A to
`a000`, open Attack Simulation (800 circles), 20 attack hover pairs, and a
20-step threshold drag. Each interaction is followed by a 200 ms settle window
(1.5 s for model switches) before the observer is read. `setAttribute` with an
unchanged value still produces a record, so counts measure writes issued, not
pixels changed. Results are in `results/2026-09-11-dom-writes/` with a
`REPORT.md`; counts were identical across repetitions.
