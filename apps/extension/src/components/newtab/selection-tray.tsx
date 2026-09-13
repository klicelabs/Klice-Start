import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@klice-start/ui/components/dropdown-menu";
import { Icon } from "@klice-start/ui/icons/icon";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { setDragData } from "../../lib/dnd";
import { showGroupDragGhost } from "../../lib/drag-ghost";
import { wouldCreateCycle } from "../../lib/folder-tree";
import { glassDropdownItem, glassMenu } from "../../lib/glass";
import { describeMoveGroup, resolveMoveGroup } from "../../lib/move-selection";
import { cn } from "../../lib/utils";
import { useMoveDialogStore } from "../../stores/move-dialog-store";
import { useSelectionStore } from "../../stores/selection-store";
import { useSetupStore } from "../../stores/setup-store";
import type { Card, Folder } from "../../types";
import type { SelectionCreateMode } from "../shared/create-folder-from-selection-dialog";
import { CreateFolderFromSelectionDialog } from "../shared/create-folder-from-selection-dialog";
import { useAppearance } from "./appearance-provider";

interface SelectionTrayProps {
	/** Navigate to a folder after a successful create-and-move operation. */
	onNavigateFolder?: (id: string) => void;
}

interface CreateRequest {
	mode: SelectionCreateMode;
	parentId: string | null;
	selectedIds: string[];
}

/**
 * Floating Selection Tray — the transport surface for multi-select.
 *
 * Appears as soon as anything is selected and persists across navigation
 * (selection lives in the store, not in any mounted grid), so users can
 * carry items into another folder and commit with Move here — no dragging
 * required. Dragging the preview cluster also works as a group drag source.
 *
 * Deliberately NOT a card, toast or modal: one compact squircle bar with a
 * stacked preview, a count summary and a compact set of quiet actions, in the
 * same Glass/Flat material as the context menus.
 */
