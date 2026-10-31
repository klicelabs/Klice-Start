# Agent Rules

Klice Start is a local-only MV3 browser dashboard (newtab replacement). React 19.2 + TS 5.9 + WXT 0.20, Zustand 5, Tailwind 4. Manifest 1.2.4. Pre-launch; targets Chrome Web Store + Firefox AMO.

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

## Dev output freshness

- At the end of every agent task, ensure both WXT outputs are current: `apps/extension/.output/chrome-mv3` and `apps/extension/.output/chrome-mv3-dev`.
- Refresh production output with `bun run build` from `apps/extension/`. Refresh dev output with `bun run dev` from the same directory, wait for its successful build, and let its watcher rebuild after source changes.
- Keep the dev server running between tasks on strict port 5555; if it is stopped, start it hidden and wait for the initial build. Leave it running when the task ends. Both directories are generated, ignored, and must not be committed. The separate legacy-looking `apps/extension/dev/.output` is not produced by these commands.

## Directory map

- `apps/extension/` — the product. `entrypoints/` (newtab, popup, background worker), `src/` (components, stores, lib, hooks, services, styles), `scripts/` (verify-*.test.ts + bench harnesses).
- `apps/web/` — Next.js (backend/landing target, unused). `apps/fumadocs/` — docs site.
- `packages/ui/` — shared primitives. `packages/db/` — empty Drizzle scaffold. `packages/env/`, `packages/config/` — shared config.
- `docs/` — PRODUCT, ARCHITECTURE, DECISIONS, perf/. Nothing else belongs there.

## Docs

Reference, not required reading. Consult on demand.

| Question | File |
|---|---|
| What is this product? Vision, principles, requirements, tone | `docs/PRODUCT.md` |
| Stack, data model, storage, MV3 specifics | `docs/ARCHITECTURE.md` |
| Open decisions (backend, AI, billing, budget, i18n) | `docs/DECISIONS.md` |
| Performance history and constraints | `docs/perf/diagnosis.md` |

## Workflow

- After every code update, run `bun test scripts/` and `bun run compile` from `apps/extension/` before reporting the task complete. Refresh both Chrome outputs after the update: run `bun run build`, then ensure `bun run dev` has successfully rebuilt `chrome-mv3-dev` and leave the dev server running on port 5555. If a check fails, report the failure and do not claim validation passed.
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
