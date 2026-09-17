import { create } from "zustand";
import {
	commitToStacks,
	type HistoryEntry,
	type PendingConfirmation,
	popRedoIds,
	popUndoIds,
	stagedThumbnailIds,
} from "../lib/history";
import { useImageStore } from "./image-store";
import { useSetupStore } from "./setup-store";

interface HistoryNotice {
	entryId: string;
	seq: number;
}

export interface ExecutedHistory {
	direction: "undo" | "redo";
	entries: HistoryEntry[];
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
	noticeSeq: number;
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
}

function applySnapshot(snapshot: HistoryEntry["undo"]): void {
	useSetupStore.getState().applyHistorySnapshot(snapshot);
}

export const useHistoryStore = create<HistoryStoreState>()((set, get) => ({
	past: [],
	future: [],
	pending: null,
	notice: null,
	noticeSeq: 0,

	commit: (entry, opts) => {
		const state = get();
		// Standard branch semantics: a new commit discards the redo branch.
		const { evicted, ...stacks } = commitToStacks(
			{ past: state.past, future: state.future },
			entry,
		);
		const seq = state.noticeSeq + 1;
		set({
			...stacks,
			notice: opts?.silent ? state.notice : { entryId: entry.id, seq },
			noticeSeq: seq,
		});
		// Why here: evicted entries (past overflow + discarded redo branch)
		// are no longer undoable, so their staged thumbnail bytes can go.
		// Best-effort, never blocks the commit.
		const thumbIds = stagedThumbnailIds(evicted);
		if (thumbIds.length > 0) {
			void useImageStore.getState().deleteThumbnails(thumbIds);
		}
	},

	consumeNotice: () => {
		if (get().notice) set({ notice: null });
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
		if (index === -1) return;
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
		if (index === -1) return;
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
		set({ ...stacks, pending: null });
		return { direction: "redo", entries };
	},
}));
