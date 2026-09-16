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
import type { ItemRef } from "../lib/item-order";
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

function edgeScroll(e: DragEvent) {
	const source = e.currentTarget;
	const scrollContainer =
		source instanceof HTMLElement
			? source.closest<HTMLElement>("[data-speed-dial-scroll]")
			: null;
	if (scrollContainer) {
		const bounds = scrollContainer.getBoundingClientRect();
		if (e.clientY - bounds.top < 50) scrollContainer.scrollTop -= 10;
		else if (bounds.bottom - e.clientY < 50) scrollContainer.scrollTop += 10;
		return;
	}
	if (typeof window === "undefined") return;
	if (e.clientY < 50)
		window.scrollBy({ top: -10, behavior: "instant" as ScrollBehavior });
	else if (window.innerHeight - e.clientY < 50)
		window.scrollBy({ top: 10, behavior: "instant" as ScrollBehavior });
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

	const spring = useSpringLoad(() => {
		const target = springTarget.current;
		if (target) handlersRef.current.onOpenFolder(target);
	});
	const springStart = spring.start;
	const springCancel = spring.cancel;

	const clearVisuals = useCallback(() => {
		setInsertion(null);
		setCombineKey(null);
		setNestId(null);
		setPreviewInsertion(null);
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
		resetVisuals();
		clearActiveDrag();
	}, [resetVisuals]);

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
	useEffect(() => {
		if (typeof window === "undefined") return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") resetDrag();
		};
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("dragend", resetDrag);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("dragend", resetDrag);
			resetDrag();
		};
	}, [resetDrag]);

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
					edgeScroll(e);
					lastApplied.current = null;
					setInsertion(null);
					setCombineKey(null);
					setNestId(ref.id);
					if (h.allowFolderSpringLoad !== false) {
						springTarget.current = ref.id;
						springStart();
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
					edgeScroll(e);
					return;
				}
				e.preventDefault();
				e.dataTransfer.dropEffect = "move";
				edgeScroll(e);
				springCancel();
				springTarget.current = null;
				setNestId(null);
				setCombineKey(null);
				setInsertion({ key: ref.id, position: zone });
				applyLiveReorder(dragged, ref, zone);
				return;
			}

			// Target is a card.
			if (zone === "center") {
				// Only card-on-card combines; a folder cannot nest into a card.
				if (dragged.kind !== "card" || foreign) return;
				e.preventDefault();
				e.dataTransfer.dropEffect = "move";
				edgeScroll(e);
				lastApplied.current = null;
				springCancel();
				springTarget.current = null;
				setInsertion(null);
				setNestId(null);
				setCombineKey(ref.id);
				return;
			}
			if (foreign) {
				e.preventDefault();
				e.dataTransfer.dropEffect = "move";
				edgeScroll(e);
				return;
			}
			e.preventDefault();
			e.dataTransfer.dropEffect = "move";
			edgeScroll(e);
			springCancel();
			springTarget.current = null;
			setNestId(null);
			setCombineKey(null);
			setInsertion({ key: ref.id, position: zone });
			applyLiveReorder(dragged, ref, zone);
		},
		[springStart, springCancel, applyLiveReorder],
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

	const handleBackgroundDragOver = useCallback((e: DragEvent) => {
		const dragged = dragRef.current ?? resolveDrag(e);
		if (!dragged || !dragged.id) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		edgeScroll(e);
	}, []);

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
					setPreviewInsertion({ folderId, targetCardId: cardId, position });
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
					const position =
						previewInsertion?.folderId === folderId &&
						previewInsertion.targetCardId === cardId
							? previewInsertion.position
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
		[resetDrag, previewInsertion],
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
				setNestId(folderId);
				springTarget.current = folderId;
				springStart();
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
		[springStart, springCancel, resetDrag],
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
