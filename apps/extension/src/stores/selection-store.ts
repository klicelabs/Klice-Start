import { create } from "zustand";

interface SelectionStoreState {
	selectedIds: string[];
	lastSelectedId: string | null;
	select: (id: string) => void;
	toggle: (id: string) => void;
	selectRange: (targetId: string, orderedIds: string[]) => void;
	clear: () => void;
	selectAll: (allIds: string[]) => void;
	isSelected: (id: string) => boolean;
}

export const useSelectionStore = create<SelectionStoreState>()((set, get) => ({
	selectedIds: [],
	lastSelectedId: null,

	select: (id: string) => {
		set({ selectedIds: [id], lastSelectedId: id });
	},

	toggle: (id: string) => {
		const current = get().selectedIds;
		const exists = current.includes(id);
		const next = exists ? current.filter((x) => x !== id) : [...current, id];
		set({
			selectedIds: next,
			lastSelectedId: exists ? get().lastSelectedId : id,
		});
	},

	selectRange: (targetId: string, orderedIds: string[]) => {
		const last = get().lastSelectedId;
		if (!last || !orderedIds.includes(last) || !orderedIds.includes(targetId)) {
			set({ selectedIds: [targetId], lastSelectedId: targetId });
			return;
		}

		const fromIdx = orderedIds.indexOf(last);
		const toIdx = orderedIds.indexOf(targetId);
		const start = Math.min(fromIdx, toIdx);
		const end = Math.max(fromIdx, toIdx);

		const rangeIds = orderedIds.slice(start, end + 1);
		const merged = Array.from(new Set([...get().selectedIds, ...rangeIds]));
		set({ selectedIds: merged, lastSelectedId: targetId });
	},

	clear: () => {
		if (get().selectedIds.length > 0 || get().lastSelectedId !== null) {
			set({ selectedIds: [], lastSelectedId: null });
		}
	},

	selectAll: (allIds: string[]) => {
		set({ selectedIds: allIds, lastSelectedId: allIds[allIds.length - 1] ?? null });
	},

	isSelected: (id: string) => get().selectedIds.includes(id),
}));
