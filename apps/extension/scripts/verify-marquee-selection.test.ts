import { expect, test } from "bun:test";
import { anchorForScroll } from "../src/lib/marquee-geometry";
import { mergeMarqueeSelection } from "../src/lib/marquee-selection";
import type { SelectionItem } from "../src/stores/selection-store";

const card = (id: string, sourceId = "folder-1"): SelectionItem => ({
	id,
	kind: "card",
	sourceId,
});

test("crossed IDs survive after their rectangles leave the viewport", () => {
	const crossed = new Map<string, SelectionItem>();
	crossed.set("one", card("one"));
	const beforeScroll = mergeMarqueeSelection([], crossed, "add");
	// Geometry can now contain only the second row; membership is independent.
	crossed.set("two", card("two"));
	expect(beforeScroll.map((item) => item.id)).toEqual(["one"]);
	expect(
		mergeMarqueeSelection([], crossed, "add").map((item) => item.id),
	).toEqual(["one", "two"]);
});

test("add preserves carried selection and does not duplicate repeated hits", () => {
	const carried = card("carried", "other-folder");
	const crossed = new Map([
		["one", card("one")],
		["carried", carried],
	]);
	crossed.set("one", card("one"));
	expect(mergeMarqueeSelection([carried], crossed, "add")).toEqual([
		carried,
		card("one"),
	]);
});

test("Ctrl marquee flips each crossed ID once relative to its snapshot", () => {
	const snapshot = [card("one"), card("carried", "other-folder")];
	const crossed = new Map([
		["one", card("one")],
		["two", card("two")],
	]);
	crossed.set("one", card("one"));
	const expected = [card("carried", "other-folder"), card("two")];
	expect(mergeMarqueeSelection(snapshot, crossed, "toggle")).toEqual(expected);
	expect(mergeMarqueeSelection(snapshot, crossed, "toggle")).toEqual(expected);
	expect(snapshot.map((item) => item.id)).toEqual(["one", "carried"]);
});

test("empty hit geometry is not a clear-selection instruction", () => {
	const snapshot = [card("one")];
	for (const mode of ["add", "toggle"] as const) {
		expect(mergeMarqueeSelection(snapshot, new Map(), mode)).toEqual(snapshot);
	}
});

test("anchor tracks its content origin across scroll", () => {
	const anchor = { x: 8, y: 772 };
	// Scrolling down moves content up: the anchor's client position rises.
	expect(anchorForScroll(anchor, 200, 663)).toEqual({ x: 8, y: 309 });
	// Scrolling back up returns it exactly — no origin drift.
	expect(anchorForScroll(anchor, 200, 200)).toEqual(anchor);
	// Horizontal presses never shift: only the scroll axis translates.
	expect(anchorForScroll({ x: 300, y: 100 }, 0, 1000)).toEqual({
		x: 300,
		y: -900,
	});
});
