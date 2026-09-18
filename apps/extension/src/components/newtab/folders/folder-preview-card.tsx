import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@klice-start/ui/components/motion/context-menu";
import { Icon } from "@klice-start/ui/icons/icon";
import { EASE_OUT } from "@klice-start/ui/lib/ease";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import type { GridItemDragProps } from "../../../lib/dnd";
import {
	glassCardFooter,
	glassCardMaterial,
	glassDropdownItem,
	glassDropRing,
	glassFocusRing,
	glassForeground,
	glassMaterial,
	glassMenu,
} from "../../../lib/glass";
import { buildRenameEntry } from "../../../lib/history-capture";
import { iconFolderPreviewSlots } from "../../../lib/icon-layout";
import { cn, softGradientFromString } from "../../../lib/utils";
import { useHistoryStore } from "../../../stores/history-store";
import { useImageStore } from "../../../stores/image-store";
import { useMoveDialogStore } from "../../../stores/move-dialog-store";
import { useRenameStore } from "../../../stores/rename-store";
import { useSelectionStore } from "../../../stores/selection-store";
import { useSetupStore } from "../../../stores/setup-store";
import { InlineRenameInput } from "../../shared/inline-rename-input";
import { useAppearance } from "../appearance-provider";
import { IconAppTile } from "../icon-app-tile";

/** A single card's preview data for the folder mosaic. */
export interface FolderPreviewItem {
	id: string;
	url: string;
	thumbId: string | null;
	favicon: string;
}

interface FolderPreviewCardProps {
	id: string;
	name: string;
	itemCount: number;
	previewCards: FolderPreviewItem[];
	dragging?: boolean;
	isSelected?: boolean;
	/**
	 * During selection mode the body toggles selection, so an explicit
	 * sibling chevron opens the folder without touching selection.
	 */
	showOpenAction?: boolean;
	onClick?: (e: React.MouseEvent) => void;
	onOpen: (id: string) => void;
	onNewSubfolder: (id: string) => void;
	onDelete: (id: string) => void;
	dragProps?: GridItemDragProps;
	/** Specific preview target; takes precedence over the broad grid drop. */
	getPreviewDragProps?: (cardId: string) => GridItemDragProps;
	/** Spring-loaded target behavior for the stacked ninth preview slot. */
	stackDragProps?: Pick<
		GridItemDragProps,
		"onDragOver" | "onDragLeave" | "onDrop"
	>;
	previewInsertion?: {
		targetCardId: string;
		position: "before" | "after";
	} | null;
	/** Live insertion marker drawn on the card's leading/trailing edge. */
	insertion?: "before" | "after" | null;
	/** Highlight: a dragged item hovers the body — drop moves it inside. */
	dropActive?: boolean;
	/**
	 * H7/P2 (decisão A): the hovered preview refuses this drag — a
	 * multi-item group cannot be positioned inside a folder preview.
	 */
	refuseGroup?: boolean;
	className?: string;
}

