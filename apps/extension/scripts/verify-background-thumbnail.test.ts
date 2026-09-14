import { expect, mock, test } from "bun:test";
import type { Card, Setup } from "../src/types";

mock.module("../src/lib/idb", () => ({
	STORE_THUMBS: "thumbnails",
	idbDelete: async () => undefined,
	saveThumbnail: async () => "thumb-captured",
}));

type Listener = (...args: unknown[]) => unknown;

function createEvent() {
	const listeners = new Set<Listener>();
	return {
		addListener(listener: Listener) {
			listeners.add(listener);
		},
		emit(...args: unknown[]) {
			return [...listeners].map((listener) => listener(...args));
		},
	};
}

function createSetup(): Setup {
	const card: Card = {
		id: "manual-card",
		folderId: "default",
		title: "Example",
		url: "https://example.com",
		favicon: null,
		thumbId: null,
		order: 0,
		origin: "local",
		capturedAt: null,
	};
	return {
		folders: [{ id: "default", name: "Home", order: 0, parentId: null }],
		cards: [card],
		activeFolderId: "default",
		settings: {
			tileSize: "medium",
			maxColumns: 7,
			showTitle: true,
			showDeleteButton: true,
			openInNewTab: false,
			dialLayout: "card",
			cardAspect: "vertical",
			iconShowLabel: true,
			thumbnailCapture: { enabled: true, delayMs: 1200 },
			background: {
				type: "solid",
				color: "#000000",
				gradientId: null,
				imageId: null,
				wallpaperId: null,
				customWallpapers: [],
				blur: 0,
				brightness: 100,
				opacity: 100,
				pexelsQuery: "",
				pexelsFrequency: "locked",
				pexelsPreviousFrequency: null,
				pexelsLastFetched: null,
				pexelsLastPeriod: null,
				pexelsImageId: null,
			},
			clock: {
				enabled: true,
				format24: true,
				showSeconds: false,
				size: 200,
				timezone: "auto",
			},
			greeting: { enabled: true, name: "" },
			search: {
				enabled: true,
				engine: "google",
				placeholder: "",
				iconMode: "engine",
			},
			appearanceMode: "liquid",
			colorScheme: "auto",
		},
		itemOrder: { __root__: ["folder:default"], default: ["card:manual-card"] },
	};
}

test("auto-captures a manually added screenshotless bookmark after navigation settles", async () => {
	const onInstalled = createEvent();
	const onStartup = createEvent();
	const onStorageChanged = createEvent();
	const onContextMenu = createEvent();
	const onCommand = createEvent();
	const onUpdated = createEvent();
	const onActivated = createEvent();
	const onRemoved = createEvent();
	let storedSetup = createSetup();
	const tab = {
		id: 7,
		url: "https://example.com/",
		title: "Example",
		status: "loading",
		active: false,
		windowId: 1,
		favIconUrl: "https://example.com/favicon.ico",
	};
	let captureCount = 0;

	const storageLocal = {
		async get(key: string | string[]) {
			if (key === "perch-reset-generation")
				return { "perch-reset-generation": 0 };
			if (
				key === "perch-setup" ||
				(Array.isArray(key) && key.includes("perch-setup"))
			) {
				return { "perch-setup": JSON.stringify({ state: storedSetup }) };
			}
			return {};
		},
		async set(value: Record<string, unknown>) {
			if (typeof value["perch-setup"] !== "string") return;
			storedSetup = JSON.parse(value["perch-setup"] as string).state as Setup;
		},
		async remove() {
			return undefined;
		},
	};
	const fakeBrowser = {
		runtime: {
			onInstalled,
			onStartup,
			lastError: undefined,
			getURL: (path: string) => `extension://${path}`,
		},
		storage: { local: storageLocal, onChanged: onStorageChanged },
		contextMenus: {
			onClicked: onContextMenu,
			removeAll: async () => undefined,
			create: () => undefined,
		},
		commands: { onCommand },
		tabs: {
			onUpdated,
			onActivated,
			onRemoved,
			get: async () => tab,
			query: async () => [tab],
			captureVisibleTab: async () => {
				captureCount += 1;
				return "data:image/jpeg;base64,captured";
			},
		},
		windows: { create: async () => undefined },
		action: {
			setBadgeBackgroundColor: async () => undefined,
			setBadgeText: async () => undefined,
		},
	};

	(globalThis as Record<string, unknown>).browser = fakeBrowser;
	(globalThis as Record<string, unknown>).chrome = fakeBrowser;
	(globalThis as Record<string, unknown>).defineBackground = (
		callback: () => unknown,
	) => callback();

	await import("../entrypoints/background");

	onUpdated.emit(
		tab.id,
		{ status: "loading", url: tab.url },
		{ ...tab, status: "loading" },
	);
	onUpdated.emit(
		tab.id,
		{ status: "complete" },
		{ ...tab, status: "complete" },
	);
	tab.active = true;
	const activation = onActivated.emit({ tabId: tab.id })[0];
	await activation;
	tab.status = "complete";
	await new Promise((resolve) => setTimeout(resolve, 1350));

	expect(captureCount).toBe(1);
	expect(storedSetup.cards[0]?.thumbId).toBe("thumb-captured");

	onUpdated.emit(
		tab.id,
		{ status: "loading", url: tab.url },
		{ ...tab, status: "loading" },
	);
	onUpdated.emit(tab.id, { status: "complete" }, tab);
	await new Promise((resolve) => setTimeout(resolve, 1350));

	expect(captureCount).toBe(1);
});
