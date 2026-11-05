import { expect, test } from "bun:test";
import { DEFAULT_QUICK_LINKS, DEFAULT_SETUP } from "../src/lib/constants";
import { normalizeState } from "../src/lib/storage";
import { useSetupStore } from "../src/stores/setup-store";
import { prepareQuickLink, reorderQuickLinks } from "../src/lib/quick-links";

test("quick link input accepts sites, derives names and rejects unsafe destinations", () => {
	expect(prepareQuickLink("", " www.example.com/tools ")).toEqual({
		label: "example.com",
		url: "https://www.example.com/tools",
	});
	expect(prepareQuickLink(" My tools ", "http://example.com")).toEqual({
		label: "My tools",
		url: "http://example.com/",
	});
	for (const url of [
		"",
		"javascript:alert(1)",
		"data:text/html,test",
		"file:///local",
		"not a url",
		"https://",
	])
		expect(prepareQuickLink("Title", url)).toBeNull();
});

test("quick links move before and after stable ids without loss or duplicates", () => {
	const items = DEFAULT_QUICK_LINKS.slice(0, 3).map((link) => ({ ...link }));
	const [first, second, third] = items;
	if (!first || !second || !third) throw new Error("Expected three links");
	const moved = reorderQuickLinks(items, first.id, third.id, "after");
	expect(moved.map((link) => link.id)).toEqual([second.id, third.id, first.id]);
	expect(reorderQuickLinks(moved, first.id, second.id, "before")).toEqual(
		items,
	);
	expect(reorderQuickLinks(items, first.id, "missing", "before")).toBe(items);
	expect(reorderQuickLinks(items, "missing", first.id, "before")).toBe(items);
	expect(reorderQuickLinks(items, first.id, first.id, "after")).toBe(items);
	expect(reorderQuickLinks(items, first.id, second.id, "before")).toBe(items);
});

test("create, edit, move and delete preserve unrelated data and saved order", () => {
	const original = useSetupStore.getState();
	try {
		const store = useSetupStore.getState();
		const id = store.addQuickLink({
			label: "New destination",
			url: "example.com/new",
		});
		if (!id) throw new Error("Expected a created link");
		const first = original.settings.quickLinks.items[0];
		if (!first) throw new Error("Expected a default link");
		store.updateQuickLink(id, { label: "Renamed" });
		store.moveQuickLink(id, first.id, "before");
		const current = useSetupStore.getState();
		expect(current.settings.quickLinks.items[0]).toEqual({
			id,
			label: "Renamed",
			url: "https://example.com/new",
		});
		expect(normalizeState(current).settings.quickLinks.items).toEqual(
			current.settings.quickLinks.items,
		);
		expect(current.cards).toBe(original.cards);
		expect(current.folders).toBe(original.folders);
		expect(
			store.addQuickLink({ label: "Invalid", url: "javascript:alert(1)" }),
		).toBeNull();
		store.removeQuickLink(id);
		expect(useSetupStore.getState().settings.quickLinks.items).toEqual(
			original.settings.quickLinks.items,
		);
	} finally {
		useSetupStore.setState({ settings: original.settings });
	}
});

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
