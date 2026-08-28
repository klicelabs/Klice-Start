import type { SVGLItem, SVGLThemeOptions } from "../types";

const SVGL_API = "https://api.svgl.app";
const CACHE_KEY = "svgl:index";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
	data: SVGLItem[];
	timestamp: number;
}

// ── In-memory cache (fast path, survives only this session) ─────────────────

let inMemoryCache: SVGLItem[] | null = null;
let inMemoryTimestamp = 0;

// ── chrome.storage.session helpers ──────────────────────────────────────────

// chrome.storage.session is available from Chrome 104+. Cast to bypass strict
// typing when the WXT / @types/chrome version does not include it yet.
const sessionStorage = (chrome.storage as Record<string, unknown>).session as {
	get(keys: string | string[] | Record<string, unknown>): Promise<Record<string, unknown>>;
	set(items: Record<string, unknown>): Promise<void>;
	remove(keys: string | string[]): Promise<void>;
};

async function readCache(): Promise<CacheEntry | null> {
	try {
		const result = await sessionStorage.get(CACHE_KEY);
		return (result[CACHE_KEY] as CacheEntry) ?? null;
	} catch {
		return null;
	}
}

async function writeCache(entry: CacheEntry): Promise<void> {
	try {
		await sessionStorage.set({ [CACHE_KEY]: entry });
	} catch {
		// sessionStorage not available (e.g. non‑extension context) — silent
	}
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetches the full SVGL catalogue **metadata** (JSON) once and caches it.
 * Subsequent calls return instantly from cache.
 *
 * This does NOT fetch the actual SVG XML — call `getSvgXml()` for that.
 */
export async function fetchAllSvgs(): Promise<SVGLItem[]> {
	const now = Date.now();

	// 1. In-memory hot path
	if (inMemoryCache && now - inMemoryTimestamp < CACHE_TTL) {
		return inMemoryCache;
	}

	// 2. chrome.storage.session warm path
	const cached = await readCache();
	if (cached && now - cached.timestamp < CACHE_TTL) {
		inMemoryCache = cached.data;
		inMemoryTimestamp = cached.timestamp;
		return cached.data;
	}

	// 3. Network fetch
	const res = await fetch(`${SVGL_API}/`);
	if (!res.ok) {
		throw new Error(`SVGL API error: ${res.status}`);
	}
	const data = (await res.json()) as SVGLItem[];

	// Populate both caches
	inMemoryCache = data;
	inMemoryTimestamp = now;
	await writeCache({ data, timestamp: now });

	return data;
}

/**
 * Finds a single SVGL item by its `title` (case‑insensitive).
 * Returns `null` when not found.
 */
export async function getSvgByTitle(
	title: string,
): Promise<SVGLItem | null> {
	const all = await fetchAllSvgs();
	const query = title.toLowerCase();
	return all.find((item) => item.title.toLowerCase() === query) ?? null;
}

/**
 * Resolves the SVG **URL** from an item's `route`, respecting theme variants.
 *
 * SVGL's `dark` / `light` refers to the background colour the SVG was designed
 * for (dark background → light/white paths). Klice Start is always dark‑themed, so
 * we prefer `dark` when available. Pass `forceLight: true` to override.
 */
export function resolveRoute(
	item: SVGLItem,
	forceLight = false,
): string {
	if (typeof item.route === "string") return item.route;
	const theme = item.route as SVGLThemeOptions;
	return forceLight ? theme.light : theme.dark;
}

/**
 * Fetches the raw SVG **XML** for a given brand title.
 *
 * Uses the cache index for metadata, then lazily fetches the SVG from its
 * resolved route URL. Returns `null` when the brand isn't found or the fetch
 * fails.
 */
export async function getSvgXml(
	title: string,
	forceLight = false,
): Promise<string | null> {
	const item = await getSvgByTitle(title);
	if (!item) return null;

	const url = resolveRoute(item, forceLight);
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		return await res.text();
	} catch {
		return null;
	}
}

/**
 * Clears both in‑memory and persisted caches. Useful for testing or when the
 * user explicitly requests a refresh.
 */
export async function clearSvgCache(): Promise<void> {
	inMemoryCache = null;
	inMemoryTimestamp = 0;
	try {
		await sessionStorage.remove(CACHE_KEY);
	} catch {
		// silent
	}
}
