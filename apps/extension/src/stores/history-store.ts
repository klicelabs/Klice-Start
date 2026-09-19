import { create } from "zustand";
import {
	collectGcableThumbnailIds,
	commitToStacks,
	type HistoryEntry,
	type PendingConfirmation,
	popRedoIds,
	popUndoIds,
} from "../lib/history";
import { useImageStore } from "./image-store";
import { useRenameStore } from "./rename-store";
import { useSetupStore } from "./setup-store";

interface HistoryNotice {
	entryId: string;
	seq: number;
}

export interface ExecutedHistory {
	direction: "undo" | "redo";
	entries: HistoryEntry[];
}

export interface DeadIdNotice {
	direction: "undo" | "redo";
	entryId: string;
}

/**
 * True when the pending ids are all still in the live branch, so a
 * confirmation can never apply snapshots against a history that moved on
 * (M4/NPD-3). Dead ids drop the pending silently — the session that moved
 * the stacks is responsible for its own user feedback.
 */
function isPendingLive(state: HistoryStoreState): boolean {
	if (!state.pending) return false;
	const pool =
		state.pending.direction === "undo"
			? state.past.map((entry) => entry.id)
			: state.future.map((entry) => entry.id);
	const live = new Set(pool);
	return (
		state.pending.entryIds.length > 0 &&
		state.pending.entryIds.every((id) => live.has(id))
	);
}

interface HistoryStoreState {
	/** Committed entries, oldest first. Session-scoped, bounded. */
	past: HistoryEntry[];
	/** Undone entries available for redo; newest-undone first. */
	future: HistoryEntry[];
	/** The single active confirmation (never stacked). */
	pending: PendingConfirmation | null;
	/** Post-action toast trigger, consumed by the history manager. */
	notice: HistoryNotice | null;
	/** FIFO queue so rapid commits never overwrite a toast trigger. */
	notices: HistoryNotice[];
	noticeSeq: number;
	/** H1 residue: last dead-id request, consumed by the manager. */
	deadIdNotice: DeadIdNotice | null;
	/**
	 * Commit one entry (bounded, redo branch discarded). Announces via the
	 * manager's post-action toast unless silent — silent commits keep their
	 * own contextual toast and attach Undo to it instead of doubling up.
	 */
	commit: (entry: HistoryEntry, opts?: { silent?: boolean }) => void;
	consumeNotice: () => void;
	requestUndo: (entryId?: string) => void;
	requestRedo: (entryId?: string) => void;
	requestUndoTo: (entryId: string) => void;
	requestRedoTo: (entryId: string) => void;
	cancelPending: () => void;
	/**
	 * Execute the pending confirmation (snapshots applied atomically per
	 * entry, top-down). Returns what ran so the manager can announce it.
	 */
	confirmPending: () => ExecutedHistory | null;
	/**
	 * NPD-3: drop past+future after a full external replacement (reset,
	 * import). Snapshots captured before the swap must never replay on top
	 * of unrelated state (they resurrect deleted items and lose new ones).
	 */
	clearHistory: () => void;
	/**
	 * NPD-3: after external state arrived (cross-tab sync), invalidate at
	 * least the redo branch and prune undo entries whose captured snapshot
	 * no longer matches live state — conservative, snapshot-verifying.
	 */
	invalidateForExternalSync: (live: {
		cards: ReadonlyMap<string, string>;
		folders: ReadonlyMap<string, string | null>;
		containers: Readonly<Record<string, readonly string[]>>;
	}) => void;
	/**
	 * H1 residue: a requestUndo/Redo with an id that is no longer in the
	 * branch (evicted by the 30-entry bound or a discarded redo branch)
	 * surfaces this once so the UI can say why nothing happened.
	 */
	consumeDeadIdNotice: () => DeadIdNotice | null;
}

function applySnapshot(snapshot: HistoryEntry["undo"]): void {
	useSetupStore.getState().applyHistorySnapshot(snapshot);
}

