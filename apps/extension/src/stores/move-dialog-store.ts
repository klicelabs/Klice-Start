import { create } from "zustand";

interface MoveDialogState {
	/** Item ids to move (cards and/or folders). Null when closed. */
	ids: string[] | null;
	open: (ids: string[]) => void;
	close: () => void;
}

/**
 * Single lightweight "Move to…" destination picker session. Rendered once in
 * App; opened from any grid/tab context menu. Ephemeral by design (never
 * persisted) like selection and rename state.
 */
export const useMoveDialogStore = create<MoveDialogState>()((set) => ({
	ids: null,

	open: (ids) => {
		if (ids.length > 0) set({ ids: [...ids] });
	},

	close: () => set({ ids: null }),
}));
