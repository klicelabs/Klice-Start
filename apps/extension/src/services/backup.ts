/**
 * Backup export/import: serializes the full setup plus the referenced images
 * (thumbnails + background) into a single JSON file, and restores it.
 *
 * Images live in IndexedDB and are inlined as data URLs so a backup is fully
 * self-contained. Restore writes images back to IDB before replacing state.
 */
import { putImage, STORE_BG, STORE_THUMBS } from "../lib/idb";
import { useImageStore } from "../stores/image-store";
import { useSetupStore } from "../stores/setup-store";
import type { Setup } from "../types";

interface BackupPayload extends Setup {
	thumbnails: Record<string, string>;
	backgrounds: Record<string, string>;
}

/** Build the backup object with all referenced images inlined as data URLs. */
export async function buildBackup(): Promise<BackupPayload> {
	const state = useSetupStore.getState();
	const images = useImageStore.getState();

	const thumbnails: Record<string, string> = {};
	for (const card of state.cards) {
		if (!card.thumbId) continue;
		const dataUrl = await images.getThumbnail(card.thumbId);
		if (dataUrl) thumbnails[card.thumbId] = dataUrl;
	}

	const backgrounds: Record<string, string> = {};
	const bg = state.settings.background;
	if (
		(bg.type === "image" && bg.imageId) ||
		(bg.type === "pexels" && bg.pexelsImageId)
	) {
		const id = bg.type === "image" ? bg.imageId! : bg.pexelsImageId!;
		const dataUrl = await images.getBackgroundImage(id);
		if (dataUrl) backgrounds[id] = dataUrl;
	}

	return {
		folders: state.folders,
		cards: state.cards,
		activeFolderId: state.activeFolderId,
		settings: state.settings,
		thumbnails,
		backgrounds,
	};
}

/** Trigger a download of the current setup as a JSON file. */
export async function exportBackup(): Promise<void> {
	const payload = await buildBackup();
	const blob = new Blob([JSON.stringify(payload, null, 2)], {
		type: "application/json",
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = "perch-backup.json";
	a.click();
	URL.revokeObjectURL(url);
}

/**
 * Restore a backup from raw file text. Images are written to IDB first, then
 * state is replaced (normalizeState inside replaceSetup guards the shape).
 * Throws on malformed JSON so the caller can surface an error.
 */
export async function importBackup(fileText: string): Promise<void> {
	const data = JSON.parse(fileText) as Partial<BackupPayload>;

	if (data.thumbnails && typeof data.thumbnails === "object") {
		for (const [id, dataUrl] of Object.entries(data.thumbnails)) {
			if (typeof dataUrl === "string")
				await putImage(STORE_THUMBS, id, dataUrl);
		}
	}
	if (data.backgrounds && typeof data.backgrounds === "object") {
		for (const [id, dataUrl] of Object.entries(data.backgrounds)) {
			if (typeof dataUrl === "string") await putImage(STORE_BG, id, dataUrl);
		}
	}

	useSetupStore.getState().replaceSetup(data as unknown as Setup);
}
