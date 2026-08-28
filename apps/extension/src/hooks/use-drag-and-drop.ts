import { type DragEvent, useCallback, useRef, useState } from "react";
import { type DragKind, setActiveDrag, setDragData } from "../lib/dnd";

export interface DragAndDrop {
	draggingId: string | null;
	overId: string | null;
	isDragging: boolean;
	/** Props to spread on each draggable/droppable item element. */
	getItemProps: (id: string) => {
		draggable: boolean;
		"data-dragging"?: boolean;
		"data-drop-target"?: boolean;
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

export function useDragAndDrop({
	onDrop,
	kind = "card",
}: Options): DragAndDrop {
	const draggingRef = useRef<string | null>(null);
	const [draggingId, setDraggingId] = useState<string | null>(null);
	const [overId, setOverId] = useState<string | null>(null);

	const handleDragStart = useCallback(
		(id: string) => (e: DragEvent) => {
			draggingRef.current = id;
			setDragData(e, kind, id);
			// Defer source dimming by one frame so browser captures full-opacity drag image
			requestAnimationFrame(() => {
				if (draggingRef.current === id) {
					setDraggingId(id);
				}
			});
		},
		[kind],
	);

	const handleDragEnd = useCallback(() => {
		draggingRef.current = null;
		setActiveDrag(null);
		setDraggingId(null);
		setOverId(null);
	}, []);

	const handleDragOver = useCallback(
		(id: string) => (e: DragEvent) => {
			if (!draggingRef.current || draggingRef.current === id) return;
			e.preventDefault();
			e.dataTransfer.dropEffect = "move";
			setOverId((prev) => (prev === id ? prev : id));

			// Edge auto-scroll
			if (typeof window !== "undefined") {
				if (e.clientY < 50) {
					window.scrollBy({ top: -10, behavior: "instant" as ScrollBehavior });
				} else if (window.innerHeight - e.clientY < 50) {
					window.scrollBy({ top: 10, behavior: "instant" as ScrollBehavior });
				}
			}
		},
		[],
	);

	const handleDragLeave = useCallback(
		(id: string) => (e: DragEvent) => {
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
			setActiveDrag(null);
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