export function SelectionTray({ onNavigateFolder }: SelectionTrayProps) {
	const selectedIds = useSelectionStore((s) => s.selectedIds);
	const clearSelection = useSelectionStore((s) => s.clear);
	const cards = useSetupStore((s) => s.cards as Card[]);
	const folders = useSetupStore((s) => s.folders as Folder[]);
	const activeFolderId = useSetupStore((s) => s.activeFolderId);
	const moveItemsToContainer = useSetupStore((s) => s.moveItemsToContainer);
	const createFolderFromSelection = useSetupStore(
		(s) => s.createFolderFromSelection,
	);
	const openMoveDialog = useMoveDialogStore((s) => s.open);
	const { isLiquid } = useAppearance();
	const reduceMotion = useReducedMotion() ?? false;
	const [createRequest, setCreateRequest] = useState<CreateRequest | null>(
		null,
	);

	const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
	const folderById = useMemo(
		() => new Map(folders.map((f) => [f.id, f])),
		[folders],
	);

	// Selection order is the transport order; unknown ids (deleted
	// elsewhere) resolve to nothing and are ignored everywhere below.
	const selCards = useMemo(
		() =>
			selectedIds
				.map((id) => cardById.get(id))
				.filter((c): c is Card => c !== undefined),
		[selectedIds, cardById],
	);
	const selFolders = useMemo(
		() =>
			selectedIds
				.map((id) => folderById.get(id))
				.filter((f): f is Folder => f !== undefined),
		[selectedIds, folderById],
	);
	const total = selCards.length + selFolders.length;
	const items = useSelectionStore((s) => s.items);

	// Distinct source folders across the selection, for the multi-source
	// indicator. Null sources are roots.
	const sourceCount = useMemo(
		() => new Set(items.map((i) => i.sourceId ?? "__root__")).size,
		[items],
	);

	// First three members across both kinds, in selection order, for the
	// stacked preview. Never renders every item, however large the set.
	const previewItems = useMemo(() => {
		const byId = new Map<
			string,
			{ card: Card | null; folder: Folder | null }
		>();
		for (const c of selCards) byId.set(c.id, { card: c, folder: null });
		for (const f of selFolders) byId.set(f.id, { card: null, folder: f });
		return selectedIds
			.map((id) => byId.get(id))
			.filter((p): p is { card: Card | null; folder: Folder | null } =>
				Boolean(p),
			)
			.slice(0, 3);
	}, [selectedIds, selCards, selFolders]);

	const move = useMemo(
		() => resolveMoveGroup(selectedIds, cards, folders, activeFolderId),
		[selectedIds, cards, folders, activeFolderId],
	);
	const destName = folders.find((f) => f.id === activeFolderId)?.name;
	// Whole-operation validity: if ANY selected folder would cycle at the
	// current destination, Move here stays disabled rather than partially
	// committing — the user deselects or picks another destination instead.
	const invalidFolder = useMemo(
		() =>
			selFolders.find(
				(f) =>
					activeFolderId === f.id ||
					wouldCreateCycle(folders, f.id, activeFolderId),
			) ?? null,
		[selFolders, folders, activeFolderId],
	);
	const canMoveHere = invalidFolder === null && move.movable > 0;
	const moveHereReason = invalidFolder
		? "Can't move a folder into itself or its subfolders."
		: move.blockedReason;

	function selectionSummary(ids: string[]) {
		let cardCount = 0;
		let folderCount = 0;
		for (const id of ids) {
			if (cardById.has(id)) cardCount += 1;
			else if (folderById.has(id)) folderCount += 1;
		}
		return describeMoveGroup(cardCount, folderCount);
	}

	function startCreate(mode: SelectionCreateMode) {
		if (mode === "subfolder" && invalidFolder) return;
		setCreateRequest({
			mode,
			parentId: mode === "folder" ? null : activeFolderId,
			selectedIds: [...selectedIds],
		});
	}

	function handleCreate(name: string) {
		if (!createRequest) return false;
		const id = createFolderFromSelection(
			name,
			createRequest.parentId,
			createRequest.selectedIds,
		);
		if (!id) return false;

		const label = createRequest.mode === "folder" ? "Folder" : "Subfolder";
		toast.success(`${label} created`, {
			description: `${selectionSummary(createRequest.selectedIds)} moved into ${name}.`,
		});
		setCreateRequest(null);
		clearSelection();
		onNavigateFolder?.(id);
		return true;
	}

	function handleMoveHere() {
		if (!canMoveHere) return;
		moveItemsToContainer(activeFolderId, move.cardIds, move.folderIds);
		toast.success(
			move.movable === 1 ? "Item moved" : `${move.movable} items moved`,
			{
				description: destName
					? `to ${destName} · ${describeMoveGroup(move.cardIds.length, move.folderIds.length)}`
					: undefined,
			},
		);
		clearSelection();
	}

	// The tray is a group drag source: one member id rides the native payload
	// and every drop site expands it back to the live selection (same rule as
	// dragging a selected grid item).
	function handleTrayDragStart(e: React.DragEvent) {
		const first =
			selCards.length > 0
				? { kind: "card" as const, id: selCards[0].id }
				: selFolders.length > 0
					? { kind: "folder" as const, id: selFolders[0].id }
					: null;
		if (!first) {
			e.preventDefault();
			return;
		}
		e.dataTransfer.effectAllowed = "move";
		setDragData(e, first.kind, first.id);
		if (total > 1) showGroupDragGhost(e, total);
	}

	return (
		<>
			<AnimatePresence>
				{total > 0 && (
					<div
						data-selection-tray
						className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4"
					>
						<motion.div
							role="region"
							aria-label={`Selection tray, ${total} selected`}
							initial={
								reduceMotion
									? { opacity: 0 }
									: { opacity: 0, y: 16, scale: 0.97 }
							}
							animate={
								reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }
							}
							exit={
								reduceMotion
									? { opacity: 0 }
									: { opacity: 0, y: 12, scale: 0.98 }
							}
							transition={
								reduceMotion
									? { duration: 0.12 }
									: { duration: 0.22, ease: [0.23, 1, 0.32, 1] }
							}
							className={cn(
								"squircle pointer-events-auto flex max-w-[min(430px,100%)] items-center gap-2.5 rounded-[20px] py-2 pr-2 pl-3 [--squircle-r:12px]",
								glassMenu(isLiquid),
							)}
						>
							{/* Preview cluster — also the group drag handle. */}
							<button
								type="button"
								draggable
								onDragStart={handleTrayDragStart}
								title={
									total > 1
										? `Drag to move ${total} items`
										: "Drag to move this item"
								}
								aria-label={`Drag to move ${total} selected ${total === 1 ? "item" : "items"}`}
								className="relative h-8 w-11 shrink-0 cursor-grab touch-none border-0 bg-transparent p-0 active:cursor-grabbing"
							>
								{previewItems.map((item, i) => (
									<TrayMini
										key={item.card?.id ?? item.folder?.id ?? String(i)}
										index={i as 0 | 1 | 2}
										card={item.card}
										folder={item.folder}
										isLiquid={isLiquid}
									/>
								))}
								<span
									aria-hidden="true"
									className="absolute -right-1 -bottom-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--apple-blue)] px-1 font-semibold text-[10px] text-white tabular-nums"
								>
									{total > 99 ? "99+" : total}
								</span>
							</button>

							<div className="min-w-0 flex-1 leading-tight">
								<p className="truncate font-semibold text-[13px]">
									{total} selected
								</p>
								<p
									className={cn(
										"truncate text-[11px]",
										isLiquid ? "text-white/65" : "text-flat-ink-muted",
									)}
								>
									{describeMoveGroup(selCards.length, selFolders.length)}
									{sourceCount > 1 ? ` · from ${sourceCount} folders` : ""}
								</p>
							</div>

							<div className="flex shrink-0 items-center gap-1">
								<DropdownMenu>
									<DropdownMenuTrigger
										render={
											<button
												type="button"
												aria-label="Create from selection"
												title="Create from selection"
												className={cn(
													"inline-flex size-8 shrink-0 items-center justify-center rounded-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
													isLiquid
														? "text-white/80 hover:bg-white/[0.12] hover:text-white aria-expanded:bg-white/[0.14]"
														: "text-flat-ink-muted hover:bg-flat-sunken-raised hover:text-flat-ink aria-expanded:bg-flat-sunken-raised",
												)}
											>
												<Icon name="folder-plus" size={15} aria-hidden="true" />
											</button>
										}
									/>
									<DropdownMenuContent
										side="top"
										align="end"
										sideOffset={10}
										className={cn(glassMenu(isLiquid), "min-w-52")}
									>
										<DropdownMenuGroup>
											<DropdownMenuLabel
												className={cn(
													"px-3 py-1.5 font-medium text-[11px]",
													isLiquid ? "text-white/55" : "text-flat-ink-muted",
												)}
											>
												Create from selection
											</DropdownMenuLabel>
											<DropdownMenuItem
												className={glassMenuItem(isLiquid)}
												onClick={() => startCreate("folder")}
											>
												<Icon name="folder-plus" size={14} aria-hidden="true" />
												Create new folder
											</DropdownMenuItem>
											<DropdownMenuItem
												className={glassMenuItem(isLiquid)}
												disabled={Boolean(invalidFolder)}
												title={
													invalidFolder
														? "A selected folder cannot be nested inside itself or its descendants."
														: undefined
												}
												onClick={() => startCreate("subfolder")}
											>
												<Icon name="folder-plus" size={14} aria-hidden="true" />
												Create new subfolder
											</DropdownMenuItem>
										</DropdownMenuGroup>
									</DropdownMenuContent>
								</DropdownMenu>
								<button
									type="button"
									onClick={() => openMoveDialog(selectedIds)}
									className={cn(
										"inline-flex h-8 shrink-0 items-center justify-center rounded-[12px] px-2.5 font-medium text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
										isLiquid
											? "text-white/85 hover:bg-white/[0.12] hover:text-white"
											: "text-flat-ink-muted hover:bg-flat-sunken-raised hover:text-flat-ink",
									)}
								>
									Move to…
								</button>
								<button
									type="button"
									onClick={handleMoveHere}
									disabled={!canMoveHere}
									title={
										canMoveHere
											? destName
												? `Move here, to ${destName}`
												: "Move here"
											: (moveHereReason ?? "Can't move here")
									}
									aria-label={
										canMoveHere
											? `Move here${destName ? `, to ${destName}` : ""}`
											: `Move here unavailable: ${moveHereReason ?? "invalid destination"}`
									}
									className="inline-flex h-8 shrink-0 items-center justify-center rounded-[12px] bg-[var(--apple-blue)] px-3 font-medium text-white text-xs transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
								>
									Move here
								</button>
								<button
									type="button"
									onClick={clearSelection}
									aria-label="Clear selection"
									className={cn(
										"inline-flex size-8 shrink-0 items-center justify-center rounded-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
										isLiquid
											? "text-white/70 hover:bg-white/[0.12] hover:text-white"
											: "text-flat-ink-muted hover:bg-flat-sunken-raised hover:text-flat-ink",
									)}
								>
									<Icon name="x" size={14} aria-hidden="true" />
								</button>
							</div>
						</motion.div>
					</div>
				)}
			</AnimatePresence>
			<CreateFolderFromSelectionDialog
				open={createRequest !== null}
				mode={createRequest?.mode ?? "folder"}
				selectionSummary={
					createRequest ? selectionSummary(createRequest.selectedIds) : ""
				}
				parentName={
					createRequest?.parentId
						? folderById.get(createRequest.parentId)?.name
						: undefined
				}
				isLiquid={isLiquid}
				onOpenChange={(open) => {
					if (!open) setCreateRequest(null);
				}}
				onCreate={handleCreate}
			/>
		</>
	);
}

