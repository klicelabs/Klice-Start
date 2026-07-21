export interface Folder {
	id: string;
	name: string;
	order: number;
	/** Parent folder id, or null for a root folder. Enables the hierarchical tree. */
	parentId: string | null;
}

export interface Card {
	id: string;
	folderId: string;
	title: string;
	url: string;
	favicon: string;
	thumbId: string | null;
	/** D3 compliance — "local" or "server" */
	origin: "local" | "server";
	/** D3 compliance — UNIX timestamp or null for local-only */
	capturedAt: number | null;
	order: number;
}

export interface ThumbnailCaptureSettings {
	enabled: boolean;
	delayMs: number;
}

export type WallpaperFrequency =
	| "per-tab"
	| "hourly"
	| "daily"
	| "daylight"
	| "locked";

export interface BackgroundSettings {
	type: "solid" | "gradient" | "image" | "pexels";
	color: string;
	gradientId: string | null;
	imageId: string | null;
	blur: number;
	brightness: number;
	opacity: number;
	pexelsQuery: string;
	pexelsFrequency: WallpaperFrequency;
	pexelsLastFetched: number | null;
	pexelsLastPeriod: "morning" | "afternoon" | "night" | null;
	pexelsImageId: string | null;
}

export interface ClockSettings {
	enabled: boolean;
	format24: boolean;
	showSeconds: boolean;
	analog: boolean;
	size: number;
	timezone: string;
	dateFormat: string;
}

export interface GreetingSettings {
	enabled: boolean;
	name: string;
}

export interface SearchSettings {
	enabled: boolean;
	engine: string;
	/**
	 * Placeholder text. When empty, the UI shows a dynamic default that names
	 * the active engine (e.g. `Buscar com "Google"`).
	 */
	placeholder: string;
	/** Leading glyph: the engine's own logo, or a classic magnifying glass. */
	iconMode: "engine" | "search";
}

/** Top-level look: rich CSS glass material vs flat shadcn surfaces. */
export type AppearanceMode = "liquid" | "classic";

/** Speed Dial display mode: full cards vs app-launcher icons. */
export type DialLayout = "card" | "icon";

/** Card shape in card layout. Vertical is taller than wide (Vivaldi-style). */
export type CardAspect = "square" | "horizontal" | "vertical";

export interface Settings {
	tileSize: "small" | "medium" | "large";
	maxColumns: number;
	showTitle: boolean;
	showDeleteButton: boolean;
	openInNewTab: boolean;
	iconRadius: number;
	/** Speed Dial display mode. */
	dialLayout: DialLayout;
	/** Card aspect ratio (card layout only). */
	cardAspect: CardAspect;
	/** Show the site title under the icon in icon layout. */
	iconShowLabel: boolean;
	thumbnailCapture: ThumbnailCaptureSettings;
	background: BackgroundSettings;
	clock: ClockSettings;
	greeting: GreetingSettings;
	search: SearchSettings;
	appearanceMode: AppearanceMode;
}

export interface Setup {
	folders: Folder[];
	cards: Card[];
	activeFolderId: string;
	settings: Settings;
}

/** A curated site shown in the "Recommended sites" section of the add-favorite dialog. */
export interface SiteSuggestion {
	name: string;
	url: string;
}

// ── SVGL API ─────────────────────────────────────────────────────────────────

export type SVGLThemeOptions = { dark: string; light: string };

export interface SVGLItem {
	id: number;
	title: string;
	category: string | string[];
	route: string | SVGLThemeOptions;
	url: string;
	wordmark?: string | SVGLThemeOptions;
	brandUrl?: string;
}
