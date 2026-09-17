import { expect, test } from "bun:test";
import {
	type ClientRect,
	intersectArea,
	marqueeHitsTile,
	normalizeRect,
	pointerTravel,
	rectsOverlap,
} from "../src/lib/marquee-geometry";

function box(
	left: number,
	top: number,
	right: number,
	bottom: number,
): ClientRect {
	return {
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
	};
}

// ---------------------------------------------------------------------------
// Rectangle helpers.
// ---------------------------------------------------------------------------

test("normalizes drag direction and measures travel", () => {
	const rect = normalizeRect({ x: 50, y: 60 }, { x: 10, y: 20 });
	expect(rect).toMatchObject({ left: 10, top: 20, right: 50, bottom: 60 });
	expect(rect.width).toBe(40);
	expect(rect.height).toBe(40);
	expect(pointerTravel({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
	expect(rectsOverlap(box(0, 0, 10, 10), box(10, 0, 20, 10))).toBe(false);
	expect(rectsOverlap(box(0, 0, 10, 10), box(9, 9, 20, 20))).toBe(true);
	expect(intersectArea(box(0, 0, 10, 10), box(5, 5, 15, 15))).toBe(25);
});

// ---------------------------------------------------------------------------
// Forgiving hit rule: centers, containment and area floor.
// ---------------------------------------------------------------------------

test("selects enclosed tiles and grazed folders", () => {
	// Tile center inside the marquee.
	expect(marqueeHitsTile(box(100, 100, 176, 176), box(0, 0, 200, 200))).toBe(
		true,
	);
	// Marquee over a folder's center selects it.
	expect(marqueeHitsTile(box(0, 0, 228, 268), box(100, 100, 140, 140))).toBe(
		true,
	);
	// A ~30x30 bite of an icon tile clears the absolute floor.
	expect(marqueeHitsTile(box(100, 100, 176, 176), box(90, 90, 130, 130))).toBe(
		true,
	);
});

test("ignores slivers and disjoint tiles", () => {
	// 1px edge touch: negligible overlap, centers outside.
	expect(marqueeHitsTile(box(100, 100, 176, 176), box(0, 0, 101, 200))).toBe(
		false,
	);
	// Disjoint.
	expect(marqueeHitsTile(box(100, 100, 176, 176), box(0, 0, 50, 50))).toBe(
		false,
	);
	// Thin sliver across a wide folder stays below the 12% ratio.
	expect(marqueeHitsTile(box(0, 0, 228, 268), box(0, 120, 228, 124))).toBe(
		false,
	);
});
