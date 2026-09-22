# Diagnostic bench tooling

These scripts are diagnostic harnesses, not product tests.

- Run only against a clean production build (`bun run build` → `.output/chrome-mv3`).
- Not part of CI. Not run on merge. Not maintained as a test suite.
- Outputs go to `results/*.json` (gitignored, regenerable).
- Throwaway branches prefixed `perf/probe-*` are never merged. They exist to test a hypothesis and are discarded.
- See `docs/perf/diagnosis.md` for the decision record and `docs/perf/appendix.md` for methodology and reproduction commands.
