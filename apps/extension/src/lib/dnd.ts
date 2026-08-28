import type { DragEvent } from "react";

/**
 * Shared drag payload conventions. Drop targets need to tell a card drag from a
 * folder drag, so we encode the kind in a dedicated MIME type alongside the raw
 * id in text/plain (kept for Firefox compatibility and native fallbacks).
 */
export type DragKind = "card" | "folder";

const KIND_PREFIX = "application/x-klice-start-";

/** Write both the raw id (text/plain) and a typed marker for the drag kind. */
export function setDragData(e: DragEvent, kind: DragKind, id: string): void {
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
  return e.dataTransfer.types.includes(`${KIND_PREFIX}${kind}`);
}

/** Read the dragged id on drop. */
export function getDragId(e: DragEvent): string {
  return e.dataTransfer.getData("text/plain");
}
