import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@perch/ui/components/context-menu";
import { Icon } from "@perch/ui/icons/icon";
import { glassVariantStyles } from "@perch/ui/lib/glass-variants";
import { type CSSProperties, useEffect, useState } from "react";
import { glassCardFooter, glassDropdownItem } from "../../lib/glass";
import { faviconUrl } from "../../lib/url";
import { cn, softGradientFromString } from "../../lib/utils";
import { useImageStore } from "../../stores/image-store";
import { useSetupStore } from "../../stores/setup-store";
import type { Card } from "../../types";
import { useAppearance } from "./appearance-provider";

interface DialCardProps {
	card: Card;
	onEdit: (id: string) => void;
	onDelete: (id: string) => void;
	dragProps?: Record<string, unknown>;
	className?: string;
	style?: CSSProperties;
}

export function DialCard({
	card,
	onEdit,
	onDelete,
	dragProps,
	className,
	style,
}: DialCardProps) {
	const { isLiquid } = useAppearance();
	const getThumbnail = useImageStore((s) => s.getThumbnail);
	const openInNewTab = useSetupStore((s) => s.settings.openInNewTab);
	const showDelete = useSetupStore((s) => s.settings.showDeleteButton);
	const showTitle = useSetupStore((s) => s.settings.showTitle);
	const dialLayout = useSetupStore((s) => s.settings.dialLayout);
	const iconShowLabel = useSetupStore((s) => s.settings.iconShowLabel);
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

	const fallbackColor = softGradientFromString(card.url);
	const initial = (card.title || card.url).trim().charAt(0).toUpperCase();
	const label = card.title || card.url;

	function handleOpenNewTab() {
		window.open(card.url, "_blank");
	}

	return (
		<ContextMenu>
			<ContextMenuTrigger
				data-local-context-menu
				className={cn(
					"dial-card squircle group relative isolate flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl bg-transparent p-0 shadow-none transition-transform duration-200 [--squircle-r:10px] hover:translate-y-[-1px] active:scale-[1.01]",
					className,
				)}
				style={style}
				render={
					<a
						href={card.url}
						target={openInNewTab ? "_blank" : "_self"}
						rel={openInNewTab ? "noopener noreferrer" : undefined}
						aria-label={label}
						{...dragProps}
					/>
				}
			>
				{dialLayout === "icon" ? (
					<div className="flex flex-col items-center gap-1 p-2.5">
						<img
							src={card.favicon || faviconUrl(card.url)}
							alt=""
							className="h-9 w-9 shrink-0 rounded-full"
							onError={(e) => {
								(e.target as HTMLImageElement).onerror = null;
								(e.target as HTMLImageElement).src = faviconUrl(card.url);
							}}
						/>
						{iconShowLabel && (
							<span className="max-w-full truncate text-center font-medium text-[11px] leading-tight">
								{label}
							</span>
						)}
					</div>
				) : (
					<>
						{thumbUrl ? (
							<img
								src={thumbUrl}
								alt=""
								className="thumb block min-h-0 w-full flex-1 object-cover"
								loading="lazy"
							/>
						) : (
							<div
								className="thumb-fallback flex min-h-0 flex-1 items-center justify-center font-semibold text-2xl text-white/60"
								style={{ background: fallbackColor }}
							>
								<span className="flex h-full w-full items-center justify-center">
									{initial}
								</span>
							</div>
						)}

						{showTitle && (
							<div
								className={cn(
									"card-footer flex shrink-0 items-center gap-1.5 rounded-b-2xl px-2",
									glassCardFooter(isLiquid),
								)}
								style={{ height: "var(--card-footer-h, 30px)" }}
							>
								<img
									src={card.favicon || faviconUrl(card.url)}
									alt=""
									className="favicon h-4 w-4 shrink-0 rounded-full"
									onError={(e) => {
										(e.target as HTMLImageElement).onerror = null;
										(e.target as HTMLImageElement).src = faviconUrl(card.url);
									}}
								/>
								<span className="title truncate font-medium text-[11px]">
									{label}
								</span>
							</div>
						)}
					</>
				)}

				{showDelete && (
					<button
						type="button"
						aria-label={`Remove ${label}`}
						className="delete-btn absolute top-1.5 right-1.5 flex h-6 w-6 scale-75 items-center justify-center rounded-full bg-black/40 text-white/70 opacity-0 transition-all duration-150 hover:bg-red-500 hover:text-white group-hover:opacity-100"
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							onDelete(card.id);
						}}
					>
						<Icon name="x" size={13} />
					</button>
				)}
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
					onClick={handleOpenNewTab}
				>
					<Icon name="globe" size={15} />
					Open in new tab
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onClick={() => onEdit(card.id)}
				>
					<Icon name="pencil" size={15} />
					Rename
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onClick={() => onEdit(card.id)}
				>
					<Icon name="globe" size={15} />
					Edit URL
				</ContextMenuItem>
				<ContextMenuSeparator
					className={isLiquid ? "bg-white/10" : undefined}
				/>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					variant="destructive"
					onClick={() => onDelete(card.id)}
				>
					<Icon name="trash" size={15} />
					Delete
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
