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

// ── Safe storage helpers (Chrome 104+ session -> local fallback) ───────────

function getStorage() {
	if (typeof chrome !== "undefined" && chrome.storage) {
		const s = (chrome.storage as Record<string, unknown>).session;
		if (s) {
			return s as {
				get(keys: string | string[] | Record<string, unknown>): Promise<Record<string, unknown>>;
				set(items: Record<string, unknown>): Promise<void>;
				remove(keys: string | string[]): Promise<void>;
			};
		}
		if (chrome.storage.local) {
			return chrome.storage.local;
		}
	}
	return null;
}

async function readCache(): Promise<CacheEntry | null> {
	try {
		const storage = getStorage();
		if (!storage) return null;
		const result = await storage.get(CACHE_KEY);
		return (result[CACHE_KEY] as CacheEntry) ?? null;
	} catch {
		return null;
	}
}

async function writeCache(entry: CacheEntry): Promise<void> {
	try {
		const storage = getStorage();
		if (!storage) return;
		await storage.set({ [CACHE_KEY]: entry });
	} catch {
		// storage not available — silent
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

	// 2. Storage warm path
	const cached = await readCache();
	if (cached && now - cached.timestamp < CACHE_TTL) {
		inMemoryCache = cached.data;
		inMemoryTimestamp = cached.timestamp;
		return cached.data;
	}

	// 3. Network fetch
	try {
		const res = await fetch(SVGL_API);
		if (!res.ok) throw new Error(`SVGL API error: ${res.status}`);
		const data = (await res.json()) as SVGLItem[];
		inMemoryCache = data;
		inMemoryTimestamp = now;
		void writeCache({ data, timestamp: now });
		return data;
	} catch (err) {
		// Network failed — return stale cache if we have it
		if (cached) return cached.data;
		throw err;
	}
}

/**
 * Given an SVGL title (e.g. "Google", "GitHub"), returns the raw SVG XML
 * string, or `null` if not found / fetch fails.
 *
 * Theme handling: if the SVG provides separate dark/light variants,
 * we pick the dark variant by default (Speed Dial is a dark canvas),
 * or the light variant if `forceLight` is true.
 */
export async function getSvgXml(
	title: string,
	forceLight = false,
): Promise<string | null> {
	try {
		const all = await fetchAllSvgs();
		const item = all.find((x) => x.title.toLowerCase() === title.toLowerCase());
		if (!item) return null;

		// Resolve route URL
		let route: string | undefined;
		if (typeof item.route === "string") {
			route = item.route;
		} else if (item.route && typeof item.route === "object") {
			const theme = item.route as SVGLThemeOptions;
			route = forceLight ? theme.light || theme.dark : theme.dark || theme.light;
		}

		if (!route) return null;

		const res = await fetch(route);
		if (!res.ok) return null;
		return await res.text();
	} catch {
		return null;
	}
}
