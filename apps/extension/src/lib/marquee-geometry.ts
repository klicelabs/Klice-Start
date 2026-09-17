/**
 * Pure marquee (rubber-band) geometry. Everything here is client-space
 * pixels: pointer events and getBoundingClientRect share that space, so no
 * scroll-offset math ever enters hit-testing. Units are trivially testable.
 */

/** Pointer travel before a press becomes a marquee (clicks stay clicks). */
export const MARQUEE_THRESHOLD_PX = 5;

/**
 * Forgiving overlap floor: a 30×30px bite always counts (~15% of an icon
 * tile, ~2% of a folder tile), so grazes register without slivers strobing
 * whole rows.
 */
export const MARQUEE_MIN_OVERLAP_PX2 = 900;

/** Overlap fraction of the tile area above which a partial cover counts. */
export const MARQUEE_OVERLAP_RATIO = 0.12;

export interface ClientRect {
	left: number;
	top: number;
	right: number;
	bottom: number;
	width: number;
	height: number;
}

export interface ClientPoint {
	x: number;
	y: number;
}

export function normalizeRect(a: ClientPoint, b: ClientPoint): ClientRect {
	const left = Math.min(a.x, b.x);
	const top = Math.min(a.y, b.y);
	const right = Math.max(a.x, b.x);
	const bottom = Math.max(a.y, b.y);
	return {
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
	};
}

export function rectsOverlap(a: ClientRect, b: ClientRect): boolean {
	return (
		a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
	);
}

export function intersectArea(a: ClientRect, b: ClientRect): number {
	const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
	const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
	if (width <= 0 || height <= 0) return 0;
	return width * height;
}

function pointInRect(p: ClientPoint, r: ClientRect): boolean {
	return p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
}

/**
 * Forgiving hit rule: the tile center inside the marquee, or a meaningful
 * area overlap. One unified rule for cards, icons and folders — deliberately
 * no marquee-center-in-tile clause, so hairline strips crossing a big tile
 * can never select it.
 */
export function marqueeHitsTile(
	tile: ClientRect,
	marquee: ClientRect,
): boolean {
	if (!rectsOverlap(tile, marquee)) return false;
	const tileCenter: ClientPoint = {
		x: (tile.left + tile.right) / 2,
		y: (tile.top + tile.bottom) / 2,
	};
	if (pointInRect(tileCenter, marquee)) return true;
	const tileArea = Math.max(1, tile.width * tile.height);
	const floor = Math.max(
		MARQUEE_MIN_OVERLAP_PX2,
		tileArea * MARQUEE_OVERLAP_RATIO,
	);
	return intersectArea(tile, marquee) >= floor;
}

export function pointerTravel(a: ClientPoint, b: ClientPoint): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}
