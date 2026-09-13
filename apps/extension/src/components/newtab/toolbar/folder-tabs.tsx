import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@klice-start/ui/components/motion/context-menu";
import {
	Tabs,
	TabsList,
	TabsTrigger,
} from "@klice-start/ui/components/motion/tabs";
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
import type { NavigationDirection } from "../../../lib/navigation";
import { TOOLBAR } from "../../../lib/toolbar-tokens";
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
	navigationDirection: NavigationDirection;
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
	navigationDirection,
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
	const selectedIds = useSelectionStore((s) => s.selectedIds);
	// A modifier-click toggles selection without navigating. The Tabs
	// primitive still fires onValueChange for the same click, so the flag
	// below absorbs exactly one navigation right after a toggle.
	const suppressNav = useRef(false);

	function handleSelectFolder(id: string) {
		if (suppressNav.current) {
			suppressNav.current = false;
			return;
		}
		onSelectFolder(id);
	}

	function handleToggleSelect(id: string) {
		suppressNav.current = true;
		// Tabs are always roots: selecting one enters (or stays in) the
		// roots domain, intentionally replacing any content selection.
		useSelectionStore
			.getState()
			.toggle({ id, kind: "folder", sourceId: null });
	}

	return (
		<GlassSurface className={cn(TOOLBAR.groupPadding, "gap-0.5")}>
			<Tabs
				value={activeRootId}
				variant="pill"
				direction={navigationDirection}
				onValueChange={handleSelectFolder}
				className="flex items-center"
			>
				<TabsList
					ariaLabel="Folders"
					className="gap-0.5 rounded-full bg-transparent p-0"
				>
					{sorted.map((folder) => (
						<FolderTab
							key={folder.id}
							folder={folder}
							active={folder.id === activeRootId}
							isLiquid={isLiquid}
							isSelected={selectedIds.includes(folder.id)}
							onToggleSelect={handleToggleSelect}
							insertion={
								insertion?.key === folder.id ? insertion.position : null
							}
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
				</TabsList>
			</Tabs>
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
							: "text-flat-ink-muted hover:bg-flat-sunken-raised hover:text-flat-ink active:bg-flat-sunken",
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
	isSelected?: boolean;
	onToggleSelect?: (id: string) => void;
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
	isSelected = false,
	onToggleSelect,
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
		if (!dragged?.id || dragged.id === folder.id) return;
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
		if (!dragged?.id || dragged.id === folder.id) return;
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

	const baseClass = cn(
		TOOLBAR.controlHeight,
		TOOLBAR.radius,
		TOOLBAR.transition,
		"max-w-[160px] select-none truncate px-3 font-medium text-[13px] [-webkit-user-drag:element]",
		glassFocusRing(isLiquid),
		active
			? isLiquid
				? "text-white"
				: "text-flat-ink"
			: isLiquid
				? "text-white/70 hover:bg-white/[0.12] hover:text-white active:bg-white/20"
				: "text-flat-ink-muted hover:bg-flat-sunken-raised hover:text-flat-ink active:bg-flat-sunken",
		isSelected &&
			(isLiquid ? "ring-1 ring-inset ring-white/50" : "ring-1 ring-inset ring-flat-edge-strong"),
	);

	const dropClass = dropActive
		? isLiquid
			? "bg-white/25 text-white ring-1 ring-white/40 shadow-xs"
			: "bg-flat-sunken-raised text-flat-ink ring-1 ring-flat-edge-strong"
		: "";
	const indicatorClass = cn(
		"pointer-events-none",
		isLiquid ? "bg-white/25 shadow-sm" : "face-control shadow-control",
		dropActive &&
			(isLiquid ? "ring-1 ring-white/40" : "ring-1 ring-flat-edge-strong"),
	);

	if (editing) {
		return (
			<TabsTrigger
				value={folder.id}
				className={cn(baseClass, "flex items-center")}
				indicatorClassName={indicatorClass}
				render={
					<div className="flex max-w-[160px] items-center px-3">
						<InlineRenameInput
							value={folder.name}
							ariaLabel={`Rename folder ${folder.name}`}
							onCommit={handleCommitRename}
							onCancel={cancelRename}
							className="text-[13px]"
						/>
					</div>
				}
			/>
		);
	}

	return (
		<ContextMenu>
			<TabsTrigger
				value={folder.id}
				className={cn(
					baseClass,
					dropClass,
					insertion === "before" && "drop-insert-before",
					insertion === "after" && "drop-insert-after",
				)}
				indicatorClassName={indicatorClass}
				render={
					<ContextMenuTrigger title={folder.name}>
						<button
							data-local-context-menu
							type="button"
							title={folder.name}
							draggable
							onClick={(e) => {
								if (e.metaKey || e.ctrlKey) {
									e.preventDefault();
									onToggleSelect?.(folder.id);
								}
							}}
							onDragStart={(e) => {
								lastApplied.current = null;
								if (
									!useSelectionStore.getState().selectedIds.includes(folder.id)
								) {
									useSelectionStore.getState().clear();
								}
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
						>
							{folder.name}
						</button>
					</ContextMenuTrigger>
				}
			/>

			<ContextMenuContent className={glassMenu(isLiquid)}>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onSelect={() => onSelectFolder(folder.id)}
				>
					<Icon name="folder" size={14} />
					Open
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onSelect={onNewRootFolder}
				>
					<Icon name="folder-plus" size={14} />
					New Folder
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onSelect={() => onNewSubfolder?.(folder.id)}
				>
					<Icon name="folder-plus" size={14} />
					New subfolder
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onSelect={() => beginRename({ kind: "folder", id: folder.id })}
				>
					<Icon name="pencil" size={14} />
					Rename
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onSelect={() =>
						useSelectionStore
							.getState()
							.toggle({ id: folder.id, kind: "folder", sourceId: null })
					}
				>
					<Icon name="check-square" size={14} />
					Select
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onSelect={() => {
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
					tone="destructive"
					onSelect={() => onDeleteFolder?.(folder.id)}
				>
					<Icon name="trash" size={14} />
					Delete
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
