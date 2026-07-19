import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { TILE_SIZE_DIMENSIONS } from "./constants";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function uid(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function clampInt(
	value: number,
	min: number,
	max: number,
	fallback: number,
): number {
	const n = Number.isFinite(value) ? Math.round(value) : fallback;
	return n < min ? min : n > max ? max : n;
}

export function safeTileSize(value: string): "small" | "medium" | "large" {
	return TILE_SIZE_DIMENSIONS[value]
		? (value as "small" | "medium" | "large")
		: "medium";
}

export function cssUrl(value: string): string {
	return `url("${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;
}

export function colorFromString(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++)
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
	const hue = Math.abs(hash) % 360;
	return `linear-gradient(135deg, hsl(${hue},55%,32%), hsl(${(hue + 40) % 360},55%,20%))`;
}

/**
 * Soft, deeply-muted gradient for preview-less cards. Low saturation + low
 * lightness so the placeholder blends into a dark wallpaper instead of reading
 * as a saturated color block. Deterministic per URL (stable across renders).
 */
export function softGradientFromString(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++)
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
	const hue = Math.abs(hash) % 360;
	const hue2 = (hue + 28) % 360;
	// Diagonal wash from a muted mid-dark tint into near-black, so it melts into
	// the background rather than sitting on top of it.
	return `linear-gradient(150deg, hsl(${hue}, 24%, 26%) 0%, hsl(${hue2}, 20%, 15%) 55%, hsl(${hue2}, 16%, 9%) 100%)`;
}
