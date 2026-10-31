# Architecture

Local-only MV3 extension. No backend, accounts, billing, sync. What follows is the repo as built, not the SaaS target.

## Stack

- Runtime: React 19.2 + TypeScript 5.9, Zustand 5 (all state), motion 13 (animation), Base UI 1.6 + shadcn-style primitives (`@klice-start/ui`), Tailwind 4, sonner toasts, lucide icons.
- Build: WXT 0.20 + Vite, `@wxt-dev/module-react`. Manifest V3, `manifest.version 1.3.0`.
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

`storage, activeTab, tabs, contextMenus, bookmarks, webNavigation`; host `http/https`; optional `<all_urls>` (`thumbnail-permission.ts` — requested synchronously inside a refresh/Settings click so the browser's native prompt opens in the same gesture; after granting, the operation continues, and refusal/existing grants get distinct messages with no repeated prompts); `Alt+Shift+D` save command; Firefox gecko id pinned. No remote code, no eval; content scripts minimal by design.

## Screenshot capture path

Popup or auto-capture → `background.ts` queue (URL-canonicalized, 1600 ms settle + user delay, 10 s cooldown, pending→in-flight maps) → one shared rate-limited capture lane (1500 ms spacing incl. rejected attempts) → capture → downscale → IDB `thumbnails` → card `thumbId`. Failures degrade to favicon/gradient, never blank.

## Manual preview refresh and selection

Manual single/batch refresh keeps its queue in `chrome.storage.session`. A matching already-active page can be captured without opening or activating another surface. Otherwise the queue picks a per-browser capture backend: Chrome drives a reused 800×600 normal window (`focused:false`, inert `capture.html#token` anchor tab) — targets load inactive, only the target tab activates per shot, and capture is `captureVisibleTab` on that window. Firefox instead keeps two inactive tabs in the user's own window (anchor + target) and photographs them with `tabs.captureTab`, so no secondary window ever appears. Both backends store an ownership token + anchor tab id; windows are adopted or closed only when that anchor is still present with the exact token, so the dashboard and user tabs are never removed by capture cleanup.

Pending-tab identity is separate from progress metadata; navigation/activation revisions and card URL/thumbnail identity guard the capture. Recent activity, not total batch duration, controls crash staleness.

Focus restoration (Chrome only) is best-effort and honors the currently focused window; some browser/window-manager combinations may still briefly focus a newly created window. Minimized/offscreen rendering is not relied on — Chromium ignores `state: minimized` on create and Firefox restores it, so fidelity always wins over invisibility. The shared storage write chain is **per context**, not a cross-context transaction: reset generations prevent old captures being promoted after reset, but `storage.local` has no compare-and-swap for whole-envelope writes.

Selection is session-only and keyed by item IDs with source-folder metadata. Marquee geometry only discovers crossings; crossed membership survives scroll and is committed independently of viewport rectangles. Cards expose sibling Base UI checkboxes with beUI Motion styling (20×20 px visual control, 32×32 px expanded hit area, shared press spring and draw-on checkmark), so selecting never nests a control inside a navigation link. Refreshing a selection expands folders recursively first (`expandSelectionToCards`): a selected folder batches its whole subtree, deduplicated by card id, and the tray's refresh entry counts the expanded targets — the large-batch confirm (>20) lives once in `startBatchRefresh`, which every entry path funnels through.

Refresh feedback uses a single neutral skeleton shimmer on the worker's active card: a clipped, linear 1800 ms sweep, no secondary card spinner, and a static surface under reduced motion. Queued cards only have a status label. The previous decoded thumbnail stays opaque beneath the incoming image until its 220 ms opacity transition finishes; unreadable replacements preserve it. Local decoding remains `aria-busy` but does not start another shimmer after the worker advances to the next card.

## Corner scale

One preference drives three coordinate systems, so every radius in the product moves together. `tokens.css` declares the `--shape-*` variables (a Chromium radius plus its calibrated Gecko fallback for corner-shape: squircle), and `packages/ui` shape roles consume them: panel, section, surface, card, control, thumbnail and pill. It also remaps `--radius` per tier, which is the base of the Tailwind/shadcn `rounded-sm…4xl` ladder — dropdown menus, context menus, dialogs, inputs, selects and popovers in `packages/ui` therefore follow the preference without per-component overrides. Settings → Appearance writes `cornerScale` ("discreet"/"soft"/"rounded", default "soft" = shipped geometry) to storage; the appearance provider mirrors it as `[data-klice-corner]` on the document root for instant live preview. Bookmark and folder cards read `--shape-card`, subfolder preview mini-tiles read `--shape-thumb`, the workspace frame reads the panel token, and the `select`/`input` squircle pairings derive their Gecko fallback from `--radius` so both engines stay proportional at every tier.

Deliberately outside the scale (intentional geometry): toolbar surfaces and controls are always true capsules (`--klice-toolbar-radius`), icon-mode tiles keep the Home-Screen squircle (`--icon-radius`), and micro details inside thumbnails (favicons) plus circles stay fixed.

The resting search field is the only intentional exception to the role/fallback pairing: it uses `--shape-search-collapsed` (12/22/28px, tracking the section step), one engine-identical value per tier. At Rounded its 28px is exactly half of the 56px field height, and the search surface opts out of the squircle curvature (`.klice-search-surface` sets `corner-shape: round`), so it renders true circular capsule ends instead of a squircle-cornered rectangle; the lower tiers keep the squircle curvature and read as progressively squarer fields. The expanded results surface is not its own geometry — it resolves to the regular `surface` role (`--shape-surface` / `--shape-surface-fallback`), one step below the field's section step, so focus always reduces the radius instead of keeping the capsule step on a large container (Chromium 22→18, 12→10, 28→24). In Gecko it reads the calibrated fallback (11/6/14px) instead of the raw Chromium radius, which otherwise looked excessive. Both search states share the Rounded opt-out so the curvature cannot pop while the container opens. Only the resting field and the toolbar are ever full-rounded. Both morph endpoints must stay finite — `rounded-full` serializes to `3.40282e38px` and cannot interpolate, so the surface would hold one shape through the whole open transition and snap to the other at the end. With finite endpoints, height and border-radius interpolate on the same 160 ms timeline; the radius shrinks as the container grows and returns on close, in both engines (in Gecko to the surface fallback). The shared `GlassSurface` entry point keys its LiquidGlass lens on the corner tier, so a live tier change re-measures the resting surface instead of leaving a stale refraction map.

## What is NOT here (SaaS target, unimplemented)

Sync, auth, billing/entitlements, multi-device, AI, dashboard write-parity, RLS/schema beyond the empty scaffold. `bts.jsonc`: `auth:none payments:none api:none backend:self dbSetup:supabase database:postgres orm:drizzle frontend:[next]`.
