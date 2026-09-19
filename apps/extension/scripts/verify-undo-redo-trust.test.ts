/**
 * Wave-3 regression tests: undo/redo trust fixes.
 * Run: cd apps/extension && bun test scripts/verify-undo-redo-trust.test.ts
 *
 * Covers:
 *  - M1 applier: applyHistorySnapshot merges ONLY the name for nameOnlyIds
 *    (the producer was already emitting the field; the applier ignored it).
 *  - M4/NPD-3: invalidateForExternalSync prunes history entries whose redo no
 *    longer matches live state after an external write (pure helper).
 *  - H1 residue: requestUndoTo with a dead id surfaces deadIdNotice instead
 *    of exiting silently (store-level, no React).
 *  - M20/NPD-3: replaceSetup clears past+future (real store, memory adapter).
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
};

import { expect, test } from "bun:test";
import { useSetupStore } from "../src/stores/setup-store";
import { useHistoryStore } from "../src/stores/history-store";
import { buildRenameEntry } from "../src/lib/history-capture";

const S = () => useSetupStore.getState();
const H = () => useHistoryStore.getState();

function card(id: string, folderId: string) {
	return {
		id,
		folderId,
		title: `C-${id}`,
		url: `https://example.com/${id}`,
		favicon: null,
		thumbId: null,
		order: 0,
		origin: "local" as const,
		capturedAt: null,
	};
}

function folder(id: string, name: string, parentId: string | null) {
	return { id, name, order: 0, parentId };
}

test("M1: rename undo merges only the name, leaving concurrent reparent intact", () => {
	const fid = S().addFolder("Old Name", null);
	const cid = S().addCard({
		folderId: fid,
		title: "inside",
		url: "https://example.com/inside",
		favicon: null,
		thumbId: null,
	});
	// Rename entry captured while the folder sat at the root.
	const entry = buildRenameEntry(
		folder(fid, "Old Name", null),
		folder(fid, "New", null),
	);
	expect(entry).not.toBeNull();
	// Concurrent external mutation between commit and undo: the folder was
	// moved under a new parent. The stale full record in the entry still has
	// parentId null — a wholesale replace would clobber it.
	const pid = S().addFolder("Parent", null);
	S().moveFolder(fid, pid);
	// Apply the rename UNDO snapshot (this is what confirmPending does).
	S().applyHistorySnapshot(entry!.undo);
	const after = S().folders.find((f) => f.id === fid)!;
	expect(after.name).toBe("Old Name"); // rename reverted
	expect(after.parentId).toBe(pid); // concurrent reparent NOT clobbered
	// Redo merges only the new name too.
	S().applyHistorySnapshot(entry!.redo);
	const redone = S().folders.find((f) => f.id === fid)!;
	expect(redone.name).toBe("New");
	expect(redone.parentId).toBe(pid);
	// Cleanup so other tests start clean.
	S().deleteCard(cid);
	S().deleteFolder(fid);
	S().deleteFolder(pid);
});

test("M5: non-rename restores repair legacy order fields", () => {
	const fid = S().addFolder("Keep", null);
	// Non-rename snapshot: full record restore (e.g. deleted folder revival).
	const snapshot = {
		containers: {},
		cards: {},
		folders: {},
		putCards: [],
		putFolders: [{ id: fid, name: "Revived", order: 7, parentId: null }],
		delCardIds: [],
		delFolderIds: [],
	};
	// Remove the folder so putFolders re-creates it wholesale.
	S().deleteFolder(fid);
	S().applyHistorySnapshot(snapshot);
	const revived = S().folders.find((f) => f.id === fid);
	expect(revived).toEqual({
		id: fid,
		name: "Revived",
		order: 1,
		parentId: null,
	});
});

function makeEntry(id: string, redo: Record<string, unknown>) {
	return {
		id,
		at: 0,
		summary: { kind: "move" as const, total: 1, cardCount: 1, folderCount: 0 },
		undo: {
			containers: {},
			cards: {},
			folders: {},
			putCards: [],
			putFolders: [],
			delCardIds: [],
			delFolderIds: [],
		},
		redo: redo as never,
	};
}

function emptyRedo() {
	return {
		containers: {},
		cards: {},
		folders: {},
		putCards: [],
		putFolders: [],
		delCardIds: [],
		delFolderIds: [],
	};
}

const matchingLive = () => ({
	cards: new Map([["c1", "f1"]]),
	folders: new Map<string, string | null>([["f1", null]]),
	containers: { f1: ["card:c1"] } as Record<string, readonly string[]>,
});

test("M4/NPD-3: invalidateForExternalSync prunes entries whose redo drifted", () => {
	H().clearHistory();
	// Matching external state -> the entry stays undoable.
	H().commit(makeEntry("h-m4-a", {
		...emptyRedo(),
		containers: { f1: ["card:c1"] },
		cards: { c1: "f1" },
	}));
	H().invalidateForExternalSync(matchingLive());
	expect(H().past.map((e) => e.id)).toEqual(["h-m4-a"]);
	// A reordered container in the external write kills the entry.
	H().invalidateForExternalSync({
		...matchingLive(),
		containers: { f1: ["card:c2", "card:c1"] },
	});
	expect(H().past).toHaveLength(0);
	// A card moved by the external write kills the entry.
	H().commit(makeEntry("h-m4-b", {
		...emptyRedo(),
		cards: { c1: "f1" },
	}));
	H().invalidateForExternalSync({
		...matchingLive(),
		cards: new Map([["c1", "f2"]]),
	});
	expect(H().past).toHaveLength(0);
	// A container removed by the external write kills the entry.
	H().commit(makeEntry("h-m4-c", {
		...emptyRedo(),
		containers: { gone: [] },
	}));
	H().invalidateForExternalSync(matchingLive());
	expect(H().past).toHaveLength(0);
	// The redo branch is ALWAYS invalidated (NPD-3, conservative).
	useHistoryStore.setState({ future: [makeEntry("h-m4-f", emptyRedo())] });
	H().invalidateForExternalSync(matchingLive());
	expect(H().future).toHaveLength(0);
	H().clearHistory();
});

test("H1 residue: dead undo id surfaces a deadIdNotice instead of silence", () => {
	// Fresh history (clear then seed via commit).
	H().clearHistory();
	H().commit({
		id: "h-dead-1",
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
	});
	// A request for an id that is not in the branch must be reported.
	H().requestUndoTo("h-evicted-away");
	expect(H().deadIdNotice).toEqual({
		direction: "undo",
		entryId: "h-evicted-away",
	});
	const noticed = H().consumeDeadIdNotice();
	expect(noticed?.entryId).toBe("h-evicted-away");
	expect(H().consumeDeadIdNotice()).toBeNull();
	// With an EMPTY past there is nothing to explain (shortcut path already
	// no-ops on empty stacks); no notice should be surfaced.
	H().clearHistory();
	H().requestUndoTo("h-any");
	expect(H().deadIdNotice).toBeNull();
	H().requestRedoTo("h-any");
	expect(H().deadIdNotice).toBeNull();
});

test("M20/NPD-3: replaceSetup clears past and future", () => {
	H().clearHistory();
	H().commit({
		id: "h-pre-reset",
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
	});
	expect(H().past.length).toBe(1);
	S().replaceSetup({
		...(S() as unknown as Record<string, never>),
		folders: [],
		cards: [],
		activeFolderId: "default",
		settings: S().settings,
		itemOrder: {},
	} as never);
	expect(H().past).toHaveLength(0);
	expect(H().future).toHaveLength(0);
	expect(H().pending).toBeNull();
	H().clearHistory();
});
