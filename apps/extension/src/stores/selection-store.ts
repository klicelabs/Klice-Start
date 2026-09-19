import { create } from "zustand";
import {
	canonicalizeSelection,
	materializeExcluding,
	selectedAncestorOf,
} from "../lib/selection-model";
import { useSetupStore } from "./setup-store";

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
 * Scope informs local selection affordances. Root and content items may
 * coexist when a selected root is materialized inside its folder.
 */
export type SelectionScope = "content" | "roots" | "mixed";

function domainOf(item: SelectionItem): SelectionScope {
	return item.kind === "folder" && item.sourceId === null ? "roots" : "content";
}

function scopeOf(items: readonly SelectionItem[]): SelectionScope | null {
	if (items.length === 0) return null;
	const first = domainOf(items[0]);
	return items.some((item) => domainOf(item) !== first) ? "mixed" : first;
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
	/**
	 * Union the given items into the live selection (Select all adds the
	 * current page to whatever is already selected elsewhere, never
	 * replacing it). Existing members keep their position; newcomers append
	 * in the given order. Explicit ancestor folders subsume their descendants.
	 */
	addAll: (items: SelectionItem[]) => void;
	removeAll: (items: SelectionItem[]) => void;
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
		set({
			items: [item],
			selectedIds: [item.id],
			lastSelectedId: item.id,
			scope,
		});
	},

	toggle: (item) => {
		const state = get();
		const setup = useSetupStore.getState();
		const exists = state.selectedIds.includes(item.id);
		const inheritedFrom = exists
			? null
			: selectedAncestorOf(item, state.items, setup.folders);
		const next = inheritedFrom
			? [
					...state.items.filter((entry) => entry.id !== inheritedFrom),
					...materializeExcluding(
						inheritedFrom,
						item,
						setup.folders,
						setup.cards,
						setup.itemOrder,
					),
				]
			: exists
				? state.items.filter((entry) => entry.id !== item.id)
				: [...state.items, item];
		const items = canonicalizeSelection(next, setup.folders);
		set({
			items,
			selectedIds: syncIds(items),
			lastSelectedId: inheritedFrom || exists ? state.lastSelectedId : item.id,
			scope: scopeOf(items),
		});
	},

	selectRange: (targetId, ordered) => {
		const state = get();
		const base = state.items;
		const last = state.lastSelectedId;
		const ids = ordered.map((o) => o.id);
		if (!last || !ids.includes(last) || !ids.includes(targetId)) {
			const found = ordered.find((o) => o.id === targetId);
			if (!found) return;
			const setup = useSetupStore.getState();
			const inheritedFrom = selectedAncestorOf(
				found,
				state.items,
				setup.folders,
			);
			const next = inheritedFrom
				? [
						...state.items.filter((entry) => entry.id !== inheritedFrom),
						...materializeExcluding(
							inheritedFrom,
							found,
							setup.folders,
							setup.cards,
							setup.itemOrder,
							true,
						),
					]
				: [...state.items, found];
			const items = canonicalizeSelection(next, setup.folders);
			set({
				items,
				selectedIds: syncIds(items),
				lastSelectedId: found.id,
				scope: scopeOf(items),
			});
			return;
		}

		const fromIdx = ids.indexOf(last);
		const toIdx = ids.indexOf(targetId);
		const start = Math.min(fromIdx, toIdx);
		const end = Math.max(fromIdx, toIdx);

		const merged = new Map(base.map((i) => [i.id, i]));
		for (const item of ordered.slice(start, end + 1)) merged.set(item.id, item);
		const items = canonicalizeSelection(
			Array.from(merged.values()),
			useSetupStore.getState().folders,
		);
		set({
			items,
			selectedIds: syncIds(items),
			lastSelectedId: targetId,
			scope: scopeOf(items),
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
		const canonical = canonicalizeSelection(
			items,
			useSetupStore.getState().folders,
		);
		set({
			items: canonical,
			selectedIds: syncIds(canonical),
			lastSelectedId: canonical.at(-1)?.id ?? null,
			scope: scopeOf(canonical),
		});
	},

	addAll: (items) => {
		const state = get();
		const merged = new Map(state.items.map((i) => [i.id, i]));
		for (const item of items) merged.set(item.id, item);
		const next = canonicalizeSelection(
			Array.from(merged.values()),
			useSetupStore.getState().folders,
		);
		set({
			items: next,
			selectedIds: syncIds(next),
			lastSelectedId:
				state.lastSelectedId ?? items[items.length - 1]?.id ?? null,
			scope: scopeOf(next),
		});
	},

	removeAll: (items) => {
		const state = get();
		const setup = useSetupStore.getState();
		const removeIds = new Set(items.map((item) => item.id));
		const expanded = new Set<string>();
		let next = [...state.items];
		for (const item of items) {
			const ancestor = selectedAncestorOf(item, next, setup.folders);
			if (!ancestor || expanded.has(ancestor)) continue;
			expanded.add(ancestor);
			next = [
				...next.filter((entry) => entry.id !== ancestor),
				...materializeExcluding(
					ancestor,
					item,
					setup.folders,
					setup.cards,
					setup.itemOrder,
					true,
				),
			];
		}
		const canonical = canonicalizeSelection(
			next.filter((entry) => !removeIds.has(entry.id)),
			setup.folders,
		);
		set({
			items: canonical,
			selectedIds: syncIds(canonical),
			lastSelectedId: canonical.at(-1)?.id ?? null,
			scope: scopeOf(canonical),
		});
	},

	isSelected: (id) => get().selectedIds.includes(id),
}));
