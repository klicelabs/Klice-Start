import type { Card, Folder } from "../types";
import type { DragGroupMember } from "./drag-group";
import type { HistoryEntry, HistorySnapshot, HistorySummary } from "./history";
import type { ItemOrder } from "./item-order";

/**
 * Gesture-scoped capture for history entries.
 *
 * A drag gesture mutates live order on hover, so the "before" state must be
 * frozen at dragstart — long before any drop handler runs. This module holds
 * one opaque pending capture (plain data, no store imports, so the DnD hook
 * and its tests never touch the store graph). Drop sites take it, diff
 * against live state, and commit at most one entry per gesture.
 */

export interface GestureCapture {
	order: ItemOrder;
	cardParents: Record<string, string>;
	folderParents: Record<string, string | null>;
	/** Full entity records (references stay valid: the store is immutable). */
	cards: Card[];
	folders: Folder[];
}

let pending: GestureCapture | null = null;

export function beginGestureCapture(
	cards: readonly Card[],
	folders: readonly Folder[],
	itemOrder: ItemOrder | null | undefined,
): void {
	pending = snapshotSetup(cards, folders, itemOrder);
}

/** Take the pending capture exactly once (clears it, preventing doubles). */
export function takeGestureCapture(): GestureCapture | null {
	const capture = pending;
	pending = null;
	return capture;
}

export function clearGestureCapture(): void {
	pending = null;
}

/**
 * L8: the drag group is frozen at dragstart alongside the order capture.
 * Drop sites consume this frozen payload instead of re-resolving the live
 * selection, so clearing the selection mid-drag (tray close, hover commit,
 * a stray clear) can no longer collapse the drag to its first member.
 * The freeze is overwritten by every dragstart and cleared on dragend.
 */
let frozenDragGroup: DragGroupMember[] | null = null;

export function freezeDragGroup(group: readonly DragGroupMember[]): void {
	frozenDragGroup = [...group];
}

export function getFrozenDragGroup(): readonly DragGroupMember[] | null {
	return frozenDragGroup;
}

export function clearFrozenDragGroup(): void {
	frozenDragGroup = null;
}

export function snapshotSetup(
	cards: readonly Card[],
	folders: readonly Folder[],
	itemOrder: ItemOrder | null | undefined,
): GestureCapture {
	const order: ItemOrder = {};
	if (itemOrder) {
		for (const [container, keys] of Object.entries(itemOrder)) {
			order[container] = [...keys];
		}
	}
	const cardParents: Record<string, string> = {};
	for (const card of cards) cardParents[card.id] = card.folderId;
	const folderParents: Record<string, string | null> = {};
	for (const folder of folders)
		folderParents[folder.id] = folder.parentId ?? null;
	return {
		order,
		cardParents,
		folderParents,
		cards: [...cards],
		folders: [...folders],
	};
}

export function sameKeys(a: string[], b: string[]): boolean {
	return a.length === b.length && a.every((key, i) => key === b[i]);
}

let entrySeq = 0;

function nextEntryId(): string {
	entrySeq += 1;
	return `h${Date.now().toString(36)}${entrySeq}`;
}

/**
 * Shared entry-id source so store-built entries (H2 deletes) use the same
 * id vocabulary as gesture-diff entries.
 */
export function nextHistoryEntryId(): string {
	return nextEntryId();
}

/**
 * Rename entry: order and parents never move, so the diff engine would see
 * nothing — the old and new folder records ARE the inverse data.
 *
 * Why nameOnlyIds: the applier (setup-store, owned separately) replaces
 * whole records on putFolders, so a stale full record would clobber
 * concurrent fields. putFolders is retained for backward compatibility;
 * the applier owner will merge only `name` for nameOnlyIds next wave.
 */
export function buildRenameEntry(
	before: Folder,
	after: Folder,
): HistoryEntry | null {
	if (before.id !== after.id || before.name === after.name) return null;
	const shape = {
		containers: {},
		cards: {},
		folders: {},
		delCardIds: [],
		delFolderIds: [],
	};
	return {
		id: nextEntryId(),
		at: Date.now(),
		summary: {
			kind: "rename",
			total: 1,
			cardCount: 0,
			folderCount: 1,
			label: before.name,
			newName: after.name,
		},
		undo: {
			...shape,
			putCards: [],
			putFolders: [{ ...before }],
			nameOnlyIds: [before.id],
		},
		redo: {
			...shape,
			putCards: [],
			putFolders: [{ ...after }],
			nameOnlyIds: [after.id],
		},
	};
}

