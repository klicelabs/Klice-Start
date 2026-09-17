import { useEffect, useRef } from "react";

/**
 * Shared edge-triggered autoscroll session (DnD + marquee).
 *
 * Sensing and actuation stay decoupled: callers only `feed()` the latest
 * pointer point (dragover stalls with a static pointer, pointermove keeps
 * flowing — either way the time-driven rAF loop owns every scroll write).
 * Speed follows a quadratic depth curve: the zone entry crawls for
 * precision (~1 row/s) while the extreme lip traverses (~6 rows/s).
 */

export const AUTOSCROLL_ZONE_PX = 90;
export const AUTOSCROLL_MIN_PX_S = 180;
export const AUTOSCROLL_MAX_PX_S = 1000;

export interface AutoscrollPoint {
	x: number;
	y: number;
}

export interface AutoscrollOptions {
	zonePx?: number;
	minPxS?: number;
	maxPxS?: number;
	/** Resolve the scroll viewport; called lazily, may return null. */
	getContainer?: () => HTMLElement | null;
	/**
	 * Legacy window fallback when no container resolves. Newtab call sites
	 * must NOT enable this (the page never scrolls; a miss must no-op).
	 */
	windowFallback?: boolean;
	/** Fired after every applied scroll delta (re-hit-test here). */
	onScroll?: (dyPx: number) => void;
}

export interface AutoscrollSession {
	feed: (point: AutoscrollPoint) => void;
	stop: () => void;
	/** Reset the cached container (undefined = resolve lazily again). */
	setContainer: (el: HTMLElement | null | undefined) => void;
}

function defaultGetContainer(): HTMLElement | null {
	if (typeof document === "undefined") return null;
	return document.querySelector<HTMLElement>("[data-speed-dial-scroll]");
}

export function autoscrollSpeed(
	distancePx: number,
	zonePx = AUTOSCROLL_ZONE_PX,
	minPxS = AUTOSCROLL_MIN_PX_S,
	maxPxS = AUTOSCROLL_MAX_PX_S,
): number {
	const depth = Math.min(1, Math.max(0, 1 - distancePx / zonePx));
	return minPxS + (maxPxS - minPxS) * depth * depth;
}

function canScrollY(el: HTMLElement, dir: -1 | 1): boolean {
	if (!el.isConnected) return false;
	if (el.scrollHeight <= el.clientHeight + 1) return false;
	if (dir < 0) return el.scrollTop > 0;
	return el.scrollTop < el.scrollHeight - el.clientHeight - 1;
}

export function createAutoscrollSession(
	options: AutoscrollOptions = {},
): AutoscrollSession {
	const zonePx = options.zonePx ?? AUTOSCROLL_ZONE_PX;
	const minPxS = options.minPxS ?? AUTOSCROLL_MIN_PX_S;
	const maxPxS = options.maxPxS ?? AUTOSCROLL_MAX_PX_S;
	const getContainer = options.getContainer ?? defaultGetContainer;
	const windowFallback = options.windowFallback ?? false;
	const onScroll = options.onScroll;

	const pointer = { x: 0, y: 0, active: false };
	let container: HTMLElement | null | undefined;
	let raf: number | null = null;
	let lastT = 0;

	const stop = () => {
		pointer.active = false;
		if (raf !== null) {
			cancelAnimationFrame(raf);
			raf = null;
		}
	};

	const tick = () => {
		raf = null;
		if (!pointer.active) return;
		const now =
			typeof performance !== "undefined" ? performance.now() : Date.now();
		const dt = Math.min(0.05, lastT === 0 ? 0.016 : (now - lastT) / 1000);
		lastT = now;

		let dir: -1 | 0 | 1 = 0;
		let distance = 0;
		const el = container;
		if (el) {
			const bounds = el.getBoundingClientRect();
			const dTop = pointer.y - bounds.top;
			const dBottom = bounds.bottom - pointer.y;
			if (dTop < zonePx) {
				dir = -1;
				distance = dTop;
			} else if (dBottom < zonePx) {
				dir = 1;
				distance = dBottom;
			}
			if (dir !== 0) {
				if (canScrollY(el, dir)) {
					const dy =
						dir * autoscrollSpeed(distance, zonePx, minPxS, maxPxS) * dt;
					el.scrollTop += dy;
					onScroll?.(dy);
				} else {
					dir = 0;
				}
			}
		} else if (windowFallback && typeof window !== "undefined") {
			if (pointer.y < zonePx) {
				dir = -1;
				distance = pointer.y;
			} else if (window.innerHeight - pointer.y < zonePx) {
				dir = 1;
				distance = window.innerHeight - pointer.y;
			}
			if (dir !== 0) {
				window.scrollBy({
					top: dir * autoscrollSpeed(distance, zonePx, minPxS, maxPxS) * dt,
					behavior: "auto" as ScrollBehavior,
				});
			}
		}
		// Loop only while scrolling is needed; a fresh feed restarts it, so
		// an idle pointer outside the zone costs nothing while a static
		// pointer inside keeps travelling.
		if (pointer.active && dir !== 0) {
			raf = requestAnimationFrame(tick);
		}
	};

	return {
		feed: (point) => {
			pointer.x = point.x;
			pointer.y = point.y;
			pointer.active = true;
			if (container === undefined) container = getContainer();
			if (raf === null) {
				lastT = 0;
				raf = requestAnimationFrame(tick);
			}
		},
		stop,
		setContainer: (el) => {
			container = el;
		},
	};
}

/**
 * Session bound to component lifetime (stops on unmount). Options are read
 * once (lazy init); callers needing live callbacks must pass stable
 * references that read through refs.
 */
export function useAutoscroll(
	options: AutoscrollOptions = {},
): AutoscrollSession {
	const sessionRef = useRef<AutoscrollSession | null>(null);
	if (sessionRef.current === null) {
		sessionRef.current = createAutoscrollSession(options);
	}
	useEffect(() => () => sessionRef.current?.stop(), []);
	return sessionRef.current;
}
