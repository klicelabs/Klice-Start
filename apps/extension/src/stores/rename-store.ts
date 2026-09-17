import { create } from "zustand";

export type RenameKind = "card" | "folder";

export interface RenameTarget {
	kind: RenameKind;
	id: string;
}

interface RenameStoreState {
	/** The item currently in inline-edit mode, if any. Single global target. */
	editing: RenameTarget | null;
	begin: (target: RenameTarget) => void;
	cancel: () => void;
	isEditing: (kind: RenameKind, id: string) => boolean;
}

/**
 * Single global inline-rename session. Only one name can be edited at a time;
 * beginning a new session implicitly cancels the previous one (which reverts,
 * never commits, so no value is silently lost).
 */
export const useRenameStore = create<RenameStoreState>()((set, get) => ({
	editing: null,

	begin: (target) => set({ editing: target }),

	cancel: () => {
		if (get().editing !== null) set({ editing: null });
	},

	isEditing: (kind, id) => {
		const current = get().editing;
		return current !== null && current.kind === kind && current.id === id;
	},
}));
