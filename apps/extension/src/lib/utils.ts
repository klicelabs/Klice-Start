import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { TILE_SIZE_DIMENSIONS } from "./constants";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Collision-resistant id (H12): the legacy form had ~31 bits of timestamped
 * entropy and imported thousands of entities within the same millisecond,
 * so two ids could alias and silently drop entities. Crypto randomness is
 * always available in extension contexts (and in every modern browser),
 * with a Math.random fallback for hardened environments.
 */
export function uid(): string {
	const cryptoObj = globalThis.crypto;
	if (typeof cryptoObj?.randomUUID === "function") {
		return cryptoObj.randomUUID();
	}
	if (typeof cryptoObj?.getRandomValues === "function") {
		const bytes = new Uint8Array(9);
		cryptoObj.getRandomValues(bytes);
		let binary = "";
		for (const byte of bytes) binary += byte.toString(36).padStart(2, "0");
		return binary;
	}
	// Fallback (legacy entropy + wider random slice); callers that import in
	// bulk additionally dedupe by id downstream.
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
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
