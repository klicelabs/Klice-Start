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
import {
	dropZoneFor,
	resolveDragRef,
	setActiveDrag,
	setDragData,
} from "../../../lib/dnd";
import {
	glassDropdownItem,
	glassFocusRing,
	glassMenu,
} from "../../../lib/glass";
import {
	TOOLBAR,
	toolbarControlClassic,
	toolbarControlLiquid,
} from "../../../lib/toolbar-tokens";
import { cn } from "../../../lib/utils";
import { useMoveDialogStore } from "../../../stores/move-dialog-store";
import { useRenameStore } from "../../../stores/rename-store";
import { useSelectionStore } from "../../../stores/selection-store";
import {
	type InsertPosition,
	useSetupStore,
} from "../../../stores/setup-store";
import type { Folder } from "../../../types";
import { InlineRenameInput } from "../../shared/inline-rename-input";
import { useAppearance } from "../appearance-provider";
import { GlassSurface } from "./glass-surface";

interface FolderTabsProps {
	folders: Folder[];
	activeRootId: string;
	/** Inline "+" affordance. Only true while the lane has room (no overflow). */
	showAddButton?: boolean;
	onAddRoot?: () => void;
	onSelectFolder: (id: string) => void;
	onNewRootFolder?: () => void;
	onNewSubfolder?: (parentId: string) => void;
	onDeleteFolder?: (id: string) => void;
	onReorderFolders?: (
		draggedId: string,
		targetId: string,
		position?: InsertPosition,
	) => void;
	onDropCards?: (cardId: string, folderId: string) => void;
	onMoveFolders?: (folderId: string, targetFolderId: string) => void;
	/** Drop a non-root folder on a tab edge: hoist to root at that position. */
	onMoveFolderToRoot?: (
		folderId: string,
		targetId: string,
		position: InsertPosition,
	) => void;
	isRootFolder?: (id: string) => boolean;
	canNestFolder?: (folderId: string, targetFolderId: string) => boolean;
}

/**
 * Floating tab bar with spring-load dwell navigation and tab context menu.
 *
 * Drop intent is zonal, identical to the grid: the center nests/moves the
 * dragged item into the tab (persisted first, navigation second), while the
 * edges live-reorder root tabs. Spring-load only arms on center hover.
 */
export function FolderTabs({
	folders,
	activeRootId,
	showAddButton = false,
	onAddRoot,
	onSelectFolder,
	onNewRootFolder,
	onNewSubfolder,
	onDeleteFolder,
	onReorderFolders,
	onDropCards,
	onMoveFolders,
	onMoveFolderToRoot,
	isRootFolder,
	canNestFolder,
}: FolderTabsProps) {
	const { isLiquid } = useAppearance();
	const sorted = [...folders].sort((a, b) => a.order - b.order);
	const [insertion, setInsertion] = useState<{
		key: string;
		position: InsertPosition;
	} | null>(null);

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
					insertion={insertion?.key === folder.id ? insertion.position : null}
					onInsertionChange={setInsertion}
					onSelectFolder={onSelectFolder}
					onNewRootFolder={onNewRootFolder}
					onNewSubfolder={onNewSubfolder}
					onDeleteFolder={onDeleteFolder}
					onReorderFolders={onReorderFolders}
					onDropCards={onDropCards}
					onMoveFolders={onMoveFolders}
					onMoveFolderToRoot={onMoveFolderToRoot}
					isRootFolder={isRootFolder}
					canNestFolder={canNestFolder}
				/>
			))}
			{showAddButton && (
				<button
					type="button"
					onClick={onAddRoot}
					aria-label="New folder"
					title="New folder"
					className={cn(
						TOOLBAR.controlHeight,
						"flex w-[34px] shrink-0 items-center justify-center rounded-full transition-colors duration-150",
						glassFocusRing(isLiquid),
						isLiquid
							? "text-white/70 hover:bg-white/[0.12] hover:text-white active:bg-white/20"
							: "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-accent",
					)}
				>
					<Icon name="plus" size={15} />
				</button>
			)}
		</GlassSurface>
	);
}

interface FolderTabProps {
	folder: Folder;
	active: boolean;
	isLiquid: boolean;
	insertion: InsertPosition | null;
	onInsertionChange: (
		value: { key: string; position: InsertPosition } | null,
	) => void;
	onSelectFolder: (id: string) => void;
	onNewRootFolder?: () => void;
	onNewSubfolder?: (parentId: string) => void;
	onDeleteFolder?: (id: string) => void;
	onReorderFolders?: (
		draggedId: string,
		targetId: string,
		position?: InsertPosition,
	) => void;
	onDropCards?: (cardId: string, folderId: string) => void;
	onMoveFolders?: (folderId: string, targetFolderId: string) => void;
	onMoveFolderToRoot?: (
		folderId: string,
		targetId: string,
		position: InsertPosition,
	) => void;
	isRootFolder?: (id: string) => boolean;
	canNestFolder?: (folderId: string, targetFolderId: string) => boolean;
}

