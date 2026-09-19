/**
 * Wave-5 regression tests: delete history + thumbnail tombstones.
 * Run: cd apps/extension && bun test scripts/verify-delete-history.test.ts
 *
 * Covers:
 *  - H2: deleteCard/deleteFolder commit ONE atomic entry; undo restores
 *    records, container positions and (folder case) the full subtree.
 *  - H2: last-root delete stays a guarded no-op (no entry).
 *  - H3/P3: deleting never destroys thumb bytes at the act; undo/redo keep
 *    them alive; only undo-branch eviction GCs them (the discarded redo
 *    branch must NOT be collected — undone cards still reference bytes).
 *  - GC hygiene: staged ids surface on past eviction; reset clears history
 *    and GCs past-resident staged bytes.
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

import { afterEach, beforeEach, expect, test } from "bun:test";
import { ROOT_CONTAINER } from "../src/lib/item-order";
import { useHistoryStore } from "../src/stores/history-store";
import { useImageStore } from "../src/stores/image-store";
import { useSetupStore } from "../src/stores/setup-store";

const S = () => useSetupStore.getState();
const H = () => useHistoryStore.getState();

// bun runs every test file in one process: earlier files (e.g.
// verify-data-integrity) leave store/history behind — start each test clean.
beforeEach(() => {
	useHistoryStore.setState({ past: [], future: [], pending: null });
	useSetupStore.setState(useSetupStore.getInitialState());
});

/** Spy on image byte deletes without touching real IndexedDB. */
const realGetState = useImageStore.getState.bind(useImageStore);
let byteDeletes: string[][] = [];
function spyBytes(): void {
	byteDeletes = [];
	type Patchable = {
		getState: () => ReturnType<typeof useImageStore.getState>;
	};
	(useImageStore as unknown as Patchable).getState = () => ({
		...realGetState(),
		deleteThumbnail: async (id: string) => {
			byteDeletes.push([id]);
		},
		deleteThumbnails: async (ids: readonly string[]) => {
			byteDeletes.push([...ids]);
		},
	});
}
function unspyBytes(): void {
	type Patchable = {
		getState: () => ReturnType<typeof useImageStore.getState>;
	};
	(useImageStore as unknown as Patchable).getState = realGetState;
}
afterEach(() => {
	unspyBytes();
	useHistoryStore.setState({ past: [], future: [], pending: null });
	useSetupStore.setState(useSetupStore.getInitialState());
});

function seed(): { fid: string; c1: string; c2: string } {
	const fid = S().addFolder("D", null);
	const c1 = S().addCard({
		folderId: fid,
		title: "One",
		url: "https://example.com/1",
		favicon: null,
		thumbId: "thumb_one",
	});
	const c2 = S().addCard({
		folderId: fid,
		title: "Two",
		url: "https://example.com/2",
		favicon: null,
		thumbId: "thumb_two",
	});
	return { fid, c1, c2 };
}

test("H2: deleteCard commits one entry and undo restores the exact slot", () => {
	spyBytes();
	const { fid, c1, c2 } = seed();
	expect(H().past).toHaveLength(0);
	S().deleteCard(c1);
	const past = H().past;
	expect(past).toHaveLength(1);
	const entry = past[0];
	expect(entry.summary.kind).toBe("delete");
	expect(entry.summary.label).toBe("One");
	expect(entry.thumbnails).toEqual(["thumb_one"]);
	// Bytes were NOT destroyed at the act (P3).
	expect(byteDeletes).toEqual([]);
	// Undo restores the card AND its exact container slot.
	H().requestUndo();
	expect(H().confirmPending()).not.toBeNull();
	expect(S().cards.some((c) => c.id === c1)).toBe(true);
	expect(S().itemOrder[fid]).toEqual([`card:${c1}`, `card:${c2}`]);
	// Redo deletes again via the entry's redo snapshot.
	H().requestRedo();
	expect(H().confirmPending()).not.toBeNull();
	expect(S().cards.some((c) => c.id === c1)).toBe(false);
	expect(S().itemOrder[fid]).toEqual([`card:${c2}`]);
	// Redo did not GC the tombstoned bytes (the entry is undoable again).
	expect(byteDeletes).toEqual([]);
});

test("H2: user bookmark metadata updates are reversible field patches", () => {
	const fid = S().addFolder("D", null);
	const cid = S().addCard({
		folderId: fid,
		title: "Before",
		url: "https://example.com/before",
		favicon: null,
		thumbId: null,
	});
	H().clearHistory();
	S().updateCard(
		cid,
		{ title: "After", url: "https://example.com/after" },
		{ history: true },
	);
	const entry = H().past.at(-1);
	expect(entry).toBeDefined();
	expect(entry?.summary.kind).toBe("update");
	expect(S().cards.find((card) => card.id === cid)?.title).toBe("After");
	S().applyHistorySnapshot(entry.undo);
	expect(S().cards.find((card) => card.id === cid)).toMatchObject({
		title: "Before",
		url: "https://example.com/before",
	});
	S().applyHistorySnapshot(entry.redo);
	expect(S().cards.find((card) => card.id === cid)).toMatchObject({
		title: "After",
		url: "https://example.com/after",
	});
});

