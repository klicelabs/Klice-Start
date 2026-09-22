# Architecture

Local-only MV3 extension. No backend, accounts, billing, sync. What follows is the repo as built, not the SaaS target.

## Stack

- Runtime: React 19.2 + TypeScript 5.9, Zustand 5 (all state), motion 13 (animation), Base UI 1.6 + shadcn-style primitives (`@klice-start/ui`), Tailwind 4, sonner toasts, lucide icons.
- Build: WXT 0.20 + Vite, `@wxt-dev/module-react`. Manifest V3, `manifest.version 1.2.3`.
- Dev: `bun run dev` (WXT port 5555, strict). Typecheck: `bun run compile` (`tsc --noEmit`). Tests: `bun test scripts/` (bun:test, ~169). Lint/format: Biome via root `bun run check`.
- Package manager: bun 1.3.13 (workspaces + catalog). Turbo orchestrates `apps/*`.

## Monorepo layout

- `apps/extension/` — the product. `entrypoints/` (newtab, popup, background service worker), `src/` (components, stores, lib, hooks, services, styles), `scripts/` (verify-*.test.ts product tests + bench-*.mjs diagnostic harnesses, never CI).
- `apps/web/` — Next.js app (landing/backend target; auth `none`, payments `none` today).
- `apps/fumadocs/` — docs site.
- `packages/ui/` — shared primitives (glass material, motion menus, icons, sidebar, switch).
- `packages/db/` — empty Drizzle/Postgres scaffold (`schema/index.ts` is `export {}`; Supabase configured, unused).
- `packages/env/`, `packages/config/` — shared env/config.

## Entrypoints

- `entrypoints/newtab/` (`main.tsx` → `App.tsx`) — the dashboard. First paint path: `main.tsx` seeds the store from the `localStorage` first-paint mirror, then mounts; wallpaper frame 1 comes from a CSS shim (`wallpaper-snapshot.ts`), storage wins on resolve.
- `entrypoints/popup/` — save-current-page + capture trigger.
- `entrypoints/background.ts` — service worker: thumbnail capture queue (`captureVisibleTab`, pending/in-flight maps, 10 s cooldown), cross-tab envelope reads, reset generation barrier.

## Storage (3 layers)

1. **`chrome.storage.local`, key `perch-setup`** — source of truth. One JSON envelope `{state, __perchResetGeneration}`. Writes coalesced 200 ms (`_doWrite` chain in `src/lib/storage.ts`); quota preflighted at 95% of 10 MiB; own-write echoes consumed so `onChanged` never replays our saves. Flush on `beforeunload`/`pagehide`/hidden.
2. **IndexedDB `perch-db` v1** (`src/lib/idb.ts`) — binary bytes the envelope can't hold: `thumbnails` (card screenshots, `thumbId`), `backgrounds` (custom/pexels images). Orphan sweep runs once per session post-hydration.
3. **Import/export** — `bookmarks-html.ts` (Chromium/Firefox/Vivaldi flavours + fixtures) and `backup.ts` in, envelope JSON out.

Normalization is load-bearing: `normalizeState` repairs folders (orphans→root, cycle-break), cards (dedupe, URL-gated), and backfills `itemOrder`. Corrupt envelopes are quarantined (removed + reported), never absorbed.

## Seam contract

- `useSetupStore` (zustand + persist) owns folders/cards/settings/itemOrder; every structural mutation keeps `itemOrder` in sync atomically (one coalesced write).
- `useImageStore` owns bytes (IDB only, never persisted to chrome.storage).
- Session-only stores (selection, rename, move-dialog, history UI, settings-motion) are never persisted.
- Cross-tab: `storage.onChanged` → echo-consume → `mergeConcurrentSetup` → history invalidation (`use-cross-tab-sync.ts`, `background.ts:284`).
- Reset protocol: generation barrier (`perch-reset-generation`); stale envelopes read as empty; reset cancels pending writes first.

## Permissions & MV3 specifics

`storage, activeTab, tabs, contextMenus, bookmarks`; host `http/https`; optional `<all_urls>` (gated behind explicit thumbnail permission, `thumbnail-permission.ts`); `Alt+Shift+D` save command; Firefox gecko id pinned. No remote code, no eval; content scripts minimal by design.

## Screenshot capture path

Popup or auto-capture → `background.ts` queue (URL-canonicalized, 1200 ms settle, 10 s cooldown, pending→in-flight maps) → `captureVisibleTab` (the only capture API — no iframe/offscreen workarounds) → downscale → IDB `thumbnails` → card `thumbId`. Failures degrade to favicon/gradient, never blank.

## What is NOT here (SaaS target, unimplemented)

Sync, auth, billing/entitlements, multi-device, AI, dashboard write-parity, RLS/schema beyond the empty scaffold. `bts.jsonc`: `auth:none payments:none api:none backend:self dbSetup:supabase database:postgres orm:drizzle frontend:[next]`.
