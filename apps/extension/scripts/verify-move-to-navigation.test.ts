/**
 * Task 3 — "Move to…" follows the folder you are standing in (option B).
 * Run: cd apps/extension && bun test scripts/verify-move-to-navigation.test.ts
 *
 * Two seams:
 *  1. `moveFollowTarget` — the pure decision. Which moves navigate, and to
 *     where. Compared by ID, never by name or path.
 *  2. The history contract — the view rides on the SAME entry as the tree, so
 *     one undo puts the user back where they were instead of leaving them on a
 *     destination they only reached because of the move.
 */
// ---- Minimal browser shims (storage.ts guards chrome; idb stays lazy). ----
const mem = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
	getItem: (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
	setItem: (k: string, v: string) => void mem.set(k, String(v)),
	removeItem: (k: string) => void mem.delete(k),
	clear: () => mem.clear(),
} as Storage;
(globalThis as Record<string, unknown>).window = {
	addEventListener: () => undefined,
	removeEventListener: () => undefined,
};
(globalThis as Record<string, unknown>).document = {
	addEventListener: () => undefined,
	removeEventListener: () => undefined,
	visibilityState: "visible",
	// motion-dom's frameloop is a process-wide singleton that reads the LIVE
	// `document` global on every tick (DocumentProjectionNode.measureScroll).
	// The render harnesses in this folder leave animations pending, so a stub
	// without `documentElement` makes a stray tick throw and aborts the run.
	// Keep the double document-shaped even though this file never renders.
	documentElement: { scrollLeft: 0, scrollTop: 0 },
};

import { expect, test } from "bun:test";
import { moveFollowTarget } from "../src/components/shared/move-to-dialog";
import { buildHistoryEntry, snapshotSetup } from "../src/lib/history-capture";
import { useHistoryStore } from "../src/stores/history-store";
import { useSetupStore } from "../src/stores/setup-store";

const S = () => useSetupStore.getState();
const H = () => useHistoryStore.getState();

// ---- The pure decision ---------------------------------------------------

test("moving the current folder into a root folder follows to that folder", () => {
	// design → dev: the user was standing in design, which is now inside dev.
	expect(moveFollowTarget("dev", ["design"], "design")).toBe("dev");
});

test("moving the current folder into a nested folder follows to that folder", () => {
	// design → dev > ui: the destination is the deep id, not the root.
	expect(moveFollowTarget("ui", ["design"], "design")).toBe("ui");
});

test("moving the current folder to the top level does not navigate", () => {
	// The moved folder BECOMES a root, so the derived breadcrumb collapses on
	// its own — there is nowhere new to go, and this stays a no-op.
	expect(moveFollowTarget(null, ["design"], "design")).toBeNull();
	// Nothing chosen yet.
	expect(moveFollowTarget(undefined, ["design"], "design")).toBeNull();
});

test("moving a different folder never navigates", () => {
	// The acceptance case: `outra` is not the folder the user is standing in.
	expect(moveFollowTarget("dev", ["outra"], "design")).toBeNull();
	// A bookmark-only move has no folder to follow either.
	expect(moveFollowTarget("dev", [], "design")).toBeNull();
});

test("the decision compares ids, never names", () => {
	// Two folders can share a name. Only the id identifies the current folder.
	const sameNameButDifferent = ["design-copy"];
	expect(moveFollowTarget("dev", sameNameButDifferent, "design")).toBeNull();
	expect(moveFollowTarget("dev", ["design"], "design")).toBe("dev");
});

test("a group move follows when the current folder is part of it", () => {
	expect(moveFollowTarget("dev", ["design", "outra"], "design")).toBe("dev");
});

// ---- One entry carries tree AND view -------------------------------------

interface Scene {
	dev: string;
	design: string;
	ui: string;
}

/** dev (root) → ui, plus a separate root folder `design`. */
function scene(): Scene {
	const dev = S().addFolder("dev", null);
	const ui = S().addFolder("ui", dev);
	const design = S().addFolder("design", null);
	return { dev, design, ui };
}

