import { type DragEvent, useCallback, useRef, useState } from "react";
import { type DragKind, setDragData } from "../lib/dnd";

/**
 * Generic HTML5 drag-and-drop coordinator for a list of identified items.
 *
 * Why a ref for the dragged id: React re-renders during a drag (we update
 * `overId` for visual feedback), and a plain local/render-scoped variable would
 * be reset on every render — which is exactly the bug this replaces. The ref
 * persists across renders for the whole gesture.
 *
 * The consumer decides what a drop means (reorder vs. move into a container)
 * based on the target item's kind, so this hook stays layout-agnostic.
 */
export interface DragAndDrop {
	draggingId: string | null;
	overId: string | null;
	isDragging: boolean;
	/** Props to spread on each draggable/droppable item element. */
	getItemProps: (id: string) => {
		draggable: true;
		"data-dragging": boolean | undefined;
		"data-drop-target": boolean | undefined;
		onDragStart: (e: DragEvent) => void;
		onDragEnd: () => void;
		onDragOver: (e: DragEvent) => void;
		onDragLeave: (e: DragEvent) => void;
		onDrop: (e: DragEvent) => void;
	};
}

interface Options {
	/** Called when `draggedId` is dropped onto `targetId` (never equal). */
	onDrop: (draggedId: string, targetId: string) => void;
	/** Drag kind written to the dataTransfer so drop targets can filter. Defaults to "card". */
	kind?: DragKind;
}

export function useDragAndDrop({ onDrop, kind = "card" }: Options): DragAndDrop {
	const draggingRef = useRef<string | null>(null);
	const [draggingId, setDraggingId] = useState<string | null>(null);
	const [overId, setOverId] = useState<string | null>(null);

	const handleDragStart = useCallback(
		(id: string) => (e: DragEvent) => {
			draggingRef.current = id;
			setDraggingId(id);
			// setDragData sets effectAllowed and writes the typed payload + text/plain.
			setDragData(e, kind, id);
		},
		[kind],
	);

	const handleDragEnd = useCallback(() => {
		draggingRef.current = null;
		setDraggingId(null);
		setOverId(null);
	}, []);

	const handleDragOver = useCallback(
		(id: string) => (e: DragEvent) => {
			if (!draggingRef.current || draggingRef.current === id) return;
			e.preventDefault();
			e.dataTransfer.dropEffect = "move";
			setOverId((prev) => (prev === id ? prev : id));
		},
		[],
	);

	const handleDragLeave = useCallback(
		(id: string) => (e: DragEvent) => {
			// Ignore leave events fired when moving over a child element.
			const related = e.relatedTarget as Node | null;
			if (
				related &&
				e.currentTarget instanceof Node &&
				e.currentTarget.contains(related)
			)
				return;
			setOverId((prev) => (prev === id ? null : prev));
		},
		[],
	);

	const handleDrop = useCallback(
		(id: string) => (e: DragEvent) => {
			e.preventDefault();
			const dragged = draggingRef.current;
			draggingRef.current = null;
			setDraggingId(null);
			setOverId(null);
			if (!dragged || dragged === id) return;
			onDrop(dragged, id);
		},
		[onDrop],
	);

	const getItemProps = useCallback(
		(id: string) => ({
			draggable: true as const,
			"data-dragging": draggingId === id ? true : undefined,
			"data-drop-target": overId === id ? true : undefined,
			onDragStart: handleDragStart(id),
			onDragEnd: handleDragEnd,
			onDragOver: handleDragOver(id),
			onDragLeave: handleDragLeave(id),
			onDrop: handleDrop(id),
		}),
		[
			draggingId,
			overId,
			handleDragStart,
			handleDragEnd,
			handleDragOver,
			handleDragLeave,
			handleDrop,
		],
	);

	return {
		draggingId,
		overId,
		isDragging: draggingId !== null,
		getItemProps,
	};
}
