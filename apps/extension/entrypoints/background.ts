import { getChildren } from "../src/lib/folder-tree";
import { saveThumbnail } from "../src/lib/idb";
import { normalizeState } from "../src/lib/storage";
import { canonicalUrl } from "../src/lib/url";
import { uid } from "../src/lib/utils";
import type { Folder, Setup } from "../src/types";

// Persistent identifiers from the Perch era — kept verbatim so existing
// installs keep their data and context-menu registration after the rename.
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

// Context menu: "Save page to Klice Start" is a parent item with one entry
// per Klice Start folder (nested folders become nested submenus).
const FOLDER_MENU_PREFIX = "klice-folder:";
const MAX_MENU_TITLE_LENGTH = 60;

/** Menu id for a folder item; stable across restarts and updates. */
function folderMenuId(folderId: string): string {
	return `${FOLDER_MENU_PREFIX}${folderId}`;
}

/**
 * Escape "&" (contextMenus treats it as a mnemonic accelerator on some
 * platforms) and truncate very long names so submenus stay usable.
 */
function menuTitle(name: string): string {
	const trimmed = name.trim() || "Untitled";
	const short =
		trimmed.length > MAX_MENU_TITLE_LENGTH
			? `${trimmed.slice(0, MAX_MENU_TITLE_LENGTH)}…`
			: trimmed;
	return short.replaceAll("&", "&&");
}

/**
 * Create one menu item per folder, mirroring the folder hierarchy.
 * Parents are created before their children so every parentId resolves,
 * and siblings follow the app's folder-tree ordering (order, then name —
 * see getChildren). normalizeState already repaired orphans and cycles,
 * so walking parentId chains always terminates at a root.
 */
function createFolderMenuItems(folders: Folder[]): void {
	const createLevel = (parentId: string | null, parentMenuId: string): void => {
		for (const folder of getChildren(folders, parentId)) {
			const id = folderMenuId(folder.id);
			safeCreateMenuItem({
				id,
				parentId: parentMenuId,
				title: menuTitle(folder.name),
				contexts: ["page"],
			});
			createLevel(folder.id, id);
		}
	};
	createLevel(null, MENU_ID);
}

/**
 * contextMenus.create reports duplicate-id errors asynchronously through
 * runtime.lastError (and can throw synchronously), so swallow both: a
 * duplicate here is harmless because rebuildMenus always removeAll()s first.
 */
function safeCreateMenuItem(
	properties: Parameters<typeof browser.contextMenus.create>[0],
): void {
	try {
		browser.contextMenus.create(properties, () => {
			void browser.runtime.lastError;
		});
	} catch {
		// Duplicate id or invalid properties — safe to ignore, see above.
	}
}

/**
 * Rebuild the whole context menu from the persisted setup. removeAll-then-
 * create is the race-safe pattern: no stale or duplicate items can survive
 * restarts, resets, or folder changes.
 */
async function rebuildMenus(): Promise<void> {
	await browser.contextMenus.removeAll();

	// Parent item. It has children, so it can never receive a click itself —
	// every folder leaf handles its own click.
	safeCreateMenuItem({
		id: MENU_ID,
		title: "Save page to Klice Start",
		contexts: ["page"],
	});

	const setup = (await readSetup()) ?? normalizeState(null);
	const folders = setup.folders;

	if (folders.length === 0) {
		// Should be unreachable — normalizeState guarantees a default Home
		// folder — but never ship an empty submenu.
		safeCreateMenuItem({
			id: folderMenuId("default"),
			parentId: MENU_ID,
			title: "Save to Home",
			contexts: ["page"],
		});
		return;
	}

	createFolderMenuItems(folders);
}

// Serialize rebuilds so overlapping triggers never interleave their
// removeAll/create sequences.
let rebuildChain: Promise<void> = Promise.resolve();
function scheduleRebuild(): void {
	rebuildChain = rebuildChain.then(rebuildMenus).catch(() => {
		// A failed rebuild is retried by the next trigger.
	});
}

// Trailing debounce for storage.onChanged: zustand persist coalesces writes
// but can still fire several changes in a row; keep a single pending timer.
let rebuildTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleRebuildDebounced(): void {
	clearTimeout(rebuildTimer);
	rebuildTimer = setTimeout(scheduleRebuild, 150);
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
		scheduleRebuild();
	});

	// Covers browser restarts: the service worker's menu registrations persist,
	// but rebuilding guarantees they match the current setup.
	browser.runtime.onStartup.addListener(() => {
		scheduleRebuild();
	});

	// Keep the menu in sync with folder create/delete/rename/move, import,
	// reset, and cross-tab writes — everything persists to this one key.
	browser.storage.onChanged.addListener((changes, area) => {
		if (area !== "local" || !(STORAGE_KEY in changes)) return;
		scheduleRebuildDebounced();
	});

	browser.contextMenus.onClicked.addListener((info, tab) => {
		if (!tab) return;
		const menuItemId = info.menuItemId;
		if (
			typeof menuItemId === "string" &&
			menuItemId.startsWith(FOLDER_MENU_PREFIX)
		) {
			captureAndAdd(tab, menuItemId.slice(FOLDER_MENU_PREFIX.length));
		}
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

async function captureAndAdd(
	tab: {
		id?: number;
		url?: string;
		title?: string;
		windowId?: number;
		favIconUrl?: string;
	},
	targetFolderId?: string,
) {
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
		// Context-menu clicks pass an explicit folder; fall back to the
		// active/default folder when it is absent or was deleted since the
		// menu was rendered.
		const targetFolder = targetFolderId
			? setup.folders.find((f) => f.id === targetFolderId)
			: undefined;
		const folderId =
			targetFolder?.id ||
			setup.activeFolderId ||
			setup.folders[0]?.id ||
			"default";
		const cardsInFolder = setup.cards.filter((c) => c.folderId === folderId);
		const canon = canonicalUrl(tab.url);
		const existingCard = setup.cards.find(
			(c) => c.folderId === folderId && canonicalUrl(c.url) === canon,
		);

		if (existingCard) {
			existingCard.title = tab.title || existingCard.title;
			if (thumbId) existingCard.thumbId = thumbId;
			if (tab.favIconUrl) existingCard.favicon = tab.favIconUrl;
		} else {
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
		}
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
