import type { PersistStorage, StorageValue } from "zustand/middleware";
import type { Card, Folder, Setup } from "../types";
import { DEFAULT_SETUP } from "./constants";
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

/**
 * Normalize raw state from chrome.storage.local, filling in missing keys
 * with defaults. Handles migration from the legacy format.
 */
export function normalizeState(
	rawState: Partial<Setup> | null | undefined,
): Setup {
	const source: Partial<Setup> = rawState || {};
	const sourceSettings = source.settings as
		| Partial<typeof DEFAULT_SETUP.settings>
		| undefined;

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
			background: {
				...defaults.settings.background,
				...(sourceSettings?.background ?? {}),
			},
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

/**
 * Zustand persist storage adapter backed by chrome.storage.local.
 * Uses chrome.* API directly since it's always available in extension pages.
 */
export const chromeStorageAdapter: PersistStorage<Setup> = {
	getItem: async (name: string): Promise<StorageValue<Setup> | null> => {
		const data = await chrome.storage.local.get(name);
		if (!data[name]) return null;
		const parsed = JSON.parse(data[name] as string) as StorageValue<Setup>;
		parsed.state = normalizeState(parsed.state as Partial<Setup>);
		return parsed;
	},
	setItem: async (name: string, value: StorageValue<Setup>): Promise<void> => {
		await chrome.storage.local.set({ [name]: JSON.stringify(value) });
	},
	removeItem: async (name: string): Promise<void> => {
		await chrome.storage.local.remove(name);
	},
};
