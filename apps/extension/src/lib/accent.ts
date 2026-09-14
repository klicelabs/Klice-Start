import type { AccentColor } from "../types";

export interface AccentDefinition {
	id: AccentColor;
	label: string;
	light: string;
	dark: string;
	foreground: string;
	rgb: string;
}

/**
 * Semantic interaction colors only. Materials, wallpapers and decorative
 * artwork keep their own palettes; this map owns the emphasis layer.
 */
export const ACCENT_COLORS: Record<AccentColor, AccentDefinition> = {
	blue: {
		id: "blue",
		label: "Blue",
		light: "#007aff",
		dark: "#0a84ff",
		foreground: "#ffffff",
		rgb: "0 122 255",
	},
	yellow: {
		id: "yellow",
		label: "Yellow",
		light: "#d99b00",
		dark: "#ffd60a",
		foreground: "#1c1c1e",
		rgb: "255 214 10",
	},
	green: {
		id: "green",
		label: "Green",
		light: "#249a4a",
		dark: "#30d158",
		foreground: "#ffffff",
		rgb: "48 209 88",
	},
	purple: {
		id: "purple",
		label: "Purple",
		light: "#9b3dc4",
		dark: "#bf5af2",
		foreground: "#ffffff",
		rgb: "191 90 242",
	},
	pink: {
		id: "pink",
		label: "Pink",
		light: "#e52c58",
		dark: "#ff6482",
		foreground: "#ffffff",
		rgb: "255 100 130",
	},
};

export const ACCENT_OPTIONS = Object.values(ACCENT_COLORS);
