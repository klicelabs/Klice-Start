import type {
	BackgroundSettings,
	ClockSettings,
	GreetingSettings,
	SearchSettings,
	Settings,
	Setup,
	ThumbnailCaptureSettings,
	WallpaperFrequency,
} from "../types";

export interface GradientDef {
	id: string;
	label: string;
	css: string;
}

export const GRADIENTS: GradientDef[] = [
	{
		id: "aurora",
		label: "Aurora",
		css: "radial-gradient(120% 100% at 20% 0%, #3a3f8f 0%, #0a0a0c 55%), linear-gradient(160deg,#1b1f4d,#0a0a0c)",
	},
	{
		id: "sunset",
		label: "Sunset",
		css: "linear-gradient(150deg,#3a1c3d 0%,#7a3b2e 45%,#0a0a0c 100%)",
	},
	{
		id: "ocean",
		label: "Ocean",
		css: "linear-gradient(160deg,#0f2f3d 0%,#123a4a 40%,#0a0a0c 100%)",
	},
	{
		id: "graphite",
		label: "Graphite",
		css: "linear-gradient(160deg,#232326 0%,#141416 60%,#0a0a0c 100%)",
	},
	{
		id: "forest",
		label: "Forest",
		css: "linear-gradient(160deg,#122a1e 0%,#16351f 45%,#0a0a0c 100%)",
	},
	{
		id: "rose",
		label: "Rosé",
		css: "linear-gradient(150deg,#3d1c2e 0%,#4a2340 45%,#0a0a0c 100%)",
	},
	{
		id: "ember",
		label: "Ember",
		css: "linear-gradient(160deg,#3a1210 0%,#5a2312 45%,#0a0a0c 100%)",
	},
	{
		id: "mint",
		label: "Mint",
		css: "linear-gradient(160deg,#0f3a34 0%,#123f2f 45%,#0a0a0c 100%)",
	},
];

export interface WallpaperDef {
	id: string;
	label: string;
	src: string;
}

export const WALLPAPERS: WallpaperDef[] = [
	{
		id: "alpine-lake-sunbeams",
		label: "Alpine Lake Sunbeams",
		src: "/wallpapers/alpine-lake-sunbeams.jpg",
	},
	{
		id: "matterhorn-at-dusk",
		label: "Matterhorn at Dusk",
		src: "/wallpapers/matterhorn-at-dusk.jpg",
	},
	{
		id: "purple-mountain-summit",
		label: "Purple Mountain Summit",
		src: "/wallpapers/purple-mountain-summit.jpg",
	},
	{
		id: "tokyo-skyline",
		label: "Tokyo Skyline",
		src: "/wallpapers/tokyo-skyline.jpg",
	},
	{
		id: "blue-moon-mountains",
		label: "Blue Moon Mountains",
		src: "/wallpapers/blue-moon-mountains.jpg",
	},
	{
		id: "red-sun-water",
		label: "Red Sun Water",
		src: "/wallpapers/red-sun-water.jpg",
	},
	{
		id: "turquoise-alpine-lake",
		label: "Turquoise Alpine Lake",
		src: "/wallpapers/turquoise-alpine-lake.jpg",
	},
	{
		id: "mountain-lake",
		label: "Mountain Lake",
		src: "/wallpapers/mountain-lake.avif",
	},
	{
		id: "starry-night-sky",
		label: "Starry Night Sky",
		src: "/wallpapers/starry-night-sky.jpg",
	},
	{
		id: "violet-curves",
		label: "Violet Curves",
		src: "/wallpapers/violet-curves.png",
	},
	{
		id: "bonsai-rock-milky-way",
		label: "Bonsai Rock Milky Way",
		src: "/wallpapers/bonsai-rock-milky-way.jpg",
	},
];

/**
 * Grid tile widths per size. Heights are DERIVED from CARD_ASPECT_RATIO —
 * these height values feed only fallbacks/icon layout. Small was bumped so it
 * no longer reads as a cramped thumbnail.
 */
export const TILE_SIZE_DIMENSIONS: Record<
	string,
	{ width: number; height: number }
> = {
	small: { width: 132, height: 146 },
	medium: { width: 160, height: 176 },
	large: { width: 196, height: 216 },
};

