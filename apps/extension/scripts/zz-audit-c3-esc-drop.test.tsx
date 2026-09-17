/**
 * C3 diagnostic loop — Esc-during-drag must make the subsequent drop inert.
 * Review only: this documents current behavior; it does not fix anything.
 * Run: cd apps/extension && bun test scripts/zz-audit-c3-esc-drop.test.tsx
 *
 * CONFIRMED (pass 2, red loop): the drop after Esc commits in BOTH scenarios.
 * Scenario B is the stronger form: even when the Esc keydown IS delivered and
 * the hook's cancel handler runs, handleBackgroundDrop re-resolves the drag
 * via the dataTransfer payload (dragRef is null, resolveDrag(e) is not) and
 * commits. Scenario B is intentionally RED while C3 is unfixed — it is the
 * regression test diagnosing-bugs calls for: green once a gesture-epoch/
 * cancel flag is checked in the drop handlers.
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

	// Documents the audited C3 defect: the drop after (unobserved) Esc still
	// commits through the dataTransfer fallback.
	expect(backgroundDrops).toEqual([{ kind: "card", id: "card-1" }]);
	expect(getActiveDrag()).toBeNull();
});

test("C3 scenario B (KNOWN RED while C3 unfixed): delivered Esc cancels, but drop re-commits via dataTransfer fallback", async () => {
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

	// CONFIRMED BUG (this assertion is the red loop): the drop should be
	// inert after an observed cancel, but resolveDrag(e) re-arms the gesture
	// from the persisted payload and onBackgroundDrop fires.
	expect(backgroundDrops).toEqual([]);
	expect(getActiveDrag()).toBeNull();
});
