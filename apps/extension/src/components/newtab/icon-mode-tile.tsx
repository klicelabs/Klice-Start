import type { ReactNode } from "react";
import { IconAppTile } from "./icon-app-tile";
import { GlassSurface } from "./toolbar/glass-surface";

export const ICON_MODE_SURFACE_CLASS =
	"dial-card squircle group relative isolate flex h-full w-full cursor-default select-none flex-col overflow-visible rounded-none p-0 transition-[transform,box-shadow,opacity] duration-150 [--squircle-r:10px] dial-icon-item icon-mode-surface";

interface IconModeTileProps {
	url: string;
	favicon: string;
	label?: string;
	showLabel?: boolean;
	labelContent?: ReactNode;
	tileClassName?: string;
	/** Opt-in tile surface wrapping icon + label (Icon mode only, off by default). */
	tileSurface?: boolean;
}

/**
 * Shared Icon mode visual. Home bookmarks and Quick Links both go through
 * this component so favicon fallback, sizing tokens, squircle geometry and
 * selection feedback cannot drift into separate tile styles.
 *
 * The opt-in tile surface is NOT a private CSS recipe: the pane is the shared
 * `GlassSurface` with the `tile` role, so it follows the same global material
 * and appearance settings as every other product surface. Only the geometry
 * (size, padding and double-radius rule) is specific to Icon Mode.
 */
export function IconModeTile({
	url,
	favicon,
	label,
	showLabel = false,
	labelContent,
	tileClassName,
	tileSurface = false,
}: IconModeTileProps) {
	return (
		<div className="icon-bookmark-layout flex h-full w-full flex-col items-center">
			{tileSurface ? (
				// The surface owns the label so icon + label read as ONE
				// physical object with a single-line title. See
				// the .icon-glass-tile geometry in tokens.css.
				<GlassSurface
					variant="tile"
					shape="surface"
					className="icon-glass-tile"
				>
					<IconAppTile url={url} favicon={favicon} className={tileClassName} />
					{(showLabel || labelContent) &&
						(labelContent ?? (
							<span className="icon-label icon-label-glass">{label}</span>
						))}
				</GlassSurface>
			) : (
				<>
					<IconAppTile url={url} favicon={favicon} className={tileClassName} />
					{(showLabel || labelContent) &&
						(labelContent ?? (
							<span className="icon-label">{label}</span>
						))}
				</>
			)}
		</div>
	);
}
