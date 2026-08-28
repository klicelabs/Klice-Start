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

let _activeDrag: ActiveDrag | null = null;

/** Get the currently active in-memory drag state (available during dragover). */
export function getActiveDrag(): ActiveDrag | null {
	return _activeDrag;
}

/** Set or clear the active in-memory drag state. */
export function setActiveDrag(drag: ActiveDrag | null): void {
	_activeDrag = drag;
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
