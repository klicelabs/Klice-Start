# Diagnostic bench tooling

These scripts are diagnostic harnesses, not product tests.

- Run only against a clean production build (`bun run build` → `.output/chrome-mv3`).
- Not part of CI. Not run on merge. Not maintained as a test suite.
- Outputs go to `results/*.json` (gitignored, regenerable).
- Throwaway branches prefixed `perf/probe-*` are never merged. They exist to test a hypothesis and are discarded.
- See `docs/perf/diagnosis.md` for the decision record and `docs/perf/appendix.md` for methodology and reproduction commands.

## Icon resolution probes

- `probe-icon-sources.ts` — runs the PRODUCTION resolver (`src/lib/icon-resolver.ts`) against live sites and prints the asset each domain resolves to: source, URL, decoded size, edge-alpha ratio and treatment (app tile vs glyph). It is the proof for "which icon did this domain actually get".
- `probe-image-metrics.ts` — the offline decoder behind it: bun has no canvas, so the browser's fetch→blob→canvas 32×32 edge-ring measurement is reproduced by decoding the PNG bytes directly (node:zlib inflate + PNG unfilter).

Run: `cd apps/extension && bun run scripts/probe-icon-sources.ts`
