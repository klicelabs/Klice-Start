import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
	DEFAULT_SETTINGS,
	GRID_GAP_PX,
	GRID_PADDING_X_PX,
	MAX_COLUMNS,
	MIN_COLUMNS,
	TILE_SIZE_DIMENSIONS,
} from "../lib/constants";
import { getSubtreeIds, wouldCreateCycle } from "../lib/folder-tree";
import { chromeStorageAdapter, normalizeState } from "../lib/storage";
import { clampInt, uid as generateId, safeTileSize } from "../lib/utils";
import type { Card, Folder, Settings, Setup } from "../types";
import { useImageStore } from "./image-store";

interface SetupActions {
	addFolder: (name: string, parentId?: string | null) => string;
	updateFolder: (id: string, name: string) => void;
	moveFolder: (id: string, parentId: string | null) => void;
	deleteFolder: (id: string) => void;
	reorderFolders: (draggedId: string, targetId: string) => void;
	setActiveFolder: (id: string) => void;
	addCard: (
		card: Omit<Card, "id" | "order" | "origin" | "capturedAt">,
	) => string;
	updateCard: (id: string, changes: Partial<Card>) => void;
	moveCard: (id: string, folderId: string) => void;
	deleteCard: (id: string) => void;
	reorderCardsInActiveFolder: (draggedId: string, targetId: string) => void;
	updateSettings: (changes: Partial<Settings>) => void;
	updateBackground: (changes: Partial<Settings["background"]>) => void;
	updateClock: (changes: Partial<Settings["clock"]>) => void;
	updateGreeting: (changes: Partial<Settings["greeting"]>) => void;
	updateSearch: (changes: Partial<Settings["search"]>) => void;
	updateThumbnailCapture: (
		changes: Partial<Settings["thumbnailCapture"]>,
	) => void;
	replaceSetup: (setup: Setup) => void;
	resetAll: () => Promise<void>;
}

export type SetupStore = Setup & SetupActions;

/** Next sibling order for a folder being appended under `parentId`. */
function nextFolderOrder(folders: Folder[], parentId: string | null): number {
	const siblings = folders.filter((f) => (f.parentId ?? null) === parentId);
	return siblings.length;
}

