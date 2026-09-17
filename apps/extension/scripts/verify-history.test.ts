import { expect, test } from "bun:test";
import {
	commitToStacks,
	describeHistoryAction,
	describeHistoryGerund,
	describeHistoryPast,
	HISTORY_LIMIT,
	type HistoryEntry,
	type HistoryStacks,
	popRedoIds,
	popUndoIds,
} from "../src/lib/history";
import {
	buildHistoryEntry,
	type GestureCapture,
	snapshotSetup,
} from "../src/lib/history-capture";
import { itemKey } from "../src/lib/item-order";
import type { Card, Folder } from "../src/types";

function card(id: string, folderId: string): Card {
	return {
		id,
		url: `https://${id}.example`,
		title: id,
		favicon: "",
		thumbId: null,
		folderId,
		order: 0,
		origin: "manual",
		capturedAt: 0,
	} as Card;
}

function folder(id: string, parentId: string | null): Folder {
	return { id, name: id, parentId, order: 0 } as Folder;
}

function entry(id: string): HistoryEntry {
	const empty = { containers: {}, cards: {}, folders: {} };
	return {
		id,
		at: 0,
		summary: { kind: "move", total: 1, cardCount: 1, folderCount: 0 },
		undo: empty,
		redo: empty,
	};
}

// ---------------------------------------------------------------------------
// First-class descriptions drive toast, confirmation and history copy.
// ---------------------------------------------------------------------------

test("describes moves and reorders contextually", () => {
	const single = {
		kind: "move" as const,
		total: 1,
		cardCount: 1,
		folderCount: 0,
		dest: "Work",
		label: "GitHub",
	};
	expect(describeHistoryAction(single)).toBe("Move “GitHub” to Work");
	expect(describeHistoryGerund(single)).toBe("moving “GitHub” to Work");
	expect(describeHistoryPast(single)).toBe("Moved “GitHub” to Work");

	const multi = {
		kind: "move" as const,
		total: 7,
		cardCount: 7,
		folderCount: 0,
		dest: "Design",
	};
	expect(describeHistoryAction(multi)).toBe("Move 7 bookmarks to Design");
	expect(describeHistoryGerund(multi)).toBe("moving 7 bookmarks to Design");

	const mixed = {
		kind: "move" as const,
		total: 5,
		cardCount: 4,
		folderCount: 1,
		dest: "Design",
	};
	expect(describeHistoryAction(mixed)).toBe("Move 5 items to Design");

	const reorder = {
		kind: "reorder" as const,
		total: 3,
		cardCount: 3,
		folderCount: 0,
		container: "Home",
	};
	expect(describeHistoryAction(reorder)).toBe("Reorder 3 items in Home");
	expect(describeHistoryGerund(reorder)).toBe("reordering 3 items in Home");
	expect(describeHistoryPast(reorder)).toBe("Reordered 3 items in Home");
});

// ---------------------------------------------------------------------------
// Bounded stacks with standard redo-branch semantics.
// ---------------------------------------------------------------------------

test("bounds history and discards the redo branch on commit", () => {
	let stacks: HistoryStacks = { past: [], future: [entry("old")] };
	for (let i = 0; i < HISTORY_LIMIT + 5; i += 1) {
		stacks = commitToStacks(stacks, entry(`e${i}`));
	}
	expect(stacks.past).toHaveLength(HISTORY_LIMIT);
	expect(stacks.future).toHaveLength(0);
	expect(stacks.past[0].id).toBe("e5");
	expect(stacks.past[stacks.past.length - 1].id).toBe(`e${HISTORY_LIMIT + 4}`);
});

test("undo pops strictly top-down and stops at mismatches", () => {
	const stacks: HistoryStacks = {
		past: [entry("a"), entry("b"), entry("c")],
		future: [],
	};
	const cascade = popUndoIds(stacks, ["c", "b"]);
	expect(cascade.entries.map((e) => e.id)).toEqual(["c", "b"]);
	expect(cascade.stacks.past.map((e) => e.id)).toEqual(["a"]);
	expect(cascade.stacks.future.map((e) => e.id)).toEqual(["c", "b"]);

	const stale = popUndoIds(stacks, ["b"]);
	expect(stale.entries).toHaveLength(0);
	expect(stale.stacks.past).toHaveLength(3);
});

test("redo mirrors head-first through the future branch", () => {
	const stacks: HistoryStacks = {
		past: [entry("a")],
		future: [entry("b"), entry("c")],
	};
	const redone = popRedoIds(stacks, ["b", "c"]);
	expect(redone.entries.map((e) => e.id)).toEqual(["b", "c"]);
	expect(redone.stacks.past.map((e) => e.id)).toEqual(["a", "b", "c"]);
	expect(redone.stacks.future).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Atomic gesture diffs: one entry per drop, exact positions, null on no-op.
// ---------------------------------------------------------------------------

function setup(orderA: string[], orderB: string[]) {
	const cards = [card("x", "a"), card("y", "a"), card("t", "b")];
	const folders = [folder("a", null), folder("b", null)];
	return {
		cards,
		folders,
		order: {
			a: orderA.map((id) => itemKey("card", id)),
			b: orderB.map((id) => itemKey("card", id)),
		},
	};
}

test("a folder move captures parents and both containers atomically", () => {
	const before = setup(["x", "y"], ["t"]);
	const capture: GestureCapture = snapshotSetup(
		before.cards,
		before.folders,
		before.order,
	);
	const moved = [card("x", "b"), card("y", "a"), card("t", "b")];
	const afterOrder = {
		a: [itemKey("card", "y")],
		b: [itemKey("card", "t"), itemKey("card", "x")],
	};
	const result = buildHistoryEntry(capture, moved, before.folders, afterOrder, {
		kind: "move",
		total: 1,
		cardCount: 1,
		folderCount: 0,
		dest: "b",
	});
	expect(result).not.toBeNull();
	expect(result?.undo.cards).toEqual({ x: "a" });
	expect(result?.redo.cards).toEqual({ x: "b" });
	expect(result?.undo.containers.a).toEqual([
		itemKey("card", "x"),
		itemKey("card", "y"),
	]);
	expect(result?.redo.containers.b).toEqual([
		itemKey("card", "t"),
		itemKey("card", "x"),
	]);
});

test("a same-slot drop diffs to nothing", () => {
	const state = setup(["x", "y"], ["t"]);
	const capture = snapshotSetup(state.cards, state.folders, state.order);
	const result = buildHistoryEntry(
		capture,
		state.cards,
		state.folders,
		state.order,
		{ kind: "reorder", total: 1, cardCount: 1, folderCount: 0 },
	);
	expect(result).toBeNull();
});
