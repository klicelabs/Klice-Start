import type { PersistStorage, StorageValue } from "zustand/middleware";
import type {
	AppearanceMode,
	BackgroundSettings,
	Card,
	CustomWallpaper,
	Folder,
	Setup,
	WallpaperFrequency,
} from "../types";
import { DEFAULT_SETUP, WALLPAPERS } from "./constants";
import { getDescendantIds } from "./folder-tree";
import { buildItemOrder, repairItemOrder } from "./item-order";
import { isAbsoluteHttpUrl } from "./url";

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
const VALID_WALLPAPER_IDS = new Set(
	WALLPAPERS.map((wallpaper) => wallpaper.id),
);
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

function normalizeAppearanceMode(
	value: unknown,
	fallback: AppearanceMode,
): AppearanceMode {
	if (value === "liquid") return "liquid";
	if (value === "classic" || value === "flat") return "classic";
	return fallback;
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
			appearanceMode: normalizeAppearanceMode(
				sourceSettings?.appearanceMode,
				defaults.settings.appearanceMode,
			),
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
	state.cards = state.cards
		.filter(
			(card) =>
				isRecord(card) &&
				typeof card.url === "string" &&
				isAbsoluteHttpUrl(card.url),
		)
		.map(
			(card): Card => ({
				...card,
				origin:
					(card as Card & Record<string, unknown>).origin ?? ("local" as const),
				capturedAt:
					(card as Card & Record<string, unknown>).capturedAt ??
					(null as number | null),
			}),
		);

	// Migrate to the unified item-order model. Legacy payloads have no
	// `itemOrder`; backfill folders-first so existing installs see no change.
	// Runs after card filtering so no key can dangle at a dropped card.
	state.itemOrder =
		source.itemOrder !== undefined
			? repairItemOrder(source.itemOrder, state.folders, state.cards)
			: buildItemOrder(state.folders, state.cards);

	return state;
}

// --- Coalesced persist ---

// Persistent keys from the Perch era — kept verbatim so existing installs
// keep their data after the rename to Klice Start.
export const RESET_GENERATION_KEY = "perch-reset-generation";
export const PERSIST_GENERATION_KEY = "__perchResetGeneration";

function normalizeResetGeneration(value: unknown): number {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
		? value
		: 0;
}

let _resetGeneration = 0;
let _resetGenerationLoaded = true;
let _resetGenerationReady = Promise.resolve();
if (typeof chrome !== "undefined" && chrome.storage?.local) {
	_resetGenerationLoaded = false;
	_resetGenerationReady = chrome.storage.local
		.get(RESET_GENERATION_KEY)
		.then((data) => {
			_resetGeneration = normalizeResetGeneration(data[RESET_GENERATION_KEY]);
		})
		.catch(() => undefined)
		.finally(() => {
			_resetGenerationLoaded = true;
		});
	chrome.storage.onChanged?.addListener((changes, area) => {
		if (area !== "local") return;
		const next = normalizeResetGeneration(
			changes[RESET_GENERATION_KEY]?.newValue,
		);
		if (next > _resetGeneration) _resetGeneration = next;
	});
}

interface PendingSetItem {
	name: string;
	value: StorageValue<Setup>;
	generation: number;
}

let _pendingSetItem: PendingSetItem | null = null;
let _pendingResolvers: Array<() => void> = [];
let _setItemTimer: ReturnType<typeof setTimeout> | null = null;
let _inFlightWrite: Promise<void> | null = null;
let _lastWrittenJSON: string | null = null;

function _doWrite(
	name: string,
	value: StorageValue<Setup>,
	generation: number,
): Promise<void> {
	const json = JSON.stringify({
		...value,
		[PERSIST_GENERATION_KEY]: generation,
	});
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
	if (!_resetGenerationLoaded) {
		return _resetGenerationReady.then(() => flushPersist());
	}
	if (_setItemTimer) clearTimeout(_setItemTimer);
	_setItemTimer = null;
	const snap = _pendingSetItem;
	_pendingSetItem = null;
	const resolvers = _pendingResolvers;
	_pendingResolvers = [];
	if (!snap) return _inFlightWrite ?? Promise.resolve();
	const write = _doWrite(snap.name, snap.value, snap.generation);
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
	await _resetGenerationReady;
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

/** Advance the shared reset barrier before deleting persisted setup data. */
export async function beginReset(): Promise<void> {
	await _resetGenerationReady;
	const next = _resetGeneration + 1;
	await chrome.storage.local.set({ [RESET_GENERATION_KEY]: next });
	_resetGeneration = next;
}

export function getResetGeneration(): number {
	return _resetGeneration;
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
		if (typeof chrome === "undefined" || !chrome.storage?.local) {
			const raw =
				typeof localStorage !== "undefined" ? localStorage.getItem(name) : null;
			if (!raw) return null;
			try {
				const parsed = JSON.parse(raw) as StorageValue<Setup>;
				parsed.state = normalizeState(parsed.state as Partial<Setup>);
				return parsed;
			} catch {
				return null;
			}
		}
		const data = await chrome.storage.local.get([name, RESET_GENERATION_KEY]);
		if (!data[name]) return null;
		const resetGeneration = normalizeResetGeneration(
			data[RESET_GENERATION_KEY],
		);
		_resetGeneration = Math.max(_resetGeneration, resetGeneration);
		const parsed = JSON.parse(data[name] as string) as StorageValue<Setup> &
			Record<string, unknown>;
		const persistedGeneration = normalizeResetGeneration(
			parsed[PERSIST_GENERATION_KEY],
		);
		if (persistedGeneration < resetGeneration) return null;
		delete parsed[PERSIST_GENERATION_KEY];
		parsed.state = normalizeState(parsed.state as Partial<Setup>);
		return parsed;
	},
	setItem: async (name: string, value: StorageValue<Setup>): Promise<void> => {
		if (typeof chrome === "undefined" || !chrome.storage?.local) {
			if (typeof localStorage !== "undefined") {
				localStorage.setItem(name, JSON.stringify(value));
			}
			return;
		}
		await _resetGenerationReady;
		_pendingSetItem = { name, value, generation: _resetGeneration };
		if (_setItemTimer) clearTimeout(_setItemTimer);
		const { promise, resolve } = Promise.withResolvers<void>();
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
			_doWrite(snap.name, snap.value, snap.generation).then(
				() => {
					resolvers.forEach((pendingResolve) => {
						pendingResolve();
					});
				},
				() => {
					console.warn("[klice-start] chrome.storage.local.set failed");
					resolvers.forEach((pendingResolve) => {
						pendingResolve();
					});
				},
			);
		}, 200);
		return promise;
	},
	removeItem: async (name: string): Promise<void> => {
		if (typeof chrome === "undefined" || !chrome.storage?.local) {
			if (typeof localStorage !== "undefined") {
				localStorage.removeItem(name);
			}
			return;
		}
		await chrome.storage.local.remove(name);
	},
};