export function FolderPreviewCard({
	id,
	name,
	itemCount,
	previewCards,
	dragging,
	isSelected = false,
	showOpenAction = false,
	onClick,
	onOpen,
	onNewSubfolder,
	onDelete,
	dragProps,
	getPreviewDragProps,
	stackDragProps,
	previewInsertion,
	insertion = null,
	dropActive = false,
	refuseGroup = false,
	className,
}: FolderPreviewCardProps) {
	const { isLiquid, resolvedDark } = useAppearance();
	const dialLayout = useSetupStore((s) => s.settings.dialLayout);
	const openInNewTab = useSetupStore((s) => s.settings.openInNewTab);

	const editing = useRenameStore((s) => s.isEditing("folder", id));
	const beginRename = useRenameStore((s) => s.begin);
	const cancelRename = useRenameStore((s) => s.cancel);
	const openMoveDialog = useMoveDialogStore((s) => s.open);

	const hasPreviews = previewCards.length > 0;

	function handleCommitRename(next: string) {
		const store = useSetupStore.getState();
		const before = store.folders.find((f) => f.id === id);
		store.updateFolder(id, next);
		if (before && before.name !== next) {
			const entry = buildRenameEntry(before, { ...before, name: next });
			if (entry) useHistoryStore.getState().commit(entry);
		}
		cancelRename();
	}

	return (
		<ContextMenu>
			<ContextMenuTrigger
				data-selected={isSelected ? "true" : undefined}
				data-dragging={dragging ? "true" : undefined}
				draggable={
					dialLayout === "icon"
						? editing
							? false
							: (dragProps?.draggable ?? true)
						: undefined
				}
				onDragStart={
					dialLayout === "icon" && !editing ? dragProps?.onDragStart : undefined
				}
				onDragEnd={dialLayout === "icon" ? dragProps?.onDragEnd : undefined}
				onDragOver={dialLayout === "icon" ? dragProps?.onDragOver : undefined}
				onDragLeave={dialLayout === "icon" ? dragProps?.onDragLeave : undefined}
				onDrop={dialLayout === "icon" ? dragProps?.onDrop : undefined}
				aria-invalid={refuseGroup || undefined}
				data-group-refused={refuseGroup || undefined}
				className={cn(
					// Calm by default: no hover lift/translate/glow — same rule
					// as bookmark cards. Drop-target states are untouched.
					// The single wrapper child below owns the card box; the
					// open chevron lives beside the body button (never nested
					// inside it) so both stay valid, focusable controls.
					"dial-card squircle group/folder relative isolate flex h-full w-full select-none flex-col transition-[transform,box-shadow,opacity] duration-150 [--squircle-r:10px] [-webkit-user-drag:element]",
					dialLayout === "card" && "overflow-hidden rounded-2xl",
					// Sizing/span live on the grid-item wrapper (DialGrid); the
					// inner card only fills it. Keeping the span class here would
					// size a non-grid-item and overflow its cell.
					dialLayout === "icon" && "overflow-visible rounded-none",
					dialLayout === "card" && glassCardMaterial(isLiquid),
					insertion === "before" &&
						dialLayout === "card" &&
						"drop-insert-before",
					insertion === "after" && dialLayout === "card" && "drop-insert-after",
					dropActive && dialLayout === "card" && glassDropRing(isLiquid),
					dragging && "scale-[0.985] opacity-40",
					className,
				)}
			>
				<div className="relative flex h-full w-full min-w-0 flex-col">
					{dialLayout === "icon" ? (
						<IconFolderBody
							id={id}
							name={name}
							previewCards={previewCards}
							itemCount={itemCount}
							isSelected={isSelected}
							editing={editing}
							showOpenAction={showOpenAction}
							dropActive={dropActive}
							insertion={insertion}
							openInNewTab={openInNewTab}
							isLiquid={isLiquid}
							onClick={onClick}
							onOpen={onOpen}
							onCommitRename={handleCommitRename}
							onCancelRename={cancelRename}
							getPreviewDragProps={getPreviewDragProps}
							stackDragProps={stackDragProps}
							previewInsertion={previewInsertion}
						/>
					) : (
						<>
							<button
								data-local-context-menu
								type="button"
								className={cn(
									"flex h-full w-full min-w-0 flex-col text-left active:scale-[0.97]",
									glassFocusRing(isLiquid),
								)}
								aria-label={
									editing
										? `Rename folder ${name}`
										: `${showOpenAction ? "Select" : "Open"} folder ${name}${isSelected ? ", selected" : ""}`
								}
								title={name}
								onClick={onClick}
								onKeyDown={(e) => {
									if (e.key === "Enter" && !editing) {
										e.preventDefault();
										if (showOpenAction) {
											const folder = useSetupStore
												.getState()
												.folders.find((candidate) => candidate.id === id);
											useSelectionStore.getState().toggle({
												id,
												kind: "folder",
												sourceId: folder?.parentId ?? null,
											});
										} else {
											onOpen(id);
										}
									}
								}}
								draggable={
									dragProps ? (editing ? false : dragProps.draggable) : true
								}
								onDragStart={editing ? undefined : dragProps?.onDragStart}
								onDragEnd={dragProps?.onDragEnd}
								onDragOver={dragProps?.onDragOver}
								onDragLeave={dragProps?.onDragLeave}
								onDrop={dragProps?.onDrop}
							>
								<div className="relative min-h-0 flex-1 overflow-hidden p-1.5">
									{hasPreviews ? (
										<div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-1.5">
											{previewCards.slice(0, 4).map((card) => (
												<FolderMiniTile key={card.id} card={card} />
											))}
											{Array.from({
												length: Math.max(0, 4 - previewCards.length),
											}).map((_, i) => (
												<div
													key={`empty-${String(i)}`}
													className={cn(
														"rounded-[7px]",
														isLiquid ? "bg-white/[0.05]" : "bg-muted",
													)}
												/>
											))}
										</div>
									) : (
										<div className="flex h-full w-full items-center justify-center">
											<Icon
												name="folder"
												size={32}
												className={cn(
													"transition-colors",
													isLiquid ? glassForeground() : "text-flat-ink",
												)}
											/>
										</div>
									)}

									<span
										className={cn(
											"absolute top-2 right-2 rounded-full px-1.5 text-[10px]",
											isLiquid
												? "bg-black/45 text-white/80"
												: "bg-muted text-muted-foreground",
										)}
									>
										{itemCount}
									</span>

									{isSelected && (
										<div
											aria-hidden="true"
											className="absolute top-1.5 left-1.5 z-30 flex size-5 items-center justify-center rounded-full bg-[var(--klice-accent)] text-[var(--klice-accent-foreground)] shadow-md"
										>
											<Icon name="check" size={11} strokeWidth={3} />
										</div>
									)}
								</div>

								<div
									className={cn(
										"card-footer squircle flex shrink-0 items-center justify-start gap-1.5 rounded-b-2xl px-2.5 text-left [--squircle-r:10px]",
										glassCardFooter(isLiquid),
										showOpenAction && !editing && "pr-8",
									)}
									style={{ height: "var(--card-footer-h, 30px)" }}
								>
									<Icon
										name="folder"
										size={14}
										className={cn("shrink-0", isLiquid && glassForeground())}
									/>
									{editing ? (
										<InlineRenameInput
											value={name}
											ariaLabel={`Rename folder ${name}`}
											onCommit={handleCommitRename}
											onCancel={cancelRename}
										/>
									) : (
										<span className="min-w-0 flex-1 truncate text-left font-medium text-[11px]">
											{name}
										</span>
									)}
								</div>
							</button>
							{showOpenAction && !editing ? (
								<button
									type="button"
									aria-label={`Open folder ${name}`}
									title={`Open ${name}`}
									onClick={() => onOpen(id)}
									className={cn(
										"absolute right-1 bottom-[3px] z-30 inline-flex size-6 items-center justify-center rounded-full transition-[background-color,color] duration-150 hover:bg-black/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--klice-accent)]",
										isLiquid ? glassForeground() : "text-flat-ink",
										"dark:hover:bg-white/15",
									)}
								>
									<Icon name="chevron-right" size={14} aria-hidden="true" />
								</button>
							) : null}
						</>
					)}
				</div>
			</ContextMenuTrigger>

			<ContextMenuContent className={glassMenu(isLiquid, resolvedDark)}>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid, resolvedDark, {
						pillOwned: true,
					})}
					onSelect={() => onOpen(id)}
				>
					<Icon name="folder" size={14} />
					Open
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid, resolvedDark, {
						pillOwned: true,
					})}
					onSelect={() => onNewSubfolder(id)}
				>
					<Icon name="folder-plus" size={14} />
					New subfolder
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid, resolvedDark, {
						pillOwned: true,
					})}
					onSelect={() => beginRename({ kind: "folder", id })}
				>
					<Icon name="pencil" size={14} />
					Rename
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid, resolvedDark, {
						pillOwned: true,
					})}
					onSelect={() => {
						const folder = useSetupStore
							.getState()
							.folders.find((f) => f.id === id);
						useSelectionStore.getState().toggle({
							id,
							kind: "folder",
							sourceId: folder?.parentId ?? null,
						});
					}}
				>
					<Icon name="check-square" size={14} />
					Select
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid, resolvedDark, {
						pillOwned: true,
					})}
					onSelect={() => {
						const selected = useSelectionStore.getState().selectedIds;
						openMoveDialog(selected.includes(id) ? selected : [id]);
					}}
				>
					<Icon name="folder" size={14} />
					Move to…
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem
					className={glassDropdownItem(isLiquid, resolvedDark, {
						pillOwned: true,
					})}
					tone="destructive"
					onSelect={() => onDelete(id)}
				>
					<Icon name="trash" size={14} />
					Delete
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}

