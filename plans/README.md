# Implementation plans

| # | Plan | Severity | Status |
| --- | --- | --- | --- |
| 001 | [Measure and tune Liquid Glass without visual drift](001-liquid-glass-performance.md) | HIGH | PLANNED |

## Recommended order

1. Phase 0: create and validate the benchmark harness; do not change application source.
2. Phase 1: coalesce the slider stream only if the baseline selects it.
3. Phase 2A, then 2B: split and migrate appearance subscriptions; run a phase-wide validator after both.
4. Phase 3A, then 3B: release the closed Settings subtree, then conditionally convert the measured Settings Motion path.
5. Phase 4: gate unsupported Firefox displacement-map work.
6. Phase 5: triage dense filters, the full-viewport background filter, layout animations, and clip paths. Make no speculative visual simplification.
7. Run final integration checks, rebuild Chrome and Firefox, and complete the Impeccable/Emil visual review.

Every source sub-phase has a disjoint implementer scope, an immediately following validator, and a same-matrix benchmark after any meaningful optimization. Multi-sub-phase phases also require a phase-wide validator.

