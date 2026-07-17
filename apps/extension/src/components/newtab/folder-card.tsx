import { Icon } from "@perch/ui/icons/icon";
import { type DragEvent, useState } from "react";
import { getDragId, isDragKind } from "../../lib/dnd";
import { useSpringLoad } from "../../hooks/use-spring-load";
import { cn } from "../../lib/utils";

interface FolderCardProps {
	id: string;
	name: string;
	/** Number of direct child folders + cards, shown as a subtitle. */
	itemCount: number;
	/** True while this folder itself is the one being dragged (dim it). */
	dragging?: boolean;
	onOpen: (id: string) => void;
	onEdit: (id: string) => void;
	/** Called when a card (by id) is dropped onto this folder. */
	onDropCard: (cardId: string, folderId: string) => void;
	/** Called when another folder (by id) is dropped onto this folder to nest it. */
	onDropFolder: (folderId: string, targetFolderId: string) => void;
	/** Whether a given folder can legally be nested here (cycle-safe check from parent). */
	canAcceptFolder: (folderId: string) => boolean;
	/** Drag props so a folder tile is itself draggable (to reorder / nest elsewhere). */
	dragProps?: Record<string, unknown>;
}

/**
 * A folder tile rendered inside the dial grid. Visually consistent with
 * DialCard (same squircle + sizing) but represents a navigable subfolder.
 * Doubles as a drop target: cards dropped here move in, folders dropped here
 * nest in, and hovering during a drag "spring-loads" — auto-opening the folder
 * so the user can drill deeper without releasing.
 */
export function FolderCard({
	id,
	name,
	itemCount,
	dragging,
	onOpen,
	onEdit,
	onDropCard,
	onDropFolder,
	canAcceptFolder,
	dragProps,
}: FolderCardProps) {
	const [dropActive, setDropActive] = useState(false);
	const spring = useSpringLoad(() => onOpen(id));

	function accepts(e: DragEvent): boolean {
		if (isDragKind(e, "card")) return true;
		if (isDragKind(e, "folder")) {
			const draggedId = getDragId(e);
			// draggedId is empty during dragover in some browsers; fall back to allow,
			// the drop handler re-validates before mutating.
			return draggedId ? draggedId !== id && canAcceptFolder(draggedId) : true;
		}
		return false;
	}

	function handleDragOver(e: DragEvent) {
		if (!accepts(e)) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		if (!dropActive) setDropActive(true);
		spring.start();
	}

	function handleDragLeave() {
		setDropActive(false);
		spring.cancel();
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		setDropActive(false);
		spring.cancel();
		const draggedId = getDragId(e);
		if (!draggedId) return;
		if (isDragKind(e, "folder")) {
			if (draggedId !== id && canAcceptFolder(draggedId)) {
				onDropFolder(draggedId, id);
			}
		} else if (isDragKind(e, "card")) {
			onDropCard(draggedId, id);
		}
	}

	return (
		<button
			type="button"
			aria-label={`Open folder ${name}`}
			onClick={() => onOpen(id)}
			onContextMenu={(e) => {
				e.preventDefault();
				onEdit(id);
			}}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
			className={cn(
				"squircle dial-card relative flex min-h-[var(--tile-h,100px)] w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden border bg-white/[0.04] p-2 transition-all duration-200 hover:translate-y-[-1px] hover:bg-white/[0.08] active:scale-[1.01]",
				dropActive
					? "scale-[1.04] border-white/70 bg-white/[0.14]"
					: "border-white/[0.06]",
				dragging && "opacity-40",
			)}
			style={{ borderRadius: "var(--radius-card, 18px)" }}
			{...dragProps}
		>
			<Icon
				name="folder"
				size={26}
				className={cn(
					"transition-opacity",
					dropActive ? "opacity-100" : "opacity-70",
				)}
			/>
			<span className="w-full truncate px-1 text-center font-medium text-[11px] text-white/70">
				{name}
			</span>
			<span className="absolute top-2 right-2 rounded-full bg-white/10 px-1.5 text-[10px] text-white/50">
				{itemCount}
			</span>
		</button>
	);
}
