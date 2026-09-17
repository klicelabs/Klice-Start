import type { Card, Folder } from "../types";

/**
 * Unified per-folder item ordering.
 *
 * Bookmarks (`Card.order`) and folders (`Folder.order`) historically lived in
 * two independent namespaces, which forced the grid to render "folders first"
 * and made mixed reorder impossible. `ItemOrder` is a single ordered list of
 * item keys per container (a folder id, or ROOT_CONTAINER for top-level
 * folders) and is the source of truth for grid/tabbar display order.
 *
 * Keys are `${kind}:${id}` with kind `card` | `folder`. The legacy `order`
 * fields are kept consistent (reindexed from these arrays) so older readers
 * and the tabbar's `order` sort keep working.
 */

export type ItemKind = "card" | "folder";

export interface ItemRef {
	kind: ItemKind;
	id: string;
}

/** Container key for root-level folders (`parentId === null`). */
export const ROOT_CONTAINER = "__root__";

export function containerKeyOf(parentId: string | null): string {
	return parentId ?? ROOT_CONTAINER;
}

export function itemKey(kind: ItemKind, id: string): string {
	return `${kind}:${id}`;
}

export function parseItemKey(key: string): ItemRef | null {
	const sep = key.indexOf(":");
	if (sep <= 0) return null;
	const kind = key.slice(0, sep);
	const id = key.slice(sep + 1);
	if ((kind === "card" || kind === "folder") && id.length > 0) {
		return { kind, id };
	}
	return null;
}

export type ItemOrder = Record<string, string[]>;

/**
 * Build the initial ordering from legacy data. Preserves the historical
 * visual order (subfolders first, then cards) so existing installs see no
 * change on migration.
 */
export function buildItemOrder(folders: Folder[], cards: Card[]): ItemOrder {
	const order: ItemOrder = {};
	const byParent = new Map<string, Folder[]>();
	for (const f of folders) {
		const key = containerKeyOf(f.parentId ?? null);
		const list = byParent.get(key);
		if (list) list.push(f);
		else byParent.set(key, [f]);
	}
	const cardsByFolder = new Map<string, Card[]>();
	for (const c of cards) {
		const list = cardsByFolder.get(c.folderId);
		if (list) list.push(c);
		else cardsByFolder.set(c.folderId, [c]);
	}
	const sortByOrder = <T extends { order: number; name?: string }>(list: T[]) =>
		[...list].sort((a, b) =>
			a.order !== b.order
				? a.order - b.order
				: (a.name ?? "").localeCompare(b.name ?? ""),
		);
	const containers = new Set<string>([
		ROOT_CONTAINER,
		...folders.map((f) => f.id),
	]);
	for (const container of containers) {
		const kids =
			container === ROOT_CONTAINER
				? (byParent.get(ROOT_CONTAINER) ?? [])
				: (byParent.get(container) ?? []);
		const folderKeys = sortByOrder(kids).map((f) => itemKey("folder", f.id));
		const cardKeys =
			container === ROOT_CONTAINER
				? []
				: sortByOrder(cardsByFolder.get(container) ?? []).map((c) =>
						itemKey("card", c.id),
					);
		order[container] = [...folderKeys, ...cardKeys];
	}
	return order;
}

/**
 * Repair an ordering map: drop keys pointing at missing entities, append
 * entities missing from their container, ensure every folder (and root) has
 * a container. Never throws; always returns a usable map.
 */
export function repairItemOrder(
	raw: unknown,
	folders: Folder[],
	cards: Card[],
): ItemOrder {
	const folderIds = new Set(folders.map((f) => f.id));
	const cardById = new Map(cards.map((c) => [c.id, c]));
	const record: Record<string, unknown> =
		typeof raw === "object" && raw !== null && !Array.isArray(raw)
			? (raw as Record<string, unknown>)
			: {};

	const order: ItemOrder = {};
	const containers = new Set<string>([
		ROOT_CONTAINER,
		...folders.map((f) => f.id),
	]);
	for (const container of containers) {
		const seen = new Set<string>();
		const keys: string[] = [];
		const maybe = record[container];
		if (Array.isArray(maybe)) {
			for (const entry of maybe) {
				if (typeof entry !== "string" || seen.has(entry)) continue;
				const ref = parseItemKey(entry);
				if (!ref) continue;
				if (ref.kind === "folder") {
					const folder = folders.find((f) => f.id === ref.id);
					if (!folder) continue;
					if (containerKeyOf(folder.parentId ?? null) !== container) continue;
				} else {
					const card = cardById.get(ref.id);
					if (!card || card.folderId !== container) continue;
				}
				seen.add(entry);
				keys.push(entry);
			}
		}
		order[container] = keys;
	}

	// Append anything the stored arrays missed (new entities, legacy data).
	const subfoldersOf = (container: string) =>
		folders.filter(
			(f) =>
				(container === ROOT_CONTAINER ? null : container) ===
				(f.parentId ?? null),
		);
	for (const container of containers) {
		const keys = order[container] ?? [];
		const known = new Set(keys);
		for (const f of subfoldersOf(container)) {
			const key = itemKey("folder", f.id);
			if (!known.has(key)) {
				keys.push(key);
				known.add(key);
			}
		}
		if (container !== ROOT_CONTAINER) {
			for (const c of cards) {
				if (c.folderId !== container) continue;
				const key = itemKey("card", c.id);
				if (!known.has(key)) {
					keys.push(key);
					known.add(key);
				}
			}
		}
		order[container] = keys;
	}

	// Drop containers for folders that no longer exist.
	for (const key of Object.keys(order)) {
		if (key !== ROOT_CONTAINER && !folderIds.has(key)) delete order[key];
	}
	return order;
}

