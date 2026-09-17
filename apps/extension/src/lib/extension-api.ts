import type { Browser } from "wxt/browser";

/**
 * Unified extension namespace for popup + background.
 *
 * The codebase splits extension APIs: popup/storage/sync/bookmarks use
 * promise-style `chrome.*`, background.ts uses `browser.*`. On Firefox the
 * `chrome.*` promise surface is unreliable, so every migrated caller goes
 * through `ext`, which prefers the `browser` namespace when present and
 * falls back to `chrome`.
 *
 * Why `typeof Browser` (from wxt/browser) and not `typeof chrome`: the
 * project's minimal chrome.d.ts only declares the popup/storage subset.
 * background.ts needs the full surface (contextMenus parentId,
 * runtime.onStartup/getURL, tabs.onUpdated/onActivated/onRemoved, windows)
 * that WXT's generated `browser` global had — the full chrome-derived type
 * keeps `ext` honest without depending on @types/chrome. The cast is safe
 * at runtime: Firefox defines the full `browser` global in every extension
 * context, and Chrome provides the same surface as `chrome`.
 *
 * Coverage (at minimum): storage.local (get/set/remove + onChanged),
 * tabs (query/get/captureVisibleTab), bookmarks (getTree), runtime
 * (id/lastError/getURL + onInstalled/onStartup), windows (create),
 * contextMenus, permissions, commands, action/badge (setBadgeText /
 * setBadgeBackgroundColor). Exporting the whole namespace keeps the
 * migration mechanical (no behavior change) and future callers covered.
 *
 * Other owners migrate src/lib/storage.ts, src/hooks/use-cross-tab-sync.ts
 * and src/services/bookmarks-html.ts next — those files intentionally keep
 * their direct `chrome.*` uses for now.
 */

const scope = globalThis as unknown as {
	browser?: typeof Browser;
	chrome?: typeof Browser;
};

export const ext: typeof Browser =
	scope.browser ?? (scope.chrome as typeof Browser);
