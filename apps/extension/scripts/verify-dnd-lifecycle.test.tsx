import { afterEach, expect, test } from "bun:test";
import { parseHTML } from "linkedom";
import { act, useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useGridDnd } from "../src/hooks/use-grid-dnd";
import { useSpringLoad } from "../src/hooks/use-spring-load";
import {
	clearActiveDrag,
	getActiveDrag,
} from "../src/lib/dnd";
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
	requestAnimationFrame: (callback: FrameRequestCallback) =>
		setTimeout(() => callback(Date.now()), 0),
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

interface HarnessProps {
	folderId: string;
	onNavigate: (id: string) => void;
	onBackgroundDrop: (dragged: ItemRef) => void;
}

function Harness({ folderId, onNavigate, onBackgroundDrop }: HarnessProps) {
	const spring = useSpringLoad(() => undefined);
	const firstSpring = useRef(spring);
	const springStable = firstSpring.current === spring;
	if (!springStable) firstSpring.current = spring;

	const dnd = useGridDnd({
		onLiveReorder: () => undefined,
		onCombineCards: () => undefined,
		onDropOnFolder: () => undefined,
		onBackgroundDrop,
		onOpenFolder: onNavigate,
		canNest: () => true,
		isInContainer: () => true,
	});

	// This mirrors DialGrid's container-swap lifecycle. The regression is
	// caught when a fresh reset callback is created on each render.
	useEffect(() => {
		dnd.resetVisuals();
	}, [folderId, dnd.resetVisuals]);

	return (
		<section
			data-testid="grid"
			data-spring-stable={String(springStable)}
			{...dnd.backgroundProps}
		>
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

test("keeps the native payload through rerender and folder navigation", async () => {
	const drops: ItemRef[] = [];
	let navigate!: (id: string) => void;
	let folderId = "root";

	function App() {
		const [, setFolder] = useState(folderId);
		navigate = (id) => {
			folderId = id;
			setFolder(id);
		};
		return (
			<Harness
				folderId={folderId}
				onNavigate={navigate}
				onBackgroundDrop={(dragged) => drops.push(dragged)}
			/>
		);
	}

	const mount = document.getElementById("app");
	if (!mount) throw new Error("test mount missing");
	root = createRoot(mount);
	await act(async () => {
		root?.render(<App />);
	});

	const source = document.querySelector('[data-testid="source"]');
	const grid = document.querySelector('[data-testid="grid"]');
	if (!source || !grid) throw new Error("test nodes missing");

	const dataTransfer = new TestDataTransfer();
	await act(async () => {
		dispatchDnd(source, "dragstart", dataTransfer);
		await new Promise((resolve) => setTimeout(resolve, 20));
	});
	expect(getActiveDrag()).toEqual({ kind: "card", id: "card-1" });
	expect(document.querySelector('[data-testid="grid"]')?.dataset.springStable).toBe(
		"true",
	);

	await act(async () => {
		navigate("child");
	});
	expect(getActiveDrag()).toEqual({ kind: "card", id: "card-1" });

	const nextGrid = document.querySelector('[data-testid="grid"]');
	if (!nextGrid) throw new Error("next grid missing");
	await act(async () => {
		dispatchDnd(nextGrid, "drop", dataTransfer);
	});
	expect(drops).toEqual([{ kind: "card", id: "card-1" }]);
	expect(getActiveDrag()).toBeNull();
});

// ---------------------------------------------------------------------------
// Live-reorder intent. Guards the behaviour a user actually sees: hovering an
// item's leading/trailing edge reorders once (not once per dragover frame), and
// the drop does not re-apply an already-applied edge decision.
// ---------------------------------------------------------------------------

interface ReorderCall {
	dragged: ItemRef;
	target: ItemRef;
	position: "before" | "after";
}

interface ReorderHarnessProps {
	onLiveReorder: (dragged: ItemRef, target: ItemRef, position: "before" | "after") => void;
	onDropOnFolder: (draggedId: string, folderId: string) => void;
}

function ReorderHarness({ onLiveReorder, onDropOnFolder }: ReorderHarnessProps) {
	const dnd = useGridDnd({
		onLiveReorder,
		onCombineCards: () => undefined,
		onDropOnFolder,
		onBackgroundDrop: () => undefined,
		onOpenFolder: () => undefined,
		canNest: () => true,
		isInContainer: () => true,
	});

	return (
		<section data-testid="grid" {...dnd.backgroundProps}>
			<div
				data-testid="a"
				{...dnd.getItemDragProps({ kind: "card", id: "card-a" })}
			/>
			<div
				data-testid="b"
				{...dnd.getItemDragProps({ kind: "card", id: "card-b" })}
			/>
			<div
				data-testid="folder"
				{...dnd.getItemDragProps({ kind: "folder", id: "folder-1" })}
			/>
			<output data-testid="insertion">
				{dnd.insertion ? `${dnd.insertion.key}:${dnd.insertion.position}` : ""}
			</output>
		</section>
	);
}

function stubRect(el: Element, width = 100, height = 100) {
	Object.defineProperty(el, "getBoundingClientRect", {
		configurable: true,
		value: () => ({
			left: 0,
			top: 0,
			right: width,
			bottom: height,
			width,
			height,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		}),
	});
}

function dispatchDragOver(el: Element, dataTransfer: TestDataTransfer, clientX: number) {
	const event = new Event("dragover", { bubbles: true, cancelable: true });
	Object.defineProperties(event, {
		clientX: { value: clientX },
		clientY: { value: 50 },
		dataTransfer: { value: dataTransfer },
	});
	el.dispatchEvent(event);
}

test("applies an edge reorder once per zone and settles on drop", async () => {
	const reorders: ReorderCall[] = [];
	const folderDrops: string[] = [];

	const mount = document.getElementById("app");
	if (!mount) throw new Error("test mount missing");
	root = createRoot(mount);
	await act(async () => {
		root?.render(
			<ReorderHarness
				onLiveReorder={(dragged, target, position) =>
					reorders.push({ dragged, target, position })
				}
				onDropOnFolder={(draggedId, folderId) =>
					folderDrops.push(`${draggedId}->${folderId}`)
				}
			/>,
		);
	});

	const a = document.querySelector('[data-testid="a"]');
	const b = document.querySelector('[data-testid="b"]');
	const folder = document.querySelector('[data-testid="folder"]');
	if (!a || !b || !folder) throw new Error("test nodes missing");
	// linkedom reports a zero-size rect, which collapses every pointer position
	// into the trailing edge. Give both drop targets a real box so the zone math
	// is exercised the way a browser resolves it.
	stubRect(b);
	stubRect(folder);

	const dataTransfer = new TestDataTransfer();
	await act(async () => {
		dispatchDnd(a, "dragstart", dataTransfer);
		await new Promise((resolve) => setTimeout(resolve, 20));
	});
	expect(getActiveDrag()).toEqual({ kind: "card", id: "card-a" });

	// Leading edge of `b` (clientX 10 of 100 → ratio 0.1 → "before").
	await act(async () => {
		dispatchDragOver(b, dataTransfer, 10);
		dispatchDragOver(b, dataTransfer, 12);
		dispatchDragOver(b, dataTransfer, 14);
	});
	expect(reorders).toHaveLength(1);
	expect(reorders[0]).toEqual({
		dragged: { kind: "card", id: "card-a" },
		target: { kind: "card", id: "card-b" },
		position: "before",
	});
	expect(document.querySelector('[data-testid="insertion"]')?.textContent).toBe(
		"card-b:before",
	);

	// Dropping on the same edge must not re-apply the decision.
	await act(async () => {
		dispatchDnd(b, "drop", dataTransfer);
	});
	expect(reorders).toHaveLength(1);
	expect(document.querySelector('[data-testid="insertion"]')?.textContent).toBe("");
	expect(getActiveDrag()).toBeNull();

	// A folder's centre is a nest target, not a reorder. The pointer stays at
	// the centre for both the over and the drop, exactly like a real gesture.
	await act(async () => {
		dispatchDnd(a, "dragstart", dataTransfer);
		await new Promise((resolve) => setTimeout(resolve, 20));
		dispatchDragOver(folder, dataTransfer, 50);
		dispatchDnd(folder, "drop", dataTransfer, 50);
	});
	expect(folderDrops).toEqual(["card-a->folder-1"]);
	expect(reorders).toHaveLength(1);
	expect(getActiveDrag()).toBeNull();
});