export const useSetupStore = create<SetupStore>()(
	persist(
		(set, get) => ({
			...normalizeState(null),

			addFolder: (name, parentId = null) => {
				const id = generateId();
				set((s) => ({
					folders: [
						...s.folders,
						{ id, name, order: nextFolderOrder(s.folders, parentId), parentId },
					],
				}));
				return id;
			},

			updateFolder: (id, name) =>
				set((s) => ({
					folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)),
				})),

			moveFolder: (id, parentId) =>
				set((s) => {
					if (id === parentId) return {};
					if (wouldCreateCycle(s.folders, id, parentId)) return {};
					return {
						folders: s.folders.map((f) =>
							f.id === id
								? {
										...f,
										parentId,
										order: nextFolderOrder(s.folders, parentId),
									}
								: f,
						),
					};
				}),

			deleteFolder: (id) =>
				set((s) => {
					// Never delete the last remaining root folder.
					const roots = s.folders.filter((f) => (f.parentId ?? null) === null);
					const target = s.folders.find((f) => f.id === id);
					if (!target) return {};
					if ((target.parentId ?? null) === null && roots.length <= 1)
						return {};

					const removedFolderIds = new Set(getSubtreeIds(s.folders, id));
					for (const c of s.cards) {
						if (removedFolderIds.has(c.folderId) && c.thumbId) {
							useImageStore.getState().deleteThumbnail(c.thumbId);
						}
					}
					const remainingFolders = s.folders.filter(
						(f) => !removedFolderIds.has(f.id),
					);
					const nextActive = removedFolderIds.has(s.activeFolderId)
						? target.parentId &&
							remainingFolders.some((f) => f.id === target.parentId)
							? target.parentId
							: remainingFolders.find((f) => (f.parentId ?? null) === null)
									?.id ||
								remainingFolders[0]?.id ||
								"default"
						: s.activeFolderId;

					return {
						folders: remainingFolders,
						cards: s.cards.filter((c) => !removedFolderIds.has(c.folderId)),
						activeFolderId: nextActive,
					};
				}),

			reorderFolders: (draggedId, targetId) =>
				set((s) => {
					const dragged = s.folders.find((f) => f.id === draggedId);
					const target = s.folders.find((f) => f.id === targetId);
					if (!dragged || !target) return {};
					// Only reorder within the same parent; cross-parent moves use moveFolder.
					if ((dragged.parentId ?? null) !== (target.parentId ?? null))
						return {};

					const siblings = s.folders
						.filter((f) => (f.parentId ?? null) === (dragged.parentId ?? null))
						.sort((a, b) => a.order - b.order);
					const from = siblings.findIndex((f) => f.id === draggedId);
					const to = siblings.findIndex((f) => f.id === targetId);
					if (from === -1 || to === -1) return {};
					const [moved] = siblings.splice(from, 1);
					siblings.splice(to, 0, moved);
					const orderById = new Map(siblings.map((f, i) => [f.id, i]));
					return {
						folders: s.folders.map((f) =>
							orderById.has(f.id) ? { ...f, order: orderById.get(f.id)! } : f,
						),
					};
				}),

			setActiveFolder: (id) => set({ activeFolderId: id }),

			addCard: (partial) => {
				const state = get();
				const id = generateId();
				const cardsInFolder = state.cards.filter(
					(c) => c.folderId === partial.folderId,
				);
				const card: Card = {
					...partial,
					id,
					order: cardsInFolder.length,
					origin: "local",
					capturedAt: null,
				};
				set((s) => ({ cards: [...s.cards, card] }));
				return id;
			},

			updateCard: (id, changes) =>
				set((s) => ({
					cards: s.cards.map((c) => (c.id === id ? { ...c, ...changes } : c)),
				})),

			moveCard: (id, folderId) =>
				set((s) => {
					const card = s.cards.find((c) => c.id === id);
					if (!card || card.folderId === folderId) return {};
					const order = s.cards.filter((c) => c.folderId === folderId).length;
					return {
						cards: s.cards.map((c) =>
							c.id === id ? { ...c, folderId, order } : c,
						),
					};
				}),

			deleteCard: (id) =>
				set((s) => {
					const card = s.cards.find((c) => c.id === id);
					if (card?.thumbId)
						useImageStore.getState().deleteThumbnail(card.thumbId);
					return { cards: s.cards.filter((c) => c.id !== id) };
				}),

			reorderCardsInActiveFolder: (draggedId, targetId) =>
				set((s) => {
					const list = s.cards
						.filter((c) => c.folderId === s.activeFolderId)
						.sort((a, b) => a.order - b.order);
					const from = list.findIndex((c) => c.id === draggedId);
					const to = list.findIndex((c) => c.id === targetId);
					if (from === -1 || to === -1) return {};
					const [moved] = list.splice(from, 1);
					list.splice(to, 0, moved);
					const orderById = new Map(list.map((c, i) => [c.id, i]));
					return {
						cards: s.cards.map((c) =>
							orderById.has(c.id) ? { ...c, order: orderById.get(c.id)! } : c,
						),
					};
				}),

			updateSettings: (changes) =>
				set((s) => ({ settings: { ...s.settings, ...changes } })),

			updateBackground: (changes) =>
				set((s) => ({
					settings: {
						...s.settings,
						background: { ...s.settings.background, ...changes },
					},
				})),

			updateClock: (changes) =>
				set((s) => ({
					settings: {
						...s.settings,
						clock: { ...s.settings.clock, ...changes },
					},
				})),

			updateGreeting: (changes) =>
				set((s) => ({
					settings: {
						...s.settings,
						greeting: { ...s.settings.greeting, ...changes },
					},
				})),

			updateSearch: (changes) =>
				set((s) => ({
					settings: {
						...s.settings,
						search: { ...s.settings.search, ...changes },
					},
				})),

			updateThumbnailCapture: (changes) =>
				set((s) => ({
					settings: {
						...s.settings,
						thumbnailCapture: { ...s.settings.thumbnailCapture, ...changes },
					},
				})),

			replaceSetup: (setup) => set(normalizeState(setup)),

			resetAll: async () => {
				await chrome.storage.local.clear();
				await useImageStore.getState().clearAll();
				set(normalizeState(null));
			},
		}),
		{
			name: "perch-setup",
			storage: chromeStorageAdapter,
		},
	),
);

/** Grid max width for the current tile size + column count. Pure selector helper. */
export function computeGridMaxWidth(
	tileSize: string,
	maxColumns: number,
): number {
	const size = safeTileSize(tileSize);
	const cols = clampInt(maxColumns, MIN_COLUMNS, MAX_COLUMNS, 7);
	const tile = TILE_SIZE_DIMENSIONS[size];
	return cols * tile.width + (cols - 1) * GRID_GAP_PX + GRID_PADDING_X_PX * 2;
}
