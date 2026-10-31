import { create } from "zustand";
import type {
	RefreshBatchState,
	RefreshProgressEvent,
} from "../lib/thumbnail-refresh";

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

function mergeRecentSites(
	current: readonly RefreshSiteEntry[],
	recent: RefreshProgressEvent["recent"],
): RefreshSiteEntry[] {
	if (!recent) return [...current];
	const merged = new Map(current.map((site) => [site.cardId, site]));
	for (const site of recent) merged.set(site.cardId, { ...site });
	return [...merged.values()];
}

interface RefreshStoreState {
	/** A batch is acknowledged and progressing. */
	active: boolean;
	total: number;
	completed: number;
	updated: number;
	failed: number;
	/** The one card whose page is being prepared/captured right now. */
	currentCardId: string | null;
	currentTitle: string | null;
	/** Batch members not yet done/failed; queued cards have no card overlay. */
	queuedIds: string[];
	/** Chronological capture log for the toast's site list. */
	sites: RefreshSiteEntry[];
	/** Post-run summary shown for a few seconds after done/cancelled. */
	summary: (RefreshSummary & { cancelled: boolean }) | null;
	/** Optimistic local start: queued members, but no active card yet. */
	beginLocal: (cardIds: string[]) => void;
	/** Rebuild an in-flight batch from chrome.storage.session after a reload. */
	hydrateFromSession: (snapshot: RefreshBatchState) => void;
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
			currentCardId: null,
		}),

	hydrateFromSession: (snapshot) => {
		if (snapshot.status !== "running") {
			set({ ...initial });
			return;
		}
		const finished = new Set([...snapshot.doneIds, ...snapshot.failedIds]);
		const sites = snapshot.cardIds.flatMap((cardId) => {
			if (!finished.has(cardId)) return [];
			const site = snapshot.sites[cardId];
			return site ? [{ cardId, ...site }] : [];
		});
		const currentCardId = snapshot.activeCardId ?? null;
		let currentTitle: string | null = null;
		if (currentCardId)
			currentTitle = snapshot.sites[currentCardId]?.title ?? null;
		set({
			active: true,
			total: snapshot.cardIds.length,
			completed: snapshot.doneIds.length + snapshot.failedIds.length,
			updated: snapshot.doneIds.length,
			failed: snapshot.failedIds.length,
			currentCardId,
			currentTitle,
			queuedIds: snapshot.cardIds.filter((id) => !finished.has(id)),
			sites,
			summary: null,
		});
	},

	applyProgress: (event) =>
		set((state) => {
			switch (event.status) {
				case "started":
				case "capturing": {
					const started = event.status === "started";
					const sites = started
						? (event.recent?.map((item) => ({ ...item })) ?? [])
						: mergeRecentSites(state.sites, event.recent);
					return {
						active: true,
						summary: null,
						total: event.total,
						completed: event.completed,
						updated: event.updated,
						failed: event.failed,
						currentCardId: event.currentCardId ?? null,
						currentTitle: event.currentTitle ?? null,
						queuedIds: event.queuedIds ?? state.queuedIds,
						sites,
					};
				}
				case "card-done":
				case "card-failed": {
					const ok = event.status === "card-done";
					let entry: RefreshSiteEntry | null = null;
					if (event.currentCardId) {
						let error = event.recent?.find(
							(site) => site.cardId === event.currentCardId,
						)?.error;
						if (ok) error = undefined;
						entry = {
							cardId: event.currentCardId,
							title: event.currentTitle ?? event.currentCardId,
							url: event.currentUrl ?? "",
							ok,
							error,
						};
					}
					const finishedId = event.currentCardId;
					let queuedIds = event.queuedIds ?? state.queuedIds;
					if (!event.queuedIds && finishedId) {
						queuedIds = state.queuedIds.filter((id) => id !== finishedId);
					}
					const sites = mergeRecentSites(state.sites, event.recent);
					if (entry && !sites.some((site) => site.cardId === entry.cardId)) {
						sites.push(entry);
					}
					return {
						active: true,
						summary: null,
						total: event.total,
						completed: event.completed,
						updated: event.updated,
						failed: event.failed,
						currentCardId: null,
						currentTitle: null,
						queuedIds,
						sites,
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
					// A rejected second start leaves the in-flight batch untouched.
					return state;
				case "needs-permission":
					return {
						...initial,
						total: state.total,
						completed: state.completed,
						updated: state.updated,
						failed: state.failed,
						sites: state.sites,
					};
				default:
					return state;
			}
		}),

	dismissSummary: () => set({ summary: null, sites: [] }),

	clear: () => set({ ...initial }),
}));
