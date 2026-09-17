import { getDescendantIds, wouldCreateCycle } from "./folder-tree";
import type { Card, Folder } from "../types";

export interface ResolvedMove {
	/** Cards that will actually move, in selection order. */
	cardIds: string[];
	/** Folders that will actually move, in selection order. */
	folderIds: string[];
	/** Total selected members (including ones already home or gone). */
	total: number;
	/** Members that will move. */
	movable: number;
	cardCount: number;
	folderCount: number;
	/**
	 * Why nothing can move, for disabled states and tooltips. Null when at
	 * least one member is movable.
	 */
	blockedReason: string | null;
}

/**
 * Resolve a multi-selection against one destination folder, up front.
 *
 * One shared validator for the tray's Move here, so every member of the
 * operation is checked before anything is committed:
 *
 *   - unknown ids (deleted elsewhere) are ignored, never moved;
 *   - cards already in the destination stay put instead of re-appending;
 *   - cards cannot live at the top level (null destination);
 *   - folders cannot land in themselves or their descendants;
 *   - folders already parented to the destination stay put.
 *
 * The caller commits `cardIds` + `folderIds` through
 * `moveItemsToContainer` in a single atomic store call, which re-validates
 * the same rules. Ordering follows the selection sequence.
 */
export function resolveMoveGroup(
	selectedIds: string[],
	cards: Card[],
	folders: Folder[],
	targetFolderId: string | null,
): ResolvedMove {
	const cardById = new Map(cards.map((c) => [c.id, c]));
	const folderById = new Map(folders.map((f) => [f.id, f]));

	const cardIds: string[] = [];
	const folderIds: string[] = [];
	let selectedCards = 0;
	let selectedFolders = 0;
	let cycleBlocked = false;

	for (const id of selectedIds) {
		const card = cardById.get(id);
		if (card) {
			selectedCards += 1;
			if (targetFolderId !== null && card.folderId !== targetFolderId) {
				cardIds.push(id);
			}
			continue;
		}
		const folder = folderById.get(id);
		if (!folder) continue;
		selectedFolders += 1;
		if (targetFolderId === null) {
			// Top level accepts folders that are not already roots.
			if ((folder.parentId ?? null) !== null) folderIds.push(id);
			continue;
		}
		if (
			targetFolderId === id ||
			wouldCreateCycle(folders, id, targetFolderId) ||
			(folder.parentId ?? null) === targetFolderId
		) {
			if (
				targetFolderId === id ||
				getDescendantIds(folders, id).includes(targetFolderId)
			) {
				cycleBlocked = true;
			}
			continue;
		}
		folderIds.push(id);
	}

	const movable = cardIds.length + folderIds.length;
	const total = selectedIds.length;

	let blockedReason: string | null = null;
	if (movable === 0 && total > 0) {
		if (cycleBlocked) {
			blockedReason = "Can't move a folder into itself or its subfolders.";
		} else if (targetFolderId === null && selectedCards > 0) {
			blockedReason = "Bookmarks can't live at the top level.";
		} else {
			blockedReason = "Already in this folder.";
		}
	}

	return {
		cardIds,
		folderIds,
		total,
		movable,
		cardCount: selectedCards,
		folderCount: selectedFolders,
		blockedReason,
	};
}

/** "3 bookmarks · 1 folder" summary for trays and toasts. */
export function describeMoveGroup(cardCount: number, folderCount: number): string {
	const parts: string[] = [];
	if (cardCount > 0)
		parts.push(`${cardCount} bookmark${cardCount === 1 ? "" : "s"}`);
	if (folderCount > 0)
		parts.push(`${folderCount} folder${folderCount === 1 ? "" : "s"}`);
	return parts.join(" · ");
}