test("H2: deleteFolder commits one entry and undo restores the whole subtree", () => {
	spyBytes();
	const { fid } = seed();
	const sub = S().addFolder("Sub", fid);
	S().addCard({
		folderId: sub,
		title: "Deep",
		url: "https://example.com/deep",
		favicon: null,
		thumbId: "thumb_deep",
	});
	// The two addFolder/addCard ops before the delete are 2 entries; drop
	// them to isolate the delete entry.
	useHistoryStore.setState({ past: [], future: [], pending: null });
	const subCardRecord = S().cards.find((c) => c.folderId === sub);
	expect(subCardRecord).toBeDefined();
	if (!subCardRecord) throw new Error("expected deep card");
	const subCard = subCardRecord.id;
	S().deleteFolder(fid);
	const past = H().past;
	expect(past).toHaveLength(1);
	const entry = past[0];
	expect(entry.summary.kind).toBe("delete");
	expect(entry.summary.folderCount).toBe(1); // Sub
	expect(entry.summary.cardCount).toBe(3); // One, Two, Deep
	expect(entry.thumbnails).toEqual(["thumb_one", "thumb_two", "thumb_deep"]);
	expect(byteDeletes).toEqual([]);
	// Undo restores folder, subfolder, cards and container arrays.
	H().requestUndo();
	expect(H().confirmPending()).not.toBeNull();
	expect(S().folders.some((f) => f.id === fid)).toBe(true);
	expect(S().folders.some((f) => f.id === sub)).toBe(true);
	expect(S().cards.some((c) => c.id === subCard)).toBe(true);
	expect(S().itemOrder[fid]).toContain(`folder:${sub}`);
	expect(S().itemOrder[sub]).toEqual([`card:${subCard}`]);
	expect(S().itemOrder[ROOT_CONTAINER]).toContain(`folder:${fid}`);
});

test("H2: deleting the last root folder is a guarded no-op (no entry)", () => {
	useSetupStore.setState({ folders: [], cards: [], itemOrder: {} });
	const fid = S().addFolder("Only", null);
	useHistoryStore.setState({ past: [], future: [], pending: null });
	S().deleteFolder(fid);
	expect(H().past).toHaveLength(0);
	expect(S().folders.some((f) => f.id === fid)).toBe(true);
});

test("P3 GC: live-referenced bytes survive discards; evicted garbage goes", () => {
	spyBytes();
	const { fid, c1 } = seed();
	useHistoryStore.setState({ past: [], future: [], pending: null });
	S().deleteCard(c1); // stages thumb_one on the delete entry
	H().requestUndo();
	H().confirmPending();
	// Card is LIVE again (restored). Any discard must keep thumb_one.
	S().addCard({
		folderId: fid,
		title: "Noise",
		url: "https://example.com/noise",
		favicon: null,
		thumbId: null,
	}); // discards the redo branch
	expect(byteDeletes).toEqual([]);
	// Redo the delete: card gone for good, entry back in past with bytes.
	H().requestRedo();
	H().confirmPending();
	expect(byteDeletes).toEqual([]); // still undoable
	// Overflow the 30-entry bound with real commits (add+delete cycles):
	// the delete entry leaves past; with no live card referencing thumb_one,
	// eviction finally GCs the bytes.
	for (let i = 0; i < 40; i++) {
		const filler = S().addCard({
			folderId: fid,
			title: `Filler ${i}`,
			url: `https://example.com/f${i}`,
			favicon: null,
			thumbId: null,
		});
		S().deleteCard(filler);
	}
	const flushed = byteDeletes.flat();
	expect(flushed).toContain("thumb_one");
});

test("P3 GC: clearHistory collects past-resident bytes; undone survive", () => {
	spyBytes();
	const { c1 } = seed();
	useHistoryStore.setState({ past: [], future: [], pending: null });
	// Past-resident: reset/import GCs the bytes (nothing live references them).
	S().deleteCard(c1);
	H().clearHistory();
	expect(byteDeletes.flat()).toContain("thumb_one");
	// Future-resident: the undo restored the card, so its bytes stay.
	const { c1: c2 } = seed();
	useHistoryStore.setState({ past: [], future: [], pending: null });
	S().deleteCard(c2);
	H().requestUndo();
	H().confirmPending();
	byteDeletes = [];
	H().clearHistory();
	expect(byteDeletes).toEqual([]);
});
