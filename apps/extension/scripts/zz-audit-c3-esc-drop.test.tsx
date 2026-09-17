/**
 * C3 regression test — Esc-during-drag must make the subsequent drop inert.
 * Run: cd apps/extension && bun test scripts/zz-audit-c3-esc-drop.test.tsx
 *
 * History: written as the pass-2 red loop (drop after Esc committed in BOTH
 * scenarios — scenario B being the stronger form: even a DELIVERED Esc whose
 * cancel handler ran was ignored by handleBackgroundDrop, which re-resolved
 * the drag via the dataTransfer payload). Fixed in wave 3: drop handlers
 * consult the gesture-epoch `cancelled` flag BEFORE the resolveDrag fallback
 * (use-grid-dnd resetDragCancelled). Scenario B is the locked-in regression
 * test; scenario A documents that a drop without any observed cancel still
 * commits (correct behavior — nothing cancelled it).
 */
import { afterEach, expect, test } from "bun:test";
import { parseHTML } from "linkedom";
import { act, useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useGridDnd } from "../src/hooks/use-grid-dnd";
import { useSpringLoad } from "../src/hooks/use-spring-load";
import { clearActiveDrag, getActiveDrag } from "../src/lib/dnd";
import type { ItemRef } from "../src/lib/item-order";

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

class TestDataTransfer {
	effectAllowed = "none";
	dropEffect = "none";
	private readonly values = new Map<string, string>();
	get types() {
		return [...this.values.keys()];
	}
	setData(type: string, value: string) {
		this.values.set(type, value);
	}
	getData(type: string) {
		return this.values.get(type) ?? "";
	}
}

function dispatchDnd(
	element: Element,
	type: "dragstart" | "drop",
	dataTransfer: TestDataTransfer,
	clientX = 0,
	clientY = 100,
) {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperties(event, {
		clientX: { value: clientX },
		clientY: { value: clientY },
		dataTransfer: { value: dataTransfer },
	});
	element.dispatchEvent(event);
}

function dispatchKey(element: Element | Window, key: string) {
	// linkedom has no KeyboardEvent constructor; the hook only reads `e.key`.
	const event = new Event("keydown", { bubbles: true });
	Object.defineProperty(event, "key", { value: key });
	(element as unknown as { dispatchEvent(e: unknown): boolean }).dispatchEvent(
		event,
	);
}

interface HarnessProps {
	backgroundDrops: ItemRef[];
	folderDrops: string[];
}

function Harness({ backgroundDrops, folderDrops }: HarnessProps) {
	const spring = useSpringLoad(() => undefined);
	const first = useRef(spring);
	const stable = first.current === spring;

	const dropsRef = useRef({ backgroundDrops, folderDrops });
	dropsRef.current = { backgroundDrops, folderDrops };

	const dnd = useGridDnd({
		onLiveReorder: () => undefined,
		onCombineCards: () => undefined,
		onDropOnFolder: (draggedId: string) => dropsRef.current.folderDrops.push(draggedId),
		onBackgroundDrop: (dragged: ItemRef) => dropsRef.current.backgroundDrops.push(dragged),
		onOpenFolder: () => undefined,
		canNest: () => true,
		isInContainer: () => true,
	});

	// Mirror DialGrid: settle visuals when the container identity changes.
	useEffect(() => {
		dnd.resetVisuals();
	}, [dnd.resetVisuals]);

	return (
		<section data-testid="grid" data-spring-stable={String(stable)} {...dnd.backgroundProps}>
			<div
				data-testid="source"
				{...dnd.getItemDragProps({ kind: "card", id: "card-1" })}
			/>
		</section>
	);
}

let root: Root | null = null;

afterEach(() => {
	act(() => root?.unmount());
	root = null;
	clearActiveDrag();
	document.body.innerHTML = '<div id="app"></div>';
});

test("C3 scenario A: drop after Esc still resolves via dataTransfer fallback", async () => {
	const backgroundDrops: ItemRef[] = [];
	const folderDrops: string[] = [];

	const mount = document.getElementById("app");
	if (!mount) throw new Error("test mount missing");
	root = createRoot(mount);
	await act(async () => {
		root?.render(
			<Harness backgroundDrops={backgroundDrops} folderDrops={folderDrops} />,
		);
	});

	const source = document.querySelector('[data-testid="source"]');
	const grid = document.querySelector('[data-testid="grid"]');
	if (!source || !grid) throw new Error("test nodes missing");

	const dataTransfer = new TestDataTransfer();
	await act(async () => {
		dispatchDnd(source, "dragstart", dataTransfer);
		await new Promise((r) => setTimeout(r, 20));
	});
	expect(getActiveDrag()).toEqual({ kind: "card", id: "card-1" });

	// Simulate the Chrome-observed behavior: Escape during native drag never
	// reaches the page (native loop consumes it). We just proceed to drop.

	await act(async () => {
		dispatchDnd(grid, "drop", dataTransfer);
	});

	// Correct behavior: nothing observed a cancel (native Esc is swallowed by
	// the browser's drag loop before reaching the page), so the drop commits
	// through the dataTransfer fallback.
	expect(backgroundDrops).toEqual([{ kind: "card", id: "card-1" }]);
	expect(getActiveDrag()).toBeNull();
});

test("C3 scenario B (regression): delivered Esc cancels, and the drop stays inert — no dataTransfer re-commit", async () => {
	const backgroundDrops: ItemRef[] = [];
	const folderDrops: string[] = [];

	const mount = document.getElementById("app");
	if (!mount) throw new Error("test mount missing");
	root = createRoot(mount);
	await act(async () => {
		root?.render(
			<Harness backgroundDrops={backgroundDrops} folderDrops={folderDrops} />,
		);
	});

	const source = document.querySelector('[data-testid="source"]');
	const grid = document.querySelector('[data-testid="grid"]');
	if (!source || !grid) throw new Error("test nodes missing");

	const dataTransfer = new TestDataTransfer();
	await act(async () => {
		dispatchDnd(source, "dragstart", dataTransfer);
		await new Promise((r) => setTimeout(r, 20));
	});
	expect(getActiveDrag()).toEqual({ kind: "card", id: "card-1" });

	// Deliver Escape to the window (what would happen on platforms/situations
	// where the keydown reaches the page during native drag).
	await act(async () => {
		dispatchKey(window, "Escape");
	});
	expect(getActiveDrag()).toBeNull();

	await act(async () => {
		dispatchDnd(grid, "drop", dataTransfer);
	});

	// FIXED (wave 3): the drop is inert after an observed cancel — the gesture
	// epoch's cancelled flag blocks the resolveDrag fallback from re-arming
	// the gesture from the persisted payload.
	expect(backgroundDrops).toEqual([]);
	expect(getActiveDrag()).toBeNull();
});
