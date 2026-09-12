import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@klice-start/ui/components/context-menu";
import { Icon } from "@klice-start/ui/icons/icon";
import { useEffect, useState } from "react";
import type { GridItemDragProps } from "../../lib/dnd";
import {
	glassCardFooter,
	glassDropdownItem,
	glassFocusRing,
	glassMenu,
} from "../../lib/glass";
import { faviconUrl } from "../../lib/url";
import { cn, softGradientFromString } from "../../lib/utils";
import { useImageStore } from "../../stores/image-store";
import { useMoveDialogStore } from "../../stores/move-dialog-store";
import { useRenameStore } from "../../stores/rename-store";
import { useSelectionStore } from "../../stores/selection-store";
import { useSetupStore } from "../../stores/setup-store";
import type { Card } from "../../types";
import { InlineRenameInput } from "../shared/inline-rename-input";
import { useAppearance } from "./appearance-provider";

interface DialCardProps {
	card: Card;
	onDelete: (id: string) => void;
	isSelected?: boolean;
	showMultiBadge?: boolean;
	onClick?: (e: React.MouseEvent) => void;
	dragProps?: GridItemDragProps;
	/** Live insertion marker drawn on the card's leading/trailing edge. */
	insertion?: "before" | "after" | null;
	/** Drop-onto highlight: this card is the combine target. */
	combineActive?: boolean;
	dragging?: boolean;
	className?: string;
}

