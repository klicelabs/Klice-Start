import type { Setup } from "../types";

/**
 * Read-fast localStorage mirror of the display-affecting flags.
 *
 * Same class of bug as the wallpaper flash: React mounts with store
 * defaults (clock/date/greeting/quick-links/search visible, card tiles),
 * then chrome.storage.local.get resolves and Zustand rehydrates → widgets
 * visibly swap. Seeding the store before createRoot().render() makes the
 * first render already reflect the user's choices.
 *
 * Flag enumeration (verified in code; boot-deterministic or non-gating
 * state is deliberately excluded — see the report):
 *   INCLUDED (9): settings.clock.enabled, settings.clock.dateEnabled,
 *     settings.clock.showSeconds, settings.clock.format24,
 *     settings.greeting.enabled, settings.greeting.name,
 *     settings.quickLinks.enabled, settings.dialLayout,
 *     settings.search.enabled.
 *   EXCLUDED: restMode (local useState, always false at boot), settings
 *     panel phase (motion store, always "closed"), activeFolderId (needs
 *     card data to be meaningful — known gap), background.* (wallpaper
 *     shim's territory), theme knobs (don't gate rendering), sizes and
 *     continuous styling (no show/hide swap), session-only UI state
 *     (selection/rename/history/dialogs — deterministic at boot).
 *
 * Contract: chrome.storage.local is the source of truth. The mirror is
 * written on the same tick as the coalesced chrome write (_doWrite) and
 * consumed once before the first render. Storage wins on divergence.
 */
export const FIRST_PAINT_SNAPSHOT_KEY = "first-paint-snapshot";

export interface FirstPaintSnapshot {
	clockEnabled: boolean;
	clockShowSeconds: boolean;
	clockFormat24: boolean;
	dateEnabled: boolean;
	greetingEnabled: boolean;
	greetingText: string;
	quickLinksVisible: boolean;
	displayMode: "card" | "icon";
	searchBarVisible: boolean;
}

/** Derive the mirror value from live state. Flat — one level, nine fields. */
export function snapshotFromSetup(state: Setup): FirstPaintSnapshot {
	const settings = state.settings;
	return {
		clockEnabled: settings.clock.enabled,
		clockShowSeconds: settings.clock.showSeconds,
		clockFormat24: settings.clock.format24,
		dateEnabled: settings.clock.dateEnabled,
		greetingEnabled: settings.greeting.enabled,
		greetingText: settings.greeting.name,
		quickLinksVisible: settings.quickLinks.enabled,
		displayMode: settings.dialLayout,
		searchBarVisible: settings.search.enabled,
	};
}

/** Best-effort write. Never throws — it must not break the real persist write. */
export function writeFirstPaintSnapshot(state: Setup): void {
	try {
		if (typeof localStorage === "undefined") return;
		localStorage.setItem(
			FIRST_PAINT_SNAPSHOT_KEY,
			JSON.stringify(snapshotFromSetup(state)),
		);
	} catch {
		// Mirror is best-effort only.
	}
}