interface IconFolderBodyProps {
	id: string;
	name: string;
	previewCards: FolderPreviewItem[];
	itemCount: number;
	isSelected: boolean;
	editing: boolean;
	showOpenAction: boolean;
	dropActive: boolean;
	insertion: "before" | "after" | null;
	openInNewTab: boolean;
	isLiquid: boolean;
	onClick?: (e: React.MouseEvent) => void;
	onOpen: (id: string) => void;
	onCommitRename: (next: string) => void;
	onCancelRename: () => void;
	getPreviewDragProps?: (cardId: string) => GridItemDragProps;
	stackDragProps?: Pick<
		GridItemDragProps,
		"onDragOver" | "onDragLeave" | "onDrop"
	>;
	previewInsertion?: {
		targetCardId: string;
		position: "before" | "after";
	} | null;
}

function IconFolderBody({
	id,
	name,
	previewCards,
	itemCount,
	isSelected,
	editing,
	showOpenAction,
	dropActive,
	insertion,
	openInNewTab,
	isLiquid,
	onClick,
	onOpen,
	onCommitRename,
	onCancelRename,
	getPreviewDragProps,
	stackDragProps,
	previewInsertion,
}: IconFolderBodyProps) {
	const hasPreviews = previewCards.length > 0;
	const overflowCount = Math.max(0, itemCount - 10);

	function handleFolderKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			e.currentTarget.click();
		}
	}

	return (
		<div className="icon-folder-layout flex h-full w-full min-w-0 flex-col items-center text-left">
			<div
				className={cn(
					"icon-folder-tile squircle",
					glassMaterial(isLiquid, "menu", "dense"),
					dropActive && "icon-folder-tile-drop-active",
					insertion === "before" && "icon-drop-insert-before",
					insertion === "after" && "icon-drop-insert-after",
				)}
			>
				<button
					data-local-context-menu
					type="button"
					className={cn(
						"icon-folder-open-surface absolute inset-0 z-0 size-full cursor-default rounded-[var(--icon-radius)] text-left",
						glassFocusRing(isLiquid),
					)}
					aria-label={
						editing
							? `Rename folder ${name}`
							: `${showOpenAction ? "Select" : "Open"} folder ${name}${isSelected ? ", selected" : ""}`
					}
					title={name}
					onClick={onClick}
					onKeyDown={handleFolderKeyDown}
				/>

				{hasPreviews ? (
					<div
						className="icon-folder-preview relative z-10"
						data-count={Math.min(previewCards.length, 10)}
					>
						{iconFolderPreviewSlots(previewCards).map((slot, index) => {
							if (slot.kind === "stack") {
								const card = slot.front;
								return (
									<motion.div
										key={card.id}
										layout="position"
										transition={{ duration: 0.2, ease: EASE_OUT }}
										className="icon-folder-preview-motion-cell"
									>
										<button
											type="button"
											aria-label={`Open folder ${name}`}
											title={`Open ${name}`}
											className="icon-folder-preview-stack"
											onClick={() => onOpen(id)}
											{...getPreviewDragProps?.(card.id)}
											{...stackDragProps}
										>
											{slot.back ? (
												<IconAppTile
													url={slot.back.url}
													favicon={slot.back.favicon}
													mini
													className="icon-folder-stack-back-tile"
												/>
											) : (
												<IconAppTile
													url={`${id}:stack-empty`}
													favicon=""
													mini
													showFavicon={false}
													className="icon-folder-stack-back-tile icon-folder-stack-back-empty"
												/>
											)}
											<IconAppTile
												url={card.url}
												favicon={card.favicon}
												mini
												className="icon-folder-stack-front-tile"
											/>
											{slot.back && overflowCount > 0 ? (
												<span
													aria-hidden="true"
													className={cn(
														"icon-folder-stack-count rounded-full px-1.5 font-semibold text-[10px] tabular-nums leading-none",
														glassMaterial(isLiquid, "menu", "dense"),
														isLiquid ? glassForeground() : "text-flat-ink",
													)}
												>
													+{overflowCount}
												</span>
											) : null}
										</button>
									</motion.div>
								);
							}
							if (slot.kind === "empty") {
								return (
									<IconAppTile
										key={`empty-${String(index)}`}
										url={`${id}:empty:${index}`}
										favicon=""
										mini
										showFavicon={false}
										className="icon-folder-preview-empty"
									/>
								);
							}
							const card = slot.item;
							return (
								<motion.div
									key={card.id}
									layout="position"
									transition={{ duration: 0.2, ease: EASE_OUT }}
									className="icon-folder-preview-motion-cell"
								>
									<a
										href={card.url}
										target={openInNewTab ? "_blank" : "_self"}
										rel={openInNewTab ? "noopener noreferrer" : undefined}
										aria-label={`Open ${card.url}`}
										className="icon-folder-preview-link"
										onClick={(e) => e.stopPropagation()}
										{...getPreviewDragProps?.(card.id)}
										data-preview-insertion={
											previewInsertion?.targetCardId === card.id
												? previewInsertion.position
												: undefined
										}
									>
										<IconAppTile url={card.url} favicon={card.favicon} mini />
									</a>
								</motion.div>
							);
						})}
					</div>
				) : (
					<div className="icon-folder-empty pointer-events-none relative z-10">
						<Icon name="folder" size={42} strokeWidth={1.5} />
					</div>
				)}

				{isSelected && (
					<div
						aria-hidden="true"
						className="pointer-events-none absolute top-3 left-3 z-30 flex size-6 items-center justify-center rounded-full bg-[var(--klice-accent)] text-[var(--klice-accent-foreground)] shadow-md"
					>
						<Icon name="check" size={12} strokeWidth={3} />
					</div>
				)}
			</div>

			{editing ? (
				<InlineRenameInput
					value={name}
					ariaLabel={`Rename folder ${name}`}
					onCommit={onCommitRename}
					onCancel={onCancelRename}
					className="icon-label"
				/>
			) : (
				<span className="icon-label">{name}</span>
			)}
		</div>
	);
}

function FolderMiniTile({ card }: { card: FolderPreviewItem }) {
	const getThumbnail = useImageStore((s) => s.getThumbnail);
	const [thumbUrl, setThumbUrl] = useState<string | null>(null);

	useEffect(() => {
		let active = true;
		if (card.thumbId) {
			getThumbnail(card.thumbId).then((url) => {
				if (active) setThumbUrl(url);
			});
		}
		return () => {
			active = false;
		};
	}, [card.thumbId, getThumbnail]);

	// Missing screenshots reuse the bookmark gradient fallback so the tile
	// belongs to the same family instead of rendering as a flat empty box.
	const fallback = softGradientFromString(card.url || card.id);

	return (
		<div
			className="relative flex size-full items-center justify-center overflow-hidden rounded-[7px]"
			style={{ background: fallback }}
		>
			{thumbUrl ? (
				<img
					src={thumbUrl}
					alt=""
					draggable={false}
					className="absolute inset-0 size-full object-cover object-center"
				/>
			) : (
				<img
					src={card.favicon}
					alt=""
					draggable={false}
					className="size-3.5 rounded-[3px] object-contain"
					onError={(e) => {
						e.currentTarget.style.display = "none";
					}}
				/>
			)}
		</div>
	);
}
