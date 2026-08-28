/**
 * Backup export/import: serializes the full setup plus the referenced images
 * (thumbnails + background) into a single JSON file, and restores it.
 *
 * Images live in IndexedDB and are inlined as data URLs so a backup is fully
 * self-contained. Restore writes images back to IDB before replacing state.
 */
import { MAX_BACKGROUND_IMAGE_BYTES } from "../lib/constants";
import { putImages, STORE_BG, STORE_THUMBS } from "../lib/idb";
import { isAbsoluteHttpUrl } from "../lib/url";
import { useImageStore } from "../stores/image-store";
import { useSetupStore } from "../stores/setup-store";
import type { Card, Folder, Settings, Setup } from "../types";

interface BackupPayload extends Setup {
	thumbnails: Record<string, string>;
	backgrounds: Record<string, string>;
}

const MAX_BACKUP_INPUT_LENGTH = 100 * 1024 * 1024;
const MAX_BACKUP_IMAGE_ENTRIES = 1_000;
const MAX_BACKUP_TOTAL_IMAGE_BYTES = 50 * 1024 * 1024;
const MAX_BACKUP_DATA_URL_LENGTH =
	Math.ceil((MAX_BACKGROUND_IMAGE_BYTES / 3) * 4) + 256;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(
	value: unknown,
	field: string,
): asserts value is string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`Backup has an invalid ${field}.`);
	}
}

function validateSetupShape(data: Record<string, unknown>): Setup {
	if (!Array.isArray(data.folders)) {
		throw new Error("Backup is missing a folders array.");
	}
	if (!Array.isArray(data.cards)) {
		throw new Error("Backup is missing a cards array.");
	}
	if (!isRecord(data.settings)) {
		throw new Error("Backup is missing a settings object.");
	}
	if (
		data.activeFolderId !== undefined &&
		typeof data.activeFolderId !== "string"
	) {
		throw new Error("Backup has an invalid activeFolderId.");
	}

	const folderIds = new Set<string>();
	for (const [index, rawFolder] of data.folders.entries()) {
		if (!isRecord(rawFolder)) {
			throw new Error(`Backup folder ${index} is not an object.`);
		}
		requireNonEmptyString(rawFolder.id, `folder ${index} id`);
		requireNonEmptyString(rawFolder.name, `folder ${index} name`);
		if (folderIds.has(rawFolder.id)) {
			throw new Error(`Backup contains duplicate folder id "${rawFolder.id}".`);
		}
		folderIds.add(rawFolder.id);
		if (
			rawFolder.order !== undefined &&
			(typeof rawFolder.order !== "number" || !Number.isFinite(rawFolder.order))
		) {
			throw new Error(`Backup folder ${index} has an invalid order.`);
		}
		if (
			rawFolder.parentId !== undefined &&
			rawFolder.parentId !== null &&
			typeof rawFolder.parentId !== "string"
		) {
			throw new Error(`Backup folder ${index} has an invalid parentId.`);
		}
	}

	for (const [index, rawCard] of data.cards.entries()) {
		if (!isRecord(rawCard)) {
			throw new Error(`Backup card ${index} is not an object.`);
		}
		requireNonEmptyString(rawCard.id, `card ${index} id`);
		requireNonEmptyString(rawCard.folderId, `card ${index} folderId`);
		requireNonEmptyString(rawCard.title, `card ${index} title`);
		if (typeof rawCard.url !== "string" || !isAbsoluteHttpUrl(rawCard.url)) {
			throw new Error(
				`Backup card ${index} must have an absolute http(s) URL.`,
			);
		}
		if (rawCard.favicon !== undefined && typeof rawCard.favicon !== "string") {
			throw new Error(`Backup card ${index} has an invalid favicon.`);
		}
		if (
			rawCard.order !== undefined &&
			(typeof rawCard.order !== "number" || !Number.isFinite(rawCard.order))
		) {
			throw new Error(`Backup card ${index} has an invalid order.`);
		}
		if (
			rawCard.origin !== undefined &&
			rawCard.origin !== "local" &&
			rawCard.origin !== "server"
		) {
			throw new Error(`Backup card ${index} has an invalid origin.`);
		}
		if (
			rawCard.capturedAt !== undefined &&
			rawCard.capturedAt !== null &&
			(typeof rawCard.capturedAt !== "number" ||
				!Number.isFinite(rawCard.capturedAt))
		) {
			throw new Error(`Backup card ${index} has an invalid capturedAt.`);
		}
		if (
			rawCard.thumbId !== undefined &&
			rawCard.thumbId !== null &&
			typeof rawCard.thumbId !== "string"
		) {
			throw new Error(`Backup card ${index} has an invalid thumbId.`);
		}
	}

	if ("background" in data.settings && !isRecord(data.settings.background)) {
		throw new Error("Backup settings has an invalid background object.");
	}

	return {
		folders: data.folders as Folder[],
		cards: data.cards as Card[],
		activeFolderId:
			typeof data.activeFolderId === "string" ? data.activeFolderId : "",
		settings: data.settings as unknown as Settings,
	};
}

