import {
	type DragEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	clearActiveDrag,
	dropZoneFor,
	insertPositionFor,
	type GridItemDragProps,
	resolveDragRef,
	setDragData,
} from "../lib/dnd";
import { sweepDragGhosts } from "../lib/drag-ghost";
import type { ItemOrder, ItemRef } from "../lib/item-order";
import { useSpringLoad } from "./use-spring-load";

export interface GridDndHandlers {
	/** Live mixed reorder inside one container (never reparents). */
	onLiveReorder: (
		dragged: ItemRef,
		target: ItemRef,
		position: "before" | "after",
	) => void;
	/** Drop a card onto another card: create a subfolder with both. */
	onCombineCards: (draggedCardId: string, targetCardId: string) => void;
	/** Drop anything onto a folder: move (multi-selection aware upstream). */
	onDropOnFolder: (draggedId: string, folderId: string) => void;
	/** Drop onto empty grid background. */
	onBackgroundDrop: (dragged: ItemRef) => void;
	/** Spring-loaded navigation into a folder. */
	onOpenFolder: (id: string) => void;
	/** Icon mode owns spring-loading on its stacked ninth preview slot. */
	allowFolderSpringLoad?: boolean;
	/** Preview reorder callbacks share the grid's active drag lifecycle. */
	onPreviewLiveReorder?: (
		targetFolderId: string,
		dragged: ItemRef,
		target: ItemRef,
		position: "before" | "after",
	) => void;
	onPreviewDrop?: (
		targetFolderId: string,
		draggedCardId: string,
		targetCardId: string,
		position: "before" | "after",
	) => void;
	/** Cycle guard for folder-in-folder drops. */
	canNest: (folderId: string, targetFolderId: string) => boolean;
	/** True when the ref belongs to this grid's container. */
	isInContainer: (ref: ItemRef) => boolean;
	/**
	 * Escape support: hover-applied live reorders are real store writes, so
	 * cancelling must undo them. The owner snapshots the persisted order at
	 * dragstart and restores it on Escape; the coordinator only holds the
	 * opaque snapshot (store access stays with the owner, keeping this hook
	 * free of store imports and their module side effects).
	 */
	onSnapshotOrder?: () => ItemOrder | null;
	onRestoreOrder?: (snapshot: ItemOrder) => void;
	/**
	 * Runs first inside dragstart, synchronously: the owner adjusts selection
	 * (dragging an unselected item starts a fresh single drag) and may set a
	 * custom drag image while the browser still accepts one.
	 */
	onItemDragStart?: (ref: ItemRef, e: DragEvent) => void;
}

function resolveDrag(e: DragEvent): ItemRef | null {
	const active = resolveDragRef(e);
	if (!active || !active.id) return null;
	return { kind: active.kind, id: active.id };
}

/**
 * Edge-triggered autoscroll tuning. The zone is viewport pixels from the
 * scroll container's lip; speed follows a quadratic depth curve so the
 * entry edge crawls for precision (~1 row/s) while the extreme lip
 * traverses (~6 rows/s) without ever jumping.
 */
const AUTOSCROLL_ZONE_PX = 90;
const AUTOSCROLL_MIN_PX_S = 180;
const AUTOSCROLL_MAX_PX_S = 1000;

interface AutoscrollPointer {
	x: number;
	y: number;
	active: boolean;
}

function autoscrollSpeed(distancePx: number): number {
	const depth = Math.min(1, Math.max(0, 1 - distancePx / AUTOSCROLL_ZONE_PX));
	return (
		AUTOSCROLL_MIN_PX_S +
		(AUTOSCROLL_MAX_PX_S - AUTOSCROLL_MIN_PX_S) * depth * depth
	);
}

function canScrollY(el: HTMLElement, dir: -1 | 1): boolean {
	if (el.scrollHeight <= el.clientHeight + 1) return false;
	if (dir < 0) return el.scrollTop > 0;
	return el.scrollTop < el.scrollHeight - el.clientHeight - 1;
}