function glassMenuItem(isLiquid: boolean) {
	return cn("gap-2.5", glassDropdownItem(isLiquid));
}

const MINI_POS = [
	"left-0 top-[5px] -rotate-6",
	"left-[9px] top-[3px] rotate-[5deg]",
	"left-[18px] top-[6px] -rotate-3",
] as const;

function TrayMini({
	index,
	card,
	folder,
	isLiquid,
}: {
	index: 0 | 1 | 2;
	card: Card | null;
	folder: Folder | null;
	isLiquid: boolean;
}) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"absolute flex size-[22px] items-center justify-center overflow-hidden rounded-[7px] border",
				isLiquid
					? "border-white/25 bg-black/40"
					: "border-black/10 bg-flat-sunken-raised dark:border-white/10",
				MINI_POS[index],
			)}
		>
			{card ? (
				<img
					src={card.favicon ?? undefined}
					alt=""
					draggable={false}
					className="size-3.5 rounded-[3px] object-contain"
					onError={(e) => {
						e.currentTarget.style.display = "none";
					}}
				/>
			) : folder ? (
				<Icon
					name="folder"
					size={12}
					className={isLiquid ? "text-white/80" : "text-flat-ink-muted"}
					aria-hidden="true"
				/>
			) : null}
		</span>
	);
}
