import { clampInt, safeTileSize } from "./utils";

/** Shared geometry for the Home Screen-style icon layout. */
export const ICON_GRID = {
	small: {
		cellWidth: 88,
		cellHeight: 106,
		iconSize: 64,
		faviconSize: 40,
		columnGap: 18,
		rowGap: 18,
		labelGap: 6,
		folderSpan: 2,
		radius: 20,
		miniRadius: 10,
	},
	medium: {
		cellWidth: 104,
		cellHeight: 124,
		iconSize: 76,
		faviconSize: 48,
		columnGap: 20,
		rowGap: 20,
		labelGap: 7,
		folderSpan: 2,
		radius: 24,
		miniRadius: 11,
	},
	large: {
		cellWidth: 128,
		cellHeight: 150,
		iconSize: 92,
		faviconSize: 58,
		columnGap: 24,
		rowGap: 24,
		labelGap: 8,
		folderSpan: 2,
		radius: 28,
		miniRadius: 13,
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
	return columns * config.cellWidth + (columns - 1) * config.columnGap + 24 * 2;
}

/** Stable hue used only for restrained icon-tile background tinting. */
export function iconHueFromString(value: string): number {
	let hash = 0;
	for (let index = 0; index < value.length; index += 1) {
		hash = value.charCodeAt(index) + ((hash << 5) - hash);
	}
	return Math.abs(hash) % 360;
}