/**
 * Diff a gesture capture against live state. Returns a single atomic entry
 * covering every touched container and entity, or null when nothing
 * actually changed (same-slot drop) so no-ops never enter history.
 */
export function buildHistoryEntry(
	capture: GestureCapture,
	cards: readonly Card[],
	folders: readonly Folder[],
	itemOrder: ItemOrder | null | undefined,
	summary: HistorySummary,
): HistoryEntry | null {
	const now = snapshotSetup(cards, folders, itemOrder);
	const undoContainers: Record<string, string[]> = {};
	const redoContainers: Record<string, string[]> = {};
	const names = new Set([
		...Object.keys(capture.order),
		...Object.keys(now.order),
	]);
	for (const name of names) {
		const before = capture.order[name] ?? [];
		const after = now.order[name] ?? [];
		if (!sameKeys(before, after)) {
			undoContainers[name] = [...before];
			redoContainers[name] = [...after];
		}
	}

	const undoCards: Record<string, string> = {};
	const redoCards: Record<string, string> = {};
	const cardIds = new Set([
		...Object.keys(capture.cardParents),
		...Object.keys(now.cardParents),
	]);
	for (const id of cardIds) {
		const before = capture.cardParents[id];
		const after = now.cardParents[id];
		if (before !== undefined && after !== undefined && before !== after) {
			undoCards[id] = before;
			redoCards[id] = after;
		}
	}
	const undoFolders: Record<string, string | null> = {};
	const redoFolders: Record<string, string | null> = {};
	const folderIds = new Set([
		...Object.keys(capture.folderParents),
		...Object.keys(now.folderParents),
	]);
	for (const id of folderIds) {
		const before = capture.folderParents[id];
		const after = now.folderParents[id];
		if (before !== undefined && after !== undefined && before !== after) {
			undoFolders[id] = before;
			redoFolders[id] = after;
		}
	}

	// Created entities (present now, absent before): undo removes them,
	// redo restores their full records. Deleted entities mirror that.
	const beforeCards = new Map(capture.cards.map((c) => [c.id, c]));
	const afterCards = new Map(cards.map((c) => [c.id, c]));
	const undoPutCards = [...beforeCards.values()].filter(
		(c) => !afterCards.has(c.id),
	);
	const redoPutCards = [...afterCards.values()].filter(
		(c) => !beforeCards.has(c.id),
	);
	const beforeFolders = new Map(capture.folders.map((f) => [f.id, f]));
	const afterFolders = new Map(folders.map((f) => [f.id, f]));
	const undoPutFolders = [...beforeFolders.values()].filter(
		(f) => !afterFolders.has(f.id),
	);
	const redoPutFolders = [...afterFolders.values()].filter(
		(f) => !beforeFolders.has(f.id),
	);

	const touched =
		Object.keys(undoContainers).length > 0 ||
		Object.keys(undoCards).length > 0 ||
		Object.keys(undoFolders).length > 0 ||
		undoPutCards.length > 0 ||
		redoPutCards.length > 0 ||
		undoPutFolders.length > 0 ||
		redoPutFolders.length > 0;
	if (!touched) return null;

	const undo: HistorySnapshot = {
		containers: undoContainers,
		cards: undoCards,
		folders: undoFolders,
		putCards: undoPutCards.map((c) => ({ ...c })),
		putFolders: undoPutFolders.map((f) => ({ ...f })),
		delCardIds: redoPutCards.map((c) => c.id),
		delFolderIds: redoPutFolders.map((f) => f.id),
	};
	const redo: HistorySnapshot = {
		containers: redoContainers,
		cards: redoCards,
		folders: redoFolders,
		putCards: redoPutCards.map((c) => ({ ...c })),
		putFolders: redoPutFolders.map((f) => ({ ...f })),
		delCardIds: undoPutCards.map((c) => c.id),
		delFolderIds: undoPutFolders.map((f) => f.id),
	};
	return { id: nextEntryId(), at: Date.now(), summary, undo, redo };
}
