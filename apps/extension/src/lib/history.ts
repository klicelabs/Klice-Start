/**
 * Command-history vocabulary for Klice Start.
 *
 * Every reversible operation is a compact inverse-data entry (never a full
 * app snapshot): affected container key arrays plus affected entity parents,
 * before and after. Descriptions are first-class — toast, confirmation and
 * history UI copy all derive from the same summary, never ad hoc strings.
 */

import type { Card, Folder } from "../types";
import { ROOT_CONTAINER } from "./item-order";

/** Display name for a container key (ROOT = top level, unknown = Home). */
export function historyContainerName(
	container: string,
	folders: readonly Pick<Folder, "id" | "name">[],
): string {
	if (container === ROOT_CONTAINER) return "Top level";
	return folders.find((f) => f.id === container)?.name ?? "Home";
}

/** Recent-operation bound. Session-scoped; old entries fall off the top. */
export const HISTORY_LIMIT = 30;

export type HistoryKind = "move" | "reorder" | "combine" | "create" | "rename" | "delete";

/**
 * What happened, in UI words. `dest` is the destination folder name (moves);
 * `container` is the container display name (reorders). `label` names a
 * single moved item (card title / folder name).
 */
export interface HistorySummary {
	kind: HistoryKind;
	total: number;
	cardCount: number;
	folderCount: number;
	dest?: string;
	container?: string;
	label?: string;
	/** Rename target name (kind "rename" only). */
	newName?: string;
}

export interface HistorySnapshot {
	/** Container key → ordered item keys, for every touched container. */
	containers: Record<string, string[]>;
	/** Card id → folder id, for every touched card. */
	cards: Record<string, string>;
	/** Folder id → parent id (null = root), for every touched folder. */
	folders: Record<string, string | null>;
	/** Full records to restore (entities deleted by the action). */
	putCards: Card[];
	putFolders: Folder[];
	/** Ids to remove (entities created by the action). */
	delCardIds: string[];
	delFolderIds: string[];
}

export interface HistoryEntry {
	id: string;
	at: number;
	summary: HistorySummary;
	undo: HistorySnapshot;
	redo: HistorySnapshot;
}

export type HistoryDirection = "undo" | "redo";

export interface PendingConfirmation {
	direction: HistoryDirection;
	/** Entry ids top-down (cascade for undo-to-here / redo-to-here). */
	entryIds: string[];
}

function itemNoun(
	total: number,
	cardCount: number,
	folderCount: number,
): string {
	if (total === 1 && cardCount === 1) return "bookmark";
	if (total === 1 && folderCount === 1) return "folder";
	if (cardCount > 0 && folderCount === 0) {
		return total === 1 ? "bookmark" : "bookmarks";
	}
	if (folderCount > 0 && cardCount === 0) {
		return total === 1 ? "folder" : "folders";
	}
	return total === 1 ? "item" : "items";
}

function moveObject(summary: HistorySummary): string {
	if (summary.total === 1 && summary.label) return `“${summary.label}”`;
	return `${summary.total} ${itemNoun(summary.total, summary.cardCount, summary.folderCount)}`;
}

/** "Moved 5 items to Design" — post-action and redo follow-ups. */
export function describeHistoryPast(summary: HistorySummary): string {
	if (summary.kind === "reorder") {
		const where = summary.container ?? "this folder";
		return summary.total === 1
			? `Reordered in ${where}`
			: `Reordered ${summary.total} items in ${where}`;
	}
	if (summary.kind === "combine") {
		return `Combined ${summary.total} ${itemNoun(summary.total, summary.cardCount, summary.folderCount)} into a new folder`;
	}
	if (summary.kind === "create") {
		return `Created folder “${summary.label ?? "Untitled"}”${createdWith(summary)}`;
	}
	if (summary.kind === "rename") {
		return `Renamed “${summary.label}” to “${summary.newName}”`;
	}
	if (summary.kind === "delete") {
		return `Deleted folder “${summary.label}”${deletedWith(summary)}`;
	}
	const dest = summary.dest ?? "another folder";
	if (summary.total === 1 && summary.label) {
		return `Moved “${summary.label}” to ${dest}`;
	}
	return `${capitalize(moveObject(summary))} moved to ${dest}`;
}

/** "moving 5 items to Design" — confirmation questions. */
export function describeHistoryGerund(summary: HistorySummary): string {
	if (summary.kind === "reorder") {
		const where = summary.container ?? "this folder";
		return summary.total === 1
			? `reordering in ${where}`
			: `reordering ${summary.total} items in ${where}`;
	}
	if (summary.kind === "combine") {
		return `combining ${summary.total} ${itemNoun(summary.total, summary.cardCount, summary.folderCount)} into a new folder`;
	}
	if (summary.kind === "create") {
		return `creating folder “${summary.label ?? "Untitled"}”${createdWith(summary)}`;
	}
	if (summary.kind === "rename") {
		return `renaming “${summary.label}” to “${summary.newName}”`;
	}
	if (summary.kind === "delete") {
		return `deleting folder “${summary.label}”${deletedWith(summary)}`;
	}
	const dest = summary.dest ?? "another folder";
	return `moving ${moveObject(summary)} to ${dest}`;
}

