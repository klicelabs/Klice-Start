import { expect, test } from "bun:test";
import { DEFAULT_QUICK_LINKS, DEFAULT_SETUP } from "../src/lib/constants";
import { normalizeState } from "../src/lib/storage";
import { useSetupStore } from "../src/stores/setup-store";

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

test("explicit empty quick links stay empty after normalization", () => {
	const normalized = normalizeState({
		settings: { quickLinks: { enabled: true, items: [] } },
	});

	expect(normalized.settings.quickLinks.items).toEqual([]);
});

test("quick link edit and removal actions update only the quick link list", () => {
	const originalSettings = useSetupStore.getState().settings;
	const originalItem = originalSettings.quickLinks.items[0];
	if (!originalItem) throw new Error("Expected a default Quick Link");

	useSetupStore.getState().updateQuickLink(originalItem.id, {
		label: "Edited",
		url: "https://example.com/edited",
	});
	const edited = useSetupStore.getState();
	expect(edited.settings.quickLinks.items[0]).toEqual({
		...originalItem,
		label: "Edited",
		url: "https://example.com/edited",
	});

	useSetupStore.getState().removeQuickLink(originalItem.id);
	const removed = useSetupStore.getState();
	expect(
		removed.settings.quickLinks.items.some(
			(item) => item.id === originalItem.id,
		),
	).toBe(false);
	expect(removed.cards).toBe(edited.cards);
	expect(removed.folders).toBe(edited.folders);

	useSetupStore.setState({ settings: originalSettings });
});