function isValidItemDrop(
	dragged: ItemRef,
	target: ItemRef,
	zone: "before" | "after" | "center",
	handlers: GridDndHandlers,
) {
	if (dragged.id === target.id) return false;
	if (zone === "center") {
		if (target.kind === "folder") {
			return (
				dragged.kind !== "folder" || handlers.canNest(dragged.id, target.id)
			);
		}
		return dragged.kind === "card" && handlers.isInContainer(dragged);
	}
	return (
		handlers.isInContainer(dragged) ||
		target.kind === "folder" ||
		target.kind === "card"
	);
}

/**
 * Grid drag-and-drop coordinator.
 *
 * One hook owns the whole interaction so drop intent is unambiguous:
 *
 *   - pointer over an item's edges → live reorder (surrounding items move
 *     out of the way in real time via `onLiveReorder` on every zone change);
 *   - pointer over a card's center → combine (drop creates a subfolder);
 *   - pointer over a folder's center → nest (drop moves inside) + spring-load;
 *   - drop on empty background → container append (this is what makes a drop
 *     still land correctly when spring-load navigation swapped the grid
 *     mid-drag: the moved item is always persisted, navigation never swallows
 *     the move).
 *
 * Spring-load only arms on folder-center hover, never on reorder edges, and
 * the drop always persists its move — navigation is never a substitute.
 */
