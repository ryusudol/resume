# Machine Unlearning Comparator: DOM writes per interaction

Measured 2026-09-11T21:16:30.669Z. 5 sessions per version, alternating order; 20 hover pairs and 20 drag steps per session; 200 ms settle after each interaction. Chromium 151.0.7922.34, Apple M1, darwin 25.6.0, headless.

The comparison is the committed frontend (baseline) versus the pre-existing local frontend edits (current), using the same frozen production builds and fixtures as the timing benchmark. Values are medians of per-interaction MutationObserver counts across all sessions; counts were deterministic (min = max) unless a range is shown. This measures DOM work issued per interaction, not user-visible latency; see the timing report for INP and frame pacing.

Sessions: baseline 5, current 5; captured browser errors: 0 → 0.

## embedding-hover-enter

Observations: 100 → 100.

| Metric | Baseline | Current | Change |
| --- | ---: | ---: | ---: |
| Attribute writes | 5 | 5 | 0% |
| of which style | 5 | 5 | 0% |
| Child-list records | 5 | 5 | 0% |
| Nodes added | 3 | 3 | 0% |
| Nodes removed | 2 | 2 | 0% |
| React commits | 1 | 1 | 0% |

## embedding-hover-leave

Observations: 100 → 100.

| Metric | Baseline | Current | Change |
| --- | ---: | ---: | ---: |
| Attribute writes | 4 | 4 | 0% |
| of which style | 4 | 4 | 0% |
| Child-list records | 1 | 1 | 0% |
| Nodes added | 0 | 0 | – |
| Nodes removed | 1 | 1 | 0% |
| React commits | 1 | 1 | 0% |

## embedding-highlight-Target to Forget

Observations: 5 → 5.

| Metric | Baseline | Current | Change |
| --- | ---: | ---: | ---: |
| Attribute writes | 22,421 | 7,221 | -68% |
| of which style | 7,208 | 7,208 | 0% |
| Child-list records | 3 | 3 | 0% |
| Nodes added | 2 | 2 | 0% |
| Nodes removed | 1 | 1 | 0% |
| React commits | 10 | 10 | 0% |

## embedding-highlight-All

Observations: 5 → 5.

| Metric | Baseline | Current | Change |
| --- | ---: | ---: | ---: |
| Attribute writes | 22,422 | 7,222 | -68% |
| of which style | 7,208 | 7,208 | 0% |
| Child-list records | 3 | 3 | 0% |
| Nodes added | 2 | 2 | 0% |
| Nodes removed | 1 | 1 | 0% |
| React commits | 10 | 10 | 0% |

## model-switch-B-d641

Observations: 5 → 5.

| Metric | Baseline | Current | Change |
| --- | ---: | ---: | ---: |
| Attribute writes | 34,662 | 11,862 (11,862–11,900) | -66% |
| of which style | 366 | 366 | 0% |
| Child-list records | 1,069 | 1,069 | 0% |
| Nodes added | 1,016 | 1,016 | 0% |
| Nodes removed | 57 | 57 | 0% |
| React commits | 42 | 42 (42–43) | 0% |

## model-switch-A-a000

Observations: 5 → 5.

| Metric | Baseline | Current | Change |
| --- | ---: | ---: | ---: |
| Attribute writes | 34,843 | 12,043 (12,043–12,083) | -65% |
| of which style | 480 | 480 | 0% |
| Child-list records | 1,058 | 1,058 | 0% |
| Nodes added | 1,006 | 1,006 | 0% |
| Nodes removed | 56 | 56 | 0% |
| React commits | 40 | 40 | 0% |

## attack-hover-enter

Observations: 100 → 100.

| Metric | Baseline | Current | Change |
| --- | ---: | ---: | ---: |
| Attribute writes | 5,773 (0–5,773) | 1,212 (0–1,212) | -79% |
| of which style | 410 (0–410) | 400 (0–400) | -2% |
| Child-list records | 1,133 (0–1,133) | 8 (0–8) | -99% |
| Nodes added | 588 (0–588) | 6 (0–6) | -99% |
| Nodes removed | 545 (0–545) | 2 (0–2) | -100% |
| React commits | 2 (0–2) | 1 | -50% |

## attack-hover-leave

Observations: 100 → 100.

| Metric | Baseline | Current | Change |
| --- | ---: | ---: | ---: |
| Attribute writes | 5,759 (0–5,759) | 1,198 (0–1,198) | -79% |
| of which style | 408 (0–408) | 398 (0–398) | -2% |
| Child-list records | 1,127 (0–1,127) | 2 (0–2) | -100% |
| Nodes added | 582 (0–582) | 0 | -100% |
| Nodes removed | 545 (0–545) | 2 (0–2) | -100% |
| React commits | 2 (0–2) | 1 (0–1) | -50% |

## attack-threshold-drag-step

Observations: 100 → 100.

| Metric | Baseline | Current | Change |
| --- | ---: | ---: | ---: |
| Attribute writes | 5,566 (2–5,777) | 1,046 (2–1,257) | -81% |
| of which style | 12 (0–24) | 2 (0–14) | -83% |
| Child-list records | 1,125 (0–1,131) | 14 (0–20) | -99% |
| Nodes added | 582 (0–585) | 11 (0–14) | -98% |
| Nodes removed | 543 (0–546) | 11 (0–14) | -98% |
| React commits | 2 (0–2) | 2 (0–2) | 0% |

## Definitions

- **attributeWrites:** MutationObserver attribute records in the whole document during the interaction plus a settle window; setAttribute with an unchanged value still produces a record
- **styleWrites:** Subset of attributeWrites where attributeName is style
- **childListRecords:** MutationObserver childList records; nodesAdded/nodesRemoved count nodes in those records
- **reactCommits:** onCommitFiberRoot calls across all React roots

## Limits

- Counts include every attribute set during the settle window, including sets whose value did not change and unrelated React updates (for example the connection line and status polling).
- Equal React commit counts mean the change did not alter React rendering; the difference is in D3 work per commit.
- These are lab counts on fixed fixtures (two 2,000-point plots, 800 attack samples) and do not describe production usage.
