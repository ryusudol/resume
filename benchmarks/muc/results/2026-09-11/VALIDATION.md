# Validation

- Both isolated production builds compiled successfully with TypeScript checking. ESLint build integration was disabled identically because of isolated dependency resolution; no lint success is claimed.
- All 40 final browser sessions completed their workload assertions with zero captured browser errors or HTTP error responses.
- All 280 custom readiness observations matched exactly one Event Timing pointerdown entry; 200 observations are model-B switches.
- Four metric-analysis unit tests passed, covering missing observations, sparse frame samples, Chrome frame deduplication/classification, and paired bootstrap behavior.
- Representative embedding and attack screenshots were visually inspected; both charts and real data rendered. The paired-trial figure was also inspected.
- Every current frontend source hash still matches the pre-benchmark snapshot. No MUC application code or resume content was edited by this task.
- Constrained panning has insufficient rAF intervals for a p95 comparison; that aggregate is excluded, with raw observations and trace diagnostics preserved.

The archived runtime scripts are those used for collection. Final analysis adds Event Timing alignment and the documented sparse-frame eligibility rule; it does not modify raw observations. The evidence hash index covers both raw evidence and final derived files.
