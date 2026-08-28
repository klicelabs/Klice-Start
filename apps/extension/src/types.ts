export interface Folder {
	id: string;
	name: string;
	order: number;
	parentId?: string | null;
}

export interface Card {
	id: string;
	folderId: string;
	title: string;
	url: string;
	favicon: string | null;
	thumbId: string | null;
	order: number;
	/** "local" for user-created cards, "browser" for imported cards. */
	origin?: "local" | "browser";
	/** Timestamp (ms) when thumbnail was captured by background script. */
	capturedAt?: number | null;
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

export interface CustomWallpaper {
	id: string;
	name: string;
}

export interface BackgroundSettings {
	type: "solid" | "gradient" | "image" | "pexels" | "wallpaper";
	color: string;
	gradientId: string | null;
	imageId: string | null;
	wallpaperId: string | null;
	customWallpapers?: CustomWallpaper[];
	blur: number;
	brightness: number;
	opacity: number;
	pexelsQuery: string;
	pexelsFrequency: WallpaperFrequency;
	/** Previous frequency saved before locking — restored on unlock. */
	pexelsPreviousFrequency: WallpaperFrequency | null;
	pexelsLastFetched: number | null;
	pexelsLastPeriod: "morning" | "afternoon" | "night" | null;
	pexelsImageId: string | null;
}

export interface ClockSettings {
	enabled: boolean;
	format24: boolean;
	showSeconds: boolean;
	size: number;
	timezone: string;
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
	 * the active engine (e.g. `Search with "Google"`).
	 */
	placeholder: string;
	/** Leading glyph: the engine's own logo, or a classic magnifying glass. */
	iconMode: "engine" | "search";
}

/** Top-level look: rich CSS glass material vs flat surfaces. */
export type AppearanceMode = "liquid" | "classic";

/** System appearance mode: follow system or explicit light/dark. */
export type ColorScheme = "auto" | "light" | "dark";

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
	colorScheme: ColorScheme;
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
}
