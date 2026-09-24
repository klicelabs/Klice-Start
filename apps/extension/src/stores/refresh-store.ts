import { create } from "zustand";
import type { RefreshProgressEvent } from "../lib/thumbnail-refresh";

export interface RefreshSiteEntry {
	cardId: string;
	title: string;
	url: string;
	ok: boolean;
	/** Stage-tagged failure reason from the worker. Absent on success. */
	error?: string;
}

export interface RefreshSummary {
	updated: number;
	failed: number;
	/** Most common failure reason. Shown under the summary when anything failed. */
	error?: string;
}

/** Most frequent error among failed entries (total-failure diagnosis). */
function dominantError(
	entries: readonly RefreshSiteEntry[],
): string | undefined {
	const counts = new Map<string, number>();
	for (const entry of entries) {
		if (entry.ok || !entry.error) continue;
		counts.set(entry.error, (counts.get(entry.error) ?? 0) + 1);
	}
	let best: string | undefined;
	let bestCount = 0;
	for (const [error, count] of counts) {
		if (count > bestCount) {
			best = error;
			bestCount = count;
		}
	}
	return best;
}

interface RefreshStoreState {
	/** A batch is acknowledged and progressing. */
	active: boolean;
	total: number;
	completed: number;
	updated: number;
	failed: number;
	/** Card currently under the camera (pulse overlay target). */
	currentCardId: string | null;
	currentTitle: string | null;
	/** Batch members not yet done/failed (subtle queued overlay). */
	queuedIds: string[];
	/** Chronological capture log for the toast's site list. */
	sites: RefreshSiteEntry[];
	/** Post-run summary shown for a few seconds after done/cancelled. */
	summary: (RefreshSummary & { cancelled: boolean }) | null;
	/** Optimistic local start: the UI owns the id list until events arrive. */
	beginLocal: (cardIds: string[]) => void;
	applyProgress: (event: RefreshProgressEvent) => void;
	dismissSummary: () => void;
	clear: () => void;
}

const initial = {
	active: false,
	total: 0,
	completed: 0,
	updated: 0,
	failed: 0,
	currentCardId: null,
	currentTitle: null,
	queuedIds: [],
	sites: [],
	summary: null,
};

export const useRefreshStore = create<RefreshStoreState>()((set) => ({
	...initial,

	beginLocal: (cardIds) =>
		set({
			...initial,
			active: true,
			total: cardIds.length,
			queuedIds: [...cardIds],
			currentCardId: cardIds[0] ?? null,
		}),

	applyProgress: (event) =>
		set((state) => {
			switch (event.status) {
				case "started":
				case "capturing":
					return {
						active: true,
						summary: null,
						total: event.total,
						completed: event.completed,
						updated: event.updated,
						failed: event.failed,
						currentCardId: event.currentCardId ?? state.currentCardId,
						currentTitle: event.currentTitle ?? state.currentTitle,
					};
				case "card-done":
				case "card-failed": {
					const ok = event.status === "card-done";
					const entry: RefreshSiteEntry | null = event.currentCardId
						? {
								cardId: event.currentCardId,
								title: event.currentTitle ?? event.currentCardId,
								url: event.currentUrl ?? "",
								ok,
								error: ok ? undefined : event.recent?.[0]?.error,
							}
						: null;
					const finishedId = event.currentCardId;
					return {
						active: true,
						summary: null,
						total: event.total,
						completed: event.completed,
						updated: event.updated,
						failed: event.failed,
						currentCardId: event.currentCardId ?? state.currentCardId,
						currentTitle: event.currentTitle ?? state.currentTitle,
						queuedIds: finishedId
							? state.queuedIds.filter((id) => id !== finishedId)
							: state.queuedIds,
						sites: entry ? [...state.sites, entry] : state.sites,
					};
				}
				case "done":
				case "cancelled": {
					const sites =
						event.recent?.map((item) => ({
							cardId: item.cardId,
							title: item.title,
							url: item.url,
							ok: item.ok,
							error: item.error,
						})) ?? state.sites;
					return {
						active: false,
						total: event.total,
						completed: event.completed,
						updated: event.updated,
						failed: event.failed,
						currentCardId: null,
						currentTitle: null,
						queuedIds: [],
						sites,
						summary: {
							updated: event.updated,
							failed: event.failed,
							cancelled: event.status === "cancelled",
							error:
								event.status === "cancelled" ? undefined : dominantError(sites),
						},
					};
				}
				case "already-running":
				case "needs-permission":
					// Handled by the caller as a one-shot toast; the running
					// batch (if any) keeps its own state untouched.
					return state;
			}
		}),

	dismissSummary: () => set({ summary: null, sites: [] }),

	clear: () => set({ ...initial }),
}));
