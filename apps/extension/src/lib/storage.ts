import type { PersistStorage, StorageValue } from "zustand/middleware";
import type {
	BackgroundSettings,
	Card,
	CustomWallpaper,
	Folder,
	Setup,
	WallpaperFrequency,
} from "../types";
import { DEFAULT_SETUP, WALLPAPERS } from "./constants";
import { getDescendantIds } from "./folder-tree";

/**
 * Repair folder hierarchy: coerce every folder to include a valid parentId,
 * drop parent references that point to missing folders (orphans become roots),
 * and break any cycles so tree traversal always terminates.
 */
function normalizeFolders(rawFolders: Folder[]): Folder[] {
	const folders: Folder[] = rawFolders.map((f, i) => ({
		id: f.id,
		name: f.name,
		order: typeof f.order === "number" ? f.order : i,
		parentId: (f as Partial<Folder>).parentId ?? null,
	}));

	const ids = new Set(folders.map((f) => f.id));

	// Orphaned parents → root.
	for (const folder of folders) {
		if (folder.parentId && !ids.has(folder.parentId)) folder.parentId = null;
	}

	// Break cycles: if a folder is reachable from its own subtree, detach it.
	for (const folder of folders) {
		if (
			folder.parentId &&
			getDescendantIds(folders, folder.id).includes(folder.parentId)

		) {
			folder.parentId = null;
		}
	}

	return folders;
}
const VALID_WALLPAPER_IDS = new Set(WALLPAPERS.map((wallpaper) => wallpaper.id));
const VALID_FREQUENCIES: readonly WallpaperFrequency[] = [
	"per-tab",
	"hourly",
	"daily",
	"daylight",
	"locked",
];
const VALID_PERIODS = ["morning", "afternoon", "night"] as const;
type DaylightPeriod = (typeof VALID_PERIODS)[number];

