import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@klice-start/ui/components/motion/context-menu";
import { Icon } from "@klice-start/ui/icons/icon";
import { glassVariantStyles } from "@klice-start/ui/lib/glass-variants";
import { flatSurface } from "@klice-start/ui/lib/surface";
import { useEffect, useState } from "react";
import type { GridItemDragProps } from "../../../lib/dnd";
import {
	glassCardFooter,
	glassDropdownItem,
	glassFocusRing,
	glassMenu,
} from "../../../lib/glass";
import { cn, softGradientFromString } from "../../../lib/utils";
import { useImageStore } from "../../../stores/image-store";
import { useMoveDialogStore } from "../../../stores/move-dialog-store";
import { useRenameStore } from "../../../stores/rename-store";
import { useSelectionStore } from "../../../stores/selection-store";
import { useSetupStore } from "../../../stores/setup-store";
import { InlineRenameInput } from "../../shared/inline-rename-input";
import { useAppearance } from "../appearance-provider";

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
	/** Live insertion marker drawn on the card's leading/trailing edge. */
	insertion?: "before" | "after" | null;
	/** Highlight: a dragged item hovers the body — drop moves it inside. */
	dropActive?: boolean;
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
	insertion = null,
	dropActive = false,
	className,
}: FolderPreviewCardProps) {
	const { isLiquid } = useAppearance();

	const editing = useRenameStore((s) => s.isEditing("folder", id));
	const beginRename = useRenameStore((s) => s.begin);
	const cancelRename = useRenameStore((s) => s.cancel);
	const openMoveDialog = useMoveDialogStore((s) => s.open);

	const hasPreviews = previewCards.length > 0;

	function handleCommitRename(next: string) {
		useSetupStore.getState().updateFolder(id, next);
		cancelRename();
	}

	return (
		<ContextMenu>
			<ContextMenuTrigger
				data-selected={isSelected ? "true" : undefined}
				className={cn(
					// Calm by default: no hover lift/translate/glow — same rule
					// as bookmark cards. Drop-target states are untouched.
					// The single wrapper child below owns the card box; the
					// open chevron lives beside the body button (never nested
					// inside it) so both stay valid, focusable controls.
					"dial-card squircle group/folder relative isolate flex h-full w-full select-none flex-col overflow-hidden rounded-2xl transition-[transform,box-shadow,opacity] duration-150 [--squircle-r:10px] [-webkit-user-drag:element]",
					isLiquid ? glassVariantStyles.liquid : flatSurface("floating"),
					insertion === "before" && "drop-insert-before",
					insertion === "after" && "drop-insert-after",
					dropActive && "scale-[1.02] shadow-md ring-2 ring-white/80",
					dragging && "scale-[0.985] opacity-40",
					className,
				)}
			>
				<div className="relative flex h-full w-full min-w-0 flex-col">
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
							// In selection mode, Enter follows the body button's announced
							// Select action; the sibling chevron remains the explicit opener.
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
											"transition-opacity",
											dropActive ? "opacity-100" : "opacity-60",
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
									className="absolute top-1.5 left-1.5 z-30 flex size-5 items-center justify-center rounded-full bg-[var(--apple-blue)] text-white shadow-md"
								>
									<Icon name="check" size={11} strokeWidth={3} />
								</div>
							)}
						</div>

						<div
							className={cn(
								// Same squircle system as the outer card so the
								// footer follows the card geometry instead of
								// reading as an independent capsule. Same material
								// recipe as the bookmark footer via glassCardFooter.
								"card-footer squircle flex shrink-0 items-center justify-start gap-1.5 rounded-b-2xl px-2.5 text-left [--squircle-r:10px]",
								glassCardFooter(isLiquid),
								showOpenAction && !editing && "pr-8",
							)}
							style={{ height: "var(--card-footer-h, 30px)" }}
						>
							<Icon name="folder" size={14} className="shrink-0 opacity-70" />
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
					{/* Sibling overlay (never nested inside the body button):
				    opens the folder without selecting/deselecting it. */}
					{showOpenAction && !editing ? (
						<button
							type="button"
							aria-label={`Open folder ${name}`}
							title={`Open ${name}`}
							onClick={() => onOpen(id)}
							className="absolute right-1 bottom-[3px] z-30 inline-flex size-6 items-center justify-center rounded-full opacity-55 transition-[opacity,background-color] duration-150 hover:bg-black/15 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 dark:hover:bg-white/15"
						>
							<Icon name="chevron-right" size={14} aria-hidden="true" />
						</button>
					) : null}
				</div>
			</ContextMenuTrigger>

			<ContextMenuContent className={glassMenu(isLiquid)}>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onSelect={() => onOpen(id)}
				>
					<Icon name="folder" size={14} />
					Open
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onSelect={() => onNewSubfolder(id)}
				>
					<Icon name="folder-plus" size={14} />
					New subfolder
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onSelect={() => beginRename({ kind: "folder", id })}
				>
					<Icon name="pencil" size={14} />
					Rename
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
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
					className={glassDropdownItem(isLiquid)}
					onSelect={() => {
						const selected = useSelectionStore.getState().selectedIds;
						openMoveDialog(selected.includes(id) ? selected : [id]);
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
					onSelect={() => onDelete(id)}
				>
					<Icon name="trash" size={14} />
					Delete
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
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
