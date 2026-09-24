import { expect, mock, test } from "bun:test";
// Static import resolves BEFORE mock.module registers, so the spread below
// carries the REAL module surface (idbGet, idbPut, putImages, …). bun's
// module mocks are global across the whole test run: an incomplete mock
// here used to break any later test file that imports the real store graph
// (setup-store → image-store → idb) with a misleading
// "Export named 'idbGet' not found".
import * as realIdb from "../src/lib/idb";
import type { Card, Setup } from "../src/types";

mock.module("../src/lib/idb", () => ({
	...realIdb,
	STORE_BG: "backgrounds",
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
				customWallpaper: null,
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

test("auto-captures any missing-thumbnail bookmark after navigation settles", {
	timeout: 25_000,
}, async () => {
	const onInstalled = createEvent();
	const onStartup = createEvent();
	const onStorageChanged = createEvent();
	const onContextMenu = createEvent();
	const onCommand = createEvent();
	const onUpdated = createEvent();
	const onActivated = createEvent();
	const onRemoved = createEvent();
	const onPermissionAdded = createEvent();
	const onPermissionRemoved = createEvent();
	const onNavigationCompleted = createEvent();
	const onMessage = createEvent();
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
	let captureShouldFail = false;
	let capturePermissionGranted = false;

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
		permissions: {
			onAdded: onPermissionAdded,
			onRemoved: onPermissionRemoved,
			contains: async ({ origins }: { origins: string[] }) => {
				expect(origins).toEqual(["<all_urls>"]);
				return capturePermissionGranted;
			},
			request: async () => capturePermissionGranted,
		},
		runtime: {
			onInstalled,
			onStartup,
			onMessage,
			lastError: undefined,
			getURL: (path: string) => `extension://${path}`,
		},
		storage: {
			local: storageLocal,
			onChanged: onStorageChanged,
			session: {
				get: async () => ({}),
				set: async () => undefined,
				remove: async () => undefined,
			},
		},
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
				if (!capturePermissionGranted)
					throw new Error(
						"Either the '<all_urls>' or 'activeTab' permission is required.",
					);
				captureCount += 1;
				if (captureShouldFail) throw new Error("capture denied");
				return "data:image/jpeg;base64,captured";
			},
		},
		windows: { create: async () => undefined },
		webNavigation: { onCompleted: onNavigationCompleted },
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
	await new Promise((resolve) => setTimeout(resolve, 1750));
	expect(captureCount).toBe(0);
	expect(storedSetup.cards[0]?.thumbId).toBeNull();

	// A manual bookmark remains eligible after the user grants optional site
	// access. The denied visit must not have started a failure cooldown.
	capturePermissionGranted = true;
	onPermissionAdded.emit({ origins: ["<all_urls>"] });
	onUpdated.emit(tab.id, { status: "complete" }, { ...tab });
	await new Promise((resolve) => setTimeout(resolve, 1750));

	expect(captureCount).toBe(1);
	expect(storedSetup.cards[0]?.thumbId).toBe("thumb-captured");
	expect(storedSetup.cards[0]?.capturedAt).toEqual(expect.any(Number));

	onUpdated.emit(
		tab.id,
		{ status: "loading", url: tab.url },
		{ ...tab, status: "loading" },
	);
	onUpdated.emit(tab.id, { status: "complete" }, tab);
	await new Promise((resolve) => setTimeout(resolve, 1750));

	expect(captureCount).toBe(1);

	// Browser UI and extension URLs are never capture candidates.
	tab.url = "chrome://settings";
	tab.active = true;
	tab.status = "complete";
	onUpdated.emit(tab.id, { status: "complete" }, { ...tab });
	onActivated.emit({ tabId: tab.id });
	await new Promise((resolve) => setTimeout(resolve, 1300));
	expect(captureCount).toBe(1);

	// The user-facing setting gates queued work before the expensive API call.
	const disabledCard = {
		...createSetup().cards[0],
		id: "disabled-card",
		url: "https://disabled.example",
	};
	storedSetup.cards = [disabledCard];
	storedSetup.settings.thumbnailCapture.enabled = false;
	tab.url = disabledCard.url;
	tab.active = true;
	tab.status = "complete";
	onUpdated.emit(tab.id, { status: "loading", url: tab.url }, { ...tab });
	onUpdated.emit(tab.id, { status: "complete" }, { ...tab });
	await new Promise((resolve) => setTimeout(resolve, 1750));
	expect(captureCount).toBe(1);
	expect(storedSetup.cards[0]?.thumbId).toBeNull();

	// A failed capture leaves the card untouched and duplicate events do not
	// immediately retry the same URL.
	const failedCard = {
		...disabledCard,
		id: "failed-card",
		url: "https://failed.example",
	};
	storedSetup.cards = [failedCard];
	storedSetup.settings.thumbnailCapture.enabled = true;
	captureShouldFail = true;
	tab.url = failedCard.url;
	onUpdated.emit(tab.id, { status: "loading", url: tab.url }, { ...tab });
	onUpdated.emit(tab.id, { status: "complete" }, { ...tab });
	onActivated.emit({ tabId: tab.id });
	await new Promise((resolve) => setTimeout(resolve, 1750));
	expect(captureCount).toBe(2);
	expect(storedSetup.cards[0]?.thumbId).toBeNull();
	expect(storedSetup.cards[0]?.capturedAt).toBeNull();
	onUpdated.emit(tab.id, { status: "complete" }, { ...tab });
	onActivated.emit({ tabId: tab.id });
	await new Promise((resolve) => setTimeout(resolve, 1750));
	expect(captureCount).toBe(2);

	// The webNavigation.onCompleted path funnels into the same pipeline:
	// a top-frame visit of a thumbless card captures after the settle
	// debounce, while sub-frames and the extension's own pages never do.
	captureShouldFail = false;
	tab.url = "https://example.com/";
	tab.active = true;
	tab.status = "complete";
	storedSetup.cards = [{ ...createSetup().cards[0] }];
	onNavigationCompleted.emit({
		frameId: 0,
		tabId: tab.id,
		url: "https://example.com/",
	});
	await new Promise((resolve) => setTimeout(resolve, 1750));
	expect(captureCount).toBe(3);
	expect(storedSetup.cards[0]?.thumbId).toBe("thumb-captured");

	// Sub-frame loads own no visible surface — no capture, no timer.
	onNavigationCompleted.emit({
		frameId: 1,
		tabId: tab.id,
		url: "https://example.com/",
	});
	await new Promise((resolve) => setTimeout(resolve, 100));
	expect(captureCount).toBe(3);

	// The extension's own pages (the newtab override) never capture.
	onNavigationCompleted.emit({
		frameId: 0,
		tabId: tab.id,
		url: "extension:///newtab.html",
	});
	await new Promise((resolve) => setTimeout(resolve, 100));
	expect(captureCount).toBe(3);
});
