import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@klice-start/ui/components/context-menu";
import { Icon } from "@klice-start/ui/icons/icon";
import { glassVariantStyles } from "@klice-start/ui/lib/glass-variants";
import { type DragEvent, useEffect, useState } from "react";
import { useSpringLoad } from "../../../hooks/use-spring-load";
import { getActiveDrag, getDragId, isDragKind, setDragData } from "../../../lib/dnd";
import { glassCardFooter, glassDropdownItem } from "../../../lib/glass";
import { cn } from "../../../lib/utils";
import { useImageStore } from "../../../stores/image-store";
import { useAppearance } from "../appearance-provider";

/** A single card's preview data for the folder mosaic. */
export interface FolderPreviewItem {
	id: string;
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
	onEdit: (id: string) => void;
	onDelete: (id: string) => void;
	onDropCard: (cardId: string, folderId: string) => void;
	onDropFolder: (folderId: string, targetFolderId: string) => void;
	canAcceptFolder: (folderId: string) => boolean;
	dragProps?: {
		draggable?: boolean;
		onDragStart?: (e: DragEvent) => void;
		onDragEnd?: () => void;
	};
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
	onEdit,
	onDelete,
	onDropCard,
	onDropFolder,
	canAcceptFolder,
	dragProps,
	className,
}: FolderPreviewCardProps) {
	const { isLiquid } = useAppearance();
	const [dropActive, setDropActive] = useState(false);
	const spring = useSpringLoad(() => onOpen(id));

	function accepts(e: DragEvent): boolean {
		if (isDragKind(e, "card")) return true;
		if (isDragKind(e, "folder")) {
			const active = getActiveDrag();
			const draggedId = active?.id || getDragId(e);
			return draggedId ? draggedId !== id && canAcceptFolder(draggedId) : false;
		}
		return false;
	}

	function handleDragOver(e: DragEvent) {
		if (!accepts(e)) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		if (!dropActive) setDropActive(true);
		spring.start();
	}

	function handleDragLeave() {
		setDropActive(false);
		spring.cancel();
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		setDropActive(false);
		spring.cancel();
		const active = getActiveDrag();
		const draggedId = active?.id || getDragId(e);
		if (!draggedId) return;

		if (isDragKind(e, "folder")) {
			if (draggedId !== id && canAcceptFolder(draggedId)) {
				onDropFolder(draggedId, id);
			}
		} else if (isDragKind(e, "card")) {
			onDropCard(draggedId, id);
		}
	}

	const hasPreviews = previewCards.length > 0;

	return (
		<ContextMenu>
			<ContextMenuTrigger
				data-local-context-menu
				className={cn(
					"dial-card squircle group/folder relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl transition-[transform,box-shadow,opacity] duration-150 [--squircle-r:10px] hover:translate-y-[-1px] active:scale-[0.97]",
					isLiquid
						? glassVariantStyles.liquid
						: "border border-border bg-card shadow-sm",
					isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background/40 shadow-lg scale-[1.02]",
					dropActive && "scale-[1.04] ring-2 ring-white/80 shadow-md",
					dragging && "opacity-40",
					className,
				)}
				render={
					<button
						type="button"
						aria-label={`Open folder ${name}`}
						title={name}
						onClick={onClick}
						draggable={true}
						onDragStart={(e) => {
							setDragData(e, "folder", id);
							dragProps?.onDragStart?.(e);
						}}
						onDragEnd={() => {
							dragProps?.onDragEnd?.();
						}}
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
					/>
				}
			>
				<div className="relative min-h-0 flex-1 overflow-hidden p-1.5">
					{hasPreviews ? (
						<div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-1.5">
							{previewCards.slice(0, 4).map((card) => (
								<FolderMiniTile key={card.id} card={card} isLiquid={isLiquid} />
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
								? "bg-black/30 text-white/70"
								: "bg-muted text-muted-foreground",
						)}
					>
						{itemCount}
					</span>

					{isSelected && showMultiBadge && (
						<div className="absolute top-1.5 left-1.5 z-30 flex size-5 items-center justify-center rounded-full bg-primary font-bold text-[10px] text-primary-foreground shadow-xs">
							✓
						</div>
					)}
				</div>

				<div
					className={cn(
						"card-footer flex shrink-0 items-center gap-1.5 rounded-b-2xl px-2.5",
						glassCardFooter(isLiquid),
					)}
					style={{ height: "var(--card-footer-h, 30px)" }}
				>
					<Icon name="folder" size={14} className="shrink-0 opacity-70" />
					<span className="truncate font-medium text-[11px]">{name}</span>
				</div>
			</ContextMenuTrigger>

			<ContextMenuContent
				className={cn(
					"min-w-44 rounded-xl border border-border/60 bg-popover p-1 text-popover-foreground shadow-xl",
					isLiquid && "bg-popover/90 backdrop-blur-xl",
				)}
			>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onClick={() => onOpen(id)}
				>
					<Icon name="folder" size={14} />
					Open
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onClick={() => onEdit(id)}
				>
					<Icon name="pencil" size={14} />
					Rename
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

function FolderMiniTile({
	card,
	isLiquid,
}: {
	card: FolderPreviewItem;
	isLiquid: boolean;
}) {
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

	return (
		<div
			className={cn(
				"relative flex size-full items-center justify-center overflow-hidden rounded-[7px]",
				isLiquid
					? "bg-white/[0.08]"
					: "bg-muted/60",
			)}
		>
			{thumbUrl ? (
				<img
					src={thumbUrl}
					alt=""
					className="absolute inset-0 size-full object-cover"
				/>
			) : (
				<img
					src={card.favicon}
					alt=""
					className="size-3.5 object-contain"
					onError={(e) => {
						e.currentTarget.style.display = "none";
					}}
				/>
			)}
		</div>
	);
}
