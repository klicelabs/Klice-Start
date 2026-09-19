import { Icon } from "@klice-start/ui/icons/icon";
import type { ReactNode } from "react";
import { IconAppTile } from "./icon-app-tile";

export const ICON_MODE_SURFACE_CLASS =
	"dial-card squircle group relative isolate flex h-full w-full cursor-default select-none flex-col overflow-visible rounded-none p-0 transition-[transform,box-shadow,opacity] duration-150 [--squircle-r:10px] active:scale-[0.97] dial-icon-item icon-mode-surface";

interface IconModeTileProps {
	url: string;
	favicon: string;
	label?: string;
	showLabel?: boolean;
	labelContent?: ReactNode;
	selected?: boolean;
	tileClassName?: string;
}

/**
 * Shared Icon mode visual. Home bookmarks and Quick Links both go through
 * this component so favicon fallback, sizing tokens, squircle geometry and
 * selection feedback cannot drift into separate tile styles.
 */
export function IconModeTile({
	url,
	favicon,
	label,
	showLabel = false,
	labelContent,
	selected = false,
	tileClassName,
}: IconModeTileProps) {
	return (
		<div className="icon-bookmark-layout flex h-full w-full flex-col items-center justify-center">
			<IconAppTile url={url} favicon={favicon} className={tileClassName} />
			{(showLabel || labelContent) &&
				(labelContent ?? <span className="icon-label">{label}</span>)}
			{selected && (
				<div
					aria-hidden="true"
					className="absolute top-1.5 left-1.5 z-30 flex size-5 items-center justify-center rounded-full bg-[var(--klice-accent)] text-[var(--klice-accent-foreground)] shadow-md"
				>
					<Icon name="check" size={11} strokeWidth={3} />
				</div>
			)}
		</div>
	);
}
