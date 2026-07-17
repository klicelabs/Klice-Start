import { Button } from "@perch/ui/components/button";
import { Icon } from "@perch/ui/icons/icon";
import { type DragEvent, useRef, useState } from "react";
import { useSpringLoad } from "../../hooks/use-spring-load";
import { getDragId, isDragKind, setDragData } from "../../lib/dnd";
import type { Folder } from "../../types";

interface TopbarProps {
	/** Root folders only — subfolders are navigated inside the grid. */
	rootFolders: Folder[];
	/** The root ancestor of the currently active folder (drives tab highlight). */
	activeRootId: string;
	onSelectFolder: (id: string) => void;
	onAddFolder: () => void;
	onOpenSettings: () => void;
	onEditFolder?: (id: string) => void;
	onReorderFolders?: (draggedId: string, targetId: string) => void;
	/** Move a card (by id) into a root folder when dropped on its tab. */
	onDropCard?: (cardId: string, folderId: string) => void;
	/** Nest a folder (by id) under a root folder when dropped on its tab. */
	onMoveFolder?: (folderId: string, targetFolderId: string) => void;
	/** Cycle-safe check: may `folderId` be nested under `targetFolderId`. */
	canNestFolder?: (folderId: string, targetFolderId: string) => boolean;
}

export function Topbar({
	rootFolders,
	activeRootId,
	onSelectFolder,
	onAddFolder,
	onOpenSettings,
	onEditFolder,
	onReorderFolders,
	onDropCard,
	onMoveFolder,
	canNestFolder,
}: TopbarProps) {
	const sorted = [...rootFolders].sort((a, b) => a.order - b.order);
	// Which folder is currently being dragged from the tab bar (null for cards).
	const dragFolderId = useRef<string | null>(null);

	return (
		<header className="topbar grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-3">
			<div className="min-w-0" aria-hidden="true" />

			<div className="folder-tabs flex max-w-full items-center gap-1">
				<div
					role="tablist"
					aria-label="Folders"
					className="folder-tabs-scroll scrollbar-none flex items-center gap-0.5 overflow-x-auto"
				>
					{sorted.map((folder) => (
						<FolderTab
							key={folder.id}
							folder={folder}
							active={folder.id === activeRootId}
							dragFolderId={dragFolderId}
							onSelectFolder={onSelectFolder}
							onEditFolder={onEditFolder}
							onReorderFolders={onReorderFolders}
							onDropCard={onDropCard}
							onMoveFolder={onMoveFolder}
							canNestFolder={canNestFolder}
						/>
					))}
				</div>
				<Button
					variant="ghost"
					size="icon"
					className="ml-1 shrink-0"
					onClick={onAddFolder}
					aria-label="New folder"
				>
					<Icon name="plus" size={14} />
				</Button>
			</div>

			<div className="topbar-actions flex items-center gap-2 justify-self-end">
				<Button
					variant="ghost"
					size="icon"
					onClick={onOpenSettings}
					aria-label="Open settings"
				>
					<Icon name="settings" size={18} />
				</Button>
			</div>
		</header>
	);
}

interface FolderTabProps {
	folder: Folder;
	active: boolean;
	dragFolderId: React.RefObject<string | null>;
	onSelectFolder: (id: string) => void;
	onEditFolder?: (id: string) => void;
	onReorderFolders?: (draggedId: string, targetId: string) => void;
	onDropCard?: (cardId: string, folderId: string) => void;
	onMoveFolder?: (folderId: string, targetFolderId: string) => void;
	canNestFolder?: (folderId: string, targetFolderId: string) => boolean;
}

function FolderTab({
	folder,
	active,
	dragFolderId,
	onSelectFolder,
	onEditFolder,
	onReorderFolders,
	onDropCard,
	onMoveFolder,
	canNestFolder,
}: FolderTabProps) {
	const [dropActive, setDropActive] = useState(false);
	// Spring-load: hovering a tab during a drag opens it after a beat, so the
	// user can drop a card/folder into a nested destination without releasing.
	const spring = useSpringLoad(() => onSelectFolder(folder.id));

	function accepts(e: DragEvent): boolean {
		if (isDragKind(e, "card")) return true;
		if (isDragKind(e, "folder")) {
			const draggedId = getDragId(e);
			if (!draggedId) return true; // re-validated on drop
			if (draggedId === folder.id) return true; // reorder onto self is a no-op
			return canNestFolder ? canNestFolder(draggedId, folder.id) : true;
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

		const draggedFolder = dragFolderId.current;
		if (draggedFolder) {
			// A folder was dragged from the tab bar onto another tab: reorder siblings.
			if (draggedFolder !== folder.id) onReorderFolders?.(draggedFolder, folder.id);
			dragFolderId.current = null;
			return;
		}

		const draggedId = getDragId(e);
		if (!draggedId) return;
		if (isDragKind(e, "folder")) {
			// A subfolder dragged from the grid onto a root tab: nest it under the root.
			if (
				draggedId !== folder.id &&
				(canNestFolder ? canNestFolder(draggedId, folder.id) : true)
			) {
				onMoveFolder?.(draggedId, folder.id);
			}
		} else if (isDragKind(e, "card")) {
			onDropCard?.(draggedId, folder.id);
		}
	}

	return (
		<button
			type="button"
			role="tab"
			aria-selected={active}
			className={`folder-tab whitespace-nowrap rounded-lg px-3 py-1.5 font-medium text-[13px] transition-colors ${
				dropActive
					? "bg-white/20 text-white ring-1 ring-white/40"
					: active
						? "bg-white/10 text-white"
						: "text-white/50 hover:bg-white/5 hover:text-white"
			}`}
			draggable
			onClick={() => onSelectFolder(folder.id)}
			onDoubleClick={() => onEditFolder?.(folder.id)}
			onContextMenu={(e) => {
				e.preventDefault();
				onEditFolder?.(folder.id);
			}}
			onDragStart={(e) => {
				dragFolderId.current = folder.id;
				setDragData(e, "folder", folder.id);
			}}
			onDragEnd={() => {
				dragFolderId.current = null;
			}}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			{folder.name}
		</button>
	);
}
