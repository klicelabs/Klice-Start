import type { BackgroundSettings } from "../types";
import { WALLPAPERS } from "./constants";
import { cssUrl } from "./utils";

/**
 * Read-fast localStorage mirror of the wallpaper choice.
 *
 * Problem: a new tab paints the default wallpaper, then swaps to the stored
 * one once chrome.storage.local.get resolves and Zustand rehydrates
 * (the commit1→commit2 window). The mirror lets main.tsx paint frame 1
 * with the right wallpaper before React mounts.
 *
 * Contract: chrome.storage.local is the source of truth. The mirror is
 * written on the same tick as the coalesced chrome write (_doWrite) and
 * read once before createRoot().render(). If they ever diverge, storage
 * wins as soon as it resolves.
 */
export const WALLPAPER_SNAPSHOT_KEY = "wallpaper-snapshot";

export type WallpaperSnapshot =
	| { type: "bundled"; id: string }
	| { type: "custom"; id: string }
	| { type: "solid"; color: string };

/** Only strict hex colours may reach a <style> payload (stored data is untrusted). */
const HEX_COLOR = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;

/** Derive the mirror value. Returns null when there is nothing worth mirroring. */
export function snapshotFromBackground(bg: unknown): WallpaperSnapshot | null {
	if (!bg || typeof bg !== "object") return null;
	const b = bg as Partial<BackgroundSettings>;
	if (
		b.type === "wallpaper" &&
		typeof b.wallpaperId === "string" &&
		WALLPAPERS.some((w) => w.id === b.wallpaperId)
	) {
		return { type: "bundled", id: b.wallpaperId };
	}
	if (
		b.type === "solid" &&
		typeof b.color === "string" &&
		HEX_COLOR.test(b.color)
	) {
		return { type: "solid", color: b.color };
	}
	// NOTE (polish/wallpaper-flash): custom/image maps to a neutral surface
	// in a follow-up commit; gradient/pexels keep no mirror (status quo ante).
	return null;
}

/** Best-effort write. Never throws — it must not break the real persist write. */
export function writeWallpaperSnapshot(bg: unknown): void {
	try {
		if (typeof localStorage === "undefined") return;
		const snap = snapshotFromBackground(bg);
		if (snap) localStorage.setItem(WALLPAPER_SNAPSHOT_KEY, JSON.stringify(snap));
		else localStorage.removeItem(WALLPAPER_SNAPSHOT_KEY);
	} catch {
		// Mirror is best-effort only.
	}
}

function isSnapshot(value: unknown): value is WallpaperSnapshot {
	if (!value || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	if (v.type === "bundled" || v.type === "custom") {
		return typeof v.id === "string" && v.id.length > 0;
	}
	if (v.type === "solid") {
		return typeof v.color === "string" && HEX_COLOR.test(v.color);
	}
	return false;
}

/** Strict read. Empty (first run) or malformed → null → default first paint. */
export function readWallpaperSnapshot(): WallpaperSnapshot | null {
	try {
		if (typeof localStorage === "undefined") return null;
		const raw = localStorage.getItem(WALLPAPER_SNAPSHOT_KEY);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		return isSnapshot(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

/** CSS `background` value for frame 1. Unknown bundled id → null (default path). */
export function snapshotToCss(snap: WallpaperSnapshot): string | null {
	if (snap.type === "solid") return snap.color;
	if (snap.type === "bundled") {
		const w = WALLPAPERS.find((x) => x.id === snap.id);
		return w ? `${cssUrl(w.src)} center / cover no-repeat` : null;
	}
	return null;
}
