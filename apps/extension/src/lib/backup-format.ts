import type { Card, Folder, Setup } from "../types";

export const MAX_BACKUP_INPUT_LENGTH = 50 * 1024 * 1024;
export const MAX_BACKUP_IMAGE_ENTRIES = 1000;
export const MAX_BACKUP_TOTAL_IMAGE_BYTES = 50 * 1024 * 1024;

export interface BackupPreflight {
	folders: number;
	cards: number;
}

export interface ImageBudget {
	entries: number;
	bytes: number;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeDataUrl(value: unknown): value is string {
	return (
		typeof value === "string" &&
		value.startsWith("data:image/") &&
		value.includes(";base64,")
	);
}

export function validateSetupShape(parsed: Record<string, unknown>): Setup {
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
		// Preserved when present; normalizeState backfills legacy backups.
		itemOrder: isRecord(parsed.itemOrder)
			? (parsed.itemOrder as Setup["itemOrder"])
			: undefined,
	};
}

export function preflightImageMap(
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

/**
 * Validate a backup file without touching state: JSON shape, setup shape,
 * image budgets. Returns counts for the restore confirmation. Throws
 * friendly errors for malformed or unsupported files.
 */
export function preflightBackup(fileText: string): BackupPreflight {
	if (typeof fileText !== "string" || fileText.trim().length === 0) {
		throw new Error("That file is empty.");
	}
	if (fileText.length > MAX_BACKUP_INPUT_LENGTH) {
		throw new Error(
			`Backup exceeds maximum input length (${MAX_BACKUP_INPUT_LENGTH} characters).`,
		);
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(fileText);
	} catch {
		throw new Error("That file is not a valid Klice backup.");
	}
	if (!isRecord(parsed)) {
		throw new Error("That file is not a valid Klice backup.");
	}
	const setup = validateSetupShape(parsed);
	const budget: ImageBudget = { entries: 0, bytes: 0 };
	preflightImageMap(parsed.thumbnails, "thumbnails", budget);
	preflightImageMap(parsed.backgrounds, "backgrounds", budget);
	return { folders: setup.folders.length, cards: setup.cards.length };
}
