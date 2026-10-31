import type { SelectionItem } from "../stores/selection-store";
import type { Card, Folder } from "../types";
import { buildItemOrder, getOrderedRefs, type ItemOrder } from "./item-order";

/**
 * Expand a selection into the cards the action applies to: directly selected
 * cards plus every bookmark inside selected folders, at any depth. Folder
 * selections cover descendants (the same rule the grid shows), so a nested
 * subtree acts as one unit. Duplicates collapse by id — a card selected
 * directly and through its folder refreshes once. Deleted/unknown ids are
 * ignored everywhere, matching the tray's rendering rule.
 */
export function expandSelectionToCards(
	selectedIds: readonly string[],
	cards: readonly Card[],
	folders: readonly Folder[],
): string[] {
	const folderById = new Map(folders.map((folder) => [folder.id, folder]));
	const cardIds = new Map(cards.map((card) => [card.id, card]));
	const childFolders = new Map<string | null, Folder[]>();
	for (const folder of folders) {
		const key = folder.parentId ?? null;
		const bucket = childFolders.get(key);
		if (bucket) bucket.push(folder);
		else childFolders.set(key, [folder]);
	}
	const cardsByFolder = new Map<string, Card[]>();
	for (const card of cards) {
		const bucket = cardsByFolder.get(card.folderId);
		if (bucket) bucket.push(card);
		else cardsByFolder.set(card.folderId, [card]);
	}
	const result: string[] = [];
	const seen = new Set<string>();
	const pushCard = (cardId: string) => {
		// Unknown ids resolve to nothing (the tray ignores deleted cards too).
		if (!cardIds.has(cardId)) return;
		if (seen.has(cardId)) return;
		seen.add(cardId);
		result.push(cardId);
	};
	// Deterministic queue order: direct cards in selection order first, then
	// each selected folder depth-first in source order. Visited guards make
	// even a malformed (cyclic) folder tree terminate.
	const visitedFolders = new Set<string>();
	const walkFolder = (folderId: string) => {
		for (const card of cardsByFolder.get(folderId) ?? []) pushCard(card.id);
		for (const child of childFolders.get(folderId) ?? []) {
			if (visitedFolders.has(child.id)) continue;
			visitedFolders.add(child.id);
			walkFolder(child.id);
		}
	};
	for (const id of selectedIds) {
		if (folderById.has(id)) continue;
		pushCard(id);
	}
	for (const id of selectedIds) {
		if (!folders.some((folder) => folder.id === id)) continue;
		walkFolder(id);
	}
	return result;
}

/** Explicit folder selections cover descendants visually and remain one operation unit. */
export function selectedAncestorOf(
	item: SelectionItem,
	selection: readonly SelectionItem[],
	folders: readonly Folder[],
): string | null {
	const folderById = new Map(folders.map((folder) => [folder.id, folder]));
	const explicit = new Set(
		selection
			.filter((entry) => entry.kind === "folder")
			.map((entry) => entry.id),
	);
	let parentId = item.sourceId;
	const visited = new Set<string>();
	while (parentId && !visited.has(parentId)) {
		if (explicit.has(parentId)) return parentId;
		visited.add(parentId);
		parentId = folderById.get(parentId)?.parentId ?? null;
	}
	return null;
}

/** Expand one inherited folder into the smallest explicit frontier excluding a child. */
export function materializeExcluding(
	ancestorId: string,
	target: SelectionItem,
	folders: readonly Folder[],
	cards: readonly Card[],
	itemOrder?: ItemOrder,
	includeTarget = false,
): SelectionItem[] {
	const folderById = new Map(folders.map((folder) => [folder.id, folder]));
	const chain: string[] = [];
	let id = target.sourceId;
	const visited = new Set<string>();
	while (id && !visited.has(id)) {
		chain.unshift(id);
		if (id === ancestorId) break;
		visited.add(id);
		id = folderById.get(id)?.parentId ?? null;
	}
	if (chain[0] !== ancestorId) return [];
	const result: SelectionItem[] = [];
	const resolvedOrder = itemOrder ?? buildItemOrder([...folders], [...cards]);
	for (let index = 0; index < chain.length; index++) {
		const container = chain[index];
		const next = chain[index + 1] ?? target.id;
		const children = folders.filter((folder) => folder.parentId === container);
		const links = cards.filter((card) => card.folderId === container);
		for (const ref of getOrderedRefs(
			container,
			children,
			links,
			resolvedOrder,
		)) {
			if (ref.id === next && (index < chain.length - 1 || !includeTarget))
				continue;
			result.push({ ...ref, sourceId: container });
		}
	}
	return result;
}

/** Prevent duplicate ancestor/descendant operation units after Select all. */
export function canonicalizeSelection(
	items: readonly SelectionItem[],
	folders: readonly Folder[],
): SelectionItem[] {
	const unique = [...new Map(items.map((item) => [item.id, item])).values()];
	const folderById = new Map(folders.map((folder) => [folder.id, folder]));
	const selectedFolders = new Set(
		unique.filter((item) => item.kind === "folder").map((item) => item.id),
	);
	return unique.filter((item) => {
		let parentId = item.sourceId;
		const visited = new Set<string>();
		while (parentId && !visited.has(parentId)) {
			if (selectedFolders.has(parentId)) return false;
			visited.add(parentId);
			parentId = folderById.get(parentId)?.parentId ?? null;
		}
		return true;
	});
}