function dataUrlByteLength(dataUrl: string, label: string): number {
	if (dataUrl.length > MAX_BACKUP_DATA_URL_LENGTH) {
		throw new Error(
			`${label} exceeds the maximum image size (${MAX_BACKGROUND_IMAGE_BYTES} bytes).`,
		);
	}
	if (!dataUrl.startsWith("data:")) {
		throw new Error(`${label} must be an image data URL.`);
	}

	const comma = dataUrl.indexOf(",");
	if (comma < 0) throw new Error(`${label} has an invalid image data URL.`);
	const headerParts = dataUrl.slice(5, comma).split(";");
	const mime = headerParts.shift() ?? "";
	if (!/^image\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i.test(mime)) {
		throw new Error(`${label} must use an image MIME type.`);
	}
	const encoding = headerParts.pop()?.toLowerCase();
	if (
		encoding !== "base64" ||
		headerParts.some((part) => part.toLowerCase() === "base64")
	) {
		throw new Error(`${label} must use base64 image data.`);
	}

	const encoded = dataUrl.slice(comma + 1);
	if (
		encoded.length === 0 ||
		encoded.length % 4 !== 0 ||
		!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)
	) {
		throw new Error(`${label} has invalid base64 image data.`);
	}
	const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
	const bytes = (encoded.length / 4) * 3 - padding;
	if (bytes <= 0 || bytes > MAX_BACKGROUND_IMAGE_BYTES) {
		throw new Error(
			`${label} exceeds the maximum image size (${MAX_BACKGROUND_IMAGE_BYTES} bytes).`,
		);
	}
	return bytes;
}

interface ImageEntry {
	id: string;
	dataUrl: string;
}

interface ImageBudget {
	entries: number;
	bytes: number;
}

function preflightImageMap(
	value: unknown,
	label: string,
	budget: ImageBudget,
): ImageEntry[] {
	if (value === undefined) return [];
	if (!isRecord(value)) throw new Error(`Backup ${label} must be an object.`);

	const entries = Object.entries(value);
	if (budget.entries + entries.length > MAX_BACKUP_IMAGE_ENTRIES) {
		throw new Error(
			`Backup contains too many images (maximum ${MAX_BACKUP_IMAGE_ENTRIES}).`,
		);
	}

	const validated: ImageEntry[] = [];
	for (const [id, dataUrl] of entries) {
		requireNonEmptyString(id, `${label} image id`);
		if (typeof dataUrl !== "string") {
			throw new Error(`Backup ${label} image "${id}" is not a string.`);
		}
		const bytes = dataUrlByteLength(dataUrl, `${label} image "${id}"`);
		budget.entries++;
		budget.bytes += bytes;
		if (budget.bytes > MAX_BACKUP_TOTAL_IMAGE_BYTES) {
			throw new Error(
				`Backup images exceed the aggregate size limit (${MAX_BACKUP_TOTAL_IMAGE_BYTES} bytes).`,
			);
		}
		validated.push({ id, dataUrl });
	}
	return validated;
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
	const backgroundIds = new Set<string>();
	if (bg.type === "image" && bg.imageId) backgroundIds.add(bg.imageId);
	if (bg.type === "pexels" && bg.pexelsImageId)
		backgroundIds.add(bg.pexelsImageId);
	for (const wallpaper of bg.customWallpapers) {
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
	a.download = "perch-backup.json";
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
