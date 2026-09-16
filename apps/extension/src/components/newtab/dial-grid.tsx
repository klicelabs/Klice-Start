import {
	EASE_OUT,
	SPRING_DEPTH,
	SPRING_SEGMENT,
} from "@klice-start/ui/lib/ease";
import type { Variants } from "motion/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { useGridDnd } from "../../hooks/use-grid-dnd";
import { CARD_ASPECT_RATIO } from "../../lib/constants";
import { showGroupDragGhost } from "../../lib/drag-ghost";
import { computeIconGridMaxWidth, iconGridConfig } from "../../lib/icon-layout";
import {
	getOrderedRefs,
	type ItemOrder,
	type ItemRef,
} from "../../lib/item-order";
import { describeMoveGroup } from "../../lib/move-selection";
import type { NavigationState } from "../../lib/navigation";
import { useSelectionStore } from "../../stores/selection-store";
import { computeGridMaxWidth, useSetupStore } from "../../stores/setup-store";
import type { Card, Folder } from "../../types";
import { DialCard } from "./dial-card";
import {
	FolderPreviewCard,
	type FolderPreviewItem,
} from "./folders/folder-preview-card";

type GridMotionContext = NavigationState & {
	stageWidth: number;
	depthTravel: number;
	reduceMotion: boolean;
};

const REDUCED_GRID_TRANSITION = { duration: 0.08, ease: EASE_OUT } as const;

function gridTransition(context: GridMotionContext) {
	if (context.reduceMotion) return REDUCED_GRID_TRANSITION;
	return context.kind === "depth" ? SPRING_DEPTH : SPRING_SEGMENT;
}

const GRID_VARIANTS: Variants = {
	initial: (context: GridMotionContext) => {
		if (context.kind === "root") {
			const offset =
				context.direction === "forward"
					? context.stageWidth
					: -context.stageWidth;
			return {
				transform: `translate3d(${offset}px, 0, 0)`,
				transition: gridTransition(context),
			};
		}

		return context.direction === "forward"
			? {
					opacity: 0.96,
					transform: `translate3d(0, ${context.depthTravel}px, 0) scale(0.985)`,
					transition: gridTransition(context),
				}
			: {
					opacity: 0.96,
					transform: `translate3d(0, -${context.depthTravel}px, 0) scale(0.985)`,
					transition: gridTransition(context),
				};
	},
	animate: (context: GridMotionContext) =>
		context.kind === "root"
			? {
					transform: "translate3d(0, 0, 0)",
					transition: gridTransition(context),
				}
			: {
					transform: "translate3d(0, 0, 0)",
					opacity: 1,
					transition: gridTransition(context),
				},
	exit: (context: GridMotionContext) => {
		if (context.kind === "root") {
			const offset =
				context.direction === "forward"
					? -context.stageWidth
					: context.stageWidth;
			return {
				transform: `translate3d(${offset}px, 0, 0)`,
				transition: gridTransition(context),
			};
		}

		return context.direction === "forward"
			? {
					opacity: 0.88,
					transform: `translate3d(0, -${context.depthTravel}px, 0) scale(0.985)`,
					transition: gridTransition(context),
				}
			: {
					opacity: 0.88,
					transform: `translate3d(0, ${context.depthTravel}px, 0) scale(0.985)`,
					transition: gridTransition(context),
				};
	},
	"reduced-exit": {
		opacity: 0,
		transform: "translate3d(0, 0, 0)",
		transition: REDUCED_GRID_TRANSITION,
	},
};

interface DialGridProps {
	/** Item-order container being rendered (the active folder id). */
	folderId: string;
	/** Layout commit signal used to refresh the navigation travel distance. */
	layoutOpen?: boolean;
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
	onPreviewDrop: (
		targetFolderId: string,
		draggedCardId: string,
		targetCardId: string,
		position: "before" | "after",
	) => void;
	onCombineCards: (draggedCardId: string, targetCardId: string) => void;
	canNestFolder: (folderId: string, targetFolderId: string) => boolean;
	navigation: NavigationState;
	emptyState?: ReactNode;
}

