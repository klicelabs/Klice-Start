import { clampInt, safeTileSize } from "./utils";

/**
 * Shared geometry for the Home Screen-style icon layout.
 *
 * Rhythm derived from the launcher-grid research (.pi/research/
 * launcher-grid-glass-research.md §5.1): the icon never grows, the gutter
 * does. Gutter ≈ edge margin keeps Apple's optical balance, and the row gap
 * stays ~46% of the icon height like Springboard's 28pt row pitch.
 *
 * The corner RADIUS is not here: it is derived from the global corner scale
 * (--icon-radius-ratio) and the icon size, so icons, folders, mini icons and
 * the glass pane always agree with the appearance preference.
 */
export const ICON_GRID = {
	small: {
		cellWidth: 88,
		cellHeight: 106,
		iconSize: 64,
		faviconSize: 40,
		columnGap: 24,
		rowGap: 20,
		labelGap: 6,
		folderSpan: 1,
		safePadding: 28,
	},
	medium: {
		cellWidth: 104,
		cellHeight: 124,
		iconSize: 76,
		faviconSize: 48,
		columnGap: 28,
		rowGap: 22,
		labelGap: 7,
		folderSpan: 1,
		safePadding: 32,
	},
	large: {
		cellWidth: 128,
		cellHeight: 150,
		iconSize: 92,
		faviconSize: 58,
		columnGap: 32,
		rowGap: 26,
		labelGap: 8,
		folderSpan: 1,
		safePadding: 36,
	},
} as const;

export type IconGridSize = keyof typeof ICON_GRID;

export function iconGridConfig(tileSize: string) {
	return ICON_GRID[safeTileSize(tileSize)];
}

export function computeIconGridMaxWidth(
	tileSize: string,
	maxColumns: number,
): number {
	const config = iconGridConfig(tileSize);
	const columns = clampInt(maxColumns, 4, 10, 7);
	return (
		columns * config.cellWidth +
		(columns - 1) * config.columnGap +
		config.safePadding * 2
	);
}

export type IconFolderPreviewSlot<T> =
	| { kind: "item"; item: T }
	| { kind: "empty" };

/**
 * Project folder contents into stable 3×3 launcher slots.
 *
 * A closed folder is ONE icon: the preview is a 3×3 grid of mini icons
 * inside the icon-sized tile (iOS behaviour). Items beyond the ninth are
 * summarised by the "+N" badge on the tile.
 */
export function iconFolderPreviewSlots<T>(
	items: readonly T[],
): IconFolderPreviewSlot<T>[] {
	return Array.from({ length: ICON_FOLDER_PREVIEW_SLOTS }, (_, index) =>
		items[index] !== undefined
			? ({ kind: "item", item: items[index] as T } as const)
			: ({ kind: "empty" } as const),
	);
}

/**
 * Number of items a closed folder can show in its 3×3 preview. Everything
 * beyond that is summarised by the "+N" badge on the tile.
 */
export const ICON_FOLDER_PREVIEW_SLOTS = 9;
