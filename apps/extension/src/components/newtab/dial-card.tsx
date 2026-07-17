import { Icon } from "@perch/ui/icons/icon";
import { useEffect, useState } from "react";
import { faviconUrl } from "../../lib/url";
import { cn, colorFromString } from "../../lib/utils";
import { useImageStore } from "../../stores/image-store";
import { useSetupStore } from "../../stores/setup-store";
import type { Card } from "../../types";

interface DialCardProps {
	card: Card;
	onEdit: (id: string) => void;
	onDelete: (id: string) => void;
	/** Drag-and-drop props from useDragAndDrop.getItemProps(card.id). */
	dragProps?: Record<string, unknown>;
	className?: string;
}

export function DialCard({
	card,
	onEdit,
	onDelete,
	dragProps,
	className,
}: DialCardProps) {
	const getThumbnail = useImageStore((s) => s.getThumbnail);
	const openInNewTab = useSetupStore((s) => s.settings.openInNewTab);
	const showDelete = useSetupStore((s) => s.settings.showDeleteButton);
	const showTitle = useSetupStore((s) => s.settings.showTitle);
	const iconRadius = useSetupStore((s) => s.settings.iconRadius);
	const [thumbUrl, setThumbUrl] = useState<string | null>(null);

	// Guard against out-of-order resolution when thumbId changes quickly.
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

	const fallbackColor = colorFromString(card.url);
	const initial = (card.title || card.url).trim().charAt(0).toUpperCase();
	const label = card.title || card.url;

	return (
		<a
			href={card.url}
			target={openInNewTab ? "_blank" : "_self"}
			rel={openInNewTab ? "noopener noreferrer" : undefined}
			aria-label={label}
			className={cn(
				"squircle dial-card relative flex min-h-[var(--tile-h,100px)] cursor-pointer flex-col overflow-hidden border border-white/[0.06] bg-white/[0.04] transition-all duration-200 hover:translate-y-[-1px] hover:bg-white/[0.08] active:scale-[1.01]",
				className,
			)}
			style={{ borderRadius: `${iconRadius}px` }}
			onContextMenu={(e) => {
				e.preventDefault();
				onEdit(card.id);
			}}
			{...dragProps}
		>
			{thumbUrl ? (
				<img
					src={thumbUrl}
					alt=""
					className="thumb h-full w-full object-cover"
					loading="lazy"
				/>
			) : (
				<div
					className="thumb-fallback flex flex-1 items-center justify-center font-semibold text-2xl text-white/60"
					style={{ background: fallbackColor }}
				>
					{initial}
				</div>
			)}

			{showTitle && (
				<div className="card-footer flex items-center gap-1.5 p-1.5">
					<img
						src={card.favicon || faviconUrl(card.url)}
						alt=""
						className="favicon h-4 w-4 shrink-0 rounded-full"
						onError={(e) => {
							(e.target as HTMLImageElement).onerror = null;
							(e.target as HTMLImageElement).src = faviconUrl(card.url);
						}}
					/>
					<span className="title truncate font-medium text-[11px] text-white/70">
						{label}
					</span>
				</div>
			)}

			{showDelete && (
				<button
					type="button"
					aria-label={`Remove ${label}`}
					className="delete-btn absolute top-1.5 right-1.5 flex h-6 w-6 scale-75 items-center justify-center rounded-full bg-black/40 text-white/70 opacity-0 transition-all duration-150 hover:bg-red-500 hover:text-white"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						onDelete(card.id);
					}}
				>
					<Icon name="x" size={13} />
				</button>
			)}
		</a>
	);
}
