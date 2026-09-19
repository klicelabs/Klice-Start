import { useCallback, useEffect, useRef, useState } from "react";
import { useAutoscroll } from "../lib/autoscroll";
import { getActiveDrag } from "../lib/dnd";
import { isInteractiveTarget } from "../lib/interaction-scope";
import {
	type ClientRect,
	MARQUEE_THRESHOLD_PX,
	marqueeHitsTile,
	normalizeRect,
	pointerTravel,
} from "../lib/marquee-geometry";
import {
	materializeExcluding,
	selectedAncestorOf,
} from "../lib/selection-model";
import {
	type SelectionItem,
	useSelectionStore,
} from "../stores/selection-store";
import { useSetupStore } from "../stores/setup-store";

export type MarqueeMode = "add" | "toggle";

export interface MarqueeItem {
	id: string;
	kind: "card" | "folder";
}

interface MarqueeOptions {
	/** Current container id (all hits belong to it; change aborts). */
	folderId: string;
	/** Grid-ordered items eligible for hit-testing. */
	items: MarqueeItem[];
	disabled?: boolean;
}

type Phase = "idle" | "pending" | "selecting";

interface CachedSurface {
	kind: "card" | "folder";
	rect: ClientRect;
}

/**
 * Rubber-band selection, first-class alongside item DnD.
 *
 * State model: idle → pending (armed, sub-threshold) → selecting →
 * idle. DnD is a distinct state: presses starting on items/cells never
 * arm the marquee (target veto), and a native drag winning mid-gesture
 * aborts it. Selection writes go through the one selection store, in grid
 * order, so tray/Select-all/multi-drag consume marquee results untouched.
 *
 * All geometry stays in client space (pointer events and
 * getBoundingClientRect share it): cached rects translate by scroll delta
 * per frame and the overlay is position:fixed. No scroll-offset math.
 *
 * Growth model: any drag grows the selection (click clears, drag adds).
 * Plain and Shift drags union the region with the gesture-start snapshot,
 * so pressing empty space never strands previously selected items; only
 * Ctrl/Cmd flips membership. This mirrors the app-wide addAll rule used
 * by Select-all and Ctrl+A.
 */