export function DialCard({
	card,
	onDelete,
	isSelected = false,
	showMultiBadge = false,
	onClick,
	dragProps,
	insertion = null,
	combineActive = false,
	dragging = false,
	className,
}: DialCardProps) {
	const { isLiquid } = useAppearance();
	const getThumbnail = useImageStore((s) => s.getThumbnail);
	const openInNewTab = useSetupStore((s) => s.settings.openInNewTab);
	const showTitle = useSetupStore((s) => s.settings.showTitle);
	const dialLayout = useSetupStore((s) => s.settings.dialLayout);
	const iconShowLabel = useSetupStore((s) => s.settings.iconShowLabel);
	const [thumbUrl, setThumbUrl] = useState<string | null>(null);

	const editing = useRenameStore((s) => s.isEditing("card", card.id));
	const beginRename = useRenameStore((s) => s.begin);
	const cancelRename = useRenameStore((s) => s.cancel);
	const openMoveDialog = useMoveDialogStore((s) => s.open);

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

	const fallbackColor = softGradientFromString(card.url);
	const initial = (card.title || card.url).trim().charAt(0).toUpperCase();
	const label = card.title || card.url;

	function handleOpenNewTab() {
		window.open(card.url, "_blank");
	}

	function handleCommitRename(name: string) {
		useSetupStore.getState().updateCard(card.id, { title: name });
		cancelRename();
	}

	return (
		<ContextMenu>
			<ContextMenuTrigger
				data-local-context-menu
				className={cn(
					// Calm by default: no hover lift/translate/glow. Hover only
					// deepens the shadow a whisper via drop-shadow (a filter, so
					// the glass material's own box-shadow stack is untouched).
					// `cursor-default` is explicit because the card renders as an
					// <a href>, which the UA stylesheet would otherwise give a
					// hand cursor — Klice Start uses the platform arrow.
					"dial-card squircle group relative isolate flex h-full w-full cursor-default flex-col overflow-hidden rounded-2xl bg-transparent p-0 shadow-none transition-[transform,box-shadow,filter,opacity] duration-150 [--squircle-r:10px] hover:drop-shadow-[0_6px_14px_rgba(0,0,0,0.28)] active:scale-[0.97] select-none [-webkit-user-drag:element]",
					glassFocusRing(isLiquid),
					isSelected &&
						"scale-[1.02] shadow-lg ring-2 ring-primary ring-offset-2 ring-offset-background/40",
					insertion === "before" && "drop-insert-before",
					insertion === "after" && "drop-insert-after",
					combineActive && "ring-2 ring-white/80",
					dragging && "opacity-40",
					className,
				)}
				render={
					<a
						href={card.url}
						target={openInNewTab ? "_blank" : "_self"}
						rel={openInNewTab ? "noopener noreferrer" : undefined}
						aria-label={label}
						title={label}
						onClick={onClick}
						draggable={editing ? false : (dragProps?.draggable ?? true)}
						onDragStart={editing ? undefined : dragProps?.onDragStart}
						onDragEnd={dragProps?.onDragEnd}
						onDragOver={dragProps?.onDragOver}
						onDragLeave={dragProps?.onDragLeave}
						onDrop={dragProps?.onDrop}
					/>
				}
			>
				{dialLayout === "icon" ? (
					<div className="flex flex-col items-center gap-1 p-2.5">
						<img
							src={card.favicon || faviconUrl(card.url)}
							alt=""
							draggable={false}
							className="h-9 w-9 shrink-0 rounded-full object-cover"
							onError={(e) => {
								(e.target as HTMLImageElement).onerror = null;
								(e.target as HTMLImageElement).src = faviconUrl(card.url);
							}}
						/>
						{iconShowLabel &&
							(editing ? (
								<InlineRenameInput
									value={card.title || card.url}
									ariaLabel={`Rename ${label}`}
									onCommit={handleCommitRename}
									onCancel={cancelRename}
									className="text-center"
								/>
							) : (
								<span className="max-w-full truncate text-center font-medium text-[11px] leading-tight">
									{label}
								</span>
							))}
					</div>
				) : (
					<>
						{/* Cover fills the bounded media box without stretching or letterbox
						    bands. The fallback keeps its gradient while the screenshot loads. */}
						<div
							className="thumb relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
							style={{ background: fallbackColor }}
						>
							{thumbUrl ? (
								<img
									src={thumbUrl}
									alt=""
									className="absolute inset-0 size-full object-cover object-center"
									loading="lazy"
									draggable={false}
								/>
							) : (
								<div className="thumb-fallback flex min-h-0 flex-1 items-center justify-center font-semibold text-2xl text-white/60">
									<span className="flex h-full w-full items-center justify-center">
										{initial}
									</span>
								</div>
							)}
						</div>

						{(showTitle || editing) && (
							<div
								className={cn(
									// Same squircle system as the outer card so the
									// footer follows the card geometry in every
									// browser (corner-shape aware or fallback).
									"card-footer squircle flex shrink-0 items-center gap-1.5 rounded-b-2xl px-2.5 [--squircle-r:10px]",
									glassCardFooter(isLiquid),
								)}
								style={{ height: "var(--card-footer-h, 30px)" }}
							>
								<img
									src={card.favicon || faviconUrl(card.url)}
									alt=""
									draggable={false}
									className="favicon h-4 w-4 shrink-0 rounded-full"
									onError={(e) => {
										(e.target as HTMLImageElement).onerror = null;
										(e.target as HTMLImageElement).src = faviconUrl(card.url);
									}}
								/>
								{editing ? (
									<InlineRenameInput
										value={card.title || card.url}
										ariaLabel={`Rename ${label}`}
										onCommit={handleCommitRename}
										onCancel={cancelRename}
									/>
								) : (
									<span className="title truncate font-medium text-[11px]">
										{label}
									</span>
								)}
							</div>
						)}
					</>
				)}

				{isSelected && showMultiBadge && (
					<div
						aria-hidden="true"
						className="absolute top-1.5 left-1.5 z-30 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs"
					>
						<Icon name="check" size={11} strokeWidth={3} />
					</div>
				)}
			</ContextMenuTrigger>

			<ContextMenuContent className={glassMenu(isLiquid)}>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onClick={handleOpenNewTab}
				>
					<Icon name="globe" size={14} />
					Open in new tab
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onClick={() => beginRename({ kind: "card", id: card.id })}
				>
					<Icon name="pencil" size={14} />
					Rename
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onClick={() => {
						const selected = useSelectionStore.getState().selectedIds;
						openMoveDialog(selected.includes(card.id) ? selected : [card.id]);
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
					onClick={() => onDelete(card.id)}
				>
					<Icon name="trash" size={14} />
					Delete
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