/** Ordered refs for a container, guaranteed to resolve to live entities. */
export function getOrderedRefs(
	container: string,
	folders: Folder[],
	cards: Card[],
	itemOrder: ItemOrder,
): ItemRef[] {
	const stored = itemOrder[container];
	const folderById = new Map(folders.map((f) => [f.id, f]));
	const cardById = new Map(cards.map((c) => [c.id, c]));
	const out: ItemRef[] = [];
	if (stored) {
		for (const key of stored) {
			const ref = parseItemKey(key);
			if (!ref) continue;
			if (ref.kind === "folder") {
				const folder = folderById.get(ref.id);
				if (folder && containerKeyOf(folder.parentId ?? null) === container) {
					out.push(ref);
				}
			} else if (cardById.get(ref.id)?.folderId === container) {
				out.push(ref);
			}
		}
	}
	return out;
}

/**
 * Reindex legacy `order` fields from the container arrays so both models
 * stay consistent: folder order = index among folder keys of its parent
 * container, card order = index among card keys of its folder container.
 */
export function reindexOrders(
	folders: Folder[],
	cards: Card[],
	itemOrder: ItemOrder,
): { folders: Folder[]; cards: Card[] } {
	const folderOrder = new Map<string, number>();
	const cardOrder = new Map<string, number>();
	const folderById = new Map(folders.map((f) => [f.id, f]));
	const cardById = new Map(cards.map((c) => [c.id, c]));
	for (const [container, keys] of Object.entries(itemOrder)) {
		let fi = 0;
		let ci = 0;
		for (const key of keys) {
			const ref = parseItemKey(key);
			if (!ref) continue;
			if (ref.kind === "folder") {
				const folder = folderById.get(ref.id);
				if (
					folder &&
					containerKeyOf(folder.parentId ?? null) === container &&
					!folderOrder.has(ref.id)
				) {
					folderOrder.set(ref.id, fi++);
				}
			} else {
				const card = cardById.get(ref.id);
				if (card && card.folderId === container && !cardOrder.has(ref.id)) {
					cardOrder.set(ref.id, ci++);
				}
			}
		}
	}
	return {
		folders: folders.map((f) =>
			folderOrder.has(f.id)
				? { ...f, order: folderOrder.get(f.id) ?? f.order }
				: f,
		),
		cards: cards.map((c) =>
			cardOrder.has(c.id) ? { ...c, order: cardOrder.get(c.id) ?? c.order } : c,
		),
	};
}

/** Remove every key referencing `id` (either kind) from all containers. */
export function removeKeysForId(itemOrder: ItemOrder, id: string): ItemOrder {
	const next: ItemOrder = {};
	for (const [container, keys] of Object.entries(itemOrder)) {
		next[container] = keys.filter((k) => parseItemKey(k)?.id !== id);
	}
	return next;
}

/**
 * Move a contiguous block of keys to before/after a target key inside one
 * container array. Pure: operates on key strings only, never reparents.
 * Returns null when the move is a no-op (unknown keys, or the target sits
 * inside the dragged block — dropping a group onto itself).
 */
export function reorderGroupKeys(
	keys: string[],
	draggedKeys: string[],
	targetKey: string,
	position: "before" | "after",
): string[] | null {
	const moving = new Set(draggedKeys);
	if (moving.size === 0) return null;
	if (moving.has(targetKey)) return null;
	const block = keys.filter((k) => moving.has(k));
	if (block.length === 0) return null;
	const rest = keys.filter((k) => !moving.has(k));
	const to = rest.indexOf(targetKey);
	if (to === -1) return null;
	const next = [...rest];
	next.splice(position === "after" ? to + 1 : to, 0, ...block);
	return next;
}

/**
 * Insert a block of card keys at an anchor inside the target container,
 * removing the block from every container first (reparenting move).
 * Pure: returns the next full order map, or null when nothing changes.
 */
export function insertCardsBlock(
	itemOrder: ItemOrder,
	targetContainer: string,
	draggedKeys: string[],
	targetKey: string,
	position: "before" | "after",
): ItemOrder | null {
	const moving = new Set(draggedKeys);
	if (moving.size === 0 || moving.has(targetKey)) return null;
	const next: ItemOrder = {};
	for (const [container, keys] of Object.entries(itemOrder)) {
		next[container] = keys.filter((k) => !moving.has(k));
	}
	const anchor = [...(next[targetContainer] ?? [])];
	const to = anchor.indexOf(targetKey);
	if (to === -1) return null;
	// Preserve the caller's block order (already source-ordered upstream).
	const block = draggedKeys.filter((k) => k.length > 0);
	anchor.splice(position === "after" ? to + 1 : to, 0, ...block);
	next[targetContainer] = anchor;
	return next;
}
