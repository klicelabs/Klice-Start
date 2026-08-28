import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@klice-start/ui/components/context-menu";
import { Icon } from "@klice-start/ui/icons/icon";
import { type DragEvent, useRef, useState } from "react";
import { useSpringLoad } from "../../../hooks/use-spring-load";
import { getDragId, isDragKind, setDragData } from "../../../lib/dnd";
import { glassDropdownItem } from "../../../lib/glass";
import {
	TOOLBAR,
	toolbarControlClassic,
	toolbarControlLiquid,
} from "../../../lib/toolbar-tokens";
import { cn } from "../../../lib/utils";
import type { Folder } from "../../../types";
import { useAppearance } from "../appearance-provider";
import { GlassSurface } from "./glass-surface";

interface FolderTabsProps {
	folders: Folder[];
	activeRootId: string;
	onSelectFolder: (id: string) => void;
	onEditFolder?: (id: string) => void;
	onDeleteFolder?: (id: string) => void;
	onReorderFolders?: (draggedId: string, targetId: string) => void;
	onDropCard?: (cardId: string, folderId: string) => void;
	onMoveFolder?: (folderId: string, targetFolderId: string) => void;
	canNestFolder?: (folderId: string, targetFolderId: string) => boolean;
}

/**
 * Floating tab bar. Every tab shares the same height and radius as all
 * other toolbar controls (h-[34px], rounded-full).
 */
export function FolderTabs({
	folders,
	activeRootId,
	onSelectFolder,
	onEditFolder,
	onDeleteFolder,
	onReorderFolders,
	onDropCard,
	onMoveFolder,
	canNestFolder,
}: FolderTabsProps) {
	const { isLiquid } = useAppearance();
	const sorted = [...folders].sort((a, b) => a.order - b.order);
	const dragFolderId = useRef<string | null>(null);

	return (
		<GlassSurface
			role="tablist"
			aria-label="Folders"
			className={cn(TOOLBAR.groupPadding, "gap-0.5")}
		>
			{sorted.map((folder) => (
				<FolderTab
					key={folder.id}
					folder={folder}
					active={folder.id === activeRootId}
					isLiquid={isLiquid}
					dragFolderId={dragFolderId}
					onSelectFolder={onSelectFolder}
					onEditFolder={onEditFolder}
					onDeleteFolder={onDeleteFolder}
					onReorderFolders={onReorderFolders}
					onDropCard={onDropCard}
					onMoveFolder={onMoveFolder}
					canNestFolder={canNestFolder}
				/>
			))}
		</GlassSurface>
	);
}

interface FolderTabProps {
	folder: Folder;
	active: boolean;
	isLiquid: boolean;
	dragFolderId: React.RefObject<string | null>;
	onSelectFolder: (id: string) => void;
	onEditFolder?: (id: string) => void;
	onDeleteFolder?: (id: string) => void;
	onReorderFolders?: (draggedId: string, targetId: string) => void;
	onDropCard?: (cardId: string, folderId: string) => void;
	onMoveFolder?: (folderId: string, targetFolderId: string) => void;
	canNestFolder?: (folderId: string, targetFolderId: string) => boolean;
}

function FolderTab({
	folder,
	active,
	isLiquid,
	dragFolderId,
	onSelectFolder,
	onEditFolder,
	onDeleteFolder,
	onReorderFolders,
	onDropCard,
	onMoveFolder,
	canNestFolder,
}: FolderTabProps) {
	const [dropActive, setDropActive] = useState(false);
	const spring = useSpringLoad(() => onSelectFolder(folder.id));

	function accepts(e: DragEvent): boolean {
		if (isDragKind(e, "card")) return true;
		if (isDragKind(e, "folder")) {
			const draggedId = getDragId(e);
			if (!draggedId) return true;
			if (draggedId === folder.id) return false;
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
			if (draggedFolder !== folder.id)
				onReorderFolders?.(draggedFolder, folder.id);
			dragFolderId.current = null;
			return;
		}

		const draggedId = getDragId(e);
		if (!draggedId) return;
		if (isDragKind(e, "folder")) {
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

	const baseClass = isLiquid
		? toolbarControlLiquid(active)
		: toolbarControlClassic(active);

	const dropClass = dropActive
		? isLiquid
			? "bg-white/25 text-white ring-1 ring-white/40 shadow-xs"
			: "bg-accent text-accent-foreground ring-1 ring-ring"
		: "";

	return (
		<ContextMenu>
			<ContextMenuTrigger
				data-local-context-menu
				className={cn(
					TOOLBAR.controlHeight,
					TOOLBAR.radius,
					"max-w-[160px] truncate px-3 font-medium text-[13px] transition-[background-color,color,transform,box-shadow,opacity] duration-150 ease-out active:scale-[0.97]",
					baseClass,
					dropClass,
				)}
				title={folder.name}
				render={
					<button
						type="button"
						role="tab"
						aria-selected={active}
						draggable
						onClick={() => onSelectFolder(folder.id)}
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
					/>
				}
			>
				{folder.name}
			</ContextMenuTrigger>

			<ContextMenuContent
				className={cn(
					"min-w-44 rounded-xl border border-border/60 bg-popover p-1 text-popover-foreground shadow-xl",
					isLiquid && "bg-popover/90 backdrop-blur-xl",
				)}
			>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onClick={() => onSelectFolder(folder.id)}
				>
					<Icon name="folder" size={14} />
					Open
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onClick={() => onEditFolder?.(folder.id)}
				>
					<Icon name="pencil" size={14} />
					Rename
				</ContextMenuItem>
				<ContextMenuSeparator
					className={isLiquid ? "bg-white/10" : undefined}
				/>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					variant="destructive"
					onClick={() => onDeleteFolder?.(folder.id)}
				>
					<Icon name="trash" size={14} />
					Delete
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