/**
 * Card height as a multiple of the tile width, per aspect choice.
 *
 * Vivaldi's Speed Dial cards are slightly TALLER than wide — the thumbnail is
 * landscape and the footer sits beneath it, so the whole card lands just over
 * 1:1. This ratio is applied to the tile WIDTH and is identical across the
 * Small / Medium / Large size variants, so the proportions never change when
 * the grid size is toggled.
 */
export const CARD_ASPECT_RATIO: Record<string, number> = {
	horizontal: 0.82,
	square: 1,
	vertical: 1.12,
};

/** Uniform footer height (favicon + site name + breathing room). */
export const CARD_FOOTER_HEIGHT_PX = 30;

export const GRID_GAP_PX = 22;
export const GRID_PADDING_X_PX = 24;
export const MIN_COLUMNS = 4;
export const MAX_COLUMNS = 10;

export const DEFAULT_THUMBNAIL_CAPTURE: ThumbnailCaptureSettings = {
	enabled: true,
	delayMs: 1200,
};

export const DEFAULT_BACKGROUND: BackgroundSettings = {
	type: "wallpaper",
	color: "#0A0A0C",
	gradientId: null,
	imageId: null,
	wallpaperId: "tokyo-skyline",
	customWallpapers: [],
	blur: 0,
	brightness: 100,
	opacity: 100,
	pexelsQuery: "curated wallpaper",
	pexelsFrequency: "daily" as WallpaperFrequency,
	pexelsPreviousFrequency: null,
	pexelsLastFetched: null,
	pexelsLastPeriod: null,
	pexelsImageId: null,
};

export const DEFAULT_CLOCK: ClockSettings = {
	enabled: true,
	format24: true,
	showSeconds: false,
	analog: false,
	size: 200,
	timezone: "auto",
	dateFormat: "auto",
};

export const DEFAULT_GREETING: GreetingSettings = {
	enabled: true,
	name: "",
};

export interface SearchEngineDef {
	id: string;
	label: string;
	/** Query template; "%s" is replaced with the URL-encoded search terms. */
	queryUrl: string;
	/** Origin used to derive the engine's favicon for the in-input logo. */
	homepage: string;
}

export const SEARCH_ENGINES: SearchEngineDef[] = [
	{
		id: "google",
		label: "Google",
		queryUrl: "https://www.google.com/search?q=%s",
		homepage: "https://www.google.com",
	},
	{
		id: "bing",
		label: "Bing",
		queryUrl: "https://www.bing.com/search?q=%s",
		homepage: "https://www.bing.com",
	},
	{
		id: "duckduckgo",
		label: "DuckDuckGo",
		queryUrl: "https://duckduckgo.com/?q=%s",
		homepage: "https://duckduckgo.com",
	},
	{
		id: "brave",
		label: "Brave",
		queryUrl: "https://search.brave.com/search?q=%s",
		homepage: "https://search.brave.com",
	},
	{
		id: "ecosia",
		label: "Ecosia",
		queryUrl: "https://www.ecosia.org/search?q=%s",
		homepage: "https://www.ecosia.org",
	},
];

export const DEFAULT_SEARCH: SearchSettings = {
	enabled: true,
	engine: "google",
	placeholder: "",
	iconMode: "engine",
};

export const DEFAULT_SETTINGS: Settings = {
	tileSize: "medium",
	maxColumns: 7,
	showTitle: true,
	showDeleteButton: true,
	openInNewTab: false,
	iconRadius: 14,
	dialLayout: "card",
	cardAspect: "vertical",
	iconShowLabel: true,
	thumbnailCapture: { ...DEFAULT_THUMBNAIL_CAPTURE },
	background: { ...DEFAULT_BACKGROUND },
	clock: { ...DEFAULT_CLOCK },
	greeting: { ...DEFAULT_GREETING },
	search: { ...DEFAULT_SEARCH },
	appearanceMode: "liquid",
};

export const DEFAULT_SETUP: Setup = {
	folders: [{ id: "default", name: "Home", order: 0, parentId: null }],
	cards: [],
	activeFolderId: "default",
	settings: { ...DEFAULT_SETTINGS },
};