export function useGridDnd(handlers: GridDndHandlers) {
	const [drag, setDrag] = useState<ItemRef | null>(null);
	const [insertion, setInsertion] = useState<{
		key: string;
		position: "before" | "after";
	} | null>(null);
	const [combineKey, setCombineKey] = useState<string | null>(null);
	const [nestId, setNestId] = useState<string | null>(null);
	const [previewInsertion, setPreviewInsertion] = useState<{
		folderId: string;
		targetCardId: string;
		position: "before" | "after";
	} | null>(null);

	const dragRef = useRef<ItemRef | null>(null);
	const lastApplied = useRef<string | null>(null);
	const springTarget = useRef<string | null>(null);
	const handlersRef = useRef(handlers);
	handlersRef.current = handlers;
	// Pre-drag order snapshot: Escape restores the container order instead of
	// leaving hover-applied live reorders behind.
	const orderSnapshot = useRef<ItemOrder | null>(null);
	// Latest preview insertion mirrored in a ref so preview drop reads the
	// live value without recreating every preview cell's handlers per hover.
	const previewInsertionRef = useRef<{
		folderId: string;
		targetCardId: string;
		position: "before" | "after";
	} | null>(null);

	// Time-driven autoscroll session. Native dragover events stall when the
	// pointer holds still, so sensing (dragover writes the pointer) is
	// decoupled from scrolling (a rAF loop owns all scrollTop writes and
	// keeps running with a static pointer inside the edge zone).
	const scrollPointer = useRef<AutoscrollPointer>({ x: 0, y: 0, active: false });
	const scrollContainer = useRef<HTMLElement | null | undefined>(undefined);
	const scrollRaf = useRef<number | null>(null);
	const scrollLastT = useRef(0);

	const stopAutoscroll = useCallback(() => {
		scrollPointer.current.active = false;
		if (scrollRaf.current !== null) {
			cancelAnimationFrame(scrollRaf.current);
			scrollRaf.current = null;
		}
	}, []);

	const autoscrollTick = useCallback(() => {
		scrollRaf.current = null;
		const pointer = scrollPointer.current;
		if (!pointer.active) return;
		const now =
			typeof performance !== "undefined" ? performance.now() : Date.now();
		const dt = Math.min(
			0.05,
			scrollLastT.current === 0 ? 0.016 : (now - scrollLastT.current) / 1000,
		);
		scrollLastT.current = now;

		let dir: -1 | 0 | 1 = 0;
		let distance = 0;
		const container = scrollContainer.current;
		if (container) {
			const bounds = container.getBoundingClientRect();
			const dTop = pointer.y - bounds.top;
			const dBottom = bounds.bottom - pointer.y;
			if (dTop < AUTOSCROLL_ZONE_PX) {
				dir = -1;
				distance = dTop;
			} else if (dBottom < AUTOSCROLL_ZONE_PX) {
				dir = 1;
				distance = dBottom;
			}
			if (dir !== 0) {
				if (canScrollY(container, dir)) {
					container.scrollTop += dir * autoscrollSpeed(distance) * dt;
				} else {
					dir = 0;
				}
			}
		} else if (typeof window !== "undefined") {
			if (pointer.y < AUTOSCROLL_ZONE_PX) {
				dir = -1;
				distance = pointer.y;
			} else if (window.innerHeight - pointer.y < AUTOSCROLL_ZONE_PX) {
				dir = 1;
				distance = window.innerHeight - pointer.y;
			}
			if (dir !== 0) {
				window.scrollBy({
					top: dir * autoscrollSpeed(distance) * dt,
					behavior: "auto" as ScrollBehavior,
				});
			}
		}
		// Keep looping only while scrolling is needed. A fresh dragover
		// restarts the loop, so an idle pointer outside the zone costs
		// nothing while a static pointer inside the zone keeps travelling.
		if (pointer.active && dir !== 0) {
			scrollRaf.current = requestAnimationFrame(autoscrollTick);
		}
	}, []);

	/** Record the pointer and ensure the scroll loop is running. */
	const feedAutoscroll = useCallback(
		(e: DragEvent) => {
			scrollPointer.current = {
				x: e.clientX,
				y: e.clientY,
				active: true,
			};
			if (scrollContainer.current === undefined) {
				scrollContainer.current =
					typeof document === "undefined"
						? null
						: document.querySelector<HTMLElement>("[data-speed-dial-scroll]");
			}
			if (scrollRaf.current === null) {
				scrollLastT.current = 0;
				scrollRaf.current = requestAnimationFrame(autoscrollTick);
			}
		},
		[autoscrollTick],
	);

	const spring = useSpringLoad(() => {
		const target = springTarget.current;
		if (target) handlersRef.current.onOpenFolder(target);
	});
	const springStart = spring.start;
	const springRestart = spring.restart;
	const springCancel = spring.cancel;

	const clearVisuals = useCallback(() => {
		setInsertion(null);
		setCombineKey(null);
		setNestId(null);
		setPreviewInsertion(null);
		previewInsertionRef.current = null;
	}, []);

	// Clear the rendered intent without clearing the native payload. A
	// spring-loaded folder navigation swaps the grid while the browser is still
	// holding the source drag, so the new grid must be able to resolve it.
	const resetVisuals = useCallback(() => {
		lastApplied.current = null;
		springTarget.current = null;
		springCancel();
		setDrag(null);
		clearVisuals();
	}, [springCancel, clearVisuals]);

	// Full settlement is reserved for a real drag end, drop, Escape, or
	// unmount. Navigation calls resetVisuals so the active native payload lives
	// through the container swap.
	const resetDrag = useCallback(() => {
		dragRef.current = null;
		orderSnapshot.current = null;
		stopAutoscroll();
		resetVisuals();
		clearActiveDrag();
	}, [resetVisuals, stopAutoscroll]);

	/** Restore the pre-drag order (Escape cancellation). */
	const restoreSnapshot = useCallback(() => {
		const snapshot = orderSnapshot.current;
		orderSnapshot.current = null;
		if (snapshot) handlersRef.current.onRestoreOrder?.(snapshot);
	}, []);

	const applyLiveReorder = useCallback(
		(dragged: ItemRef, target: ItemRef, position: "before" | "after") => {
			const stamp = `${dragged.kind}:${dragged.id}|${target.kind}:${target.id}|${position}`;
			if (lastApplied.current === stamp) return;
			lastApplied.current = stamp;
			handlersRef.current.onLiveReorder(dragged, target, position);
		},
		[],
	);

	const handleItemDragStart = useCallback(
		(ref: ItemRef) => (e: DragEvent) => {
			handlersRef.current.onItemDragStart?.(ref, e);
			dragRef.current = ref;
			lastApplied.current = null;
			scrollContainer.current = undefined;
			sweepDragGhosts();
			// Snapshot the persisted order before hover-applied live reorders
			// mutate it, so Escape can return to a stable pre-drag state.
			orderSnapshot.current =
				handlersRef.current.onSnapshotOrder?.() ?? null;
			setDragData(e, ref.kind, ref.id);
			// Defer source dimming one frame so the browser captures a
			// full-opacity drag image.
			requestAnimationFrame(() => {
				if (dragRef.current?.id === ref.id) setDrag(ref);
			});
		},
		[],
	);

	const handleItemDragEnd = useCallback(() => {
		resetDrag();
	}, [resetDrag]);

	// Native dragend can arrive after its source node has been removed (for
	// example, when spring-load navigation swaps the grid). Keep cleanup at the
	// window boundary as a backstop, and let Escape cancel the same state.
	// Escape also restores the pre-drag order: hover-applied live reorders
	// are real store writes, so cancelling must undo them.
	useEffect(() => {
		if (typeof window === "undefined") return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && dragRef.current) {
				restoreSnapshot();
				resetDrag();
			}
		};
		const handleDragEnd = () => resetDrag();
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("dragend", handleDragEnd);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("dragend", handleDragEnd);
			resetDrag();
		};
	}, [resetDrag, restoreSnapshot]);

	const handleItemDragOver = useCallback(
		(ref: ItemRef) => (e: DragEvent) => {
			const h = handlersRef.current;
			const dragged = dragRef.current ?? resolveDrag(e);
			if (!dragged || !dragged.id || dragged.id === ref.id) return;

			const el = e.currentTarget;
			if (!(el instanceof HTMLElement)) return;
			const zone = dropZoneFor(e, el);
			const foreign = !h.isInContainer(dragged);
			if (!isValidItemDrop(dragged, ref, zone, h)) {
				e.dataTransfer.dropEffect = "none";
				return;
			}

			if (ref.kind === "folder") {
				if (zone === "center") {
					e.preventDefault();
					e.dataTransfer.dropEffect = "move";
					feedAutoscroll(e);
					lastApplied.current = null;
					setInsertion((prev) => (prev === null ? prev : null));
					setCombineKey(null);
					setNestId((prev) => (prev === ref.id ? prev : ref.id));
					if (h.allowFolderSpringLoad !== false) {
						// A target change restarts the dwell: reusing start()
						// would keep the stale timer and navigate to the
						// previous folder (A → B navigates to A).
						if (springTarget.current === ref.id) springStart();
						else {
							springTarget.current = ref.id;
							springRestart();
						}
					} else {
						springTarget.current = null;
						springCancel();
					}
					return;
				}
				// Edge: reorder for locals; foreign folders land on drop.
				if (foreign) {
					e.preventDefault();
					e.dataTransfer.dropEffect = "move";
					feedAutoscroll(e);
					return;
				}
				e.preventDefault();
				e.dataTransfer.dropEffect = "move";
				feedAutoscroll(e);
				springCancel();
				springTarget.current = null;
				setNestId((prev) => (prev === null ? prev : null));
				setCombineKey(null);
				setInsertion((prev) =>
					prev?.key === ref.id && prev.position === zone
						? prev
						: { key: ref.id, position: zone },
				);
				applyLiveReorder(dragged, ref, zone);
				return;
			}

			// Target is a card.
			if (zone === "center") {
				// Only card-on-card combines; a folder cannot nest into a card.
				if (dragged.kind !== "card" || foreign) return;
				e.preventDefault();
				e.dataTransfer.dropEffect = "move";
				feedAutoscroll(e);
				lastApplied.current = null;
				springCancel();
				springTarget.current = null;
				setInsertion((prev) => (prev === null ? prev : null));
				setNestId((prev) => (prev === null ? prev : null));
				setCombineKey((prev) => (prev === ref.id ? prev : ref.id));
				return;
			}
			if (foreign) {
				e.preventDefault();
				e.dataTransfer.dropEffect = "move";
				feedAutoscroll(e);
				return;
			}
			e.preventDefault();
			e.dataTransfer.dropEffect = "move";
			feedAutoscroll(e);
			springCancel();
			springTarget.current = null;
			setNestId((prev) => (prev === null ? prev : null));
			setCombineKey(null);
			setInsertion((prev) =>
				prev?.key === ref.id && prev.position === zone
					? prev
					: { key: ref.id, position: zone },
			);
			applyLiveReorder(dragged, ref, zone);
		},
		[springStart, springRestart, springCancel, applyLiveReorder, feedAutoscroll],
	);

	const handleItemDragLeave = useCallback(
		(ref: ItemRef) => (e: DragEvent) => {
			const related = e.relatedTarget as Node | null;
			if (
				related &&
				e.currentTarget instanceof Node &&
				e.currentTarget.contains(related)
			) {
				return;
			}
			setInsertion((prev) => (prev?.key === ref.id ? null : prev));
			setCombineKey((prev) => (prev === ref.id ? null : prev));
			setNestId((prev) => {
				if (prev === ref.id) {
					springCancel();
					springTarget.current = null;
					return null;
				}
				return prev;
			});
		},
		[springCancel],
	);

	const handleItemDrop = useCallback(
		(ref: ItemRef) => (e: DragEvent) => {
			e.preventDefault();
			// Keep the grid-background drop handler from also firing: the item
			// already owned this drop.
			e.stopPropagation();
			const h = handlersRef.current;
			const dragged = dragRef.current ?? resolveDrag(e);
			// Preserve the hover stamp until the final edge decision. Clearing it
			// before reading it made every edge drop invoke reorder twice.
			const appliedStamp = lastApplied.current;
			// A drop fully settles the gesture: clear ALL drag visuals here, not
			// just dragend. After a spring-load navigation the source node is
			// unmounted, so dragend never reaches React and anything left set
			// (notably `drag`, which drives the opacity-40 ghost) sticks forever.
			resetDrag();
			if (!dragged || !dragged.id || dragged.id === ref.id) return;

			const el = e.currentTarget;
			const zone = el instanceof HTMLElement ? dropZoneFor(e, el) : "center";
			if (!isValidItemDrop(dragged, ref, zone, h)) return;

			if (ref.kind === "folder" && zone === "center") {
				h.onDropOnFolder(dragged.id, ref.id);
				return;
			}
			if (ref.kind === "card" && dragged.kind === "card" && zone === "center") {
				h.onCombineCards(dragged.id, ref.id);
				return;
			}
			if (!h.isInContainer(dragged)) {
				// Foreign item dropped on an edge: append to this container.
				h.onBackgroundDrop(dragged);
				return;
			}
			// Edge drop: live reorder already applied on hover; ensure the
			// final position in case drop fired without a preceding over.
			const stamp = `${dragged.kind}:${dragged.id}|${ref.kind}:${ref.id}|${zone}`;
			if (appliedStamp !== stamp && zone !== "center") {
				h.onLiveReorder(dragged, ref, zone);
			}
		},
		[resetDrag],
	);

	const handleBackgroundDragOver = useCallback(
		(e: DragEvent) => {
			const dragged = dragRef.current ?? resolveDrag(e);
			if (!dragged || !dragged.id) return;
			e.preventDefault();
			e.dataTransfer.dropEffect = "move";
			feedAutoscroll(e);
		},
		[feedAutoscroll],
	);

	const handleBackgroundDrop = useCallback(
		(e: DragEvent) => {
			e.preventDefault();
			const dragged = dragRef.current ?? resolveDrag(e);
			// Same full settle as item drops (see handleItemDrop).
			resetDrag();
			if (!dragged || !dragged.id) return;
			handlersRef.current.onBackgroundDrop(dragged);
		},
		[resetDrag],
	);

	const getItemDragProps = useCallback(
		(ref: ItemRef): GridItemDragProps => ({
			draggable: true,
			onDragStart: handleItemDragStart(ref),
			onDragEnd: handleItemDragEnd,
			onDragOver: handleItemDragOver(ref),
			onDragLeave: handleItemDragLeave(ref),
			onDrop: handleItemDrop(ref),
		}),
		[
			handleItemDragStart,
			handleItemDragEnd,
			handleItemDragOver,
			handleItemDragLeave,
			handleItemDrop,
		],
	);

	const getPreviewItemDragProps = useCallback(
		(folderId: string, cardId: string): GridItemDragProps => {
			const ref: ItemRef = { kind: "card", id: cardId };
			return {
				draggable: true,
				onDragStart: (e) => {
					e.stopPropagation();
					handlersRef.current.onItemDragStart?.(ref, e);
					dragRef.current = ref;
					lastApplied.current = null;
					scrollContainer.current = undefined;
					sweepDragGhosts();
					orderSnapshot.current =
						handlersRef.current.onSnapshotOrder?.() ?? null;
					setDragData(e, "card", cardId);
					requestAnimationFrame(() => {
						if (dragRef.current?.id === cardId) setDrag(ref);
					});
				},
				onDragEnd: (e) => {
					e.stopPropagation();
					resetDrag();
				},
				onDragOver: (e) => {
					const dragged = dragRef.current ?? resolveDrag(e);
					if (!dragged || dragged.kind !== "card" || dragged.id === cardId)
						return;
					const target = e.currentTarget;
					if (!(target instanceof HTMLElement)) return;
					const position = insertPositionFor(e, target);
					e.preventDefault();
					// Specific preview target beats folder body and page background.
					e.stopPropagation();
					e.dataTransfer.dropEffect = "move";
					feedAutoscroll(e);
					const next = { folderId, targetCardId: cardId, position };
					previewInsertionRef.current = next;
					setPreviewInsertion((prev) =>
						prev?.folderId === folderId &&
						prev.targetCardId === cardId &&
						prev.position === position
							? prev
							: next,
					);
					const stamp = `preview:${folderId}|${dragged.id}|${cardId}|${position}`;
					if (lastApplied.current === stamp) return;
					lastApplied.current = stamp;
					handlersRef.current.onPreviewLiveReorder?.(
						folderId,
						dragged,
						{ kind: "card", id: cardId },
						position,
					);
				},
				onDragLeave: (e) => {
					const related = e.relatedTarget as Node | null;
					if (
						related &&
						e.currentTarget instanceof Node &&
						e.currentTarget.contains(related)
					)
						return;
					e.stopPropagation();
					if (
						previewInsertionRef.current?.folderId === folderId &&
						previewInsertionRef.current.targetCardId === cardId
					) {
						previewInsertionRef.current = null;
					}
					setPreviewInsertion((current) =>
						current?.folderId === folderId && current.targetCardId === cardId
							? null
							: current,
					);
				},
				onDrop: (e) => {
					const dragged = dragRef.current ?? resolveDrag(e);
					if (!dragged || dragged.kind !== "card" || dragged.id === cardId)
						return;
					const target = e.currentTarget;
					if (!(target instanceof HTMLElement)) return;
					const live = previewInsertionRef.current;
					const position =
						live?.folderId === folderId && live.targetCardId === cardId
							? live.position
							: insertPositionFor(e, target);
					e.preventDefault();
					e.stopPropagation();
					resetDrag();
					handlersRef.current.onPreviewDrop?.(
						folderId,
						dragged.id,
						cardId,
						position,
					);
				},
			};
		},
		[resetDrag, feedAutoscroll],
	);

	const getFolderStackDragProps = useCallback(
		(folderId: string, sourceCardId?: string) => ({
			onDragOver: (e: DragEvent) => {
				const dragged = dragRef.current ?? resolveDrag(e);
				if (!dragged || dragged.kind !== "card" || dragged.id === sourceCardId)
					return;
				e.preventDefault();
				e.stopPropagation();
				e.dataTransfer.dropEffect = "move";
				feedAutoscroll(e);
				setNestId((prev) => (prev === folderId ? prev : folderId));
				if (springTarget.current === folderId) springStart();
				else {
					springTarget.current = folderId;
					springRestart();
				}
			},
			onDragLeave: (e: DragEvent) => {
				const related = e.relatedTarget as Node | null;
				if (
					related &&
					e.currentTarget instanceof Node &&
					e.currentTarget.contains(related)
				)
					return;
				e.stopPropagation();
				setNestId((current) => (current === folderId ? null : current));
				springTarget.current = null;
				springCancel();
			},
			onDrop: (e: DragEvent) => {
				e.preventDefault();
				e.stopPropagation();
				const dragged = dragRef.current ?? resolveDrag(e);
				resetDrag();
				if (!dragged || dragged.kind !== "card" || dragged.id === sourceCardId)
					return;
				handlersRef.current.onDropOnFolder(dragged.id, folderId);
			},
		}),
		[springStart, springRestart, springCancel, resetDrag, feedAutoscroll],
	);

	return {
		drag,
		insertion,
		combineKey,
		nestId,
		previewInsertion,
		/** Settle a stale gesture (e.g. the container swapped mid-drag). */
		reset: resetDrag,
		/** Clear hover visuals while preserving the native drag payload. */
		resetVisuals,
		getItemDragProps,
		getPreviewItemDragProps,
		getFolderStackDragProps,
		backgroundProps: {
			onDragOver: handleBackgroundDragOver,
			onDrop: handleBackgroundDrop,
		},
	};
}
