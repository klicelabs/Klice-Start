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
