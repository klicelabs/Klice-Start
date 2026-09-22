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

/**
 * Per-field parse: keeps every valid field, drops every invalid one.
 * A missing field is not an error — the patch below falls back to that
 * field's live store value (which is the store default at seed time), so
 * a partial snapshot can never zero out state it doesn't cover.
 */
export function parseFirstPaintSnapshot(
	value: unknown,
): Partial<FirstPaintSnapshot> {
	if (!value || typeof value !== "object") return {};
	const v = value as Record<string, unknown>;
	const out: Partial<FirstPaintSnapshot> = {};
	if (typeof v.clockEnabled === "boolean") out.clockEnabled = v.clockEnabled;
	if (typeof v.clockShowSeconds === "boolean")
		out.clockShowSeconds = v.clockShowSeconds;
	if (typeof v.clockFormat24 === "boolean") out.clockFormat24 = v.clockFormat24;
	if (typeof v.dateEnabled === "boolean") out.dateEnabled = v.dateEnabled;
	if (typeof v.greetingEnabled === "boolean")
		out.greetingEnabled = v.greetingEnabled;
	if (typeof v.greetingText === "string") out.greetingText = v.greetingText;
	if (typeof v.quickLinksVisible === "boolean")
		out.quickLinksVisible = v.quickLinksVisible;
	if (v.displayMode === "card" || v.displayMode === "icon")
		out.displayMode = v.displayMode;
	if (typeof v.searchBarVisible === "boolean")
		out.searchBarVisible = v.searchBarVisible;
	return out;
}

/**
 * Read: empty (first install) or malformed JSON → null → store defaults.
 * A well-formed object with some bad fields → partial → per-field fallback.
 */
export function readFirstPaintSnapshot(): Partial<FirstPaintSnapshot> | null {
	try {
		if (typeof localStorage === "undefined") return null;
		const raw = localStorage.getItem(FIRST_PAINT_SNAPSHOT_KEY);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
			return null;
		return parseFirstPaintSnapshot(parsed);
	} catch {
		return null;
	}
}

/**
 * Nested patch onto live state. Each flag resolves to snapshot-first,
 * live-state-second — every non-flag field (and every uncovered flag)
 * survives by spread. Pre-mount callers have no subscribers yet, so this
 * produces no commit; it only shapes the first render.
 */
export function snapshotPatch(
	current: Setup,
	snap: Partial<FirstPaintSnapshot>,
): Partial<Setup> {
	const clock = current.settings.clock;
	const greeting = current.settings.greeting;
	const quickLinks = current.settings.quickLinks;
	const search = current.settings.search;
	return {
		settings: {
			...current.settings,
			clock: {
				...clock,
				enabled: snap.clockEnabled ?? clock.enabled,
				showSeconds: snap.clockShowSeconds ?? clock.showSeconds,
				format24: snap.clockFormat24 ?? clock.format24,
				dateEnabled: snap.dateEnabled ?? clock.dateEnabled,
			},
			greeting: {
				...greeting,
				enabled: snap.greetingEnabled ?? greeting.enabled,
				name: snap.greetingText ?? greeting.name,
			},
			quickLinks: {
				...quickLinks,
				enabled: snap.quickLinksVisible ?? quickLinks.enabled,
			},
			dialLayout: snap.displayMode ?? current.settings.dialLayout,
			search: {
				...search,
				enabled: snap.searchBarVisible ?? search.enabled,
			},
		},
	};
}
