import type { DragEvent } from "react";

/**
 * Shared drag payload conventions. Drop targets need to tell a card drag from a
 * folder drag, so we encode the kind in a dedicated MIME type alongside the raw
 * id in text/plain (kept for Firefox compatibility and native fallbacks).
 */
export type DragKind = "card" | "folder";

const KIND_PREFIX = "application/x-klice-start-";

export interface ActiveDrag {
	kind: DragKind;
	id: string;
}

// Native drag events outlive React renders (and can outlive the source node
// when spring-load navigation swaps a folder). Keep only the small payload in
// module state so a newly rendered drop target can still resolve it.
let _activeDrag: ActiveDrag | null = null;

/** Get the currently active in-memory drag state (available during dragover). */
export function getActiveDrag(): ActiveDrag | null {
	return _activeDrag ? { ..._activeDrag } : null;
}

/** Set or clear the active in-memory drag state. */
export function setActiveDrag(drag: ActiveDrag | null): void {
	_activeDrag = drag;
}

/** Clear the payload at a terminal drag boundary (drop, dragend, or cancel). */
export function clearActiveDrag(): void {
	_activeDrag = null;
}

/** Write both the raw id (text/plain) and a typed marker for the drag kind. */
export function setDragData(e: DragEvent, kind: DragKind, id: string): void {
	setActiveDrag({ kind, id });
	e.dataTransfer.effectAllowed = "move";
	try {
		e.dataTransfer.setData("text/plain", id);
		e.dataTransfer.setData(`${KIND_PREFIX}${kind}`, id);
	} catch {
		// Some environments disallow setData during dragstart; safe to ignore.
	}
}

/** True when the active drag carries the given kind (checkable during dragOver). */
export function isDragKind(e: DragEvent, kind: DragKind): boolean {
	if (_activeDrag) {
		return _activeDrag.kind === kind;
	}
	return e.dataTransfer.types.includes(`${KIND_PREFIX}${kind}`);
}

/**
 * Props a grid item spreads onto its draggable element. Owned by the grid's
 * DnD coordinator; cards/folders stay presentational.
 */
export interface GridItemDragProps {
	draggable: boolean;
	onDragStart: (e: DragEvent) => void;
	onDragEnd: (e: DragEvent) => void;
	onDragOver: (e: DragEvent) => void;
	onDragLeave: (e: DragEvent) => void;
	onDrop: (e: DragEvent) => void;
}

/**
 * Which part of a drop target the pointer is over. Edges mean "insert
 * before/after" (reorder); the center means "drop onto/into" (nest/combine).
 * Shared by the grid and the tabbar so intent reads identically everywhere.
 */
export type DropZone = "before" | "after" | "center";

/** Preview cells always represent insertion, including over their center. */
export function insertPositionFor(
	e: DragEvent,
	el: HTMLElement,
): "before" | "after" {
	const rect = el.getBoundingClientRect();
	return e.clientX < rect.left + rect.width / 2 ? "before" : "after";
}

export function dropZoneFor(e: DragEvent, el: HTMLElement): DropZone {
	const rect = el.getBoundingClientRect();
	// Y-aware zones for wrapping grids: a pointer clearly above/below the
	// tile's vertical middle is a reorder signal even when horizontally
	// central. This keeps top/bottom approaches forgiving across rows and
	// variable heights, while the X ratio still decides within the middle
	// band. Wide (multi-cell folder) tiles keep X-dominant behavior because
	// their center band is physically meaningful.
	const ratioX = (e.clientX - rect.left) / Math.max(1, rect.width);
	const ratioY = (e.clientY - rect.top) / Math.max(1, rect.height);
	const isWide = rect.width > rect.height * 1.5;
	if (!isWide) {
		if (ratioY < 0.25 && ratioX < 0.72) return "before";
		if (ratioY > 0.75 && ratioX > 0.28) return "after";
	}
	if (ratioX < 0.28) return "before";
	if (ratioX > 0.72) return "after";
	return "center";
}

/** Resolve the active drag during over/drop: in-memory first (same-document,
 * reliable mid-drag), dataTransfer types as the cross-window fallback. */
export function resolveDragRef(e: DragEvent): ActiveDrag | null {
	if (_activeDrag) return { ..._activeDrag };
	if (e.dataTransfer.types.includes(`${KIND_PREFIX}card`)) {
		return { kind: "card", id: getDragId(e) };
	}
	if (e.dataTransfer.types.includes(`${KIND_PREFIX}folder`)) {
		return { kind: "folder", id: getDragId(e) };
	}
	return null;
}

/** Read the dragged id on drop, falling back to in-memory active drag. */
export function getDragId(e: DragEvent): string {
	if (_activeDrag) {
		return _activeDrag.id;
	}
	try {
		return e.dataTransfer.getData("text/plain");
	} catch {
		return "";
	}
}
