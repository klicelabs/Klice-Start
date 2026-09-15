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
import {
	glassDropdownItem,
	glassForeground,
	glassMaterial,
	glassMenu,
	glassShape,
} from "../../lib/glass";
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
 * Appears as soon as a selection exists and persists across navigation
 * (selection lives in the store, not tied to a mounted grid), so users can
 * carry items into another folder and commit with Move here — no dragging
 * required. Dragging the preview cluster also works as a group drag source.
 *
 * Deliberately NOT a card, toast or modal: one compact floating squircle shelf
 * with a centered preview stack, a count summary and quiet overflow actions,
 * in the same Glass/Flat material as the context menus.
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
	const { isLiquid, resolvedDark } = useAppearance();
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
	const totalLabel = `${total} ${total === 1 ? "item" : "items"}`;
	const pillLabel = selectionPillLabel(selCards.length, selFolders.length);

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
							layout
							role="region"
							aria-label={`Selection tray, ${totalLabel}`}
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
									: {
											layout: { duration: 0.22, ease: [0.23, 1, 0.32, 1] },
											opacity: { duration: 0.18, ease: [0.23, 1, 0.32, 1] },
											y: { duration: 0.22, ease: [0.23, 1, 0.32, 1] },
											scale: { duration: 0.22, ease: [0.23, 1, 0.32, 1] },
										}
							}
							className={cn(
								"pointer-events-auto flex w-full max-w-[232px] flex-col gap-2.5 overflow-hidden px-3 py-3",
								glassShape("panel"),
								// Dense readable veil (shared menu tier), never the faint
								// hero veil: the tray carries status text + actions.
								glassMaterial(isLiquid, "menu", "dense"),
								isLiquid
									? glassForeground()
									: "text-flat-ink",
							)}
						>
							<div className="flex h-8 items-center justify-between">
								<button
									type="button"
									onClick={clearSelection}
									aria-label="Clear selection"
									title="Clear selection"
								className={cn(
									"inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-[background-color,color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
									isLiquid
										? cn("bg-foreground/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]", glassForeground(), "hover:bg-foreground/15 hover:text-[var(--klice-glass-foreground-primary)]")
										: "bg-flat-sunken-raised text-flat-ink-muted shadow-control hover:text-flat-ink",
								)}
							>
								<Icon name="x" size={15} aria-hidden="true" />
							</button>

								<DropdownMenu>
									<DropdownMenuTrigger
										render={
											<button
												type="button"
												aria-label="Selection actions"
												title="Selection actions"
											className={cn(
												"inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-[background-color,color] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
												isLiquid
										? cn("bg-foreground/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]", glassForeground(), "hover:bg-foreground/15 hover:text-[var(--klice-glass-foreground-primary)] aria-expanded:bg-foreground/15")
													: "bg-flat-sunken-raised text-flat-ink-muted shadow-control hover:text-flat-ink aria-expanded:bg-flat-sunken-raised",
											)}
											>
												<Icon name="ellipsis" size={16} aria-hidden="true" />
											</button>
										}
									/>
									<DropdownMenuContent
										side="top"
										align="end"
										sideOffset={10}
										className={cn(glassMenu(isLiquid, resolvedDark), "min-w-56")}
									>
										<DropdownMenuGroup>
										<DropdownMenuLabel
											className={cn(
												"px-3 py-1.5 text-[12px] font-normal",
												isLiquid
										? glassForeground("secondary")
													: "text-flat-ink-muted",
											)}
										>
												Selection actions
											</DropdownMenuLabel>
											<DropdownMenuItem
												className={glassMenuItem(isLiquid, resolvedDark)}
												onClick={() => openMoveDialog(selectedIds)}
											>
												<Icon name="folder-move" size={14} aria-hidden="true" />
												Move to…
											</DropdownMenuItem>
											<DropdownMenuItem
												className={glassMenuItem(isLiquid, resolvedDark)}
												onClick={() => startCreate("folder")}
											>
												<Icon name="folder-plus" size={14} aria-hidden="true" />
												Create new folder
											</DropdownMenuItem>
											<DropdownMenuItem
												className={glassMenuItem(isLiquid, resolvedDark)}
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
							</div>

							{/* Preview cluster — the shelf's visual protagonist and group drag handle. */}
							<div className="flex h-[100px] items-center justify-center">
								<button
									type="button"
									draggable
									onDragStart={handleTrayDragStart}
									title={
										total > 1
											? `Drag to move ${total} items`
											: "Drag to move this item"
									}
									aria-label={
										"Drag to move " +
										total +
										" selected " +
										(total === 1 ? "item" : "items")
									}
									className="relative h-[100px] w-[116px] shrink-0 cursor-grab touch-none border-0 bg-transparent p-0 active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
								>
									<AnimatePresence initial={false} mode="popLayout">
										{previewItems.map((item, i) => (
											<TrayMini
												key={item.card?.id ?? item.folder?.id ?? String(i)}
												index={i as 0 | 1 | 2}
												card={item.card}
												folder={item.folder}
												isLiquid={isLiquid}
												resolvedDark={resolvedDark}
												reduceMotion={reduceMotion}
											/>
										))}
									</AnimatePresence>
								</button>
							</div>

							<div
								role="status"
								aria-live="polite"
							className={cn(
								"mx-auto inline-flex max-w-[92%] items-center justify-center rounded-full px-3 py-1.5 text-[12px] font-medium leading-none tracking-[-0.01em] tabular-nums",
								isLiquid
									? cn("bg-foreground/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]", glassForeground())
									: "bg-flat-sunken-raised text-flat-ink-muted shadow-control",
							)}
							>
								<span className="truncate">{pillLabel}</span>
							</div>

							<AnimatePresence initial={false} mode="popLayout">
								{canMoveHere && (
									<motion.button
										key="move-here"
										layout
										type="button"
										onClick={handleMoveHere}
										aria-label={`Move here${destName ? `, to ${destName}` : ""}`}
										title={`Move here${destName ? `, to ${destName}` : ""}`}
										initial={
											reduceMotion
												? { opacity: 0 }
												: { opacity: 0, y: 6, scale: 0.97 }
										}
										animate={
											reduceMotion
												? { opacity: 1 }
												: { opacity: 1, y: 0, scale: 1 }
										}
										exit={
											reduceMotion
												? { opacity: 0 }
												: { opacity: 0, y: 4, scale: 0.98 }
										}
										transition={
											reduceMotion
												? { duration: 0.1 }
												: {
														layout: {
															duration: 0.22,
															ease: [0.23, 1, 0.32, 1],
														},
														opacity: {
															duration: 0.16,
															ease: [0.23, 1, 0.32, 1],
														},
														y: { duration: 0.2, ease: [0.23, 1, 0.32, 1] },
														scale: { duration: 0.2, ease: [0.23, 1, 0.32, 1] },
													}
										}
										className={cn(
											"accent-action-shadow inline-flex h-9 w-full shrink-0 items-center justify-center bg-[var(--klice-accent)] px-3.5 font-medium text-[12px] text-[var(--klice-accent-foreground)] transition-opacity motion-reduce:transition-none hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
											glassShape("control"),
										)}
									>
										Move here
									</motion.button>
								)}
							</AnimatePresence>
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

