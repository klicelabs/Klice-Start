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
		radius: 24,
		safePadding: 24,
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
		radius: 28,
		safePadding: 24,
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
		radius: 32,
		safePadding: 24,
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
	| { kind: "empty" }
	| { kind: "stack"; front: T; back: T | null };

/** Project folder contents into stable 3×3 launcher slots. */
export function iconFolderPreviewSlots<T>(
	items: readonly T[],
): IconFolderPreviewSlot<T>[] {
	return Array.from({ length: 9 }, (_, index) => {
		if (index === 8 && items[8] !== undefined) {
			return {
				kind: "stack",
				front: items[8],
				back: items[9] ?? null,
			} as const;
		}
		return items[index] !== undefined
			? ({ kind: "item", item: items[index] as T } as const)
			: ({ kind: "empty" } as const);
	});
}

export interface IconSurfacePalette {
	light: string;
	dark: string;
}

/** Curated app-icon materials. Selection stays deterministic per URL. */
const ICON_SURFACES: IconSurfacePalette[] = [
	{
		light: "linear-gradient(145deg, #ffffff 0%, #e8ebf1 100%)",
		dark: "linear-gradient(145deg, #30343c 0%, #111318 100%)",
	},
	{
		light: "linear-gradient(145deg, #f6f7fa 0%, #cfd5df 100%)",
		dark: "linear-gradient(145deg, #252a33 0%, #0d0f14 100%)",
	},
	{
		light: "linear-gradient(145deg, #dce9ff 0%, #9cbcf2 100%)",
		dark: "linear-gradient(145deg, #315caa 0%, #15284e 100%)",
	},
	{
		light: "linear-gradient(145deg, #f0e5ff 0%, #c1a4ee 100%)",
		dark: "linear-gradient(145deg, #67449e 0%, #2b1d4e 100%)",
	},
	{
		light: "linear-gradient(145deg, #ffe8dc 0%, #f1ad91 100%)",
		dark: "linear-gradient(145deg, #a64f38 0%, #4a211c 100%)",
	},
	{
		light: "linear-gradient(145deg, #e0f5eb 0%, #8fd1b1 100%)",
		dark: "linear-gradient(145deg, #28735b 0%, #12392f 100%)",
	},
	{
		light: "linear-gradient(145deg, #fff2c8 0%, #e8c46d 100%)",
		dark: "linear-gradient(145deg, #896d27 0%, #3c2d10 100%)",
	},
	{
		light: "linear-gradient(145deg, #e8e5ff 0%, #a8b4ff 100%)",
		dark: "linear-gradient(145deg, #4656b2 0%, #1d2454 100%)",
	},
];

function iconSurfaceIndex(value: string): number {
	let hash = 0;
	for (let index = 0; index < value.length; index += 1) {
		hash = value.charCodeAt(index) + ((hash << 5) - hash);
	}
	return Math.abs(hash) % ICON_SURFACES.length;
}

export function iconSurfaceFromString(value: string): IconSurfacePalette {
	return ICON_SURFACES[iconSurfaceIndex(value)] ?? ICON_SURFACES[0];
}