export function DialGrid({
	folderId,
	layoutOpen = false,
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
	onPreviewDrop,
	onCombineCards,
	canNestFolder,
	navigation,
	emptyState,
}: DialGridProps) {
	const tileSize = useSetupStore((s) => s.settings.tileSize);
	const maxColumns = useSetupStore((s) => s.settings.maxColumns);
	const dialLayout = useSetupStore((s) => s.settings.dialLayout);
	const cardAspect = useSetupStore((s) => s.settings.cardAspect);
	const iconGrid = iconGridConfig(tileSize);
	const gridMaxWidth =
		dialLayout === "icon"
			? computeIconGridMaxWidth(tileSize, maxColumns)
			: computeGridMaxWidth(tileSize, maxColumns);
	const reduceMotion = useReducedMotion() ?? false;
	const stageRef = useRef<HTMLDivElement>(null);
	const [stageWidth, setStageWidth] = useState(0);

	useLayoutEffect(() => {
		const stage = stageRef.current;
		if (!stage) return;

		const updateStageWidth = () => {
			const width = stage.getBoundingClientRect().width;
			setStageWidth((currentWidth) =>
				currentWidth === width ? currentWidth : width,
			);
		};

		updateStageWidth();
		const layoutFrame = layoutOpen
			? requestAnimationFrame(updateStageWidth)
			: 0;
		window.addEventListener("resize", updateStageWidth);
		return () => {
			if (layoutFrame !== 0) cancelAnimationFrame(layoutFrame);
			window.removeEventListener("resize", updateStageWidth);
		};
	}, [layoutOpen]);

	const motionContext: GridMotionContext = {
		...navigation,
		stageWidth,
		// Measure against the visible scroll viewport, never the full grid
		// height. This lets depth navigation enter from the screen edge even
		// when the current folder has many rows below the fold.
		depthTravel: (() => {
			const stage = stageRef.current;
			const scrollContainer = stage?.closest<HTMLElement>(
				"[data-speed-dial-scroll]",
			);
			if (!stage || !scrollContainer) return 96;
			const stageRect = stage.getBoundingClientRect();
			const scrollRect = scrollContainer.getBoundingClientRect();
			return Math.max(96, Math.round(scrollRect.bottom - stageRect.top));
		})(),
		reduceMotion,
	};

	const selectedIds = useSelectionStore((s) => s.selectedIds);
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

	const movedToast = useCallback(
		(cardIds: string[], folderIds: string[], targetFolderId: string) => {
			const total = cardIds.length + folderIds.length;
			if (total === 0) return;
			const dest = allFolders.find((f) => f.id === targetFolderId);
			const movedCards = allCards.filter((c) => cardIds.includes(c.id)).length;
			const movedFolders = allFolders.filter((f) =>
				folderIds.includes(f.id),
			).length;
			toast.success(total === 1 ? "Item moved" : `${total} items moved`, {
				description: dest
					? `to ${dest.name} · ${describeMoveGroup(movedCards, movedFolders)}`
					: describeMoveGroup(movedCards, movedFolders),
			});
		},
		[allCards, allFolders],
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
				movedToast(cardIds, folderIds, targetFolderId);
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
			movedToast,
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
				movedToast(cardIds, folderIds, folderId);
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
			movedToast,
		],
	);

	// Dragstart rule: dragging an unselected item starts a fresh single drag
	// (previous selection clears); dragging a selected item carries the whole
	// set with a premium group overlay instead of N duplicated cards.
	const handleItemDragStart = useCallback(
		(ref: ItemRef, e: React.DragEvent) => {
			const store = useSelectionStore.getState();
			if (!store.selectedIds.includes(ref.id)) {
				store.clear();
				if (dialLayout === "icon") showGroupDragGhost(e, 1);
				return;
			}
			const group = store.selectedIds;
			if (group.length > 1) showGroupDragGhost(e, group.length);
			else if (dialLayout === "icon") showGroupDragGhost(e, 1);
		},
		[dialLayout],
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
		allowFolderSpringLoad: dialLayout !== "icon",
		onPreviewLiveReorder: useCallback(
			(
				targetFolderId: string,
				dragged: ItemRef,
				target: ItemRef,
				position: "before" | "after",
			) => {
				if (
					dragged.kind !== "card" ||
					target.kind !== "card" ||
					allCards.find((card) => card.id === dragged.id)?.folderId !==
						targetFolderId
				)
					return;
				onLiveReorder(targetFolderId, dragged, target, position);
			},
			[allCards, onLiveReorder],
		),
		onPreviewDrop: onPreviewDrop,
		canNest: canNestFolder,
		isInContainer,
		onItemDragStart: handleItemDragStart,
	} as Parameters<typeof useGridDnd>[0]);

	// The coordinator outlives container swaps (same hook instance): when the
	// folder changes mid-gesture (spring-load navigation), clear only visuals
	// tied to the previous container. The native payload must remain available
	// to the newly rendered grid until the browser emits drop/dragend/Escape.
	const dndResetVisuals = dnd.resetVisuals;
	useEffect(() => {
		if (folderId) dndResetVisuals();
	}, [folderId, dndResetVisuals]);

	// Ordered view items with explicit source metadata for range select.
	const orderedItems = useMemo(
		() =>
			orderedRefs.map((ref) => ({
				id: ref.id,
				kind: ref.kind,
				sourceId: folderId,
			})),
		[orderedRefs, folderId],
	);

	function handleCardClick(e: React.MouseEvent, id: string) {
		const item = { id, kind: "card" as const, sourceId: folderId };
		if (e.metaKey || e.ctrlKey) {
			e.preventDefault();
			e.stopPropagation();
			toggle(item);
		} else if (e.shiftKey) {
			e.preventDefault();
			e.stopPropagation();
			selectRange(id, orderedItems);
		} else if (useSelectionStore.getState().scope !== null) {
			// Content selection mode: plain clicks add/remove, no modifiers.
			e.preventDefault();
			e.stopPropagation();
			toggle(item);
		}
		// Otherwise the link navigates normally (mode not entered).
	}

	function handleFolderClick(
		e: React.MouseEvent,
		id: string,
		onOpen: () => void,
	) {
		const item = { id, kind: "folder" as const, sourceId: folderId };
		if (e.metaKey || e.ctrlKey) {
			e.preventDefault();
			e.stopPropagation();
			toggle(item);
		} else if (e.shiftKey) {
			e.preventDefault();
			e.stopPropagation();
			selectRange(id, orderedItems);
		} else if (useSelectionStore.getState().scope !== null) {
			// Content selection mode: plain clicks add/remove. Opening uses
			// the card's chevron affordance or the Open context action.
			e.preventDefault();
			e.stopPropagation();
			toggle(item);
		} else {
			onOpen();
		}
	}

	return (
		<section
			className="dial-grid-wrap mx-auto w-full px-[var(--speed-dial-content-gutter)]"
			data-layout={dialLayout}
			data-drag-active={dnd.drag ? "true" : undefined}
			style={{ maxWidth: dialLayout === "icon" ? undefined : gridMaxWidth }}
			{...dnd.backgroundProps}
		>
			<div
				ref={stageRef}
				className={
					dialLayout === "icon"
						? "dial-grid-stage dial-grid-stage-icon"
						: "dial-grid-stage overflow-hidden"
				}
				style={{
					maxWidth: dialLayout === "icon" ? gridMaxWidth : undefined,
					marginInline: dialLayout === "icon" ? "auto" : undefined,
				}}
			>
				<AnimatePresence initial={false} mode="sync" custom={motionContext}>
					<motion.div
						key={folderId}
						initial={
							reduceMotion || (navigation.kind === "root" && stageWidth <= 0)
								? false
								: "initial"
						}
						animate="animate"
						exit={reduceMotion ? "reduced-exit" : "exit"}
						variants={GRID_VARIANTS}
						custom={motionContext}
						className="dial-grid"
						data-tile={tileSize}
						data-layout={dialLayout}
						data-nav-direction={navigation.direction}
						data-nav-kind={navigation.kind}
						style={{
							display: orderedRefs.length === 0 ? undefined : "grid",
							gridTemplateColumns:
								orderedRefs.length === 0
									? undefined
									: dialLayout === "icon"
										? "repeat(auto-fill, var(--icon-cell-w, 104px))"
										: "repeat(auto-fill, var(--tile-w, 148px))",
							gap:
								orderedRefs.length === 0
									? undefined
									: dialLayout === "icon"
										? "var(--icon-row-gap) var(--icon-column-gap)"
										: "var(--grid-gap, 22px)",
							justifyContent: orderedRefs.length === 0 ? undefined : "center",
							gridArea: "1 / 1",
							...(dialLayout === "icon"
								? {
										["--icon-cell-w" as string]: `${iconGrid.cellWidth}px`,
										["--icon-cell-h" as string]: `${iconGrid.cellHeight}px`,
										["--icon-size" as string]: `${iconGrid.iconSize}px`,
										["--icon-favicon-size" as string]: `${iconGrid.faviconSize}px`,
										["--icon-column-gap" as string]: `${iconGrid.columnGap}px`,
										["--icon-row-gap" as string]: `${iconGrid.rowGap}px`,
										["--icon-label-gap" as string]: `${iconGrid.labelGap}px`,
									["--icon-folder-span" as string]: iconGrid.folderSpan,
									["--icon-radius" as string]: `${iconGrid.radius}px`,
									["--icon-safe-padding" as string]: `${iconGrid.safePadding}px`,
									}
								: {}),
							...cellAspectStyle,
						}}
					>
						{orderedRefs.length === 0
							? emptyState
							: orderedRefs.map((ref) => {
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
												showOpenAction={selectedIds.length > 0}
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
												getPreviewDragProps={(cardId) =>
													dnd.getPreviewItemDragProps(folder.id, cardId)
												}
												stackDragProps={dnd.getFolderStackDragProps(
													folder.id,
													previewCards[folder.id]?.[8]?.id,
												)}
												previewInsertion={
													dnd.previewInsertion?.folderId === folder.id
														? {
																targetCardId: dnd.previewInsertion.targetCardId,
																position: dnd.previewInsertion.position,
															}
														: null
												}
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
		</section>
	);
}