function isDaylightPeriod(value: unknown): value is DaylightPeriod {
	return VALID_PERIODS.some((period) => period === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function isWallpaperFrequency(value: unknown): value is WallpaperFrequency {
	return (
		typeof value === "string" &&
		(VALID_FREQUENCIES as readonly string[]).includes(value)
	);
}

function normalizeId(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const id = value.trim();
	return id.length > 0 ? id : null;
}

function normalizeCustomWallpapers(raw: unknown): CustomWallpaper[] {
	if (!Array.isArray(raw)) return [];
	const seen = new Set<string>();
	const normalized: CustomWallpaper[] = [];
	for (const entry of raw) {
		if (!isRecord(entry)) continue;
		const id = normalizeId(entry.id);
		const name = normalizeId(entry.name);
		if (!id || !name || seen.has(id)) continue;
		seen.add(id);
		normalized.push({ id, name });
	}
	return normalized;
}

function normalizeBackground(
	rawValue: unknown,
	defaults: BackgroundSettings,
): BackgroundSettings {
	const raw = isRecord(rawValue) ? rawValue : {};
	const rawType = raw.type;
	const type =
		rawType === "solid" ||
		rawType === "gradient" ||
		rawType === "image" ||
		rawType === "pexels" ||
		rawType === "wallpaper"
			? rawType
			: null;
	const migratedUnsplash = rawType === "unsplash";
	const imageId = normalizeId(raw.imageId);
	const wallpaperId = normalizeId(raw.wallpaperId);
	const normalizedType =
		migratedUnsplash || type === null
			? migratedUnsplash
				? "pexels"
				: defaults.type
			: type;
	const incompleteImage = normalizedType === "image" && !imageId;
	const effectiveType = incompleteImage ? defaults.type : normalizedType;
	const normalizedWallpaperId =
		rawType === "wallpaper" &&
		effectiveType === "wallpaper" &&
		!incompleteImage &&
		wallpaperId &&
		VALID_WALLPAPER_IDS.has(wallpaperId)
			? wallpaperId
			: effectiveType === "wallpaper"
				? defaults.wallpaperId
				: null;
	const frequency = isWallpaperFrequency(raw.pexelsFrequency)
		? raw.pexelsFrequency
		: migratedUnsplash
			? "daily"
			: defaults.pexelsFrequency;
	const previousFrequency = isWallpaperFrequency(raw.pexelsPreviousFrequency)
		? raw.pexelsPreviousFrequency
		: null;
	const lastPeriod = isDaylightPeriod(raw.pexelsLastPeriod)
		? raw.pexelsLastPeriod
		: null;
	const finiteOrDefault = (
		value: unknown,
		fallback: number,
		min: number,
		max: number,
	): number => {
		if (!isFiniteNumber(value)) return fallback;
		return Math.min(max, Math.max(min, value));
	};

	return {
		type: effectiveType,
		color: typeof raw.color === "string" ? raw.color : defaults.color,
		gradientId: normalizeId(raw.gradientId),
		imageId: effectiveType === "image" ? imageId : null,
		wallpaperId: normalizedWallpaperId,
		customWallpapers: normalizeCustomWallpapers(raw.customWallpapers),
		blur: finiteOrDefault(raw.blur, defaults.blur, 0, 20),
		brightness: finiteOrDefault(raw.brightness, defaults.brightness, 40, 140),
		opacity: finiteOrDefault(raw.opacity, defaults.opacity, 20, 100),
		pexelsQuery:
			typeof raw.pexelsQuery === "string"
				? raw.pexelsQuery
				: defaults.pexelsQuery,
		pexelsFrequency: frequency,
		pexelsPreviousFrequency: previousFrequency,
		pexelsLastFetched:
			isFiniteNumber(raw.pexelsLastFetched) && raw.pexelsLastFetched >= 0
				? raw.pexelsLastFetched
				: null,
		pexelsLastPeriod: lastPeriod,
		pexelsImageId: normalizeId(raw.pexelsImageId),
	};
}

/**
 * Normalize raw state from chrome.storage.local, filling in missing keys
 * with defaults. Handles migration from the legacy format.
 */
export function normalizeState(
	rawState: Partial<Setup> | null | undefined,
): Setup {
	const source: Partial<Setup> = isRecord(rawState)
		? (rawState as Partial<Setup>)
		: {};
	const sourceSettings = isRecord(source.settings as unknown)
		? (source.settings as Partial<typeof DEFAULT_SETUP.settings>)
		: undefined;

	const defaults = structuredClone(DEFAULT_SETUP);

	const state: Setup = {
		...defaults,
		...source,
		folders:
			Array.isArray(source.folders) && source.folders.length > 0
				? normalizeFolders(source.folders)
				: structuredClone(defaults.folders),
		cards: Array.isArray(source.cards) ? source.cards : [],
		settings: {
			...defaults.settings,
			...sourceSettings,
			thumbnailCapture: {
				...defaults.settings.thumbnailCapture,
				...(sourceSettings?.thumbnailCapture ?? {}),
			},
			background: normalizeBackground(
				sourceSettings?.background,
				defaults.settings.background,
			),
			clock: {
				...defaults.settings.clock,
				...(sourceSettings?.clock ?? {}),
			},
			greeting: {
				...defaults.settings.greeting,
				...(sourceSettings?.greeting ?? {}),
			},
			search: {
				...defaults.settings.search,
				...(sourceSettings?.search ?? {}),
			},
		},
	};

	// Ensure activeFolderId is valid
	if (!state.folders.find((f) => f.id === state.activeFolderId)) {
		state.activeFolderId = state.folders[0]?.id || "default";
	}

	// Migrate cards to include origin/capturedAt fields
	state.cards = state.cards.map(
		(card): Card => ({
			...card,
			origin:
				(card as Card & Record<string, unknown>).origin ?? ("local" as const),
			capturedAt:
				(card as Card & Record<string, unknown>).capturedAt ??
				(null as number | null),
		}),
	);

	return state;
}

// --- Coalesced persist ---

let _pendingSetItem: { name: string; value: StorageValue<Setup> } | null = null;
let _pendingResolvers: Array<() => void> = [];
let _setItemTimer: ReturnType<typeof setTimeout> | null = null;
let _inFlightWrite: Promise<void> | null = null;
let _lastWrittenJSON: string | null = null;

function _doWrite(name: string, value: StorageValue<Setup>): Promise<void> {
	const json = JSON.stringify(value);
	const previous = _inFlightWrite ?? Promise.resolve();
	const write = previous
		.catch(() => undefined)
		.then(() => chrome.storage.local.set({ [name]: json }))
		.then(() => {
			_lastWrittenJSON = json;
		});
	const tracked = write.finally(() => {
		if (_inFlightWrite === tracked) _inFlightWrite = null;
	});
	_inFlightWrite = tracked;
	return tracked;
}

/**
 * Immediately flush any pending coalesced write to chrome.storage.
 * Returns a promise that resolves when the write completes.
 */
export function flushPersist(): Promise<void> {
	if (_setItemTimer) clearTimeout(_setItemTimer);
	_setItemTimer = null;
	const snap = _pendingSetItem;
	_pendingSetItem = null;
	const resolvers = _pendingResolvers;
	_pendingResolvers = [];
	if (!snap) return _inFlightWrite ?? Promise.resolve();
	const write = _doWrite(snap.name, snap.value);
	write.then(
		() => {
			resolvers.forEach((resolve) => {
				resolve();
			});
		},
		() => {
			resolvers.forEach((resolve) => {
				resolve();
			});
		},
	);
	return write;
}

/**
 * Cancel queued writes and wait for all writes already in the write chain.
 * Reset uses this narrow boundary before deleting persisted state.
 */
export async function cancelPendingPersist(): Promise<void> {
	if (_setItemTimer) clearTimeout(_setItemTimer);
	_setItemTimer = null;
	_pendingSetItem = null;
	const resolvers = _pendingResolvers;
	_pendingResolvers = [];
	resolvers.forEach((resolve) => {
		resolve();
	});
	while (_inFlightWrite) {
		const inFlight = _inFlightWrite;
		await inFlight.catch(() => undefined);
	}
}

/**
 * Returns the JSON string of the last successfully completed write,
 * used by the cross-tab sync guard to detect our own echoes.
 */
export function getLastWrittenJSON(): string | null {
	return _lastWrittenJSON;
}

// Flush pending writes before the tab closes or hides.
if (typeof window !== "undefined") {
	const onFlush = () => {
		flushPersist();
	};
	window.addEventListener("beforeunload", onFlush);
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") flushPersist();
	});
}

