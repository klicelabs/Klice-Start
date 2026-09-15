import type { CSSProperties } from "react";
import { iconHueFromString } from "../../lib/icon-layout";
import { faviconUrl } from "../../lib/url";
import { cn } from "../../lib/utils";

interface IconAppTileProps {
	url: string;
	favicon: string;
	mini?: boolean;
	className?: string;
}

/** Shared app-icon silhouette used by bookmarks and folder previews. */
export function IconAppTile({
	url,
	favicon,
	mini = false,
	className,
}: IconAppTileProps) {
	const fallback = faviconUrl(url);
	return (
		<div
			aria-hidden="true"
			className={cn(
				"squircle icon-app-tile relative flex shrink-0 items-center justify-center overflow-hidden",
				mini
					? "size-full rounded-[var(--icon-mini-radius)]"
					: "size-[var(--icon-size)] rounded-[var(--icon-radius)]",
				className,
			)}
			style={
				{
					"--icon-hue": iconHueFromString(url),
					"--squircle-r": mini
						? "var(--icon-mini-radius)"
						: "var(--icon-radius)",
				} as CSSProperties
			}
		>
			<img
				src={favicon || fallback}
				alt=""
				draggable={false}
				className={cn(
					"relative z-10 rounded-full object-contain drop-shadow-[0_1px_1px_rgb(0_0_0_/_0.12)]",
					mini ? "size-[62%]" : "size-[var(--icon-favicon-size)]",
				)}
				onError={(event) => {
					if (event.currentTarget.src === fallback) {
						event.currentTarget.style.visibility = "hidden";
						return;
					}
					event.currentTarget.src = fallback;
				}}
			/>
		</div>
	);
}
