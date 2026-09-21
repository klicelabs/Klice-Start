/**
 * H4 regression test — tab reorder history must capture the DROP, not the
 * first hover. Run: cd apps/extension && bun test scripts/verify-tab-reorder-history.test.ts
 *
 * Wave-3 mechanism: hover calls previewReorderItems (order-array write only,
 * legacy `order` fields stay stale, nothing history-worthy happens); the drop
 * calls reorderItems (real commit, legacy fields converge). The gesture
 * capture from dragstart diffs once against the post-drop state — exactly one
 * entry covering the whole gesture. Asserts the store-level contract the
 * App.tsx/folder-tabs wiring relies on (DOM-level preview assertions live in
 * the component, not this store seam).
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
import { useSetupStore } from "../src/stores/setup-store";
import { buildHistoryEntry, snapshotSetup } from "../src/lib/history-capture";

const S = () => useSetupStore.getState();

test("H4: hovers preview without legacy reindex; drop converges and diffs once", () => {
	// Two fresh roots appended after the store's default Home folder.
	const a = S().addFolder("H4-A", null);
	const b = S().addFolder("H4-B", null);
	const keys = S().itemOrder?.__root__ ?? [];
	expect(keys.slice(-2)).toEqual([`folder:${a}`, `folder:${b}`]);

	// Gesture begins: freeze the pre-drag order.
	const capture = snapshotSetup(S().cards, S().folders, S().itemOrder);

	// Two hovers (as folder-tabs liveReorder would fire): visual previews.
	S().previewReorderItems(
		"__root__",
		{ kind: "folder", id: b },
		{ kind: "folder", id: a },
		"before",
	);
	S().previewReorderItems(
		"__root__",
		{ kind: "folder", id: a },
		{ kind: "folder", id: b },
		"after",
	);
	// The final preview matches the drop target position.
	expect(S().itemOrder?.__root__.slice(-2)).toEqual([
		`folder:${b}`,
		`folder:${a}`,
	]);
	// Preview must NOT have reindexed the legacy fields: b keeps its
	// original order number until the real commit runs.
	const bBefore = S().folders.find((f) => f.id === b)!.order;

	// Drop: one real commit at the final hovered position.
	S().reorderItems(
		"__root__",
		{ kind: "folder", id: a },
		{ kind: "folder", id: b },
		"after",
	);
	expect(S().itemOrder?.__root__.slice(-2)).toEqual([
		`folder:${b}`,
		`folder:${a}`,
	]);
	// Legacy fields converge to the final sequence (b moved after a).
	const bAfter = S().folders.find((f) => f.id === b)!.order;
	expect(bAfter).not.toBe(bBefore);
	// Non-touched roots keep contiguous indexes (reindex is order-wide).
	const rootOrders = (S().itemOrder?.__root__ ?? []).map(
		(key) => S().folders.find((f) => f.id === key.slice("folder:".length))!.order,
	);
	expect(new Set(rootOrders).size).toBe(rootOrders.length);

	// History: one diff of capture vs post-drop state — one entry covering
	// every intermediate hover, and the undo side restores the pre-drag
	// sequence exactly.
	const entry = buildHistoryEntry(
		capture,
		S().cards,
		S().folders,
		S().itemOrder,
		{ kind: "reorder", total: 1, cardCount: 0, folderCount: 1, container: "Top level" },
	);
	expect(entry).not.toBeNull();
	expect(entry!.undo.containers.__root__.slice(-2)).toEqual([
		`folder:${a}`,
		`folder:${b}`,
	]);
	expect(entry!.redo.containers.__root__.slice(-2)).toEqual([
		`folder:${b}`,
		`folder:${a}`,
	]);

	// Zero-hover gesture: drop alone still produces the same single entry.
	const capture2 = snapshotSetup(S().cards, S().folders, S().itemOrder);
	S().reorderItems(
		"__root__",
		{ kind: "folder", id: b },
		{ kind: "folder", id: a },
		"after",
	);
	const entry2 = buildHistoryEntry(
		capture2,
		S().cards,
		S().folders,
		S().itemOrder,
		{ kind: "reorder", total: 1, cardCount: 0, folderCount: 1, container: "Top level" },
	);
	expect(entry2).not.toBeNull();
	expect(entry2!.redo.containers.__root__.slice(-2)).toEqual([
		`folder:${a}`,
		`folder:${b}`,
	]);

	// Cleanup so other tests start clean.
	S().deleteFolder(a);
	S().deleteFolder(b);
});
