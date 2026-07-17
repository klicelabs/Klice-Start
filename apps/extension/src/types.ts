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

export interface BackgroundSettings {
	type: "solid" | "gradient" | "image";
	color: string;
	gradientId: string | null;
	imageId: string | null;
	blur: number;
	brightness: number;
	opacity: number;
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
}

export interface Settings {
	tileSize: "small" | "medium" | "large";
	maxColumns: number;
	showTitle: boolean;
	showDeleteButton: boolean;
	openInNewTab: boolean;
	iconRadius: number;
	thumbnailCapture: ThumbnailCaptureSettings;
	background: BackgroundSettings;
	clock: ClockSettings;
	greeting: GreetingSettings;
	search: SearchSettings;
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