/** "Move 5 items to Design" — history list rows and menu items. */
export function describeHistoryAction(summary: HistorySummary): string {
	if (summary.kind === "reorder") {
		const where = summary.container ?? "this folder";
		return summary.total === 1
			? `Reorder in ${where}`
			: `Reorder ${summary.total} items in ${where}`;
	}
	if (summary.kind === "combine") {
		return `Combine ${summary.total} ${itemNoun(summary.total, summary.cardCount, summary.folderCount)} into a new folder`;
	}
	if (summary.kind === "create") {
		return `Create folder “${summary.label ?? "Untitled"}”${createdWith(summary)}`;
	}
	if (summary.kind === "rename") {
		return `Rename “${summary.label}” to “${summary.newName}”`;
	}
	if (summary.kind === "delete") {
		return `Delete folder “${summary.label}”${deletedWith(summary)}`;
	}
	const dest = summary.dest ?? "another folder";
	return `Move ${moveObject(summary)} to ${dest}`;
}

function capitalize(text: string): string {
	return text.length > 0 ? text[0].toUpperCase() + text.slice(1) : text;
}

/** " with 5 items" suffix for creates that grouped members, else "". */
function createdWith(summary: HistorySummary): string {
	const moved = summary.cardCount + summary.folderCount;
	if (moved <= 0) return "";
	return ` with ${moved} ${itemNoun(moved, summary.cardCount, summary.folderCount)}`;
}

/** " (4 bookmarks, 1 folder)" suffix for deletes with contents, else "". */
function deletedWith(summary: HistorySummary): string {
	const inside = summary.cardCount + summary.folderCount;
	if (inside <= 0) return "";
	const parts: string[] = [];
	if (summary.cardCount > 0) {
		parts.push(
			`${summary.cardCount} ${summary.cardCount === 1 ? "bookmark" : "bookmarks"}`,
		);
	}
	if (summary.folderCount > 0) {
		parts.push(
			`${summary.folderCount} ${summary.folderCount === 1 ? "subfolder" : "subfolders"}`,
		);
	}
	return ` (${parts.join(", ")})`;
}

/**
 * Native text editing wins: history shortcuts stay out of inputs,
 * textareas, contenteditables, selects and rename/search fields.
 */
export function isHistoryEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return Boolean(
		target.closest(
			'input, textarea, select, [contenteditable="true"], [data-rename-field], [data-search-input]',
		),
	);
}

// ---------------------------------------------------------------------------
// Pure stack transitions (unit-tested; the store is a thin shell over these).
// ---------------------------------------------------------------------------

export interface HistoryStacks {
	past: HistoryEntry[];
	future: HistoryEntry[];
}

/** Commit: append bounded, discard the redo branch. */
export function commitToStacks(
	stacks: HistoryStacks,
	entry: HistoryEntry,
): HistoryStacks {
	return {
		past: [...stacks.past, entry].slice(-HISTORY_LIMIT),
		future: [],
	};
}

/**
 * Undo the given ids strictly top-down; stops at the first mismatch so a
 * stale cascade can never skip entries. Returns the matched entries (in
 * apply order) plus the resulting stacks.
 */
export function popUndoIds(
	stacks: HistoryStacks,
	ids: readonly string[],
): { entries: HistoryEntry[]; stacks: HistoryStacks } {
	const entries: HistoryEntry[] = [];
	let past = [...stacks.past];
	const undone: HistoryEntry[] = [];
	for (const id of ids) {
		const top = past[past.length - 1];
		if (!top || top.id !== id) break;
		entries.push(top);
		past = past.slice(0, -1);
		undone.push(top);
	}
	return {
		entries,
		stacks: {
			past,
			future: [...undone, ...stacks.future].slice(0, HISTORY_LIMIT),
		},
	};
}

/** Redo mirror: strictly head-first through the future branch. */
export function popRedoIds(
	stacks: HistoryStacks,
	ids: readonly string[],
): { entries: HistoryEntry[]; stacks: HistoryStacks } {
	const entries: HistoryEntry[] = [];
	let future = [...stacks.future];
	const redone: HistoryEntry[] = [];
	for (const id of ids) {
		const top = future[0];
		if (!top || top.id !== id) break;
		entries.push(top);
		future = future.slice(1);
		redone.push(top);
	}
	return {
		entries,
		stacks: {
			past: [...stacks.past, ...redone].slice(-HISTORY_LIMIT),
			future,
		},
	};
}
