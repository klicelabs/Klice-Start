import { idbGet, openIDB, putImages, STORE_BG, STORE_THUMBS } from "../lib/idb";
import { canonicalUrl, isAbsoluteHttpUrl } from "../lib/url";
import { useImageStore } from "../stores/image-store";
import { useSetupStore } from "../stores/setup-store";
import type { Card, Folder, Setup } from "../types";

export const MAX_BACKUP_INPUT_LENGTH = 50 * 1024 * 1024;
export const MAX_BACKUP_IMAGE_ENTRIES = 1000;
export const MAX_BACKUP_TOTAL_IMAGE_BYTES = 50 * 1024 * 1024;

interface ImageBudget {
	entries: number;
	bytes: number;
}

export interface BackupPayload extends Setup {
	thumbnails: Record<string, string>;
	backgrounds: Record<string, string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeDataUrl(value: unknown): value is string {
	return (
		typeof value === "string" &&
		value.startsWith("data:image/") &&
		value.includes(";base64,")
	);
}

function validateSetupShape(parsed: Record<string, unknown>): Setup {
	if (!Array.isArray(parsed.folders) || !Array.isArray(parsed.cards)) {
		throw new Error("Backup must contain folders and cards arrays.");
	}
	if (typeof parsed.activeFolderId !== "string") {
		throw new Error("Backup must contain an activeFolderId string.");
	}
	if (!isRecord(parsed.settings)) {
		throw new Error("Backup must contain a settings object.");
	}

	return {
		folders: parsed.folders as Folder[],
		cards: parsed.cards as Card[],
		activeFolderId: parsed.activeFolderId,
		settings: parsed.settings as unknown as Setup["settings"],
	};
}

function preflightImageMap(
	map: unknown,
	name: "thumbnails" | "backgrounds",
	budget: ImageBudget,
): Array<{ id: string; dataUrl: string }> {
	if (map === undefined || map === null) return [];
	if (!isRecord(map)) {
		throw new Error(`Backup.${name} must be an object if present.`);
	}

	const entries: Array<{ id: string; dataUrl: string }> = [];
	for (const [id, value] of Object.entries(map)) {
		if (typeof id !== "string" || id.trim().length === 0) {
			throw new Error(`Invalid image key in ${name}.`);
		}
		if (!isSafeDataUrl(value)) {
			throw new Error(`Invalid data URL for image ${id} in ${name}.`);
		}

		budget.entries += 1;
		budget.bytes += value.length;

		if (budget.entries > MAX_BACKUP_IMAGE_ENTRIES) {
			throw new Error(
				`Backup exceeds maximum image entries (${MAX_BACKUP_IMAGE_ENTRIES}).`,
			);
		}
		if (budget.bytes > MAX_BACKUP_TOTAL_IMAGE_BYTES) {
			throw new Error(
				`Backup exceeds maximum total image size (${MAX_BACKUP_TOTAL_IMAGE_BYTES / 1024 / 1024} MB).`,
			);
		}

		entries.push({ id, dataUrl: value });
	}

	return entries;
}

export async function buildBackup(): Promise<BackupPayload> {
	const state = useSetupStore.getState();
	const images = useImageStore.getState();

	const thumbnails: Record<string, string> = {};
	const thumbIds = new Set<string>();
	for (const card of state.cards) {
		if (card.thumbId) thumbIds.add(card.thumbId);
	}
	for (const id of thumbIds) {
		const dataUrl = await images.getThumbnail(id);
		if (dataUrl) thumbnails[id] = dataUrl;
	}

	const backgrounds: Record<string, string> = {};
	const bg = state.settings.background;
	const backgroundIds = new Set<string>();
	if (bg.type === "image" && bg.imageId) backgroundIds.add(bg.imageId);
	if (bg.type === "pexels" && bg.pexelsImageId)
		backgroundIds.add(bg.pexelsImageId);
	const custom = bg.customWallpapers ?? [];
	for (const wallpaper of custom) {
		if (wallpaper.id) backgroundIds.add(wallpaper.id);
	}
	for (const id of backgroundIds) {
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
	a.download = "klice-start-backup.json";
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Restore a backup from raw file text. Images are written to IDB first, then
 * state is replaced (normalizeState inside replaceSetup guards the shape).
 * Throws on malformed JSON so the caller can surface an error.
 */
export async function importBackup(fileText: string): Promise<void> {
	if (typeof fileText !== "string") {
		throw new Error("Backup must be provided as text.");
	}
	if (fileText.length > MAX_BACKUP_INPUT_LENGTH) {
		throw new Error(
			`Backup exceeds the maximum input length (${MAX_BACKUP_INPUT_LENGTH} characters).`,
		);
	}

	const parsed: unknown = JSON.parse(fileText);
	if (!isRecord(parsed)) {
		throw new Error("Backup must be a JSON object.");
	}

	const setup = validateSetupShape(parsed);
	const budget: ImageBudget = { entries: 0, bytes: 0 };
	const thumbnails = preflightImageMap(parsed.thumbnails, "thumbnails", budget);
	const backgrounds = preflightImageMap(
		parsed.backgrounds,
		"backgrounds",
		budget,
	);

	// All shape, URL, count, and payload checks complete before the first write.
	await putImages([
		...thumbnails.map((image) => ({
			store: STORE_THUMBS as typeof STORE_THUMBS,
			key: image.id,
			value: image.dataUrl,
		})),
		...backgrounds.map((image) => ({
			store: STORE_BG as typeof STORE_BG,
			key: image.id,
			value: image.dataUrl,
		})),
	]);

	useSetupStore.getState().replaceSetup(setup);
}
