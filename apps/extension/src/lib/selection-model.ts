import type { SelectionItem } from "../stores/selection-store";
import type { Card, Folder } from "../types";
import { buildItemOrder, getOrderedRefs, type ItemOrder } from "./item-order";

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