function glassMenuItem(isLiquid: boolean, resolvedDark: boolean) {
	return cn("gap-2.5", glassDropdownItem(isLiquid, resolvedDark));
}

function selectionPillLabel(cardCount: number, folderCount: number) {
	if (cardCount > 0 && folderCount > 0) {
		return describeMoveGroup(cardCount, folderCount);
	}
	if (cardCount > 0) {
		return `${String(cardCount)} bookmark${cardCount === 1 ? "" : "s"}`;
	}
	if (folderCount > 0) {
		return `${String(folderCount)} folder${folderCount === 1 ? "" : "s"}`;
	}
	return "Selected items";
}

const MINI_POS = [
	"left-[4px] top-[18px] -rotate-6",
	"left-[26px] top-0 rotate-[4deg]",
	"left-[48px] top-[18px] -rotate-3",
] as const;

function TrayMini({
	index,
	card,
	folder,
	isLiquid,
	resolvedDark,
	reduceMotion,
}: {
	index: 0 | 1 | 2;
	card: Card | null;
	folder: Folder | null;
	isLiquid: boolean;
	resolvedDark: boolean;
	reduceMotion: boolean;
}) {
	return (
		<motion.span
			aria-hidden="true"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={
				reduceMotion
					? { duration: 0.1 }
					: { duration: 0.18, ease: [0.23, 1, 0.32, 1] }
			}
			className={cn(
				"absolute flex size-[64px] items-center justify-center",
				"[filter:drop-shadow(0_5px_7px_rgba(15,23,42,0.28))]",
				MINI_POS[index],
			)}
		>
			{card ? (
				<>
					<Icon
						name="globe"
						size={52}
						className={
									isLiquid
										? glassForeground("secondary")
								: "text-flat-ink-muted/70"
						}
						aria-hidden="true"
					/>
					{card.favicon ? (
						<img
							src={card.favicon}
							alt=""
							draggable={false}
							className={cn(
								"absolute size-14 object-contain",
								glassShape("thumbnail"),
							)}
							onError={(e) => {
								e.currentTarget.style.display = "none";
							}}
						/>
					) : null}
				</>
			) : folder ? (
				<Icon
					name="folder"
					size={52}
					fill="currentColor"
					className="text-[var(--klice-accent)]"
					aria-hidden="true"
				/>
			) : null}
		</motion.span>
	);
}
