import { EASE_OUT, SPRING_SEGMENT } from "@klice-start/ui/lib/ease";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useCallback, useEffect, useMemo } from "react";
import { useGridDnd } from "../../hooks/use-grid-dnd";
import { CARD_ASPECT_RATIO } from "../../lib/constants";
import {
	getOrderedRefs,
	type ItemOrder,
	type ItemRef,
} from "../../lib/item-order";
import type { NavigationState } from "../../lib/navigation";
import { useSelectionStore } from "../../stores/selection-store";
import { computeGridMaxWidth, useSetupStore } from "../../stores/setup-store";
import type { Card, Folder } from "../../types";
import { DialCard } from "./dial-card";
import {
	FolderPreviewCard,
	type FolderPreviewItem,
} from "./folders/folder-preview-card";

interface DialGridProps {
	/** Item-order container being rendered (the active folder id). */
	folderId: string;
	cards: Card[];
	subfolders: Folder[];
	allCards: Card[];
	allFolders: Folder[];
	itemOrder: ItemOrder;
	cardCounts: Record<string, number>;
	previewCards: Record<string, FolderPreviewItem[]>;
	onDelete: (id: string) => void;
	onDeleteFolder: (id: string) => void;
	onOpenFolder: (id: string) => void;
	onNewSubfolder: (parentId: string) => void;
	/** Single-set mixed move (one coalesced write, no half-moved window). */
	onMoveItems: (
		cardIds: string[],
		folderIds: string[],
		targetFolderId: string,
	) => void;
	onLiveReorder: (
		container: string,
		dragged: ItemRef,
		target: ItemRef,
		position: "before" | "after",
	) => void;
	onCombineCards: (draggedCardId: string, targetCardId: string) => void;
	canNestFolder: (folderId: string, targetFolderId: string) => boolean;
	navigation: NavigationState;
	emptyState?: ReactNode;
}

const GRID_TRANSITIONS = {
	"root-forward": {
		initial: { opacity: 0, transform: "translate3d(104px, 0, 0)" },
		exit: { opacity: 0, transform: "translate3d(-104px, 0, 0)" },
	},
	"root-back": {
		initial: { opacity: 0, transform: "translate3d(-104px, 0, 0)" },
		exit: { opacity: 0, transform: "translate3d(104px, 0, 0)" },
	},
	"depth-forward": {
		initial: { opacity: 0, transform: "translate3d(0, 48px, 0)" },
		exit: { opacity: 0, transform: "translate3d(0, -34px, 0)" },
	},
	"depth-back": {
		initial: { opacity: 0, transform: "translate3d(0, -42px, 0)" },
		exit: { opacity: 0, transform: "translate3d(0, 50px, 0)" },
	},
} as const;