function cleanUp({ dev, design, ui }: Scene) {
	H().clearHistory();
	for (const id of [ui, design, dev]) {
		if (S().folders.some((f) => f.id === id)) S().deleteFolder(id);
	}
}

/**
 * Exactly what MoveToDialog.handleMove does, minus the rendering: snapshot,
 * move, build the entry, tag it with the locations the move implies, commit.
 */
function moveViaDialog(scene: Scene, destinationId: string) {
	const state = S();
	const before = snapshotSetup(state.cards, state.folders, state.itemOrder);
	state.moveItemsToContainer(destinationId, [], [scene.design]);
	const live = S();
	const entry = buildHistoryEntry(
		before,
		live.cards,
		live.folders,
		live.itemOrder,
		{
			kind: "move",
			total: 1,
			cardCount: 0,
			folderCount: 1,
			dest: live.folders.find((f) => f.id === destinationId)?.name,
		},
	);
	if (!entry) throw new Error("expected a move entry");
	const follow = moveFollowTarget(destinationId, [scene.design], scene.design);
	if (follow) {
		entry.undo.location = scene.design;
		entry.redo.location = follow;
	}
	H().commit(entry, { silent: true });
	// The caller's onNavigate -> handleSelectFolder.
	if (follow) S().setActiveFolder(follow);
	return entry;
}

test("undo reverts the move AND the navigation as a single entry", () => {
	const s = scene();
	S().setActiveFolder(s.design);

	const entry = moveViaDialog(s, s.dev);
	// The move landed...
	expect(S().folders.find((f) => f.id === s.design)?.parentId).toBe(s.dev);
	// ...and the view followed it, because the user was standing in `design`.
	expect(S().activeFolderId).toBe(s.dev);
	// One gesture, one entry — navigation never adds a second.
	expect(H().past).toHaveLength(1);

	H().requestUndo(entry.id);
	H().confirmPending();
	// Both halves of the gesture are back.
	expect(S().folders.find((f) => f.id === s.design)?.parentId).toBeNull();
	expect(S().activeFolderId).toBe(s.design);

	// Redo restores both halves too, so the pair is symmetric.
	H().requestRedo(entry.id);
	H().confirmPending();
	expect(S().folders.find((f) => f.id === s.design)?.parentId).toBe(s.dev);
	expect(S().activeFolderId).toBe(s.dev);

	cleanUp(s);
});

test("a move that does not navigate still undoes the tree only", () => {
	const s = scene();
	// The user is standing in `dev`; the moved folder is `design`.
	S().setActiveFolder(s.dev);
	const state = S();
	const before = snapshotSetup(state.cards, state.folders, state.itemOrder);
	state.moveItemsToContainer(s.ui, [], [s.design]);
	const live = S();
	const entry = buildHistoryEntry(
		before,
		live.cards,
		live.folders,
		live.itemOrder,
		{ kind: "move", total: 1, cardCount: 0, folderCount: 1, dest: "ui" },
	);
	if (!entry) throw new Error("expected a move entry");
	// No follow, so no location is tagged at all.
	expect(moveFollowTarget(s.ui, [s.design], s.dev)).toBeNull();
	H().commit(entry, { silent: true });
	expect(entry.undo.location).toBeUndefined();
	expect(S().activeFolderId).toBe(s.dev);

	H().requestUndo(entry.id);
	H().confirmPending();
	expect(S().folders.find((f) => f.id === s.design)?.parentId).toBeNull();
	expect(S().activeFolderId).toBe(s.dev);

	cleanUp(s);
});

test("a snapshot never strands the app on a folder the replay removed", () => {
	const s = scene();
	S().setActiveFolder(s.dev);
	// A stale entry whose recorded location no longer exists after the replay.
	S().applyHistorySnapshot({
		containers: {},
		cards: {},
		folders: {},
		putCards: [],
		putFolders: [],
		delCardIds: [],
		delFolderIds: [s.design],
		location: s.design,
	});
	// The location is ignored; the user stays where they were.
	expect(S().activeFolderId).toBe(s.dev);
	cleanUp(s);
});
