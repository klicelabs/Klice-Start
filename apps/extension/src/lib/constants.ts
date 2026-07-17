import type {
	BackgroundSettings,
	ClockSettings,
	GreetingSettings,
	SearchSettings,
	Settings,
	Setup,
	ThumbnailCaptureSettings,
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

export const TILE_SIZE_DIMENSIONS: Record<
	string,
	{ width: number; height: number }
> = {
	small: { width: 116, height: 78 },
	medium: { width: 148, height: 100 },
	large: { width: 190, height: 128 },
};

export const GRID_GAP_PX = 22;
export const GRID_PADDING_X_PX = 24;
export const MIN_COLUMNS = 4;
export const MAX_COLUMNS = 10;

export const DEFAULT_THUMBNAIL_CAPTURE: ThumbnailCaptureSettings = {
	enabled: true,
	delayMs: 1200,
};

export const DEFAULT_BACKGROUND: BackgroundSettings = {
	type: "solid",
	color: "#0A0A0C",
	gradientId: null,
	imageId: null,
	blur: 0,
	brightness: 100,
	opacity: 100,
};

export const DEFAULT_CLOCK: ClockSettings = {
	enabled: true,
	format24: true,
	showSeconds: false,
	analog: false,
	size: 100,
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
}

export const SEARCH_ENGINES: SearchEngineDef[] = [
	{
		id: "google",
		label: "Google",
		queryUrl: "https://www.google.com/search?q=%s",
	},
	{ id: "bing", label: "Bing", queryUrl: "https://www.bing.com/search?q=%s" },
	{
		id: "duckduckgo",
		label: "DuckDuckGo",
		queryUrl: "https://duckduckgo.com/?q=%s",
	},
	{
		id: "brave",
		label: "Brave",
		queryUrl: "https://search.brave.com/search?q=%s",
	},
	{
		id: "ecosia",
		label: "Ecosia",
		queryUrl: "https://www.ecosia.org/search?q=%s",
	},
];

export const DEFAULT_SEARCH: SearchSettings = {
	enabled: true,
	engine: "google",
};

export const DEFAULT_SETTINGS: Settings = {
	tileSize: "medium",
	maxColumns: 7,
	showTitle: true,
	showDeleteButton: true,
	openInNewTab: false,
	iconRadius: 18,
	thumbnailCapture: { ...DEFAULT_THUMBNAIL_CAPTURE },
	background: { ...DEFAULT_BACKGROUND },
	clock: { ...DEFAULT_CLOCK },
	greeting: { ...DEFAULT_GREETING },
	search: { ...DEFAULT_SEARCH },
};

export const DEFAULT_SETUP: Setup = {
	folders: [{ id: "default", name: "Home", order: 0, parentId: null }],
	cards: [],
	activeFolderId: "default",
	settings: { ...DEFAULT_SETTINGS },
};
