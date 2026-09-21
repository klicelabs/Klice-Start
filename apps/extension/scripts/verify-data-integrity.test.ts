/**
 * Data-integrity regression tests (wave 3).
 * Run: cd apps/extension && bun test scripts/verify-data-integrity.test.ts
 *
 * Covers:
 *  - H5/M11: normalizeState remaps cards whose folderId points at a missing
 *    folder to the active folder (orphans were invisible in the grid and
 *    survived into exports).
 *  - H12: uid() is collision-resistant — thousands of same-millisecond ids
 *    stay unique (the legacy ~31-bit form aliased on bulk imports).
 *  - M21: reset failure restores the WHOLE pre-reset state, itemOrder
 *    included (grid used to fall back to scrambled legacy order).
 *  - L4: deleteCard prunes emptied non-root containers from itemOrder.
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
import { normalizeState } from "../src/lib/storage";
import { uid } from "../src/lib/utils";
import { useSetupStore } from "../src/stores/setup-store";

const S = () => useSetupStore.getState();

function folder(id: string, name: string) {
	return { id, name, order: 0, parentId: null };
}

test("H5/M11: normalizeState remaps ghost-folder cards to the active folder", () => {
	const migrated = normalizeState({
		folders: [folder("f1", "Home")],
		cards: [
			{
				id: "c1",
				folderId: "ghost-folder",
				title: "Orphan",
				url: "https://example.com/orphan",
				favicon: null,
				thumbId: null,
				order: 0,
			},
			{
				id: "c2",
				folderId: "f1",
				title: "Safe",
				url: "https://example.com/safe",
				favicon: null,
				thumbId: null,
				order: 0,
			},
		],
		activeFolderId: "f1",
	} as never);
	// The orphan is now visible (it used to be dropped from the grid forever
	// while still appearing in exports).
	expect(migrated.cards.find((c) => c.id === "c1")?.folderId).toBe("f1");
	expect(migrated.cards.find((c) => c.id === "c2")?.folderId).toBe("f1");
	// And it participates in the repaired order of its new container.
	expect(migrated.itemOrder?.f1).toContain("card:c1");
});

test("H12: uid stays unique across thousands of same-millisecond calls", () => {
	const count = 5000;
	const ids = new Set<string>();
	for (let i = 0; i < count; i++) ids.add(uid());
	expect(ids.size).toBe(count);
	// Also across a burst plus a fresh timestamp bucket edge.
	const more = new Set<string>();
	for (let i = 0; i < count; i++) more.add(uid());
	expect(more.size).toBe(count);
	expect([...ids].some((id) => more.has(id))).toBe(false);
});

test("M21: reset failure restores itemOrder along with the rest", async () => {
	// Arrange a recognizable state, then force the reset to fail mid-way.
	const fid = S().addFolder("M21", null);
	const before = {
		folders: S().folders,
		cards: S().cards,
		activeFolderId: S().activeFolderId,
		settings: S().settings,
		itemOrder: S().itemOrder,
	};
	// break beginReset's storage write by pointing chrome.storage at a
	// throwing stub for this test only.
	const realStorage = (globalThis as Record<string, unknown>).chrome;
	(globalThis as Record<string, unknown>).chrome = {
		storage: {
			local: {
				async get() {
					return {};
				},
				async set() {
					throw new Error("quota exceeded (simulated)");
				},
				async remove() {
					throw new Error("quota exceeded (simulated)");
				},
			},
			onChanged: { addListener: () => undefined, removeListener: () => undefined },
		},
	};
	let threw = false;
	try {
		await S().resetAll();
	} catch {
		threw = true;
	}
	(globalThis as Record<string, unknown>).chrome = realStorage;
	expect(threw).toBe(true);
	// The full pre-reset state is back, arrangement included.
	expect(S().folders).toEqual(before.folders);
	expect(S().cards).toEqual(before.cards);
	expect(S().itemOrder).toEqual(before.itemOrder);
	// Cleanup
	S().deleteFolder(fid);
});

test("L4: deleteCard prunes emptied non-root containers", () => {
	const fid = S().addFolder("L4", null);
	const cid = S().addCard({
		folderId: fid,
		title: "only-child",
		url: "https://example.com/only",
		favicon: null,
		thumbId: null,
	});
	expect(S().itemOrder?.[fid]).toEqual([`card:${cid}`]);
	S().deleteCard(cid);
	// The ghost container is gone (it used to linger as an empty array).
	expect(S().itemOrder?.[fid]).toBeUndefined();
	// Root container is never pruned, even when empty.
	const root = S().itemOrder?.__root__;
	expect(Array.isArray(root)).toBe(true);
	S().deleteFolder(fid);
});
