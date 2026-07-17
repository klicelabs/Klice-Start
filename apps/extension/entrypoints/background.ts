import { saveThumbnail } from "../src/lib/idb";
import { normalizeState } from "../src/lib/storage";
import { canonicalUrl } from "../src/lib/url";
import { uid } from "../src/lib/utils";
import type { Setup } from "../src/types";

const STORAGE_KEY = "perch-setup";
const MENU_ID = "add-to-perch";

/** Read and normalize the persisted setup, or null when nothing is stored. */
async function readSetup(): Promise<Setup | null> {
	const data = await browser.storage.local.get(STORAGE_KEY);
	const persisted = data[STORAGE_KEY];
	if (!persisted) return null;
	try {
		return normalizeState(JSON.parse(persisted as string).state);
	} catch {
		return null;
	}
}

async function writeSetup(setup: Setup): Promise<void> {
	await browser.storage.local.set({
		[STORAGE_KEY]: JSON.stringify({ state: setup }),
	});
}

/**
 * Capture the visible tab. windowId is optional in the API (defaults to the
 * current window), so we only pass it when we actually have one.
 */
function captureVisible(
	windowId: number | undefined,
	quality: number,
): Promise<string> {
	const options = { format: "jpeg" as const, quality };
	return typeof windowId === "number"
		? browser.tabs.captureVisibleTab(windowId, options)
		: browser.tabs.captureVisibleTab(options);
}
const pendingThumbnailCaptures = new Map<
	number,
	ReturnType<typeof setTimeout>
>();

export default defineBackground(() => {
	browser.runtime.onInstalled.addListener(() => {
		browser.contextMenus.create({
			id: MENU_ID,
			title: "Save page to Perch",
			contexts: ["page"],
		});
	});

	browser.contextMenus.onClicked.addListener((_info, tab) => {
		if (tab) captureAndAdd(tab);
	});

	browser.commands.onCommand.addListener((command) => {
		if (command === "add-current-page") {
			browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
				if (tabs[0]) captureAndAdd(tabs[0]);
			});
		}
	});

	browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
		if (changeInfo.status === "loading") {
			clearTimeout(pendingThumbnailCaptures.get(tabId));
			pendingThumbnailCaptures.delete(tabId);
		}
		if (changeInfo.status !== "complete") return;
		queueMissingThumbnailCapture(tabId, tab);
	});

	browser.tabs.onActivated.addListener(async ({ tabId }) => {
		try {
			const tab = await browser.tabs.get(tabId);
			if (tab.url && tab.status === "complete") {
				queueMissingThumbnailCapture(tabId, tab);
			}
		} catch {
			// Tab may not exist anymore
		}
	});
});

async function captureAndAdd(tab: {
	id?: number;
	url?: string;
	title?: string;
	windowId?: number;
	favIconUrl?: string;
}) {
	if (!tab?.url || !/^https?:/.test(tab.url)) {
		flashBadge("✕", "#FF453A");
		return;
	}
	try {
		// Capture and persist the thumbnail BEFORE re-reading state, so the
		// read-modify-write window that could clobber a concurrent newtab write
		// is as small as possible.
		const dataUrl = await captureVisible(tab.windowId, 85);
		const thumbId = await saveThumbnail(dataUrl);

		const setup = (await readSetup()) ?? normalizeState(null);
		const folderId = setup.activeFolderId || setup.folders[0]?.id || "default";
		const cardsInFolder = setup.cards.filter((c) => c.folderId === folderId);

		setup.cards.push({
			id: uid(),
			folderId,
			title: tab.title || tab.url,
			url: tab.url,
			favicon: tab.favIconUrl || "",
			thumbId,
			order: cardsInFolder.length,
			origin: "local",
			capturedAt: null,
		});

		await writeSetup(setup);
		flashBadge("✓", "#34C759");
	} catch {
		flashBadge("✕", "#FF453A");
	}
}

function matchingCardsWithoutThumbnail(state: Setup, tabUrl: string) {
	const current = canonicalUrl(tabUrl);
	if (!current) return [];
	return state.cards.filter(
		(card) => !card.thumbId && canonicalUrl(card.url) === current,
	);
}

function queueMissingThumbnailCapture(
	tabId: number,
	tab: { active?: boolean; url?: string },
) {
	const url = tab.url;
	if (!tab.active || !url || !/^https?:\/\//i.test(url)) return;
	clearTimeout(pendingThumbnailCaptures.get(tabId));

	const timeoutId = setTimeout(() => {
		pendingThumbnailCaptures.delete(tabId);
		captureMissingThumbnail(tabId, url).catch(() => {});
	}, 1200);

	pendingThumbnailCaptures.set(tabId, timeoutId);
}

async function captureMissingThumbnail(tabId: number, expectedUrl: string) {
	const state = await readSetup();
	if (!state || !state.settings.thumbnailCapture?.enabled) return;

	const tab = await browser.tabs.get(tabId);
	if (
		!tab.active ||
		!tab.url ||
		tab.status !== "complete" ||
		canonicalUrl(tab.url) !== canonicalUrl(expectedUrl)
	)
		return;

	const matches = matchingCardsWithoutThumbnail(state, tab.url);
	if (matches.length === 0) return;

	const delayMs = Number(state.settings.thumbnailCapture.delayMs) || 1200;
	if (delayMs > 1200) {
		const { promise, resolve } = Promise.withResolvers<void>();
		setTimeout(resolve, delayMs - 1200);
		await promise;
	}

	const dataUrl = await captureVisible(tab.windowId, 82);
	const thumbId = await saveThumbnail(dataUrl);

	// Re-read fresh state right before writing to avoid clobbering concurrent edits.
	const fresh = await readSetup();
	if (!fresh) return;
	const matchIds = new Set(matches.map((card) => card.id));
	let changed = false;

	for (const card of fresh.cards) {
		if (!matchIds.has(card.id) || card.thumbId) continue;
		card.thumbId = thumbId;
		if (!card.favicon && tab.favIconUrl) card.favicon = tab.favIconUrl;
		changed = true;
	}

	if (changed) await writeSetup(fresh);
}

function flashBadge(text: string, color: string) {
	browser.action.setBadgeBackgroundColor({ color });
	browser.action.setBadgeText({ text });
	setTimeout(() => browser.action.setBadgeText({ text: "" }), 1400);
}
