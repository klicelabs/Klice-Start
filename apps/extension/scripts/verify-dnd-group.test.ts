/**
 * DnD group-integrity regression tests (wave 6).
 * Run: cd apps/extension && bun test scripts/verify-dnd-group.test.ts
 *
 * Covers:
 *  - L8: the drag group is frozen at dragstart and survives a mid-drag
 *    selection clear — drop sites resolve the frozen payload, not the live
 *    selection (a stray clear used to collapse the drag to its first
 *    member). Without a freeze, resolution falls back to the live rule.
 *  - H8 (decisão P2-A): a mixed group whose folders cannot nest into the
 *    target refuses WHOLE (refusedFolders reported); the destination folder
 *    riding inside the group is never falsely refused.
 *  - H11: after an autoscroll delta, the re-hit-test re-dispatches a
 *    dragover to the element now under the pointer (content, not screen).
 */
import { afterEach, beforeEach, expect, test } from "bun:test";
import { redispatchDragoverAt } from "../src/lib/dnd";
import {
	planGroupFolderDrop,
	resolveDragGroup,
	resolveFrozenDragGroup,
} from "../src/lib/drag-group";
import {
	clearFrozenDragGroup,
	freezeDragGroup,
} from "../src/lib/history-capture";
import type { Card, Folder } from "../src/types";

const cards: Card[] = [
	{ id: "c1", folderId: "f1" },
	{ id: "c2", folderId: "f1" },
] as unknown as Card[];
const folders: Folder[] = [
	{ id: "f1", parentId: null },
	{ id: "f2", parentId: null },
	{ id: "sub", parentId: "f1" },
] as unknown as Folder[];
const itemOrder = {
	"folder:__root__": ["folder:f1", "folder:f2"],
	"folder:f1": ["card:c1", "card:c2", "folder:sub"],
};

const selection = [{ id: "c1" }, { id: "c2" }];

beforeEach(() => {
	clearFrozenDragGroup();
});

afterEach(() => {
	clearFrozenDragGroup();
});

test("L8: frozen group survives a mid-drag selection clear", () => {
	const grabbed = { kind: "card" as const, id: "c1" };
	// Dragstart: the resolved group is frozen.
	const atDragStart = resolveDragGroup(
		grabbed,
		selection,
		cards,
		folders,
		itemOrder,
	);
	expect(atDragStart.map((m) => m.id)).toEqual(["c1", "c2"]);
	freezeDragGroup(atDragStart);

	// Mid-drag the selection is cleared (tray commit, stray clear).
	// Drop sites still see the full frozen group, in source order.
	const atDrop = resolveFrozenDragGroup(grabbed, [], cards, folders, itemOrder);
	expect(atDrop.map((m) => m.id)).toEqual(["c1", "c2"]);
});

test("L8: without a freeze the live-selection rule applies", () => {
	const grabbed = { kind: "card" as const, id: "c1" };
	// No dragstart freeze (e.g. foreign payload): the selection is empty,
	// so the drag resolves to the single grabbed item.
	const group = resolveFrozenDragGroup(grabbed, [], cards, folders, itemOrder);
	expect(group.map((m) => m.id)).toEqual(["c1"]);
});

test("L8: a freeze that does not carry the grabbed item is ignored", () => {
	freezeDragGroup([{ kind: "card", id: "other", sourceId: "f2" }]);
	const group = resolveFrozenDragGroup(
		{ kind: "card", id: "c1" },
		selection,
		cards,
		folders,
		itemOrder,
	);
	// Live resolution wins: both selected cards, source-ordered.
	expect(group.map((m) => m.id)).toEqual(["c1", "c2"]);
});

test("H8: mixed group with an un-nestable folder refuses WHOLE", () => {
	// sub cannot nest into f2 (it would keep its parent f1 — cycle-free, but
	// the planner reports per canNest; here sub CAN nest, so simulate a
	// nested-in-nested case: f1 (ancestor of sub) into sub's sibling? Use
	// canNest that forbids nesting under own descendant.
	const group = [
		{ kind: "card" as const, id: "c1", sourceId: "f1" },
		{ kind: "folder" as const, id: "f1", sourceId: "folder:__root__" },
	];
	// Moving f1 into sub would create a cycle (sub is inside f1).
	const plan = planGroupFolderDrop(
		group,
		"sub",
		(id) => cards.find((c) => c.id === id)?.folderId,
		(folderId, target) =>
			folderId !== target && !(folderId === "f1" && target === "sub"),
	);
	expect(plan.movableCards).toEqual(["c1"]);
	expect(plan.movableFolders).toEqual([]);
	expect(plan.refusedFolders).toEqual(["f1"]);
	// Caller policy: cards would move AND folders refused → refuse whole.
	expect(plan.movableCards.length > 0 && plan.refusedFolders.length > 0).toBe(
		true,
	);
});

test("H8: the destination folder inside the group is never refused", () => {
	// Dragging f1 + c1 onto f1 itself: f1 is the target, not a candidate.
	const group = [
		{ kind: "card" as const, id: "c1", sourceId: "f1" },
		{ kind: "folder" as const, id: "f1", sourceId: "folder:__root__" },
	];
	const plan = planGroupFolderDrop(
		group,
		"f1",
		(id) => cards.find((c) => c.id === id)?.folderId,
		() => true,
	);
	expect(plan.movableCards).toEqual([]); // already inside f1
	expect(plan.movableFolders).toEqual([]);
	expect(plan.refusedFolders).toEqual([]);
});

function fakeDoc(element: unknown | null) {
	return {
		elementFromPoint: () => element,
	} as unknown as Pick<Document, "elementFromPoint">;
}

function fakeElement(dataset: Record<string, string>) {
	const dispatched: Event[] = [];
	const self = {
		dataset,
		dispatchEvent: (e: Event) => {
			dispatched.push(e);
			return true;
		},
		dispatched,
		closest: (selector: string) =>
			selector === "[data-dnd-item]" && dataset.dndItem ? self : null,
	};
	return self;
}

test("H11: re-hit-test re-dispatches dragover on the element under the pointer", () => {
	const target = fakeElement({ dndItem: "c2", dndKind: "card" });
	const doc = fakeDoc(target);
	const fired = redispatchDragoverAt({ x: 10, y: 20 }, "c1", doc);
	expect(fired).toBe(true);
	expect(target.dispatched.length).toBe(1);
	const event = target.dispatched[0] as unknown as {
		type: string;
		clientX: number;
		clientY: number;
	};
	expect(event.type).toBe("dragover");
	expect(event.clientX).toBe(10);
	expect(event.clientY).toBe(20);
});

test("H11: no re-dispatch when the hit element is the dragged item", () => {
	const target = fakeElement({ dndItem: "c1", dndKind: "card" });
	const fired = redispatchDragoverAt({ x: 0, y: 0 }, "c1", fakeDoc(target));
	expect(fired).toBe(false);
	expect(target.dispatched.length).toBe(0);
});

test("H11: no re-dispatch when nothing draggable is under the pointer", () => {
	expect(redispatchDragoverAt({ x: 0, y: 0 }, "c1", fakeDoc(null))).toBe(false);
	const plain = fakeElement({});
	expect(redispatchDragoverAt({ x: 0, y: 0 }, "c1", fakeDoc(plain))).toBe(
		false,
	);
});
