import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
	GRID_GAP_PX,
	GRID_PADDING_X_PX,
	MAX_COLUMNS,
	MIN_COLUMNS,
	TILE_SIZE_DIMENSIONS,
} from "../lib/constants";
import { getSubtreeIds, wouldCreateCycle } from "../lib/folder-tree";
import {
	containerKeyOf,
	type ItemOrder,
	type ItemRef,
	itemKey,
	parseItemKey,
	reindexOrders,
} from "../lib/item-order";
import {
	beginReset,
	cancelPendingPersist,
	chromeStorageAdapter,
	flushPersist,
	normalizeState,
} from "../lib/storage";
import { clampInt, uid as generateId, safeTileSize } from "../lib/utils";
import type { Card, Settings, Setup } from "../types";
import { useImageStore } from "./image-store";

export type InsertPosition = "before" | "after";

interface SetupActions {
	addFolder: (name: string, parentId?: string | null) => string;
	updateFolder: (id: string, name: string) => void;
	moveFolder: (id: string, parentId: string | null) => void;
	moveFolders: (ids: string[], parentId: string | null) => void;
	deleteFolder: (id: string) => void;
	reorderFolders: (
		draggedId: string,
		targetId: string,
		position?: InsertPosition,
	) => void;
	setActiveFolder: (id: string) => void;
	addCard: (
		card: Omit<Card, "id" | "order" | "origin" | "capturedAt">,
	) => string;
	updateCard: (id: string, changes: Partial<Card>) => void;
	moveCard: (id: string, folderId: string) => void;
	moveCards: (ids: string[], folderId: string) => void;
	/**
	 * Move a mixed group of cards + folders into one folder in a SINGLE set()
	 * (one coalesced storage write — no half-moved window). Order within each
	 * kind follows the input arrays. Folders that would create a cycle are
	 * skipped in place; unknown ids are ignored.
	 */
	moveItemsToContainer: (
		folderId: string,
		cardIds: string[],
		folderIds: string[],
	) => void;
	deleteCard: (id: string) => void;
	reorderCardsInActiveFolder: (
		draggedId: string,
		targetId: string,
		position?: InsertPosition,
	) => void;
	/**
	 * Move any item (card or folder) to before/after another item inside one
	 * container. Powers live mixed reorder in the grid. Never reparents.
	 */
	reorderItems: (
		container: string,
		dragged: ItemRef,
		target: ItemRef,
		position: InsertPosition,
	) => void;
	/**
	 * Atomically create a subfolder containing two cards of one container.
	 * Returns the new folder id, or null when the pair is invalid (nothing
	 * is mutated, so neither bookmark can be lost).
	 */
	createSubfolderFromCards: (
		containerFolderId: string,
		firstCardId: string,
		secondCardId: string,
		name: string,
	) => string | null;
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

/**
 * Every structural mutation below keeps the unified `itemOrder` map in sync
 * and reindexes the legacy `order` fields from it, so the two models can
 * never drift apart. All multi-entity moves run inside a single `set()`,
 * making them atomic for persistence (one coalesced storage write).
 */
export const useSetupStore = create<SetupStore>()(
	persist(
		(set, get) => ({
			...normalizeState(null),

			addFolder: (name, parentId = null) => {
				const id = generateId();
				const container = containerKeyOf(parentId);
				set((s) => {
					const base = s.itemOrder ?? {};
					const itemOrder: ItemOrder = {
						...base,
						[container]: [...(base[container] ?? []), itemKey("folder", id)],
						[id]: base[id] ?? [],
					};
					const folders = [
						...s.folders,
						{ id, name, order: (base[container] ?? []).length, parentId },
					];
					return { ...reindexOrders(folders, s.cards, itemOrder), itemOrder };
				});
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
					const folder = s.folders.find((f) => f.id === id);
					if (!folder) return {};
					const fromContainer = containerKeyOf(folder.parentId ?? null);
					const toContainer = containerKeyOf(parentId);
					const base = s.itemOrder ?? {};
					const itemOrder: ItemOrder = { ...base };
					if (fromContainer !== toContainer) {
						const key = itemKey("folder", id);
						itemOrder[fromContainer] = (base[fromContainer] ?? []).filter(
							(k) => k !== key,
						);
						itemOrder[toContainer] = [...(base[toContainer] ?? []), key];
					}
					if (!(id in itemOrder)) itemOrder[id] = base[id] ?? [];
					const folders = s.folders.map((f) =>
						f.id === id ? { ...f, parentId } : f,
					);
					return { ...reindexOrders(folders, s.cards, itemOrder), itemOrder };
				}),

			moveFolders: (ids, parentId) =>
				set((s) => {
					const valid = ids.filter(
						(id) =>
							id !== parentId &&
							!wouldCreateCycle(s.folders, id, parentId) &&
							s.folders.some((f) => f.id === id),
					);
					if (valid.length === 0) return {};
					const validSet = new Set(valid);
					const base = s.itemOrder ?? {};
					const itemOrder: ItemOrder = { ...base };
					for (const [container, keys] of Object.entries(itemOrder)) {
						const next = keys.filter((k) => {
							const ref = parseItemKey(k);
							return !(ref && ref.kind === "folder" && validSet.has(ref.id));
						});
						if (next.length !== keys.length) itemOrder[container] = next;
					}
					const toContainer = containerKeyOf(parentId);
					itemOrder[toContainer] = [
						...(itemOrder[toContainer] ?? []),
						...valid.map((id) => itemKey("folder", id)),
					];
					for (const id of valid) {
						if (!(id in itemOrder)) itemOrder[id] = base[id] ?? [];
					}
					const folders = s.folders.map((f) =>
						validSet.has(f.id) ? { ...f, parentId } : f,
					);
					return { ...reindexOrders(folders, s.cards, itemOrder), itemOrder };
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
					const remainingCards = s.cards.filter(
						(c) => !removedFolderIds.has(c.folderId),
					);
					const remainingCardIds = new Set(remainingCards.map((c) => c.id));
					const itemOrder: ItemOrder = {};
					for (const [container, keys] of Object.entries(s.itemOrder ?? {})) {
						if (removedFolderIds.has(container)) continue;
						itemOrder[container] = keys.filter((k) => {
							const ref = parseItemKey(k);
							if (!ref) return false;
							return ref.kind === "folder"
								? !removedFolderIds.has(ref.id)
								: remainingCardIds.has(ref.id);
						});
					}
					const nextActive = removedFolderIds.has(s.activeFolderId)
						? target.parentId &&
							remainingFolders.some((f) => f.id === target.parentId)
							? target.parentId
							: remainingFolders.find((f) => (f.parentId ?? null) === null)
									?.id ||
								remainingFolders[0]?.id ||
								"default"
						: s.activeFolderId;

					const reindexed = reindexOrders(
						remainingFolders,
						remainingCards,
						itemOrder,
					);
					return { ...reindexed, itemOrder, activeFolderId: nextActive };
				}),

			reorderFolders: (draggedId, targetId, position = "before") =>
				set((s) => {
					const dragged = s.folders.find((f) => f.id === draggedId);
					const target = s.folders.find((f) => f.id === targetId);
					if (!dragged || !target || draggedId === targetId) return {};
					// Only reorder within the same parent; cross-parent moves use moveFolder.
					if ((dragged.parentId ?? null) !== (target.parentId ?? null))
						return {};

					const container = containerKeyOf(dragged.parentId ?? null);
					const base = s.itemOrder ?? {};
					const keys = [...(base[container] ?? [])];
					const dKey = itemKey("folder", draggedId);
					const tKey = itemKey("folder", targetId);
					if (!keys.includes(dKey) || !keys.includes(tKey)) return {};
					const next = keys.filter((k) => k !== dKey);
					const to = next.indexOf(tKey);
					if (to === -1) return {};
					next.splice(position === "after" ? to + 1 : to, 0, dKey);
					const itemOrder: ItemOrder = { ...base, [container]: next };
					return {
						...reindexOrders(s.folders, s.cards, itemOrder),
						itemOrder,
					};
				}),

			setActiveFolder: (id) => set({ activeFolderId: id }),

			addCard: (partial) => {
				const state = get();
				const id = generateId();
				const container = partial.folderId;
				const base = state.itemOrder ?? {};
				const card: Card = {
					...partial,
					id,
					order: (base[container] ?? []).filter((k) => k.startsWith("card:"))
						.length,
					origin: "local",
					capturedAt: null,
				};
				const itemOrder: ItemOrder = {
					...base,
					[container]: [...(base[container] ?? []), itemKey("card", id)],
				};
				const reindexed = reindexOrders(
					state.folders,
					[...state.cards, card],
					itemOrder,
				);
				set({ ...reindexed, itemOrder });
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
					const key = itemKey("card", id);
					const base = s.itemOrder ?? {};
					const itemOrder: ItemOrder = { ...base };
					for (const [container, keys] of Object.entries(itemOrder)) {
						if (keys.includes(key)) {
							itemOrder[container] = keys.filter((k) => k !== key);
						}
					}
					itemOrder[folderId] = [...(itemOrder[folderId] ?? []), key];
					const cards = s.cards.map((c) =>
						c.id === id ? { ...c, folderId } : c,
					);
					return { ...reindexOrders(s.folders, cards, itemOrder), itemOrder };
				}),

			moveCards: (ids, folderId) =>
				set((s) => {
					const existing = new Set(s.cards.map((c) => c.id));
					const valid = ids.filter((id) => existing.has(id));
					if (valid.length === 0) return {};
					const validSet = new Set(valid);
					const base = s.itemOrder ?? {};
					const itemOrder: ItemOrder = { ...base };
					for (const [container, keys] of Object.entries(itemOrder)) {
						const next = keys.filter((k) => {
							const ref = parseItemKey(k);
							return !(ref && ref.kind === "card" && validSet.has(ref.id));
						});
						if (next.length !== keys.length) itemOrder[container] = next;
					}
					itemOrder[folderId] = [
						...(itemOrder[folderId] ?? []),
						...valid.map((id) => itemKey("card", id)),
					];
					const cards = s.cards.map((c) =>
						validSet.has(c.id) ? { ...c, folderId } : c,
					);
					return { ...reindexOrders(s.folders, cards, itemOrder), itemOrder };
				}),

			moveItemsToContainer: (folderId, cardIds, folderIds) =>
				set((s) => {
					const existingCards = new Set(s.cards.map((c) => c.id));
					const validCards = cardIds.filter((id) => existingCards.has(id));
					const validFolders = folderIds.filter(
						(id) =>
							id !== folderId &&
							!wouldCreateCycle(s.folders, id, folderId) &&
							s.folders.some((f) => f.id === id),
					);
					if (validCards.length === 0 && validFolders.length === 0) return {};
					const validCardSet = new Set(validCards);
					const validFolderSet = new Set(validFolders);
					const base = s.itemOrder ?? {};
					const itemOrder: ItemOrder = { ...base };
					for (const [container, keys] of Object.entries(itemOrder)) {
						const next = keys.filter((k) => {
							const ref = parseItemKey(k);
							if (!ref) return false;
							if (ref.kind === "card" && validCardSet.has(ref.id)) return false;
							if (ref.kind === "folder" && validFolderSet.has(ref.id))
								return false;
							return true;
						});
						if (next.length !== keys.length) itemOrder[container] = next;
					}
					itemOrder[folderId] = [
						...(itemOrder[folderId] ?? []),
						...validCards.map((id) => itemKey("card", id)),
						...validFolders.map((id) => itemKey("folder", id)),
					];
					for (const id of validFolders) {
						if (!(id in itemOrder)) itemOrder[id] = base[id] ?? [];
					}
					const cards = s.cards.map((c) =>
						validCardSet.has(c.id) ? { ...c, folderId } : c,
					);
					const folders = s.folders.map((f) =>
						validFolderSet.has(f.id) ? { ...f, parentId: folderId } : f,
					);
					return {
						...reindexOrders(folders, cards, itemOrder),
						itemOrder,
					};
				}),

			deleteCard: (id) =>
				set((s) => {
					const card = s.cards.find((c) => c.id === id);
					if (card?.thumbId)
						useImageStore.getState().deleteThumbnail(card.thumbId);
					const key = itemKey("card", id);
					const base = s.itemOrder ?? {};
					const itemOrder: ItemOrder = { ...base };
					for (const [container, keys] of Object.entries(itemOrder)) {
						if (keys.includes(key)) {
							itemOrder[container] = keys.filter((k) => k !== key);
						}
					}
					return {
						cards: s.cards.filter((c) => c.id !== id),
						itemOrder,
					};
				}),

			reorderCardsInActiveFolder: (draggedId, targetId, position = "before") =>
				set((s) => {
					const container = s.activeFolderId;
					const base = s.itemOrder ?? {};
					const keys = [...(base[container] ?? [])];
					const dKey = itemKey("card", draggedId);
					const tKey = itemKey("card", targetId);
					if (!keys.includes(dKey) || !keys.includes(tKey)) return {};
					const next = keys.filter((k) => k !== dKey);
					const to = next.indexOf(tKey);
					if (to === -1) return {};
					next.splice(position === "after" ? to + 1 : to, 0, dKey);
					const itemOrder: ItemOrder = { ...base, [container]: next };
					return {
						...reindexOrders(s.folders, s.cards, itemOrder),
						itemOrder,
					};
				}),

			reorderItems: (container, dragged, target, position) =>
				set((s) => {
					if (dragged.id === target.id) return {};
					const base = s.itemOrder ?? {};
					const keys = [...(base[container] ?? [])];
					const dKey = itemKey(dragged.kind, dragged.id);
					const tKey = itemKey(target.kind, target.id);
					if (!keys.includes(dKey) || !keys.includes(tKey)) return {};
					const next = keys.filter((k) => k !== dKey);
					const to = next.indexOf(tKey);
					if (to === -1) return {};
					next.splice(position === "after" ? to + 1 : to, 0, dKey);
					const itemOrder: ItemOrder = { ...base, [container]: next };
					return {
						...reindexOrders(s.folders, s.cards, itemOrder),
						itemOrder,
					};
				}),

			createSubfolderFromCards: (
				containerFolderId,
				firstCardId,
				secondCardId,
				name,
			) => {
				if (firstCardId === secondCardId) return null;
				const s = get();
				const first = s.cards.find(
					(c) => c.id === firstCardId && c.folderId === containerFolderId,
				);
				const second = s.cards.find(
					(c) => c.id === secondCardId && c.folderId === containerFolderId,
				);
				if (!first || !second) return null;
				const id = generateId();
				const base = s.itemOrder ?? {};
				// Insert the new folder where the drop target lived.
				const keys = (base[containerFolderId] ?? []).filter(
					(k) =>
						k !== itemKey("card", firstCardId) &&
						k !== itemKey("card", secondCardId),
				);
				const targetIdx = (base[containerFolderId] ?? []).indexOf(
					itemKey("card", secondCardId),
				);
				keys.splice(
					targetIdx === -1 ? keys.length : Math.min(targetIdx, keys.length),
					0,
					itemKey("folder", id),
				);
				const itemOrder: ItemOrder = {
					...base,
					[containerFolderId]: keys,
					[id]: [itemKey("card", firstCardId), itemKey("card", secondCardId)],
				};
				const folders = [
					...s.folders,
					{ id, name, order: 0, parentId: containerFolderId },
				];
				const cards = s.cards.map((c) =>
					c.id === firstCardId
						? { ...c, folderId: id, order: 0 }
						: c.id === secondCardId
							? { ...c, folderId: id, order: 1 }
							: c,
				);
				const reindexed = reindexOrders(folders, cards, itemOrder);
				set({ ...reindexed, itemOrder });
				return id;
			},

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
				const previous = get();
				await beginReset();
				await cancelPendingPersist();
				try {
					// "perch-setup" is the legacy persist name; kept for data continuity.
					await chrome.storage.local.remove("perch-setup");
					await useImageStore.getState().clearAll();
					set(normalizeState(null));
					await flushPersist();
				} catch (error) {
					set({
						folders: previous.folders,
						cards: previous.cards,
						activeFolderId: previous.activeFolderId,
						settings: previous.settings,
					});
					await flushPersist().catch(() => undefined);
					throw error;
				}
			},
		}),
		{
			// Legacy persist name kept so existing installs retain their setup.
			name: "perch-setup",
			storage: chromeStorageAdapter,
			partialize: (s) => ({
				folders: s.folders,
				cards: s.cards,
				activeFolderId: s.activeFolderId,
				settings: s.settings,
				itemOrder: s.itemOrder,
			}),
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
