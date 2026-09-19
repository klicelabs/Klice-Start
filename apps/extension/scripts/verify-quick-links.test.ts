import { expect, test } from "bun:test";
import { DEFAULT_QUICK_LINKS, DEFAULT_SETUP } from "../src/lib/constants";
import { normalizeState } from "../src/lib/storage";

test("quick links default on with curated destinations for new installs", () => {
	const normalized = normalizeState({
		folders: DEFAULT_SETUP.folders,
		cards: [],
		activeFolderId: "default",
		settings: {},
	});

	expect(normalized.settings.quickLinks.enabled).toBe(true);
	expect(normalized.settings.quickLinks.items).toEqual(DEFAULT_QUICK_LINKS);
});

test("quick links preserve disabled state and user order", () => {
	const normalized = normalizeState({
		settings: {
			quickLinks: {
				enabled: false,
				items: [
					{
						id: "custom",
						label: "Custom",
						url: "https://example.com/tools",
					},
					{
						id: "google",
						label: "Google",
						url: "https://www.google.com",
					},
				],
			},
		},
	});

	expect(normalized.settings.quickLinks.enabled).toBe(false);
	expect(normalized.settings.quickLinks.items.map((item) => item.id)).toEqual([
		"custom",
		"google",
	]);
});

test("invalid quick link payload falls back to curated defaults", () => {
	const normalized = normalizeState({
		settings: {
			quickLinks: {
				enabled: true,
				items: [
					{ id: "duplicate", label: "One", url: "javascript:alert(1)" },
					{ id: "duplicate", label: "Two", url: "not-a-url" },
				],
			},
		},
	});

	expect(normalized.settings.quickLinks.items).toEqual(DEFAULT_QUICK_LINKS);
});
