import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@perch/ui/components/context-menu";
import { Icon } from "@perch/ui/icons/icon";
import { glassVariantStyles } from "@perch/ui/lib/glass-variants";
import { type DragEvent, useEffect, useState } from "react";
import { useSpringLoad } from "../../../hooks/use-spring-load";
import { getDragId, isDragKind } from "../../../lib/dnd";
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
	onOpen: (id: string) => void;
	onEdit: (id: string) => void;
	onDelete: (id: string) => void;
	onDropCard: (cardId: string, folderId: string) => void;
	onDropFolder: (folderId: string, targetFolderId: string) => void;
	canAcceptFolder: (folderId: string) => boolean;
	dragProps?: Record<string, unknown>;
	className?: string;
}

export function FolderPreviewCard({
	id,
	name,
	itemCount,
	previewCards,
	dragging,
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
			const draggedId = getDragId(e);
			return draggedId ? draggedId !== id && canAcceptFolder(draggedId) : true;
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
		const draggedId = getDragId(e);
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
					"dial-card squircle group/folder relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl transition-all duration-200 [--squircle-r:10px] hover:translate-y-[-1px] active:scale-[1.01]",
					isLiquid
						? glassVariantStyles.liquid
						: "border border-border bg-card shadow-sm",
					dropActive && "scale-[1.04] ring-2 ring-white/60",
					dragging && "opacity-40",
					className,
				)}
				render={
					<button
						type="button"
						aria-label={`Open folder ${name}`}
						onClick={() => onOpen(id)}
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
						{...dragProps}
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
					"min-w-48",
					isLiquid
						? cn(
								glassVariantStyles.liquid,
								"border-white/[0.16] bg-white/[0.11] text-white shadow-2xl shadow-black/25 backdrop-blur-md",
								"[--liquid-glass-rim-dark:rgba(0,0,0,0.24)] [--liquid-glass-rim-light:rgba(255,255,255,0.45)] [--liquid-glass-rim-width:0.75px]",
							)
						: "border border-border bg-popover text-popover-foreground shadow-lg before:hidden",
				)}
			>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onClick={() => onOpen(id)}
				>
					<Icon name="folder" size={15} />
					Open
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onClick={() => onEdit(id)}
				>
					<Icon name="pencil" size={15} />
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
					<Icon name="trash" size={15} />
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
		let cancelled = false;
		if (!card.thumbId) {
			setThumbUrl(null);
			return;
		}
		getThumbnail(card.thumbId).then((url) => {
			if (!cancelled) setThumbUrl(url);
		});
		return () => {
			cancelled = true;
		};
	}, [card.thumbId, getThumbnail]);

	return (
		<div
			className={cn(
				"flex items-center justify-center overflow-hidden rounded-[5px]",
				isLiquid ? "bg-white/[0.08]" : "bg-muted",
			)}
		>
			{thumbUrl ? (
				<img
					src={thumbUrl}
					alt=""
					className="h-full w-full object-cover"
					loading="lazy"
				/>
			) : (
				<img
					src={card.favicon}
					alt=""
					className="h-3 w-3 rounded-[2px]"
					loading="lazy"
					onError={(e) => {
						(e.target as HTMLImageElement).style.display = "none";
					}}
				/>
			)}
		</div>
	);
}