export function DialGrid({
	folderId,
	cards,
	subfolders,
	allCards,
	allFolders,
	itemOrder,
	cardCounts,
	previewCards,
	onDelete,
	onDeleteFolder,
	onOpenFolder,
	onNewSubfolder,
	onMoveItems,
	onLiveReorder,
	onCombineCards,
	canNestFolder,
	navigation,
	emptyState,
}: DialGridProps) {
	const tileSize = useSetupStore((s) => s.settings.tileSize);
	const maxColumns = useSetupStore((s) => s.settings.maxColumns);
	const dialLayout = useSetupStore((s) => s.settings.dialLayout);
	const cardAspect = useSetupStore((s) => s.settings.cardAspect);
	const gridMaxWidth = computeGridMaxWidth(tileSize, maxColumns);
	const reduceMotion = useReducedMotion() ?? false;

	const selectedIds = useSelectionStore((s) => s.selectedIds);
	const select = useSelectionStore((s) => s.select);
	const toggle = useSelectionStore((s) => s.toggle);
	const selectRange = useSelectionStore((s) => s.selectRange);
	const clearSelection = useSelectionStore((s) => s.clear);

	// Single interleaved order: folders and cards share one sequence, so
	// folders participate in ordering instead of being pinned first.
	const orderedRefs = useMemo(
		() => getOrderedRefs(folderId, subfolders, cards, itemOrder),
		[folderId, subfolders, cards, itemOrder],
	);
	const folderById = useMemo(
		() => new Map(subfolders.map((f) => [f.id, f])),
		[subfolders],
	);
	const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
	const allItemIds = useMemo(() => orderedRefs.map((r) => r.id), [orderedRefs]);

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

	const cardHeightRatio =
		CARD_ASPECT_RATIO[cardAspect] ?? CARD_ASPECT_RATIO.vertical;
	const cellAspectStyle =
		dialLayout === "card"
			? { ["--card-height-ratio" as string]: String(cardHeightRatio) }
			: {};

	const isInContainer = useCallback(
		(ref: ItemRef) =>
			ref.kind === "card" ? cardById.has(ref.id) : folderById.has(ref.id),
		[cardById, folderById],
	);

	// Multi-item drop on folder: cards move in; folders nest when valid.
	// Cards already inside the target stay put (explicit drop ≠ reorder).
	// One store call — a mixed group can never be half-moved.
	const handleDropOnFolder = useCallback(
		(draggedId: string, targetFolderId: string) => {
			const group = selectedIds.includes(draggedId) ? selectedIds : [draggedId];
			const cardIds = group.filter((id) => {
				const card = allCards.find((c) => c.id === id);
				return card !== undefined && card.folderId !== targetFolderId;
			});
			const folderIds = group.filter(
				(id) =>
					allFolders.some((f) => f.id === id) &&
					canNestFolder(id, targetFolderId),
			);
			if (cardIds.length > 0 || folderIds.length > 0) {
				onMoveItems(cardIds, folderIds, targetFolderId);
			}
			clearSelection();
		},
		[
			selectedIds,
			allCards,
			allFolders,
			onMoveItems,
			canNestFolder,
			clearSelection,
		],
	);

	// Drop on empty grid background. A selected group can contain cards and
	// folders; keep both kinds in one store call so a spring-loaded container
	// swap cannot split the move or leave half of the selection behind.
	const handleBackgroundDrop = useCallback(
		(dragged: ItemRef) => {
			const group = selectedIds.includes(dragged.id)
				? selectedIds
				: [dragged.id];
			const cardIds = group.filter((id) =>
				allCards.some((card) => card.id === id),
			);
			const folderIds = group.filter(
				(id) =>
					allFolders.some((folder) => folder.id === id) &&
					canNestFolder(id, folderId),
			);
			if (cardIds.length > 0 || folderIds.length > 0) {
				onMoveItems(cardIds, folderIds, folderId);
			}
			clearSelection();
		},
		[
			selectedIds,
			allCards,
			allFolders,
			folderId,
			onMoveItems,
			canNestFolder,
			clearSelection,
		],
	);

	const dnd = useGridDnd({
		onLiveReorder: useCallback(
			(dragged: ItemRef, target: ItemRef, position: "before" | "after") =>
				onLiveReorder(folderId, dragged, target, position),
			[onLiveReorder, folderId],
		),
		onCombineCards,
		onDropOnFolder: handleDropOnFolder,
		onBackgroundDrop: handleBackgroundDrop,
		onOpenFolder,
		canNest: canNestFolder,
		isInContainer,
	} as Parameters<typeof useGridDnd>[0]);

	// The coordinator outlives container swaps (same hook instance): when the
	// folder changes mid-gesture (spring-load navigation), clear only visuals
	// tied to the previous container. The native payload must remain available
	// to the newly rendered grid until the browser emits drop/dragend/Escape.
	const dndResetVisuals = dnd.resetVisuals;
	useEffect(() => {
		if (folderId) dndResetVisuals();
	}, [folderId, dndResetVisuals]);

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

	function handleFolderClick(
		e: React.MouseEvent,
		id: string,
		onOpen: () => void,
	) {
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
			{...dnd.backgroundProps}
		>
			{orderedRefs.length === 0 ? (
				emptyState
			) : (
				<div className="dial-grid-stage">
					<AnimatePresence initial={false} mode="sync">
						<motion.div
							key={folderId}
							initial={reduceMotion ? false : "initial"}
							animate={{
								opacity: 1,
								transform: "translate3d(0, 0, 0)",
							}}
							exit={
								reduceMotion
									? { opacity: 0, transform: "translate3d(0, 0, 0)" }
									: "exit"
							}
							variants={
								GRID_TRANSITIONS[
									`${navigation.kind}-${navigation.direction}` as keyof typeof GRID_TRANSITIONS
								]
							}
							transition={
								reduceMotion
									? { duration: 0.08, ease: EASE_OUT }
									: SPRING_SEGMENT
							}
							className="dial-grid will-change-[transform,opacity]"
							data-tile={tileSize}
							data-layout={dialLayout}
							data-nav-direction={navigation.direction}
							data-nav-kind={navigation.kind}
							style={{
								display: "grid",
								gridTemplateColumns: "repeat(auto-fill, var(--tile-w, 148px))",
								gap: "var(--grid-gap, 22px)",
								justifyContent: "center",
								gridArea: "1 / 1",
								...cellAspectStyle,
							}}
						>
							{orderedRefs.map((ref) => {
								if (ref.kind === "folder") {
									const folder = folderById.get(ref.id);
									if (!folder) return null;
									const isSelected = selectedIds.includes(folder.id);
									return (
										<FolderPreviewCard
											key={folder.id}
											id={folder.id}
											name={folder.name}
											itemCount={cardCounts[folder.id] ?? 0}
											previewCards={previewCards[folder.id] ?? []}
											dragging={dnd.drag?.id === folder.id}
											isSelected={isSelected}
											showMultiBadge={selectedIds.length > 1}
											insertion={
												dnd.insertion?.key === folder.id
													? dnd.insertion.position
													: null
											}
											dropActive={dnd.nestId === folder.id}
											onClick={(e) =>
												handleFolderClick(e, folder.id, () =>
													onOpenFolder(folder.id),
												)
											}
											onOpen={onOpenFolder}
											onNewSubfolder={onNewSubfolder}
											onDelete={onDeleteFolder}
											dragProps={dnd.getItemDragProps({
												kind: "folder",
												id: folder.id,
											})}
											className="dial-cell"
										/>
									);
								}
								const card = cardById.get(ref.id);
								if (!card) return null;
								const isSelected = selectedIds.includes(card.id);
								return (
									<DialCard
										key={card.id}
										card={card}
										onDelete={onDelete}
										isSelected={isSelected}
										showMultiBadge={selectedIds.length > 1}
										onClick={(e) => handleCardClick(e, card.id)}
										dragProps={dnd.getItemDragProps({
											kind: "card",
											id: card.id,
										})}
										insertion={
											dnd.insertion?.key === card.id
												? dnd.insertion.position
												: null
										}
										combineActive={dnd.combineKey === card.id}
										dragging={dnd.drag?.id === card.id}
										className="dial-cell"
									/>
								);
							})}
						</motion.div>
					</AnimatePresence>
				</div>
			)}
		</section>
	);
}
