import { create } from "zustand";

export type SelectionKind = "card" | "folder";

export interface SelectionItem {
	id: string;
	kind: SelectionKind;
	/**
	 * Explicit source metadata: the parent folder at selection time (null
	 * for root folders). Never inferred from the visible folder later, so
	 * multi-source transport stays safe across navigation.
	 */
	sourceId: string | null;
}

/**
 * Which selection domain is active. Content mode (bookmarks + subfolders)
 * and roots mode (root tabs) are intentionally incompatible: entering one
 * clears the other, so navigation semantics never get ambiguous.
 */
export type SelectionScope = "content" | "roots";

function domainOf(item: SelectionItem): SelectionScope {
	return item.kind === "folder" && item.sourceId === null
		? "roots"
		: "content";
}

interface SelectionStoreState {
	items: SelectionItem[];
	selectedIds: string[];
	lastSelectedId: string | null;
	scope: SelectionScope | null;
	select: (item: SelectionItem) => void;
	toggle: (item: SelectionItem) => void;
	selectRange: (targetId: string, ordered: SelectionItem[]) => void;
	clear: () => void;
	selectAll: (items: SelectionItem[]) => void;
	isSelected: (id: string) => boolean;
}

function syncIds(items: SelectionItem[]): string[] {
	return items.map((i) => i.id);
}

export const useSelectionStore = create<SelectionStoreState>()((set, get) => ({
	items: [],
	selectedIds: [],
	lastSelectedId: null,
	scope: null,

	select: (item) => {
		const scope = domainOf(item);
		set({ items: [item], selectedIds: [item.id], lastSelectedId: item.id, scope });
	},

	toggle: (item) => {
		const state = get();
		const scope = domainOf(item);
		// Entering an incompatible domain intentionally replaces the
		// selection instead of mixing root tabs with content.
		if (state.scope !== null && state.scope !== scope) {
			set({
				items: [item],
				selectedIds: [item.id],
				lastSelectedId: item.id,
				scope,
			});
			return;
		}
		const exists = state.selectedIds.includes(item.id);
		const items = exists
			? state.items.filter((x) => x.id !== item.id)
			: [...state.items, item];
		set({
			items,
			selectedIds: syncIds(items),
			lastSelectedId: exists ? state.lastSelectedId : item.id,
			scope: items.length > 0 ? scope : null,
		});
	},

	selectRange: (targetId, ordered) => {
		const state = get();
		// Ranges only ever run inside content views; a roots selection is
		// replaced rather than extended across domains.
		const base = state.scope !== null && state.scope !== "content" ? [] : state.items;
		const last = state.scope !== null && state.scope !== "content" ? null : state.lastSelectedId;
		const ids = ordered.map((o) => o.id);
		if (!last || !ids.includes(last) || !ids.includes(targetId)) {
			const found = ordered.find((o) => o.id === targetId);
			if (!found) return;
			set({
				items: [found],
				selectedIds: [found.id],
				lastSelectedId: found.id,
				scope: "content",
			});
			return;
		}

		const fromIdx = ids.indexOf(last);
		const toIdx = ids.indexOf(targetId);
		const start = Math.min(fromIdx, toIdx);
		const end = Math.max(fromIdx, toIdx);

		const merged = new Map(base.map((i) => [i.id, i]));
		for (const item of ordered.slice(start, end + 1)) merged.set(item.id, item);
		const items = Array.from(merged.values());
		set({
			items,
			selectedIds: syncIds(items),
			lastSelectedId: targetId,
			scope: "content",
		});
	},

	clear: () => {
		const state = get();
		if (
			state.selectedIds.length > 0 ||
			state.lastSelectedId !== null ||
			state.scope !== null
		) {
			set({ items: [], selectedIds: [], lastSelectedId: null, scope: null });
		}
	},

	selectAll: (items) => {
		const scope = items.length > 0 ? domainOf(items[0]) : null;
		set({
			items,
			selectedIds: syncIds(items),
			lastSelectedId: items[items.length - 1]?.id ?? null,
			scope,
		});
	},

	isSelected: (id) => get().selectedIds.includes(id),
}));