export function useMarqueeSelection(options: MarqueeOptions) {
	const { folderId, items, disabled = false } = options;
	const [selecting, setSelecting] = useState(false);

	const folderIdRef = useRef(folderId);
	folderIdRef.current = folderId;
	const itemsRef = useRef(items);
	itemsRef.current = items;

	const phase = useRef<Phase>("idle");
	const anchor = useRef({ x: 0, y: 0 });
	const current = useRef({ x: 0, y: 0 });
	const mode = useRef<MarqueeMode>("add");
	const snapshot = useRef<SelectionItem[]>([]);
	const touched = useRef<Set<string>>(new Set());
	const touchOrder = useRef<string[]>([]);
	const touchOrderIds = useRef<Set<string>>(new Set());
	const cache = useRef(new Map<string, CachedSurface>());
	const lastKey = useRef("");
	const wrapEl = useRef<HTMLElement | null>(null);
	const activePointerId = useRef<number | null>(null);
	const overlayEl = useRef<HTMLDivElement | null>(null);
	const raf = useRef<number | null>(null);
	const lastScrollTop = useRef(0);

	const autoscroll = useAutoscroll({
		getContainer: () =>
			wrapEl.current?.closest<HTMLElement>("[data-speed-dial-scroll]") ?? null,
		onScroll: () => {
			pokeFrame();
		},
	});

	const paintOverlay = useCallback((rect: ClientRect | null) => {
		const el = overlayEl.current;
		if (!el) return;
		if (!rect || (rect.width === 0 && rect.height === 0)) {
			el.style.display = "none";
			return;
		}
		el.style.display = "block";
		el.style.left = `${rect.left}px`;
		el.style.top = `${rect.top}px`;
		el.style.width = `${rect.width}px`;
		el.style.height = `${rect.height}px`;
	}, []);

	const writeSelection = useCallback((next: SelectionItem[]) => {
		// One store write per membership change — never per pointer event.
		let key = "";
		for (const item of next) key += `${item.id}\n`;
		if (key === lastKey.current) return;
		lastKey.current = key;
		useSelectionStore.getState().selectAll(next);
	}, []);

	const processFrame = useCallback(() => {
		raf.current = null;
		if (phase.current !== "selecting") return;
		const marquee = normalizeRect(anchor.current, current.current);
		paintOverlay(marquee);
		// Translate cached rects by the scroll delta: rigid, exact, and no
		// layout reads while scrolling underneath a static pointer.
		const scroller =
			wrapEl.current?.closest<HTMLElement>("[data-speed-dial-scroll]") ?? null;
		const scrollTop = scroller?.scrollTop ?? 0;
		const dy = scrollTop - lastScrollTop.current;
		lastScrollTop.current = scrollTop;
		if (dy !== 0) {
			for (const surface of cache.current.values()) {
				surface.rect.top -= dy;
				surface.rect.bottom -= dy;
			}
		}
		const folder = folderIdRef.current;
		const hits: SelectionItem[] = [];
		for (const [id, surface] of cache.current) {
			if (!marqueeHitsTile(surface.rect, marquee)) continue;
			touched.current.add(id);
			if (!touchOrderIds.current.has(id)) {
				touchOrderIds.current.add(id);
				touchOrder.current.push(id);
			}
			hits.push({ id, kind: surface.kind, sourceId: folder });
		}
		let snap = snapshot.current;
		if (hits.length > 0) {
			const setup = useSetupStore.getState();
			const ancestor = selectedAncestorOf(hits[0], snap, setup.folders);
			if (ancestor) {
				snap = [
					...snap.filter((item) => item.id !== ancestor),
					...materializeExcluding(
						ancestor,
						hits[0],
						setup.folders,
						setup.cards,
						setup.itemOrder,
						true,
					),
				];
			}
		}
		const snapIds = new Set(snap.map((item) => item.id));
		if (mode.current === "add") {
			// Union with the gesture-start snapshot: the window
			// blank-clearer already emptied the live store at pointerdown,
			// so merging here is what keeps carried items selected.
			const merged = [...snap];
			for (const hit of hits) {
				if (!snapIds.has(hit.id)) {
					snapIds.add(hit.id);
					merged.push(hit);
				}
			}
			writeSelection(merged);
			return;
		}
		// Toggle: latched flips relative to the gesture-start snapshot.
		const touchedNow = touched.current;
		const kept = snap.filter((item) => !touchedNow.has(item.id));
		const keptIds = new Set(kept.map((item) => item.id));
		const flipped: SelectionItem[] = [];
		for (const id of touchOrder.current) {
			if (snapIds.has(id) || keptIds.has(id)) continue;
			const surface = cache.current.get(id);
			if (surface) {
				flipped.push({ id, kind: surface.kind, sourceId: folder });
				keptIds.add(id);
			}
		}
		writeSelection([...kept, ...flipped]);
	}, [paintOverlay, writeSelection]);

	const pokeFrame = useCallback(() => {
		if (phase.current !== "selecting") return;
		if (raf.current === null) {
			raf.current = requestAnimationFrame(processFrame);
		}
	}, [processFrame]);

	const releaseCapture = useCallback(() => {
		const wrap = wrapEl.current;
		const pointerId = activePointerId.current;
		wrapEl.current = null;
		activePointerId.current = null;
		if (!wrap || pointerId === null) return;
		try {
			if (wrap.hasPointerCapture(pointerId)) {
				wrap.releasePointerCapture(pointerId);
			}
		} catch {
			// Never let capture bookkeeping break gesture teardown.
		}
	}, []);

	const settle = useCallback(
		(restore: boolean) => {
			if (raf.current !== null) {
				cancelAnimationFrame(raf.current);
				raf.current = null;
			}
			autoscroll.stop();
			phase.current = "idle";
			setSelecting(false);
			paintOverlay(null);
			if (restore) {
				const snap = snapshot.current;
				if (snap.length === 0) useSelectionStore.getState().clear();
				else useSelectionStore.getState().selectAll([...snap]);
			}
			snapshot.current = [];
			touched.current.clear();
			touchOrder.current = [];
			touchOrderIds.current.clear();
			cache.current.clear();
			lastKey.current = "";
			releaseCapture();
		},
		[autoscroll, paintOverlay, releaseCapture],
	);

	const buildCache = useCallback((wrap: HTMLElement) => {
		const next = new Map<string, CachedSurface>();
		const order = itemsRef.current;
		const byId = new Map(order.map((item) => [item.id, item.kind]));
		const cells = wrap.querySelectorAll("[data-marquee-id]");
		for (const cell of cells) {
			if (!(cell instanceof HTMLElement)) continue;
			const id = cell.getAttribute("data-marquee-id");
			if (!id) continue;
			const kind = byId.get(id);
			if (!kind) continue;
			// Visual surface only: icon tiles exclude their labels; card
			// surfaces fill their cell, so the cell rect is exact there.
			const surface =
				cell.querySelector(".icon-app-tile, .icon-folder-tile") ?? cell;
			const r = surface.getBoundingClientRect();
			next.set(id, {
				kind,
				rect: {
					left: r.left,
					top: r.top,
					right: r.right,
					bottom: r.bottom,
					width: r.width,
					height: r.height,
				},
			});
		}
		cache.current = next;
	}, []);

	const onPointerDown = useCallback(
		(e: React.PointerEvent<HTMLElement>) => {
			if (disabled || phase.current !== "idle") return;
			if (!e.isPrimary || e.button !== 0) return;
			if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
			if (e.altKey) return;
			if (isInteractiveTarget(e.target)) return;
			// Plain and Shift drags both grow the selection; only
			// Ctrl/Cmd flips. (Click without drag still clears via the
			// window blank-clearer — threshold never commits.)
			mode.current = e.ctrlKey || e.metaKey ? "toggle" : "add";
			// Snapshot BEFORE the window blank-clearer runs (React handlers
			// precede native window listeners): toggle/add merge against
			// pre-gesture state and Esc restores it.
			snapshot.current = [...useSelectionStore.getState().items];
			touched.current.clear();
			touchOrder.current = [];
			touchOrderIds.current.clear();
			lastKey.current = "";
			anchor.current = { x: e.clientX, y: e.clientY };
			current.current = { x: e.clientX, y: e.clientY };
			phase.current = "pending";
			wrapEl.current = e.currentTarget;
			// Capture immediately: the press started on vetted empty space,
			// so there is no click/dragstart to swallow, and the gesture can
			// never strand in pending when released outside the wrap.
			try {
				e.currentTarget.setPointerCapture(e.pointerId);
				activePointerId.current = e.pointerId;
			} catch {
				// Capture is best-effort (e.g. pointer already up).
			}
		},
		[disabled],
	);

	const onPointerMove = useCallback(
		(e: React.PointerEvent<HTMLElement>) => {
			if (phase.current === "idle") return;
			// Implicit release: no button held (capture failed and the
			// release happened outside, or a synthesized move). Commits
			// whatever is live — exactly like pointerup — so no phase can
			// strand and no intentional drag is discarded.
			if ((e.buttons & 1) === 0) {
				settle(false);
				return;
			}
			// A native drag winning mid-gesture aborts the marquee; the two
			// states must never coexist.
			if (getActiveDrag()) {
				settle(phase.current === "selecting");
				return;
			}
			current.current = { x: e.clientX, y: e.clientY };
			if (phase.current === "pending") {
				if (
					pointerTravel(anchor.current, current.current) < MARQUEE_THRESHOLD_PX
				) {
					return;
				}
				const wrap = wrapEl.current;
				if (!wrap?.isConnected) {
					settle(false);
					return;
				}
				buildCache(wrap);
				const scroller = wrap.closest<HTMLElement>("[data-speed-dial-scroll]");
				lastScrollTop.current = scroller?.scrollTop ?? 0;
				phase.current = "selecting";
				setSelecting(true);
			}
			autoscroll.feed({ x: e.clientX, y: e.clientY });
			pokeFrame();
		},
		[autoscroll, buildCache, pokeFrame, settle],
	);

	const onPointerUp = useCallback(
		(e: React.PointerEvent<HTMLElement>) => {
			// A secondary-button release must not settle the primary gesture.
			if (e.button !== 0) return;
			// Sub-threshold release = plain empty click (the window clearer
			// already applied empty-click semantics at pointerdown).
			settle(false);
		},
		[settle],
	);

	const onPointerCancel = useCallback(() => {
		settle(phase.current === "selecting");
	}, [settle]);

	// Esc cancels the live gesture and restores the pre-gesture snapshot.
	// Capture-phase + stopPropagation preempts the grid's clear-selection
	// Esc, which would otherwise nuke the restored state.
	useEffect(() => {
		if (!selecting) return;
		function onKeyDown(e: KeyboardEvent) {
			if (e.key !== "Escape") return;
			e.stopPropagation();
			settle(true);
		}
		window.addEventListener("keydown", onKeyDown, { capture: true });
		return () =>
			window.removeEventListener("keydown", onKeyDown, { capture: true });
	}, [selecting, settle]);

	// Navigation (or unmount context change) mid-gesture: abort + restore.
	// biome-ignore lint/correctness/useExhaustiveDependencies: folderId is an intentional trigger.
	useEffect(() => {
		if (phase.current === "idle") return;
		settle(true);
	}, [folderId, settle]);

	useEffect(() => {
		return () => {
			if (raf.current !== null) cancelAnimationFrame(raf.current);
			autoscroll.stop();
		};
	}, [autoscroll]);

	return {
		marqueeProps: {
			onPointerDown,
			onPointerMove,
			onPointerUp,
			onPointerCancel,
		},
		marqueeActive: selecting,
		overlayRef: overlayEl,
	};
}

export type MarqueeProps = ReturnType<
	typeof useMarqueeSelection
>["marqueeProps"];
