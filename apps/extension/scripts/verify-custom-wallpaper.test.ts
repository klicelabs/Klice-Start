import { expect, test } from "bun:test";
import { DEFAULT_SETUP } from "../src/lib/constants";
import {
	getCustomWallpaperMigration,
	normalizeState,
} from "../src/lib/storage";

test("migrates the legacy custom wallpaper array to one active slot", () => {
	const legacy = structuredClone(DEFAULT_SETUP);
	const background = legacy.settings.background as unknown as Record<
		string,
		unknown
	>;
	delete background.customWallpaper;
	background.customWallpapers = [
		{ id: "bg-a", name: "A" },
		{ id: "bg-b", name: "B" },
		{ id: "bg-b", name: "Duplicate B" },
	];
	background.type = "image";
	background.imageId = "bg-b";

	const normalized = normalizeState(legacy);
	const migration = getCustomWallpaperMigration({
		settings: { background },
	});

	expect(normalized.settings.background.customWallpaper).toEqual({
		id: "bg-b",
		name: "B",
	});
	expect("customWallpapers" in normalized.settings.background).toBe(false);
	expect(migration).toEqual({
		legacyIds: ["bg-a", "bg-b"],
		retainedId: "bg-b",
	});
});

test("keeps the explicit custom slot when the active wallpaper is changed", () => {
	const state = structuredClone(DEFAULT_SETUP);
	state.settings.background.customWallpaper = {
		id: "bg-custom",
		name: "Custom image",
	};
	state.settings.background.type = "wallpaper";
	state.settings.background.imageId = null;

	const normalized = normalizeState(state);

	expect(normalized.settings.background.customWallpaper).toEqual({
		id: "bg-custom",
		name: "Custom image",
	});
	expect(normalized.settings.background.imageId).toBeNull();
});

test("treats an explicit empty slot as authoritative during migration", () => {
	const legacy = structuredClone(DEFAULT_SETUP);
	const background = legacy.settings.background as unknown as Record<
		string,
		unknown
	>;
	background.customWallpaper = null;
	background.customWallpapers = [{ id: "stale-bg", name: "Stale" }];

	const normalized = normalizeState(legacy);
	const migration = getCustomWallpaperMigration({
		settings: { background },
	});

	expect(normalized.settings.background.customWallpaper).toBeNull();
	expect(migration.retainedId).toBeNull();
	expect(migration.legacyIds).toEqual(["stale-bg"]);
});
