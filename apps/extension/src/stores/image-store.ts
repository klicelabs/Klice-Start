import { create } from "zustand";
import {
	idbClearStores,
	idbDelete,
	idbGet,
	STORE_BG,
	STORE_THUMBS,
	saveBackground,
	saveThumbnail,
} from "../lib/idb";

interface ImageStoreState {
	/** Temporary, non-persisted wallpaper preview used before upload confirmation. */
	previewBackgroundImage: string | null;
	setBackgroundPreview: (dataUrl: string) => void;
	clearBackgroundPreview: () => void;
	getThumbnail: (id: string) => Promise<string | null>;
	saveThumbnail: (dataUrl: string) => Promise<string>;
	deleteThumbnail: (id: string) => Promise<void>;
	getBackgroundImage: (id: string) => Promise<string | null>;
	saveBackgroundImage: (dataUrl: string) => Promise<string>;
	deleteBackgroundImage: (id: string) => Promise<void>;
	clearAll: () => Promise<void>;
}

export const useImageStore = create<ImageStoreState>()((set) => ({
	previewBackgroundImage: null,
	setBackgroundPreview: (dataUrl) => set({ previewBackgroundImage: dataUrl }),
	clearBackgroundPreview: () => set({ previewBackgroundImage: null }),
	getThumbnail: async (id: string) => idbGet(STORE_THUMBS, id),
	saveThumbnail: async (dataUrl: string) => saveThumbnail(dataUrl),
	deleteThumbnail: async (id: string) => {
		if (!id) return;
		await idbDelete(STORE_THUMBS, id);
	},
	getBackgroundImage: async (id: string) => idbGet(STORE_BG, id),
	saveBackgroundImage: async (dataUrl: string) => saveBackground(dataUrl),
	deleteBackgroundImage: async (id: string) => {
		if (!id) return;
		await idbDelete(STORE_BG, id);
	},
	clearAll: async () => {
		await idbClearStores([STORE_THUMBS, STORE_BG]);
		set({ previewBackgroundImage: null });
	},
}));
