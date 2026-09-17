import { expect, test } from "bun:test";
import {
	commitToStacks,
	describeHistoryAction,
	describeHistoryGerund,
	describeHistoryPast,
	HISTORY_LIMIT,
	historyContainerName,
	type HistoryEntry,
	type HistoryStacks,
	popRedoIds,
	popUndoIds,
	stagedThumbnailIds,
} from "../src/lib/history";
import {
	buildHistoryEntry,
	buildRenameEntry,
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

function folder(id: string, parentId: string | null, name = id): Folder {
	return { id, name, parentId, order: 0 } as Folder;
}

function entry(id: string): HistoryEntry {
	const empty = {
		containers: {},
		cards: {},
		folders: {},
		putCards: [],
		putFolders: [],
		delCardIds: [],
		delFolderIds: [],
	};
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
	// Why ["b", "c"]: future is redo-ready head-first (newest-undone first),
	// matching sequential single undos — not apply order.
	expect(cascade.stacks.future.map((e) => e.id)).toEqual(["b", "c"]);

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

test("cascade undo matches sequential undos and round-trips through redo", () => {
	const start: HistoryStacks = {
		past: [entry("a"), entry("b"), entry("c")],
		future: [],
	};
	// Cascade two at once.
	const cascade = popUndoIds(start, ["c", "b"]);
	// Same work one at a time.
	const step1 = popUndoIds(start, ["c"]);
	const step2 = popUndoIds(step1.stacks, ["b"]);
	// Cascade ≡ sequential: identical past and redo-ready future order.
	expect(cascade.stacks.past.map((e) => e.id)).toEqual(
		step2.stacks.past.map((e) => e.id),
	);
	expect(cascade.stacks.future.map((e) => e.id)).toEqual(
		step2.stacks.future.map((e) => e.id),
	);
	expect(cascade.stacks.future.map((e) => e.id)).toEqual(["b", "c"]);
	// Round-trip: redoing the cascade restores the original past order.
	const redone = popRedoIds(cascade.stacks, ["b", "c"]);
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

test("a combine captures the created folder for exact undo/redo", () => {
	const state = setup(["x", "y"], ["t"]);
	const capture = snapshotSetup(state.cards, state.folders, state.order);
	const sub = folder("sub", "a");
	const moved = [card("x", "sub"), card("y", "sub"), card("t", "b")];
	const afterOrder = {
		a: [itemKey("folder", "sub")],
		b: [itemKey("card", "t")],
		sub: [itemKey("card", "x"), itemKey("card", "y")],
	};
	const result = buildHistoryEntry(
		capture,
		moved,
		[...state.folders, sub],
		afterOrder,
		{ kind: "combine", total: 2, cardCount: 2, folderCount: 0 },
	);
	expect(result).not.toBeNull();
	// Undo removes the created folder and restores both cards home.
	expect(result?.undo.delFolderIds).toEqual(["sub"]);
	expect(result?.undo.cards).toEqual({ x: "a", y: "a" });
	expect(result?.undo.containers.a).toEqual([
		itemKey("card", "x"),
		itemKey("card", "y"),
	]);
	// Redo recreates the folder record and reparents the block.
	expect(result?.redo.putFolders.map((f) => f.id)).toEqual(["sub"]);
	expect(result?.redo.cards).toEqual({ x: "sub", y: "sub" });
	expect(result?.redo.containers.sub).toEqual([
		itemKey("card", "x"),
		itemKey("card", "y"),
	]);
});

test("describes combines contextually", () => {
	const summary = {
		kind: "combine" as const,
		total: 2,
		cardCount: 2,
		folderCount: 0,
	};
	expect(describeHistoryAction(summary)).toBe(
		"Combine 2 bookmarks into a new folder",
	);
	expect(describeHistoryGerund(summary)).toBe(
		"combining 2 bookmarks into a new folder",
	);
	expect(describeHistoryPast(summary)).toBe(
		"Combined 2 bookmarks into a new folder",
	);
});

test("describes create, rename and delete contextually", () => {
	const create = {
		kind: "create" as const,
		total: 1,
		cardCount: 3,
		folderCount: 0,
		label: "Inspiration",
	};
	expect(describeHistoryAction(create)).toBe(
		"Create folder “Inspiration” with 3 bookmarks",
	);
	expect(describeHistoryGerund(create)).toBe(
		"creating folder “Inspiration” with 3 bookmarks",
	);
	expect(describeHistoryPast(create)).toBe(
		"Created folder “Inspiration” with 3 bookmarks",
	);
	const rename = {
		kind: "rename" as const,
		total: 1,
		cardCount: 0,
		folderCount: 1,
		label: "Design",
		newName: "UI",
	};
	expect(describeHistoryAction(rename)).toBe("Rename “Design” to “UI”");
	expect(describeHistoryGerund(rename)).toBe("renaming “Design” to “UI”");
	expect(describeHistoryPast(rename)).toBe("Renamed “Design” to “UI”");
	const remove = {
		kind: "delete" as const,
		total: 1,
		cardCount: 4,
		folderCount: 1,
		label: "Research",
	};
	expect(describeHistoryAction(remove)).toBe(
		"Delete folder “Research” (4 bookmarks, 1 subfolder)",
	);
	expect(describeHistoryPast(remove)).toBe(
		"Deleted folder “Research” (4 bookmarks, 1 subfolder)",
	);
});

test("names the top-level container distinctly", () => {
	expect(historyContainerName("__root__", [])).toBe("Top level");
	expect(historyContainerName("f", [{ id: "f", name: "Work" }])).toBe("Work");
	expect(historyContainerName("missing", [])).toBe("Home");
});

test("a rename carries old and new records without touching order", () => {
	const before = folder("d", null, "Design");
	const after = { ...before, name: "UI" };
	const result = buildRenameEntry(before, after);
	expect(result).not.toBeNull();
	expect(result?.summary).toMatchObject({
		kind: "rename",
		label: "Design",
		newName: "UI",
	});
	expect(result?.undo.putFolders).toEqual([before]);
	expect(result?.redo.putFolders).toEqual([after]);
	// Contract hook for the setup-store owner: merge only `name` for these.
	expect(result?.undo.nameOnlyIds).toEqual(["d"]);
	expect(result?.redo.nameOnlyIds).toEqual(["d"]);
	expect(buildRenameEntry(before, { ...before })).toBeNull();
});

test("commit eviction reports dropped entries for thumbnail cleanup (pure)", () => {
	// Why pure-only: history-store pulls the setup-store chain, which breaks
	// under bun cross-file imports, so the store wires this transition and
	// tests prove the transition here.
	function thumbEntry(id: string, thumbs?: string[]): HistoryEntry {
		const base = entry(id);
		return thumbs ? { ...base, thumbnails: thumbs } : base;
	}
	// Overflow: oldest past entries fall off and are reported.
	let past: HistoryEntry[] = [];
	for (let i = 0; i < HISTORY_LIMIT; i += 1) {
		past.push(thumbEntry(`e${i}`));
	}
	const full: HistoryStacks = { past, future: [] };
	const overflow = commitToStacks(
		full,
		thumbEntry("new", ["thumb-new"]),
	);
	expect(overflow.past).toHaveLength(HISTORY_LIMIT);
	expect(overflow.past[0].id).toBe("e1");
	expect(overflow.evicted.map((e) => e.id)).toEqual(["e0"]);
	expect(stagedThumbnailIds(overflow.evicted)).toEqual([]);
	// Staged bytes on the evicted entry surface for deletion.
	const withThumbs: HistoryStacks = {
		past: [thumbEntry("old", ["t1", "t2"]), ...past.slice(1)],
		future: [],
	};
	const overflowThumbs = commitToStacks(withThumbs, thumbEntry("new2"));
	expect(overflowThumbs.evicted.map((e) => e.id)).toEqual(["old"]);
	expect(stagedThumbnailIds(overflowThumbs.evicted)).toEqual(["t1", "t2"]);
	// Redo-branch discard: committing with a live future drops it for cleanup.
	const branched: HistoryStacks = {
		past: [thumbEntry("a")],
		future: [thumbEntry("b", ["tb"]), thumbEntry("c")],
	};
	const committed = commitToStacks(branched, thumbEntry("d"));
	expect(committed.future).toHaveLength(0);
	expect(committed.evicted.map((e) => e.id)).toEqual(["b", "c"]);
	expect(stagedThumbnailIds(committed.evicted)).toEqual(["tb"]);
	// Flattening skips entries without staged bytes, preserving order.
	expect(
		stagedThumbnailIds([
			thumbEntry("x"),
			thumbEntry("y", ["t3"]),
			thumbEntry("z", []),
		]),
	).toEqual(["t3"]);
});

test("a folder delete captures the subtree for atomic restore", () => {
	const sub = folder("sub", "r");
	const cards = [card("a", "r"), card("b", "sub")];
	const folders = [folder("r", null), sub];
	const order = {
		__root__: [itemKey("folder", "r")],
		r: [itemKey("card", "a"), itemKey("folder", "sub")],
		sub: [itemKey("card", "b")],
	};
	const capture = snapshotSetup(cards, folders, order);
	const result = buildHistoryEntry(capture, [], [], { __root__: [] }, {
		kind: "delete",
		total: 1,
		cardCount: 2,
		folderCount: 1,
		label: "r",
	});
	expect(result).not.toBeNull();
	// Undo restores every removed record; redo removes the same ids.
	expect(result?.undo.putFolders.map((f) => f.id).sort()).toEqual(["r", "sub"]);
	expect(result?.undo.putCards.map((c) => c.id).sort()).toEqual(["a", "b"]);
	expect(result?.undo.delFolderIds).toHaveLength(0);
	expect(result?.redo.delFolderIds.sort()).toEqual(["r", "sub"]);
	expect(result?.redo.delCardIds.sort()).toEqual(["a", "b"]);
	expect(result?.undo.containers.__root__).toEqual([itemKey("folder", "r")]);
	expect(result?.redo.containers.__root__).toEqual([]);
});
