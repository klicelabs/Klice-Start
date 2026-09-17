import type { SelectionItem } from "../stores/selection-store";
import type { Card, Folder } from "../types";
import {
	containerKeyOf,
	type ItemOrder,
	type ItemRef,
	itemKey,
} from "./item-order";

export interface DragGroupMember extends ItemRef {
	/** Container the member lives in right now (never inferred later). */
	sourceId: string;
}

/**
 * Order an id set by live source position: members sort by their container,
 * then by their index inside that container's order array. Deterministic for
 * identical state — never click order, DOM timing, or hover sequence.
 * Unknown ids (deleted elsewhere) resolve to nothing and are dropped.
 */
export function orderGroupBySource(
	ids: readonly string[],
	cards: readonly Card[],
	folders: readonly Folder[],
	itemOrder: ItemOrder | null | undefined,
): DragGroupMember[] {
	const cardById = new Map(cards.map((c) => [c.id, c]));
	const folderById = new Map(folders.map((f) => [f.id, f]));
	const containers = itemOrder ? Object.keys(itemOrder) : [];
	const containerRank = new Map(containers.map((c, i) => [c, i]));
	const indexInContainer = new Map<string, number>();
	if (itemOrder) {
		for (const keys of Object.values(itemOrder)) {
			keys.forEach((key, index) => {
				if (!indexInContainer.has(key)) indexInContainer.set(key, index);
			});
		}
	}

	const members: Array<DragGroupMember & { rank: number; index: number }> = [];
	for (const id of ids) {
		const card = cardById.get(id);
		if (card) {
			const key = itemKey("card", id);
			members.push({
				kind: "card",
				id,
				sourceId: card.folderId,
				rank: containerRank.get(card.folderId) ?? Number.MAX_SAFE_INTEGER,
				index: indexInContainer.get(key) ?? Number.MAX_SAFE_INTEGER,
			});
			continue;
		}
		const folder = folderById.get(id);
		if (folder) {
			const container = containerKeyOf(folder.parentId ?? null);
			const key = itemKey("folder", id);
			members.push({
				kind: "folder",
				id,
				sourceId: container,
				rank: containerRank.get(container) ?? Number.MAX_SAFE_INTEGER,
				index: indexInContainer.get(key) ?? Number.MAX_SAFE_INTEGER,
			});
		}
	}
	members.sort((a, b) => a.rank - b.rank || a.index - b.index);
	return members.map(({ kind, id, sourceId }) => ({ kind, id, sourceId }));
}

/**
 * The single normalized drag payload. A grab on a selected item carries the
 * whole live selection in source order; a grab on an unselected item stays
 * a single-item drag. Every drop site (grid reorder, folder nest, preview,
 * background, tabs) consumes this — never raw selectedIds, never click
 * order.
 */
export function resolveDragGroup(
	dragged: ItemRef,
	selection: readonly SelectionItem[],
	cards: readonly Card[],
	folders: readonly Folder[],
	itemOrder: ItemOrder | null | undefined,
): DragGroupMember[] {
	const selected = selection.some((item) => item.id === dragged.id);
	if (!selected) {
		const sourceId = sourceContainerOf(dragged, cards, folders);
		if (sourceId === null) return [];
		return [{ ...dragged, sourceId }];
	}
	return orderGroupBySource(
		selection.map((item) => item.id),
		cards,
		folders,
		itemOrder,
	);
}

function sourceContainerOf(
	ref: ItemRef,
	cards: readonly Card[],
	folders: readonly Folder[],
): string | null {
	if (ref.kind === "card") {
		return cards.find((c) => c.id === ref.id)?.folderId ?? null;
	}
	const folder = folders.find((f) => f.id === ref.id);
	return folder ? containerKeyOf(folder.parentId ?? null) : null;
}

/** Split a group payload into kind id lists for container moves. */
export function splitGroupKinds(group: readonly DragGroupMember[]): {
	cardIds: string[];
	folderIds: string[];
} {
	const cardIds: string[] = [];
	const folderIds: string[] = [];
	for (const member of group) {
		if (member.kind === "card") cardIds.push(member.id);
		else folderIds.push(member.id);
	}
	return { cardIds, folderIds };
}
