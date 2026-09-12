import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@klice-start/ui/components/context-menu";
import { Icon } from "@klice-start/ui/icons/icon";
import { glassVariantStyles } from "@klice-start/ui/lib/glass-variants";
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
	showMultiBadge?: boolean;
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
	showMultiBadge = false,
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
				data-local-context-menu
				className={cn(
					// Calm by default: no hover lift/translate/glow — same rule
					// as bookmark cards. Drop-target states are untouched.
					"dial-card squircle group/folder relative flex h-full w-full flex-col overflow-hidden rounded-2xl transition-[transform,box-shadow,filter,opacity] duration-150 [--squircle-r:10px] hover:drop-shadow-[0_6px_14px_rgba(0,0,0,0.28)] active:scale-[0.97] select-none [-webkit-user-drag:element]",
					glassFocusRing(isLiquid),
					isLiquid
						? glassVariantStyles.liquid
						: "border border-border bg-card shadow-sm",
					isSelected &&
						"scale-[1.02] shadow-lg ring-2 ring-primary ring-offset-2 ring-offset-background/40",
					insertion === "before" && "drop-insert-before",
					insertion === "after" && "drop-insert-after",
					dropActive && "shadow-md ring-2 ring-white/80",
					dragging && "opacity-40",
					className,
				)}
				render={
					<button
						type="button"
						aria-label={
							editing ? `Rename folder ${name}` : `Open folder ${name}`
						}
						title={name}
						onClick={onClick}
						draggable={
							dragProps ? (editing ? false : dragProps.draggable) : true
						}
						onDragStart={editing ? undefined : dragProps?.onDragStart}
						onDragEnd={dragProps?.onDragEnd}
						onDragOver={dragProps?.onDragOver}
						onDragLeave={dragProps?.onDragLeave}
						onDrop={dragProps?.onDrop}
					/>
				}
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

					{isSelected && showMultiBadge && (
						<div
							aria-hidden="true"
							className="absolute top-1.5 left-1.5 z-30 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs"
						>
							<Icon name="check" size={11} strokeWidth={3} />
						</div>
					)}
				</div>

				<div
					className={cn(
						// Same squircle system as the outer card so the footer
						// follows the card geometry instead of reading as an
						// independent capsule. Same material recipe as the
						// bookmark footer via glassCardFooter.
						"card-footer squircle flex shrink-0 items-center gap-1.5 rounded-b-2xl px-2.5 [--squircle-r:10px]",
						glassCardFooter(isLiquid),
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
						<span className="truncate font-medium text-[11px]">{name}</span>
					)}
				</div>
			</ContextMenuTrigger>

			<ContextMenuContent className={glassMenu(isLiquid)}>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onClick={() => onOpen(id)}
				>
					<Icon name="folder" size={14} />
					Open
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onClick={() => onNewSubfolder(id)}
				>
					<Icon name="folder-plus" size={14} />
					New subfolder
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onClick={() => beginRename({ kind: "folder", id })}
				>
					<Icon name="pencil" size={14} />
					Rename
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onClick={() => {
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
					variant="destructive"
					onClick={() => onDelete(id)}
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
