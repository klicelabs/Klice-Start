import type { Card, Folder } from "../types";
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
	return { order, cardParents, folderParents };
}

function sameKeys(a: string[], b: string[]): boolean {
	return a.length === b.length && a.every((key, i) => key === b[i]);
}

let entrySeq = 0;

function nextEntryId(): string {
	entrySeq += 1;
	return `h${Date.now().toString(36)}${entrySeq}`;
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
	const containers: Record<string, { before: string[]; after: string[] }> = {};
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
			containers[name] = { before, after };
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

	const touched =
		Object.keys(undoContainers).length > 0 ||
		Object.keys(undoCards).length > 0 ||
		Object.keys(undoFolders).length > 0;
	if (!touched) return null;

	const undo: HistorySnapshot = {
		containers: undoContainers,
		cards: undoCards,
		folders: undoFolders,
	};
	const redo: HistorySnapshot = {
		containers: redoContainers,
		cards: redoCards,
		folders: redoFolders,
	};
	return { id: nextEntryId(), at: Date.now(), summary, undo, redo };
}
