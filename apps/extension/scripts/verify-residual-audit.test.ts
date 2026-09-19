/** Regression seams for the final pre-release residuals. */
import { expect, test } from "bun:test";
import { preflightBackup } from "../src/lib/backup-format";
import { DEFAULT_SETUP } from "../src/lib/constants";
import { mergeConcurrentSetup } from "../src/lib/merge-external-setup";
import { normalizeState } from "../src/lib/storage";
import type { Setup } from "../src/types";

function setup(): Setup {
	return structuredClone(DEFAULT_SETUP);
}

test("M10/P6: normalization rejects duplicate identities and corrupt settings", () => {
	const raw = {
		...setup(),
		folders: [
			{ id: "default", name: "Home", order: 0, parentId: null },
			{ id: "default", name: "Duplicate", order: 1, parentId: null },
		],
		cards: [
			{
				id: "c1",
				folderId: "default",
				title: "One",
				url: "https://example.com/one",
				favicon: null,
				thumbId: null,
				order: 0,
			},
			{
				id: "c1",
				folderId: "default",
				title: "Duplicate",
				url: "https://example.com/two",
				favicon: null,
				thumbId: null,
				order: 1,
			},
		],
		settings: {
			...setup().settings,
			tileSize: "corrupt",
			maxColumns: Number.NaN,
			clock: { ...setup().settings.clock, size: "huge" },
			search: { ...setup().settings.search, width: Number.POSITIVE_INFINITY },
		},
	} as never;
	const normalized = normalizeState(raw);
	expect(normalized.folders).toHaveLength(1);
	expect(normalized.cards).toHaveLength(1);
	expect(normalized.settings.tileSize).toBe(DEFAULT_SETUP.settings.tileSize);
	expect(normalized.settings.maxColumns).toBe(
		DEFAULT_SETUP.settings.maxColumns,
	);
	expect(normalized.settings.clock.size).toBe(
		DEFAULT_SETUP.settings.clock.size,
	);
	expect(normalized.settings.search.width).toBe(
		DEFAULT_SETUP.settings.search.width,
	);
});

test("M6: backup preflight refuses records that normalization would drop", () => {
	const value = setup();
	const text = JSON.stringify({
		...value,
		cards: [
			{
				id: "bad",
				folderId: "default",
				title: "Bad",
				url: "javascript:alert(1)",
				favicon: null,
				thumbId: null,
				order: 0,
			},
		],
	});
	expect(() => preflightBackup(text)).toThrow("invalid bookmark");
});

test("M12: concurrent settings edits merge independent fields", () => {
	const base = setup();
	const local = structuredClone(base);
	local.settings.glassIntensity = 80;
	const incoming = structuredClone(base);
	incoming.settings.search.width = 700;
	const merged = mergeConcurrentSetup(base, local, incoming);
	expect(merged).not.toBeNull();
	expect(merged.settings?.glassIntensity).toBe(80);
	expect(merged.settings?.search.width).toBe(700);
});