export const useHistoryStore = create<HistoryStoreState>()((set, get) => ({
	past: [],
	future: [],
	pending: null,
	notice: null,
	notices: [],
	noticeSeq: 0,
	deadIdNotice: null,

	commit: (entry, opts) => {
		const state = get();
		// Standard branch semantics: a new commit discards the redo branch.
		const { evicted, ...stacks } = commitToStacks(
			{ past: state.past, future: state.future },
			entry,
		);
		// collectGcableThumbnailIds filters ids live cards still reference, so
		// both discard paths (past overflow + redo-branch discard) are safe
		// with one rule — undone deletes keep their bytes through the restored
		// cards, true garbage goes.
		const seq = state.noticeSeq + 1;
		const nextNotice = opts?.silent ? state.notice : { entryId: entry.id, seq };
		set({
			...stacks,
			notice: nextNotice,
			notices: opts?.silent
				? state.notices
				: [...state.notices, nextNotice as HistoryNotice],
			noticeSeq: seq,
		});
		// Why here: entries leaving the history (past overflow + discarded
		// redo branch) no longer have an undo path, so their staged thumbnail
		// bytes can go — EXCEPT ids still referenced by live cards: an undone
		// delete keeps its bytes alive through the restored cards, so a
		// redo-branch discard must not GC them. Best-effort, never blocks.
		const thumbIds = collectGcableThumbnailIds(
			evicted,
			useSetupStore.getState().cards,
		);
		if (thumbIds.length > 0) {
			void useImageStore.getState().deleteThumbnails(thumbIds);
		}
	},

	consumeNotice: () => {
		const notices = get().notices;
		if (notices.length === 0) return;
		set({ notices: notices.slice(1), notice: notices[1] ?? null });
	},

	requestUndo: (entryId) => {
		const state = get();
		const top = state.past[state.past.length - 1];
		if (!top) return;
		const id = entryId ?? top.id;
		// Why cascade: a stale toast Undo carries a non-top id; a single-id
		// pending would zero-match in popUndoIds and dismiss silently.
		// Delegating to undo-to-here preserves intent.
		if (id !== top.id) {
			get().requestUndoTo(id);
			return;
		}
		if (!state.past.some((entry) => entry.id === id)) return;
		set({ pending: { direction: "undo", entryIds: [id] } });
	},

	requestRedo: (entryId) => {
		const state = get();
		const top = state.future[0];
		if (!top) return;
		const id = entryId ?? top.id;
		// Why cascade: mirrors requestUndo — a non-head redo id becomes
		// redo-to-here instead of a zero-match silent dismiss.
		if (id !== top.id) {
			get().requestRedoTo(id);
			return;
		}
		if (!state.future.some((entry) => entry.id === id)) return;
		set({ pending: { direction: "redo", entryIds: [id] } });
	},

	requestUndoTo: (entryId) => {
		const state = get();
		const index = state.past.findIndex((entry) => entry.id === entryId);
		// H1 residue: an id that is not in the branch (evicted or discarded)
		// used to exit silently; surface it so the UI can explain the no-op.
		if (index === -1) {
			if (state.past.length > 0) {
				set({ deadIdNotice: { direction: "undo", entryId } });
			}
			return;
		}
		// Cascade top-down to and including the target (stack-safe order).
		const ids = state.past
			.slice(index)
			.map((entry) => entry.id)
			.reverse();
		if (ids.length > 0) set({ pending: { direction: "undo", entryIds: ids } });
	},

	requestRedoTo: (entryId) => {
		const state = get();
		const index = state.future.findIndex((entry) => entry.id === entryId);
		if (index === -1) {
			if (state.future.length > 0) {
				set({ deadIdNotice: { direction: "redo", entryId } });
			}
			return;
		}
		const ids = state.future.slice(0, index + 1).map((entry) => entry.id);
		if (ids.length > 0) set({ pending: { direction: "redo", entryIds: ids } });
	},

	cancelPending: () => {
		if (get().pending) set({ pending: null });
	},

	confirmPending: () => {
		const state = get();
		const pending = state.pending;
		if (!pending) return null;
		// M4/NPD-3: cross-tab sync may have replaced state between the request
		// and the confirmation. A stale cascade would apply snapshots against
		// unrelated state; drop it instead (the sync itself is the feedback).
		if (!isPendingLive(state)) {
			set({ pending: null });
			return null;
		}
		// NPD-5: finalize an open rename BEFORE applying; the two states never
		// coexist (the field commits via its blur handler on unmount).
		useRenameStore.getState().cancel();
		if (pending.direction === "undo") {
			const { entries, stacks } = popUndoIds(
				{ past: state.past, future: state.future },
				pending.entryIds,
			);
			if (entries.length === 0) {
				set({ pending: null });
				return null;
			}
			for (const entry of entries) applySnapshot(entry.undo);
			// P3: entries moved past→future keep their staged bytes alive —
			// the undo snapshot may restore cards whose thumbs reference them.
			set({ ...stacks, pending: null });
			return { direction: "undo", entries };
		}
		const { entries, stacks } = popRedoIds(
			{ past: state.past, future: state.future },
			pending.entryIds,
		);
		if (entries.length === 0) {
			set({ pending: null });
			return null;
		}
		for (const entry of entries) applySnapshot(entry.redo);
		// P3: redo keeps staged bytes — the (re-)deleted cards reference them
		// and the entry is undoable again from here.
		set({ ...stacks, pending: null });
		return { direction: "redo", entries };
	},

	clearHistory: () => {
		const state = get();
		if (state.past.length > 0 || state.future.length > 0 || state.pending) {
			// Past-resident entries are dropping out of the undo branch: their
			// staged bytes become garbage (the external replacement is the new
			// truth). Redo-branch entries keep theirs — restored cards may
			// still reference them; orphans are swept at hydration.
			const thumbIds = collectGcableThumbnailIds(
				state.past,
				useSetupStore.getState().cards,
			);
			set({ past: [], future: [], pending: null });
			if (thumbIds.length > 0) {
				void useImageStore.getState().deleteThumbnails(thumbIds);
			}
		}
	},

	invalidateForExternalSync: (live) => {
		const state = get();
		const alive = state.past.filter((entry) =>
			snapshotMatchesLive(entry.redo, live),
		);
		const changed =
			alive.length !== state.past.length || state.future.length > 0;
		if (!changed) return;
		// Pruned past entries drop out of the undo branch — collect their
		// staged bytes (P3); surviving entries keep theirs.
		const pruned = state.past.filter((entry) => !alive.includes(entry));
		const thumbIds = collectGcableThumbnailIds(
			pruned,
			useSetupStore.getState().cards,
		);
		set({
			past: alive,
			future: [],
			pending: isPendingLive({ ...state, past: alive, future: [] })
				? state.pending
				: null,
		});
		if (thumbIds.length > 0) {
			void useImageStore.getState().deleteThumbnails(thumbIds);
		}
	},

	consumeDeadIdNotice: () => {
		const notice = get().deadIdNotice;
		if (notice) set({ deadIdNotice: null });
		return notice;
	},
}));

/**
 * M4/NPD-3 snapshot verification: the entry can only be applied if the
 * rows it rewrites still match what its redo snapshot captured (i.e. no
 * external writer moved the same containers/entities since the commit).
 */
function snapshotMatchesLive(
	redo: HistoryEntry["redo"],
	live: {
		cards: ReadonlyMap<string, string>;
		folders: ReadonlyMap<string, string | null>;
		containers: Readonly<Record<string, readonly string[]>>;
	},
): boolean {
	for (const [container, keys] of Object.entries(redo.containers)) {
		const current = live.containers[container];
		if (!current || current.length !== keys.length) return false;
		for (let i = 0; i < keys.length; i++) {
			if (current[i] !== keys[i]) return false;
		}
	}
	for (const [id, folderId] of Object.entries(redo.cards)) {
		if (live.cards.get(id) !== folderId) return false;
	}
	for (const [id, parentId] of Object.entries(redo.folders)) {
		if ((live.folders.get(id) ?? null) !== (parentId ?? null)) return false;
	}
	return true;
}
