import { expect, test } from "bun:test";
import { orderGroupBySource } from "../src/lib/drag-group";
import {
	type ItemOrder,
	insertCardsBlock,
	itemKey,
	reorderGroupKeys,
} from "../src/lib/item-order";
import type { Card, Folder } from "../src/types";

function card(id: string, folderId: string, order: number): Card {
	return {
		id,
		url: `https://${id}.example`,
		title: id,
		favicon: "",
		thumbId: null,
		folderId,
		order,
		origin: "manual",
		capturedAt: 0,
	} as Card;
}

function folder(
	id: string,
	parentId: string | null,
	order: number,
	name = id,
): Folder {
	return { id, name, parentId, order } as Folder;
}

// ---------------------------------------------------------------------------
// Source ordering: click order must never leak into the transported group.
// ---------------------------------------------------------------------------

test("orders a group by live source position, not click order", () => {
	const cards = [
		card("a", "f", 0),
		card("b", "f", 1),
		card("c", "f", 2),
		card("d", "f", 3),
		card("e", "f", 4),
		card("ff", "f", 5),
	];
	const order: ItemOrder = {
		f: ["a", "b", "c", "d", "e", "ff"].map((id) => itemKey("card", id)),
	};
	// Click order D, B, E → transported as B, D, E.
	const group = orderGroupBySource(["d", "b", "e"], cards, [], order);
	expect(group.map((m) => m.id)).toEqual(["b", "d", "e"]);
	expect(group.every((m) => m.kind === "card")).toBe(true);
	expect(group.every((m) => m.sourceId === "f")).toBe(true);
});

test("drops unknown ids and mixes folders after cards by container rank", () => {
	const cards = [card("a", "f", 0), card("b", "f", 1)];
	const folders = [folder("sub", "f", 0), folder("root1", null, 0)];
	const order: ItemOrder = {
		__root__: [itemKey("folder", "root1")],
		f: [itemKey("card", "a"), itemKey("folder", "sub"), itemKey("card", "b")],
	};
	const group = orderGroupBySource(
		["ghost", "sub", "b", "a"],
		cards,
		folders,
		order,
	);
	expect(group.map((m) => m.id)).toEqual(["a", "sub", "b"]);
});

// ---------------------------------------------------------------------------
// Contiguous block reorder: one insertion, surrounding room for the group.
// ---------------------------------------------------------------------------

test("moves a block contiguously before and after a target", () => {
	const keys = ["a", "b", "c", "d", "e", "f"].map((id) => itemKey("card", id));
	const before = reorderGroupKeys(
		keys,
		[itemKey("card", "b"), itemKey("card", "d")],
		itemKey("card", "e"),
		"before",
	);
	expect(before).toEqual(
		["a", "c", "b", "d", "e", "f"].map((id) => itemKey("card", id)),
	);
	const after = reorderGroupKeys(
		keys,
		[itemKey("card", "b"), itemKey("card", "d")],
		itemKey("card", "a"),
		"after",
	);
	expect(after).toEqual(
		["a", "b", "d", "c", "e", "f"].map((id) => itemKey("card", id)),
	);
});

test("group reorder is a no-op onto its own block or unknown targets", () => {
	const keys = ["a", "b", "c"].map((id) => itemKey("card", id));
	expect(
		reorderGroupKeys(
			keys,
			[itemKey("card", "a"), itemKey("card", "b")],
			itemKey("card", "b"),
			"before",
		),
	).toBeNull();
	expect(
		reorderGroupKeys(
			keys,
			[itemKey("card", "ghost")],
			itemKey("card", "c"),
			"before",
		),
	).toBeNull();
	expect(
		reorderGroupKeys(
			keys,
			[itemKey("card", "a")],
			itemKey("card", "ghost"),
			"before",
		),
	).toBeNull();
});

// ---------------------------------------------------------------------------
// Block insert across containers: reparent once, land contiguously.
// ---------------------------------------------------------------------------

test("inserts a card block at an anchor, removing it everywhere else", () => {
	const order: ItemOrder = {
		a: [itemKey("card", "x"), itemKey("card", "y")],
		b: [itemKey("card", "t"), itemKey("card", "u")],
	};
	const next = insertCardsBlock(
		order,
		"b",
		[itemKey("card", "x"), itemKey("card", "y")],
		itemKey("card", "u"),
		"before",
	);
	expect(next).not.toBeNull();
	expect(next?.a).toEqual([]);
	expect(next?.b).toEqual([
		itemKey("card", "t"),
		itemKey("card", "x"),
		itemKey("card", "y"),
		itemKey("card", "u"),
	]);
	// Input order is preserved (already source-ordered upstream).
	const reversed = insertCardsBlock(
		order,
		"b",
		[itemKey("card", "y"), itemKey("card", "x")],
		itemKey("card", "t"),
		"after",
	);
	expect(reversed?.b).toEqual([
		itemKey("card", "t"),
		itemKey("card", "y"),
		itemKey("card", "x"),
		itemKey("card", "u"),
	]);
});
