# Agent Rules

Klice Start is a local-only MV3 browser dashboard (newtab replacement). React 19.2 + TS 5.9 + WXT 0.20, Zustand 5, Tailwind 4. Manifest 1.2.3. Pre-launch; targets Chrome Web Store + Firefox AMO.

## Stack

React/react-dom 19.2.4, zustand ^5.0.0, motion ^13.2.0, Base UI ^1.6.0, tailwind 4.3.2, typescript 5.9.3, wxt 0.20.27, bun 1.3.13, turbo 2.10.2, Biome (root). No test runner dependency — `bun test` is builtin.

## Commands

Run in `apps/extension/`:

- `bun run dev` — WXT dev, port 5555 strict. `bun run dev:firefox` for Firefox.
- `bun run build` — production build to `.output/`. Rebuild clean (`rm -rf .output`) before any measurement.
- `bun run compile` — `tsc --noEmit`. Must pass before commit.
- `bun test scripts/` — product tests (`bun:test`, ~169). Must pass before commit.
- `bun run zip` — store artifact. `bun run zip:firefox` for AMO.

Run at root: `bun run check` (Biome). There is no `bun run check` or `bun run test` inside `apps/extension` — do not invent them.

## Directory map

- `apps/extension/` — the product. `entrypoints/` (newtab, popup, background worker), `src/` (components, stores, lib, hooks, services, styles), `scripts/` (verify-*.test.ts + bench harnesses).
- `apps/web/` — Next.js (backend/landing target, unused). `apps/fumadocs/` — docs site.
- `packages/ui/` — shared primitives. `packages/db/` — empty Drizzle scaffold. `packages/env/`, `packages/config/` — shared config.
- `docs/` — PRODUCT, ARCHITECTURE, DECISIONS, perf/. Nothing else belongs there.

## Read first

| Question | File |
|---|---|
| What to build / refuse | `docs/PRODUCT.md` |
| How it's built / stored | `docs/ARCHITECTURE.md` |
| Open calls (backend, AI, billing, budget, i18n) | `docs/DECISIONS.md` |
| Perf history and dead hypotheses | `docs/perf/diagnosis.md` |

## Workflow

- Branches: `feat/`, `fix/`, `chore/`, `docs/`, `perf/`, `polish/`, `refactor/`, `probe/`. Throwaway branches (`probe/`, `perf/probe-*`) never merge.
- Conventional Commits in English: `feat|fix|ui|refactor|i18n|chore|docs(<scope>): <description>`. Present tense, <72 chars, no emojis.
- Solo PR flow still applies: branch → commit → `compile` + `test` + `build` → merge → delete branch.
- Keep diffs scoped: product files + docs/ + tests only. Never mix tasks in one branch.

## Release

1. Bump semver in `apps/extension/package.json`.
2. `git tag -a vX.Y.Z -m "..."`.
3. `bun run zip` (+ `:firefox`).
4. Submit CWS + AMO.
5. `git push origin main --tags`.
6. Keep the previous zip for rollback.

## Env traps

- Never run `git repack`, `gc`, or `prune`. If `CODEBUDDY_SAFE_DELETE_ENABLED=1`, deletions route to Recycle Bin and can empty `.git/objects`.
- Builds must run outside any sandbox; the extension loads from `.output/`.
- Origin is `Klice-Start`, not the old fork. No force-push.

## Benchmark scripts

`apps/extension/scripts/bench-*.mjs` are diagnostic tooling — not tests, not CI, not maintained as a suite. See `apps/extension/scripts/README.md`.