/**
 * Zustand persist storage adapter backed by chrome.storage.local.
 * Uses chrome.* API directly since it's always available in extension pages.
 *
 * Writes are coalesced — rapid setItem calls are debounced so only the
 * latest snapshot is persisted. Call `flushPersist()` to force an
 * immediate write (e.g. on slider release).
 */
export const chromeStorageAdapter: PersistStorage<Setup> = {
	getItem: async (name: string): Promise<StorageValue<Setup> | null> => {
		const data = await chrome.storage.local.get(name);
		if (!data[name]) return null;
		const parsed = JSON.parse(data[name] as string) as StorageValue<Setup>;
		parsed.state = normalizeState(parsed.state as Partial<Setup>);
		return parsed;
	},
	setItem: (name: string, value: StorageValue<Setup>): Promise<void> => {
		_pendingSetItem = { name, value };
		if (_setItemTimer) clearTimeout(_setItemTimer);
		return new Promise((resolve) => {
			_pendingResolvers.push(resolve);
			_setItemTimer = setTimeout(() => {
				const snap = _pendingSetItem;
				_pendingSetItem = null;
				_setItemTimer = null;
				const resolvers = _pendingResolvers;
				_pendingResolvers = [];
				if (!snap) {
					resolvers.forEach((pendingResolve) => {
						pendingResolve();
					});
					return;
				}
				_doWrite(snap.name, snap.value).then(
					() => {
						resolvers.forEach((pendingResolve) => {
							pendingResolve();
						});
					},
					(err) => {
						console.warn("[perch] chrome.storage.local.set failed", err);
						resolvers.forEach((pendingResolve) => {
							pendingResolve();
						});
					},
				);
			}, 200);
		});
	},
	removeItem: async (name: string): Promise<void> => {
		await chrome.storage.local.remove(name);
	},
};
