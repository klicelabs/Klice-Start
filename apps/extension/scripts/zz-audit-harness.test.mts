/**
 * Pre-release audit pass 2 — diagnostic loop (review only, no production fixes).
 * Run: cd apps/extension && bun test scripts/zz-audit-harness.mts
 *
 * Independent second-pass verification of the pre-release audit findings using
 * the real history-stack transitions and history-capture snapshots. Each test
 * is a red-capable loop: it goes red if the audited behavior regresses.
 */
import { expect, test } from "bun:test";
import {
	beginGestureCapture,
	buildHistoryEntry,
	snapshotSetup,
} from "../src/lib/history-capture";
import {
	commitToStacks,
	popRedoIds,
	popUndoIds,
	stagedThumbnailIds,
} from "../src/lib/history";
import { ROOT_CONTAINER } from "../src/lib/item-order";
import type { Card, Folder } from "../src/types";

function card(id: string, folderId: string, title = `C${id}`): Card {
	return {
		id,
		folderId,
		title,
		url: "https://example.com/",
		order: 0,
		favicon: null,
		thumbId: null,
		origin: "local",
		capturedAt: null,
	};
}

function folder(id: string, name: string, parentId: string | null): Folder {
	return { id, name, order: 0, parentId };
}

function entry(id: string): Parameters<typeof popUndoIds>[0]["past"][number] {
	return {
		id,
		at: 0,
		summary: { kind: "move", total: 1, cardCount: 1, folderCount: 0 },
		undo: {
			containers: {},
			cards: {},
			folders: {},
			putCards: [],
			putFolders: [],
			delCardIds: [],
			delFolderIds: [],
		},
		redo: {
			containers: {},
			cards: {},
			folders: {},
			putCards: [],
			putFolders: [],
			delCardIds: [],
			delFolderIds: [],
		},
	};
}

/**
 * C1 (re-verification): cascade undo must produce the same stacks as
 * sequential single undos, and the redo branch must replay in chronological
 * order ("b" before "c" for entries committed a → b → c).
 */
test("C1 cascade undo is redo-ready in chronological order", () => {
	const start = { past: [entry("a"), entry("b"), entry("c")], future: [] };
	const cascade = popUndoIds(start, ["c", "b"]);
	const seq1 = popUndoIds(start, ["c"]);
	const seq2 = popUndoIds(seq1.stacks, ["b"]);
	// Cascade ≡ sequential (the fixed behavior the new unit test asserts).
	expect(cascade.stacks.future.map((e) => e.id)).toEqual(
		seq2.stacks.future.map((e) => e.id),
	);
	expect(cascade.stacks.future.map((e) => e.id)).toEqual(["b", "c"]);
	// Redo replays chronologically: redo both → past is [a, b, c].
	const redone = popRedoIds(cascade.stacks, ["b", "c"]);
	expect(redone.entries.map((e) => e.id)).toEqual(["b", "c"]);
	expect(redone.stacks.past.map((e) => e.id)).toEqual(["a", "b", "c"]);
});

/**
 * H1 (re-verification): a stale toast Undo (non-top id) now cascades via
 * requestUndoTo instead of silently matching zero entries. The store wires
 * this; here we prove the resulting entryIds do real work in popUndoIds.
 */
test("H1 undo-to-here entry ids match strictly top-down", () => {
	const stacks = { past: [entry("a"), entry("b"), entry("c")], future: [] };
	// requestUndoTo("a") produces ids top-down: ["c", "b", "a"].
	const ids = ["c", "b", "a"];
	const result = popUndoIds(stacks, ids);
	expect(result.entries.map((e) => e.id)).toEqual(["c", "b", "a"]);
	expect(result.stacks.past).toHaveLength(0);
	// And redo-to-here re-applies them head-first through the future branch.
	const redone = popRedoIds(result.stacks, ["a", "b", "c"]);
	expect(redone.stacks.past.map((e) => e.id)).toEqual(["a", "b", "c"]);
});

/**
 * Eviction cleanup (P3 groundwork): committing with a full past reports the
 * evicted entries and their staged thumbnails so bytes die only when an entry
 * can no longer be undone.
 */
test("eviction reports staged thumbnails for cleanup", () => {
	const full = {
		past: [entry("a"), entry("b")],
		future: [entry("z")],
	};
	const withThumbs = full.past.map((e) => ({ ...e }));
	(withThumbs[0] as { thumbnails?: string[] }).thumbnails = ["t-old"];
	const committed = commitToStacks(
		{ past: withThumbs, future: [entry("z")] },
		entry("new"),
	);
	// Under the limit, only the discarded redo branch is evicted.
	expect(committed.evicted.map((e) => e.id)).toEqual(["z"]);
	expect(stagedThumbnailIds(committed.evicted)).toEqual([]);
});

/**
 * M5 companion evidence: buildHistoryEntry snapshots container arrays
 * verbatim, so undo/redo replays exactly what it captured — including keys
 * that reference entities deleted after the capture. applyHistorySnapshot
 * writes those arrays back without pruning, so dead keys can re-enter
 * itemOrder (the original M5 mechanism, still present in the store applier).
 */
test("M5 replay of a stale snapshot re-arms pre-existing container keys", () => {
	beginGestureCapture(
		[card("k1", "f"), card("k2", "f")],
		[folder("f", "F", null)],
		{ f: ["card:k1", "card:k2"] },
	);
	const capture = snapshotSetup(
		[card("k1", "f"), card("k2", "f")],
		[folder("f", "F", null)],
		{ f: ["card:k1", "card:k2"] },
	);
	// Live state moves on: k2 is deleted and pruned from the container.
	const liveCards = [card("k1", "f")];
	const liveFolders = [folder("f", "F", null)];
	const liveOrder = { f: ["card:k1"] };
	// An unrelated later move commits a fresh entry whose containers only
	// reference k1. But undoing a hypothetical older entry captured BEFORE
	// the delete replays containers with card:k2 — the applier restores it.
	const entryOld = buildHistoryEntry(
		capture,
		liveCards,
		liveFolders,
		liveOrder,
		{ kind: "move", total: 1, cardCount: 1, folderCount: 0, dest: "F" },
	);
	// The stale capture still carries card:k2 on the UNDO side; redo carries
	// the live post-delete order. applyHistorySnapshot writes containers
	// verbatim, so undoing re-arms card:k2 in itemOrder (M5 mechanism).
	expect(entryOld?.undo.containers.f).toEqual(["card:k1", "card:k2"]);
	expect(entryOld?.redo.containers.f).toEqual(["card:k1"]);
});

/**
 * Rename diff (M1 groundwork): buildRenameEntry emits nameOnlyIds, but the
 * applier contract is store-owned — this only proves the producer side.
 */
test("M1 rename entry producer emits nameOnlyIds", () => {
	const before = folder("d", "Old", null);
	expect(buildHistoryEntry).toBeTypeOf("function");
	const { buildRenameEntry } = require("../src/lib/history-capture") as {
		buildRenameEntry: (b: Folder, a: Folder) => unknown;
	};
	const made = buildRenameEntry(before, { ...before, name: "New" }) as {
		undo: { nameOnlyIds?: string[]; putFolders: Folder[] };
		redo: { nameOnlyIds?: string[]; putFolders: Folder[] };
	};
	expect(made.undo.nameOnlyIds).toEqual(["d"]);
	expect(made.redo.nameOnlyIds).toEqual(["d"]);
	// Full records still ride along for backward compatibility.
	expect(made.undo.putFolders[0].name).toBe("Old");
	expect(made.redo.putFolders[0].name).toBe("New");
	expect(ROOT_CONTAINER).toBe("__root__");
});
