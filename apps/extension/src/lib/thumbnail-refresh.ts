/**
 * Shared contract for the thumbnail refresh layer (single + batch).
 *
 * Both the background service worker (queue processor) and the newtab UI
 * (progress toast, card overlays) import from here — message names, timing
 * constants, persisted state shape, and user-facing strings live in exactly
 * one place so the two sides can never drift apart.
 */

// ── Timing ────────────────────────────────────────────────────────────────

/**
 * Minimum gap between two captureVisibleTab calls. The platform quota is
 * 2 calls/second (MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND); 1500ms runs at
 * ~0.67 captures/second, comfortably inside the limit even on slow devices
 * where Chromium's quota window behaves conservatively.
 */
export const REFRESH_THROTTLE_MS = 1500;

/** How long the hidden batch window waits for a page to settle per card. */
export const REFRESH_PAGE_SETTLE_MS = 1800;

/**
 * A persisted "running" batch older than this is considered stale (crashed
 * worker, closed browser) and will not auto-resume — it is marked cancelled
 * instead so a new batch can start clean.
 */
export const REFRESH_BATCH_STALE_MS = 10 * 60 * 1000;

/** chrome.storage.session key for the crash-resumable batch state. */
export const REFRESH_SESSION_KEY = "klice-refresh-batch";

/**
 * Geometry for the reused batch capture window.
 *
 * NOTE — two classic patterns are dead on current Chromium: fully-offscreen
 * windows are rejected ("Bounds must be at least 50% within visible screen
 * space"), and a minimized window is at the mercy of compositor suspension
 * and Memory-Saver discard — it captures in lab conditions but is the
 * highest-risk variable on real profiles. So the window is created
 * visible-but-unfocused at the default position and kept unfocused: always
 * composited, always capturable, never focus-stealing. One window per batch,
 * closed at the end.
 */
export const REFRESH_WINDOW_GEOMETRY = {
	width: 800,
	height: 600,
	focused: false,
} as const;

/**
 * Milliseconds to wait before the next capture given the last capture time.
 * Pure helper so the spacing rule is unit-testable without timers.
 */
export function captureDelayMs(
	lastCaptureAt: number | null,
	now: number,
): number {
	if (lastCaptureAt === null) return 0;
	const elapsed = now - lastCaptureAt;
	return elapsed >= REFRESH_THROTTLE_MS ? 0 : REFRESH_THROTTLE_MS - elapsed;
}

// ── Message API (runtime.sendMessage) ─────────────────────────────────────

export type RefreshMessageType =
	| "refresh:single"
	| "refresh:batch"
	| "refresh:cancel"
	| "refresh:progress";

export interface RefreshSingleMessage {
	type: "refresh:single";
	cardId: string;
}

export interface RefreshBatchMessage {
	type: "refresh:batch";
	cardIds: string[];
}

export interface RefreshCancelMessage {
	type: "refresh:cancel";
}

export type RefreshMessage =
	| RefreshSingleMessage
	| RefreshBatchMessage
	| RefreshCancelMessage;

export type RefreshProgressStatus =
	| "started"
	| "capturing"
	| "card-done"
	| "card-failed"
	| "done"
	| "cancelled"
	| "already-running"
	| "needs-permission";

export interface RefreshProgressEvent {
	type: "refresh:progress";
	status: RefreshProgressStatus;
	/** Total cards in this batch (1 for a single refresh). */
	total: number;
	/** Cards finished (done + failed) so far. */
	completed: number;
	updated: number;
	failed: number;
	/** Card currently being captured, if any. */
	currentCardId?: string;
	currentUrl?: string;
	currentTitle?: string;
	/** Latest-first is a UI concern; the worker appends chronologically. */
	recent?: Array<{
		cardId: string;
		title: string;
		url: string;
		ok: boolean;
		/** Stage-tagged failure reason (e.g. "capture: …"). Absent on success. */
		error?: string;
	}>;
}

export function isRefreshMessage(value: unknown): value is RefreshMessage {
	if (typeof value !== "object" || value === null) return false;
	const type = (value as { type?: unknown }).type;
	return (
		type === "refresh:single" ||
		type === "refresh:batch" ||
		type === "refresh:cancel"
	);
}

// ── Persisted batch state (survives service-worker sleep) ────────────────

export interface RefreshBatchState {
	status: "running" | "idle";
	cardIds: string[];
	doneIds: string[];
	failedIds: string[];
	sites: Record<
		string,
		{ title: string; url: string; ok: boolean; error?: string }
	>;
	startedAt: number;
}

export function emptyRefreshState(): RefreshBatchState {
	return {
		status: "idle",
		cardIds: [],
		doneIds: [],
		failedIds: [],
		sites: {},
		startedAt: 0,
	};
}

/** True when a persisted state is a fresh, resumable running batch. */
export function isResumableRefreshState(value: unknown): boolean {
	if (typeof value !== "object" || value === null) return false;
	const state = value as Partial<RefreshBatchState>;
	if (state.status !== "running") return false;
	if (!Array.isArray(state.cardIds) || state.cardIds.length === 0) return false;
	if (typeof state.startedAt !== "number") return false;
	return Date.now() - state.startedAt < REFRESH_BATCH_STALE_MS;
}

// ── User-facing strings (single source; no copies in components) ─────────

export const REFRESH_STRINGS = {
	singleItem: "Refresh thumbnail",
	batchAction: (n: number) => `Refresh previews (${n})`,
	missingAction: (n: number) => `Refresh missing previews (${n})`,
	confirmMany: (n: number) =>
		`Refresh ${n} previews? This opens pages briefly in a hidden window.`,
	alreadyRunning: "A refresh is already running.",
	needsPermission:
		"Site access is needed to capture previews. Allow access in Settings → Manage bookmarks.",
	capturing: (done: number, total: number) =>
		`Capturing ${done + 1} of ${total}…`,
	cancelRefresh: "Cancel refresh",
	cancelledAt: (done: number, total: number) =>
		`Cancelled at ${done} of ${total}`,
	completeSummary: (updated: number, failed: number) =>
		failed === 0
			? `${updated} preview${updated === 1 ? "" : "s"} updated`
			: `${updated} updated, ${failed} failed`,
} as const;