function FolderTab({
	folder,
	active,
	isLiquid,
	insertion,
	onInsertionChange,
	onSelectFolder,
	onNewRootFolder,
	onNewSubfolder,
	onDeleteFolder,
	onReorderFolders,
	onDropCards,
	onMoveFolders,
	onMoveFolderToRoot,
	isRootFolder,
	canNestFolder,
}: FolderTabProps) {
	const [dropActive, setDropActive] = useState(false);
	const spring = useSpringLoad(() => onSelectFolder(folder.id));
	const lastApplied = useRef<string | null>(null);

	const editing = useRenameStore((s) => s.isEditing("folder", folder.id));
	const beginRename = useRenameStore((s) => s.begin);
	const cancelRename = useRenameStore((s) => s.cancel);
	const openMoveDialog = useMoveDialogStore((s) => s.open);

	function handleCommitRename(name: string) {
		useSetupStore.getState().updateFolder(folder.id, name);
		cancelRename();
	}

	function liveReorder(draggedId: string, position: InsertPosition) {
		const stamp = `${draggedId}|${folder.id}|${position}`;
		if (lastApplied.current === stamp) return;
		lastApplied.current = stamp;
		onReorderFolders?.(draggedId, folder.id, position);
	}

	function handleDragOver(e: DragEvent) {
		const dragged = resolveDragRef(e);
		if (!dragged || !dragged.id || dragged.id === folder.id) return;
		const el = e.currentTarget;
		if (!(el instanceof HTMLElement)) return;
		const zone = dropZoneFor(e, el);

		if (dragged.kind === "card") {
			// Cards always move into the tab, edge or center alike.
			e.preventDefault();
			e.dataTransfer.dropEffect = "move";
			onInsertionChange(null);
			if (!dropActive) setDropActive(true);
			spring.start();
			return;
		}

		// Folder drag.
		if (zone === "center") {
			if (canNestFolder && !canNestFolder(dragged.id, folder.id)) return;
			e.preventDefault();
			e.dataTransfer.dropEffect = "move";
			onInsertionChange(null);
			if (!dropActive) setDropActive(true);
			spring.start();
			return;
		}

		// Edge: live root reorder for roots; hoist-to-root for subfolders.
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		spring.cancel();
		setDropActive(false);
		if (isRootFolder?.(dragged.id) ?? true) {
			onInsertionChange({ key: folder.id, position: zone });
			liveReorder(dragged.id, zone);
		} else {
			onInsertionChange({ key: folder.id, position: zone });
		}
	}

	function handleDragLeave(e: DragEvent) {
		const related = e.relatedTarget as Node | null;
		if (
			related &&
			e.currentTarget instanceof Node &&
			e.currentTarget.contains(related)
		) {
			return;
		}
		setDropActive(false);
		spring.cancel();
		onInsertionChange(null);
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		setDropActive(false);
		spring.cancel();
		onInsertionChange(null);
		setActiveDrag(null);
		const dragged = resolveDragRef(e);
		if (!dragged || !dragged.id || dragged.id === folder.id) return;
		const el = e.currentTarget;
		const zone = el instanceof HTMLElement ? dropZoneFor(e, el) : "center";

		if (dragged.kind === "card") {
			onDropCards?.(dragged.id, folder.id);
			return;
		}
		if (zone === "center") {
			if (canNestFolder && !canNestFolder(dragged.id, folder.id)) return;
			// Persist the move first; spring-load navigation (if armed) is
			// only ever a view change on top of it.
			onMoveFolders?.(dragged.id, folder.id);
			return;
		}
		if (isRootFolder?.(dragged.id) ?? true) {
			const stamp = `${dragged.id}|${folder.id}|${zone}`;
			if (lastApplied.current !== stamp) {
				onReorderFolders?.(dragged.id, folder.id, zone);
			}
		} else {
			onMoveFolderToRoot?.(dragged.id, folder.id, zone);
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

	if (editing) {
		return (
			<div
				className={cn(
					TOOLBAR.controlHeight,
					TOOLBAR.radius,
					"flex max-w-[160px] items-center px-3",
					baseClass,
				)}
			>
				<InlineRenameInput
					value={folder.name}
					ariaLabel={`Rename folder ${folder.name}`}
					onCommit={handleCommitRename}
					onCancel={cancelRename}
					className="text-[13px]"
				/>
			</div>
		);
	}

	return (
		<ContextMenu>
			<ContextMenuTrigger
				data-local-context-menu
				className={cn(
					TOOLBAR.controlHeight,
					TOOLBAR.radius,
					"max-w-[160px] truncate px-3 font-medium text-[13px] transition-[background-color,color,transform,box-shadow,opacity] duration-150 ease-out active:scale-[0.97] select-none [-webkit-user-drag:element]",
					glassFocusRing(isLiquid),
					baseClass,
					dropClass,
					insertion === "before" && "drop-insert-before",
					insertion === "after" && "drop-insert-after",
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
							lastApplied.current = null;
							setDragData(e, "folder", folder.id);
						}}
						onDragEnd={() => {
							lastApplied.current = null;
							setActiveDrag(null);
							setDropActive(false);
							spring.cancel();
							onInsertionChange(null);
						}}
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
					/>
				}
			>
				{folder.name}
			</ContextMenuTrigger>

			<ContextMenuContent className={glassMenu(isLiquid)}>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onClick={() => onSelectFolder(folder.id)}
				>
					<Icon name="folder" size={14} />
					Open
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onClick={onNewRootFolder}
				>
					<Icon name="folder-plus" size={14} />
					New Folder
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onClick={() => onNewSubfolder?.(folder.id)}
				>
					<Icon name="folder-plus" size={14} />
					New subfolder
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onClick={() => beginRename({ kind: "folder", id: folder.id })}
				>
					<Icon name="pencil" size={14} />
					Rename
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onClick={() => {
						const selected = useSelectionStore.getState().selectedIds;
						openMoveDialog(
							selected.includes(folder.id) ? selected : [folder.id],
						);
					}}
				>
					<Icon name="folder" size={14} />
					Move to…
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
