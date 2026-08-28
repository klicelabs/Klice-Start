import { useCallback, useEffect, useMemo } from "react";
import { useDragAndDrop } from "../../hooks/use-drag-and-drop";
import { CARD_ASPECT_RATIO } from "../../lib/constants";
import { useSelectionStore } from "../../stores/selection-store";
import { computeGridMaxWidth, useSetupStore } from "../../stores/setup-store";
import type { Card, Folder } from "../../types";
import { DialCard } from "./dial-card";
import {
	FolderPreviewCard,
	type FolderPreviewItem,
} from "./folders/folder-preview-card";

interface DialGridProps {
	cards: Card[];
	subfolders: Folder[];
	cardCounts: Record<string, number>;
	previewCards: Record<string, FolderPreviewItem[]>;
	onEdit: (id: string) => void;
	onDelete: (id: string) => void;
	onDeleteFolder: (id: string) => void;
	onReorder: (fromId: string, toId: string) => void;
	onReorderFolders: (fromId: string, targetId: string) => void;
	onAdd?: () => void;
	onAddFolder?: () => void;
	onOpenFolder: (id: string) => void;
	onEditFolder: (id: string) => void;
	onMoveCard: (cardId: string, folderId: string) => void;
	onMoveFolder: (folderId: string, targetFolderId: string) => void;
	canNestFolder: (folderId: string, targetFolderId: string) => boolean;
}

export function DialGrid({
	cards,
	subfolders,
	cardCounts,
	previewCards,
	onEdit,
	onDelete,
	onDeleteFolder,
	onReorder,
	onReorderFolders,
	onOpenFolder,
	onEditFolder,
	onMoveCard,
	onMoveFolder,
	canNestFolder,
}: DialGridProps) {
	const tileSize = useSetupStore((s) => s.settings.tileSize);
	const maxColumns = useSetupStore((s) => s.settings.maxColumns);
	const dialLayout = useSetupStore((s) => s.settings.dialLayout);
	const cardAspect = useSetupStore((s) => s.settings.cardAspect);
	const gridMaxWidth = computeGridMaxWidth(tileSize, maxColumns);

	const selectedIds = useSelectionStore((s) => s.selectedIds);
	const select = useSelectionStore((s) => s.select);
	const toggle = useSelectionStore((s) => s.toggle);
	const selectRange = useSelectionStore((s) => s.selectRange);
	const clearSelection = useSelectionStore((s) => s.clear);

	const allItemIds = useMemo(
		() => [...subfolders.map((f) => f.id), ...cards.map((c) => c.id)],
		[subfolders, cards],
	);

	// Clear selection on Escape
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") {
				clearSelection();
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [clearSelection]);

	const heightMultiple =
		CARD_ASPECT_RATIO[cardAspect] ?? CARD_ASPECT_RATIO.vertical;
	const cellAspectStyle =
		dialLayout === "card"
			? { ["--cell-aspect" as string]: String(1 / heightMultiple) }
			: {};

	// Multi-item drop on folder handler
	const handleDropCardOnFolder = useCallback(
		(draggedId: string, folderId: string) => {
			const idsToMove = selectedIds.includes(draggedId)
				? selectedIds
				: [draggedId];

			for (const id of idsToMove) {
				if (cards.some((c) => c.id === id)) {
					onMoveCard(id, folderId);
				} else if (subfolders.some((f) => f.id === id)) {
					if (canNestFolder(id, folderId)) {
						onMoveFolder(id, folderId);
					}
				}
			}
			clearSelection();
		},
		[selectedIds, cards, subfolders, onMoveCard, onMoveFolder, canNestFolder, clearSelection],
	);

	const dnd = useDragAndDrop({ onDrop: onReorder, kind: "card" });
	const folderDnd = useDragAndDrop({
		onDrop: onReorderFolders,
		kind: "folder",
	});

	function handleCardClick(e: React.MouseEvent, id: string) {
		if (e.metaKey || e.ctrlKey) {
			e.preventDefault();
			e.stopPropagation();
			toggle(id);
		} else if (e.shiftKey) {
			e.preventDefault();
			e.stopPropagation();
			selectRange(id, allItemIds);
		} else if (selectedIds.length > 0 && !selectedIds.includes(id)) {
			select(id);
		}
	}

	function handleFolderClick(e: React.MouseEvent, id: string, onOpen: () => void) {
		if (e.metaKey || e.ctrlKey) {
			e.preventDefault();
			e.stopPropagation();
			toggle(id);
		} else if (e.shiftKey) {
			e.preventDefault();
			e.stopPropagation();
			selectRange(id, allItemIds);
		} else if (selectedIds.length > 0 && !selectedIds.includes(id)) {
			e.preventDefault();
			e.stopPropagation();
			select(id);
		} else {
			onOpen();
		}
	}

	return (
		<section
			className="dial-grid-wrap mx-auto w-full px-6"
			style={{ maxWidth: gridMaxWidth }}
		>
			<div
				className="dial-grid"
				data-tile={tileSize}
				data-layout={dialLayout}
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fill, var(--tile-w, 148px))",
					gap: "var(--grid-gap, 22px)",
					justifyContent: "center",
					...cellAspectStyle,
				}}
			>
				{subfolders.map((folder) => {
					const isSelected = selectedIds.includes(folder.id);
					return (
						<FolderPreviewCard
							key={folder.id}
							id={folder.id}
							name={folder.name}
							itemCount={cardCounts[folder.id] ?? 0}
							previewCards={previewCards[folder.id] ?? []}
							dragging={folderDnd.draggingId === folder.id}
							isSelected={isSelected}
							showMultiBadge={selectedIds.length > 1}
							onClick={(e) => handleFolderClick(e, folder.id, () => onOpenFolder(folder.id))}
							onOpen={onOpenFolder}
							onEdit={onEditFolder}
							onDelete={onDeleteFolder}
							onDropCard={handleDropCardOnFolder}
							onDropFolder={onMoveFolder}
							canAcceptFolder={(draggedId) =>
								canNestFolder(draggedId, folder.id)
							}
							dragProps={folderDnd.getItemProps(folder.id)}
							className="dial-cell"
						/>
					);
				})}

				{cards.map((card) => {
					const itemProps = dnd.getItemProps(card.id);
					const isOver = dnd.overId === card.id;
					const isDragging = dnd.draggingId === card.id;
					const isSelected = selectedIds.includes(card.id);

					return (
						<DialCard
							key={card.id}
							card={card}
							onEdit={onEdit}
							onDelete={onDelete}
							isSelected={isSelected}
							showMultiBadge={selectedIds.length > 1}
							onClick={(e) => handleCardClick(e, card.id)}
							dragProps={itemProps}
							className="dial-cell"
							style={{
								opacity: isDragging ? 0.4 : 1,
								transform: isOver ? "scale(1.04)" : undefined,
							}}
						/>
					);
				})}
			</div>
		</section>
	);
}
