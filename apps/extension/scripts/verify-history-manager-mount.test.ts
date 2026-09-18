/**
 * Regression test — HistoryManager mount integrity (black-screen bug, wave 4).
 * Run: cd apps/extension && bun test scripts/verify-history-manager-mount.test.ts
 *
 * History: the H1-residue effect called useHistoryStore(selector) INSIDE its
 * useEffect callback (an invalid hook call). React threw on every mount of
 * HistoryManager and unmounted the whole tree — the newtab rendered as an
 * empty dark screen. The fix subscribes in the component body and lets the
 * effect react to the deadIdNotice value.
 *
 * This test goes red if any hook is called outside render again: a crashed
 * mount unmounts the root, so the probe span next to <HistoryManager />
 * disappears. It also drives the dead-id path end-to-end to prove the H1
 * residue feature still works (notice -> consume -> toast).
 */
import { afterEach, expect, mock, test } from "bun:test";
import { parseHTML } from "linkedom";
import { createElement, Fragment } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const { window } = parseHTML(
	"<!doctype html><html><body><div id=app></div></body></html>",
);

Object.assign(globalThis, {
	window,
	document: window.document,
	self: window,
	navigator: window.navigator,
	HTMLElement: window.HTMLElement,
	Node: window.Node,
	Event: window.Event,
	KeyboardEvent: window.KeyboardEvent,
	requestAnimationFrame: (cb: (t: number) => void) =>
		setTimeout(() => cb(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Recording stub for sonner: keeps the component's DOM-free toast calls
// observable without mounting a <Toaster>. Mock must be installed before the
// component module (and its `import { toast } from "sonner"`) is loaded.
const toastCalls: Array<{ method: string; args: unknown[] }> = [];
mock.module("sonner", () => ({
	toast: new Proxy(
		{},
		{
			get: (_target, method) =>
				(...args: unknown[]) => {
					toastCalls.push({ method: String(method), args });
				},
		},
	),
}));

const { HistoryManager } = await import(
	"../src/components/newtab/history-manager.tsx"
);
const { useHistoryStore } = await import("../src/stores/history-store.ts");

let root: Root | null = null;
const container = () => document.getElementById("app") as HTMLElement;

function mountHistoryManager() {
	root = createRoot(container());
	act(() => {
		root?.render(
			createElement(
				Fragment,
				null,
				createElement("span", { id: "probe-alive" }),
				createElement(HistoryManager),
			),
		);
	});
}

afterEach(() => {
	useHistoryStore.getState().clearHistory();
	root?.unmount();
	root = null;
	toastCalls.length = 0;
});

test("HistoryManager mounts without unmounting the tree (no invalid hook call)", () => {
	mountHistoryManager();
	// If HistoryManager crashed on mount, React unmounts the root and the
	// probe span disappears with it.
	expect(document.getElementById("probe-alive")).not.toBeNull();
});

test("dead undo id surfaces the explanatory toast (H1 residue still works)", () => {
	mountHistoryManager();
	expect(document.getElementById("probe-alive")).not.toBeNull();

	// A real past entry, then a stale id pointing at nothing (the evicted/
	// discarded-branch case the notice exists for).
	const entry = {
		id: "h-alive",
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
		redo: {
			containers: {},
			cards: {},
			folders: {},
			putCards: [],
			putFolders: [],
			delCardIds: [],
			delFolderIds: [],
		},
	} as never;
	// Within this single act() the zustand update re-renders the manager, its
	// effect consumes the notice and fires the toast — so after act() the
	// notice is already consumed. That synchronous handoff is the contract.
	act(() => {
		useHistoryStore.getState().commit(entry);
		useHistoryStore.getState().requestUndoTo("ghost-entry");
	});
	expect(useHistoryStore.getState().deadIdNotice).toBeNull();
	const info = toastCalls.find((call) => call.method === "info");
	expect(info).toBeDefined();
	expect(String(info?.args[0])).toContain("no longer undoable");
	expect(useHistoryStore.getState().past.map((e) => e.id)).toEqual([
		"h-alive",
	]);

	// The tree survived the effect run.
	expect(document.getElementById("probe-alive")).not.toBeNull();
});
