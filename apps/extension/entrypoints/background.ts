import {
	findBookmarkInFolder,
	findBookmarksWithoutScreenshot,
} from "../src/lib/bookmark-match";
import { getChildren } from "../src/lib/folder-tree";
import { idbDelete, STORE_THUMBS, saveThumbnail } from "../src/lib/idb";
import {
	PENDING_SAVE_KEY,
	PENDING_SAVE_QUERY_PARAM,
	PENDING_SAVE_TTL_MS,
	parsePendingSave,
	pendingSaveId,
	pendingSaveThumbId,
} from "../src/lib/pending-save";
import { normalizeState } from "../src/lib/storage";
import { canonicalUrl, isAbsoluteHttpUrl } from "../src/lib/url";
import { uid } from "../src/lib/utils";
import type { Folder, Setup } from "../src/types";

// Persistent identifiers from the Perch era — kept verbatim so existing
// installs keep their data and context-menu registration after the rename.
const STORAGE_KEY = "perch-setup";
const MENU_ID = "add-to-perch";
const NEW_FOLDER_SEPARATOR_ID = "klice-new-folder-separator";
const NEW_FOLDER_MENU_ID = "klice-new-folder";

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
	} else {
		createFolderMenuItems(folders);
	}

	safeCreateMenuItem({
		id: NEW_FOLDER_SEPARATOR_ID,
		parentId: MENU_ID,
		type: "separator",
		contexts: ["page"],
	});
	safeCreateMenuItem({
		id: NEW_FOLDER_MENU_ID,
		parentId: MENU_ID,
		title: "New Folder…",
		contexts: ["page"],
	});
}

// Serialize rebuilds so overlapping triggers never interleave their
// removeAll/create sequences.
let rebuildChain: Promise<void> = Promise.resolve();
function scheduleRebuild(): void {
	rebuildChain = rebuildChain.then(rebuildMenus).catch(() => {
		// A failed rebuild is retried by the next trigger.
	});
}

// Context-menu and keyboard saves share one read-modify-write lane. This keeps
// two quick save gestures from both observing an empty destination and adding
// the same URL before either write reaches storage.
let bookmarkSaveChain: Promise<void> = Promise.resolve();
function enqueueBookmarkSave(task: () => Promise<void>): Promise<void> {
	const next = bookmarkSaveChain.catch(() => undefined).then(task);
	bookmarkSaveChain = next.catch(() => undefined);
	return next;
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

const THUMBNAIL_SETTLE_DELAY_MS = 1200;
const THUMBNAIL_FAILURE_COOLDOWN_MS = 10_000;

interface PendingThumbnailCapture {
	timer: ReturnType<typeof setTimeout>;
	expectedUrl: string;
	expectedKey: string;
	navigationGeneration: number;
}

interface InFlightThumbnailCapture {
	expectedKey: string;
	navigationGeneration: number;
}

// These maps contain only transient scheduling state. The bookmark and image
// records remain in extension storage/IndexedDB, so a worker restart cannot
// lose user data. The guards prevent repeated onUpdated/onActivated events
// from starting parallel captures for the same navigation.
const pendingThumbnailCaptures = new Map<number, PendingThumbnailCapture>();
const inFlightThumbnailCaptures = new Map<number, InFlightThumbnailCapture>();
const recentThumbnailAttempts = new Map<string, number>();
const navigationStartUrls = new Map<number, string>();
const navigationGenerations = new Map<number, number>();

function cancelPendingThumbnailCapture(tabId: number): void {
	const pending = pendingThumbnailCaptures.get(tabId);
	if (!pending) return;
	clearTimeout(pending.timer);
	pendingThumbnailCaptures.delete(tabId);
}

function nextNavigationGeneration(tabId: number): number {
	const next = (navigationGenerations.get(tabId) ?? 0) + 1;
	navigationGenerations.set(tabId, next);
	return next;
}

function thumbnailAttemptKey(tabId: number, expectedKey: string): string {
	return `${tabId}:${expectedKey}`;
}

function isWithinThumbnailFailureCooldown(attemptKey: string): boolean {
	const attemptedAt = recentThumbnailAttempts.get(attemptKey);
	if (attemptedAt === undefined) return false;
	if (Date.now() - attemptedAt >= THUMBNAIL_FAILURE_COOLDOWN_MS) {
		recentThumbnailAttempts.delete(attemptKey);
		return false;
	}
	return true;
}

function tabCanBeCaptured(
	tab: { active?: boolean; status?: string; url?: string },
	tabId: number,
	navigationGeneration: number,
): boolean {
	return (
		tab.active === true &&
		tab.status === "complete" &&
		navigationGenerations.get(tabId) === navigationGeneration &&
		!!tab.url &&
		isAbsoluteHttpUrl(tab.url)
	);
}

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
		if (menuItemId === NEW_FOLDER_MENU_ID) {
			void captureAndOpenPendingSave(tab);
			return;
		}
		if (
			typeof menuItemId === "string" &&
			menuItemId.startsWith(FOLDER_MENU_PREFIX)
		) {
			void captureAndAdd(tab, menuItemId.slice(FOLDER_MENU_PREFIX.length));
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
			const startUrl = changeInfo.url ?? tab.url;
			if (startUrl) navigationStartUrls.set(tabId, startUrl);
			else navigationStartUrls.delete(tabId);
			nextNavigationGeneration(tabId);
			cancelPendingThumbnailCapture(tabId);
		} else if (changeInfo.url && !navigationStartUrls.has(tabId)) {
			// Some browser navigation paths report the URL before the loading
			// status. Treat the first URL event as the navigation start while
			// preserving it through redirects.
			navigationStartUrls.set(tabId, changeInfo.url);
			nextNavigationGeneration(tabId);
			cancelPendingThumbnailCapture(tabId);
		}
		if (changeInfo.status !== "complete") return;
		const currentUrl = tab.url ?? changeInfo.url;
		if (!currentUrl) return;
		queueMissingThumbnailCapture(
			tabId,
			{ ...tab, url: currentUrl },
			navigationStartUrls.get(tabId) ?? currentUrl,
		);
	});

	browser.tabs.onActivated.addListener(async ({ tabId }) => {
		try {
			const tab = await browser.tabs.get(tabId);
			if (tab.url) {
				// Activation is a fresh opportunity for an already-settled tab;
				// do not reuse a stale redirect candidate from an old navigation.
				navigationStartUrls.delete(tabId);
				// onActivated is authoritative about the active tab, even if the
				// immediately-following tabs.get snapshot still reports old state.
				queueMissingThumbnailCapture(tabId, { ...tab, active: true }, tab.url);
			}
		} catch {
			// Tab may not exist anymore
		}
	});

	browser.tabs.onRemoved.addListener((tabId) => {
		cancelPendingThumbnailCapture(tabId);
		navigationStartUrls.delete(tabId);
		navigationGenerations.delete(tabId);
		inFlightThumbnailCaptures.delete(tabId);
		const prefix = `${tabId}:`;
		for (const key of recentThumbnailAttempts.keys()) {
			if (key.startsWith(prefix)) recentThumbnailAttempts.delete(key);
		}
	});
});

async function deletePendingThumbnail(thumbId: string | null): Promise<void> {
	if (!thumbId) return;
	try {
		await idbDelete(STORE_THUMBS, thumbId);
	} catch {
		// Cleanup is best effort; the pending record remains the source of truth.
	}
}

async function clearPendingSave(
	expectedId: string,
	deleteThumb: boolean,
	fallbackThumbId: string | null = null,
): Promise<void> {
	const data = await browser.storage.local.get(PENDING_SAVE_KEY);
	const raw = data[PENDING_SAVE_KEY];
	if (pendingSaveId(raw) !== expectedId) return;
	const thumbId = deleteThumb
		? pendingSaveThumbId(raw) || fallbackThumbId
		: null;
	await browser.storage.local.remove(PENDING_SAVE_KEY);
	if (thumbId) await deletePendingThumbnail(thumbId);
}

async function captureAndOpenPendingSave(tab: {
	id?: number;
	url?: string;
	title?: string;
	windowId?: number;
	favIconUrl?: string;
}): Promise<void> {
	if (!tab.url || !isAbsoluteHttpUrl(tab.url)) {
		flashBadge("✕", "#FF453A");
		return;
	}

	const id = uid();
	const createdAt = Date.now();
	let thumbId: string | null = null;
	try {
		const dataUrl = await captureVisible(tab.windowId, 85);
		thumbId = await saveThumbnail(dataUrl);
	} catch {
		// A page can still be saved when the browser denies the screenshot.
	}

	const pending = {
		id,
		url: tab.url.trim(),
		title: tab.title?.trim() || tab.url.trim(),
		favicon: tab.favIconUrl || "",
		thumbId,
		sourceTabId: typeof tab.id === "number" ? tab.id : null,
		sourceWindowId: typeof tab.windowId === "number" ? tab.windowId : null,
		createdAt,
		expiresAt: createdAt + PENDING_SAVE_TTL_MS,
	};
	const validated = parsePendingSave(pending, id, createdAt);
	if (!validated) {
		await deletePendingThumbnail(thumbId);
		flashBadge("✕", "#FF453A");
		return;
	}

	let stored = false;
	try {
		const existing = await browser.storage.local.get(PENDING_SAVE_KEY);
		const previousThumbId = pendingSaveThumbId(existing[PENDING_SAVE_KEY]);
		await browser.storage.local.set({ [PENDING_SAVE_KEY]: validated });
		stored = true;
		if (previousThumbId) await deletePendingThumbnail(previousThumbId);

		const popupUrl = browser.runtime.getURL(
			`/popup.html?${PENDING_SAVE_QUERY_PARAM}=${encodeURIComponent(id)}`,
		);
		await browser.windows.create({
			url: popupUrl,
			type: "popup",
			width: 360,
			height: 500,
			focused: true,
		});
	} catch {
		if (stored) {
			await clearPendingSave(id, true, thumbId).catch(() =>
				deletePendingThumbnail(thumbId),
			);
		} else {
			await deletePendingThumbnail(thumbId);
		}
		flashBadge("✕", "#FF453A");
	}
}

function captureAndAdd(
	tab: {
		id?: number;
		url?: string;
		title?: string;
		windowId?: number;
		favIconUrl?: string;
	},
	targetFolderId?: string,
): Promise<void> {
	return enqueueBookmarkSave(() => captureAndAddNow(tab, targetFolderId));
}

async function captureAndAddNow(
	tab: {
		id?: number;
		url?: string;
		title?: string;
		windowId?: number;
		favIconUrl?: string;
	},
	targetFolderId?: string,
) {
	const pageUrl = tab?.url?.trim();
	if (!pageUrl || !isAbsoluteHttpUrl(pageUrl)) {
		flashBadge("✕", "#FF453A");
		return;
	}

	let thumbId: string | null = null;
	let persisted = false;
	try {
		// Capture and persist the thumbnail BEFORE re-reading state, so the
		// read-modify-write window that could clobber a concurrent newtab write
		// is as small as possible.
		try {
			const dataUrl = await captureVisible(tab.windowId, 85);
			thumbId = await saveThumbnail(dataUrl);
		} catch {
			// Saving a bookmark remains useful when the browser denies a capture.
		}

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
		const existingCard = findBookmarkInFolder(setup.cards, folderId, pageUrl);

		if (existingCard) {
			const previousThumbId = existingCard.thumbId;
			existingCard.title = tab.title?.trim() || existingCard.title;
			if (thumbId) existingCard.thumbId = thumbId;
			if (tab.favIconUrl) existingCard.favicon = tab.favIconUrl;
			await writeSetup(setup);
			persisted = true;
			if (thumbId && previousThumbId && previousThumbId !== thumbId) {
				await deleteUnreferencedThumbnails([previousThumbId]).catch(
					() => undefined,
				);
			}
		} else {
			setup.cards.push({
				id: uid(),
				folderId,
				title: tab.title?.trim() || pageUrl,
				url: pageUrl,
				favicon: tab.favIconUrl || "",
				thumbId,
				order: cardsInFolder.length,
				origin: "local",
				capturedAt: null,
			});
			await writeSetup(setup);
			persisted = true;
		}
		flashBadge("✓", "#34C759");
	} catch {
		if (!persisted && thumbId) await deletePendingThumbnail(thumbId);
		flashBadge("✕", "#FF453A");
	}
}

async function deleteUnreferencedThumbnails(
	thumbIds: readonly (string | null)[],
): Promise<void> {
	const candidates = [...new Set(thumbIds.filter((id): id is string => !!id))];
	if (candidates.length === 0) return;
	const setup = await readSetup();
	if (!setup) return;
	const referenced = new Set(
		setup.cards.flatMap((card) => (card.thumbId ? [card.thumbId] : [])),
	);
	for (const thumbId of candidates) {
		if (!referenced.has(thumbId)) await deletePendingThumbnail(thumbId);
	}
}

function queueMissingThumbnailCapture(
	tabId: number,
	tab: { active?: boolean; url?: string },
	expectedUrl = tab.url,
) {
	const url = tab.url;
	if (tab.active === false || !url || !isAbsoluteHttpUrl(url)) {
		cancelPendingThumbnailCapture(tabId);
		return;
	}
	const candidateUrl =
		expectedUrl && isAbsoluteHttpUrl(expectedUrl) ? expectedUrl : url;
	const expectedKey = canonicalUrl(candidateUrl);
	if (!expectedKey) {
		cancelPendingThumbnailCapture(tabId);
		return;
	}

	const navigationGeneration = navigationGenerations.get(tabId) ?? 0;
	const inFlight = inFlightThumbnailCaptures.get(tabId);
	if (inFlight?.navigationGeneration === navigationGeneration) return;
	const attemptKey = thumbnailAttemptKey(tabId, expectedKey);
	if (isWithinThumbnailFailureCooldown(attemptKey)) return;

	cancelPendingThumbnailCapture(tabId);

	const timeoutId = setTimeout(() => {
		const pending = pendingThumbnailCaptures.get(tabId);
		if (!pending || pending.timer !== timeoutId) return;
		pendingThumbnailCaptures.delete(tabId);
		void captureMissingThumbnail(
			tabId,
			pending.expectedUrl,
			pending.expectedKey,
			pending.navigationGeneration,
		).catch(() => {});
	}, THUMBNAIL_SETTLE_DELAY_MS);

	pendingThumbnailCaptures.set(tabId, {
		timer: timeoutId,
		expectedUrl: candidateUrl,
		expectedKey,
		navigationGeneration,
	});
}

async function captureMissingThumbnail(
	tabId: number,
	expectedUrl: string,
	expectedKey: string,
	navigationGeneration: number,
) {
	if (inFlightThumbnailCaptures.has(tabId)) return;
	inFlightThumbnailCaptures.set(tabId, {
		expectedKey,
		navigationGeneration,
	});

	let thumbId: string | null = null;
	let persisted = false;
	try {
		const state = await readSetup();
		if (!state?.settings.thumbnailCapture?.enabled) return;

		let tab = await browser.tabs.get(tabId);
		if (!tabCanBeCaptured(tab, tabId, navigationGeneration)) return;

		let matches = findBookmarksWithoutScreenshot(state.cards, [
			expectedUrl,
			tab.url ?? "",
		]);
		if (matches.length === 0) return;

		const attemptKey = thumbnailAttemptKey(tabId, expectedKey);
		if (isWithinThumbnailFailureCooldown(attemptKey)) return;
		recentThumbnailAttempts.set(attemptKey, Date.now());

		const delayMs = Number(state.settings.thumbnailCapture.delayMs) || 1200;
		if (delayMs > THUMBNAIL_SETTLE_DELAY_MS) {
			await new Promise<void>((resolve) =>
				setTimeout(resolve, delayMs - THUMBNAIL_SETTLE_DELAY_MS),
			);
		}

		// The user may have navigated, switched tabs, or explicitly saved the
		// bookmark while the settle delay was running. Re-read both before the
		// expensive capture so we never attach a stale frame or duplicate an
		// explicit refresh.
		if (navigationGenerations.get(tabId) !== navigationGeneration) return;
		tab = await browser.tabs.get(tabId);
		if (!tabCanBeCaptured(tab, tabId, navigationGeneration)) return;
		const beforeCaptureUrl = tab.url ?? "";
		const beforeCaptureState = await readSetup();
		if (!beforeCaptureState?.settings.thumbnailCapture?.enabled) return;
		matches = findBookmarksWithoutScreenshot(beforeCaptureState.cards, [
			expectedUrl,
			beforeCaptureUrl,
		]);
		if (matches.length === 0) return;

		const dataUrl = await captureVisible(tab.windowId, 82);
		thumbId = await saveThumbnail(dataUrl);

		if (navigationGenerations.get(tabId) !== navigationGeneration) return;
		tab = await browser.tabs.get(tabId);
		if (!tabCanBeCaptured(tab, tabId, navigationGeneration)) return;

		// Re-read fresh state right before writing to avoid clobbering concurrent
		// edits and to ensure an explicit save won the race while we captured.
		const fresh = await readSetup();
		if (!fresh) return;
		const finalMatches = findBookmarksWithoutScreenshot(fresh.cards, [
			expectedUrl,
			tab.url ?? "",
		]);
		if (finalMatches.length === 0) return;
		const matchIds = new Set(finalMatches.map((card) => card.id));
		let changed = false;

		for (const card of fresh.cards) {
			if (!matchIds.has(card.id) || card.thumbId) continue;
			card.thumbId = thumbId;
			if (!card.favicon && tab.favIconUrl) card.favicon = tab.favIconUrl;
			changed = true;
		}

		if (!changed) return;
		await writeSetup(fresh);
		persisted = true;
	} finally {
		const navigationChanged =
			navigationGenerations.get(tabId) !== navigationGeneration;
		if (thumbId && !persisted) await deletePendingThumbnail(thumbId);
		const current = inFlightThumbnailCaptures.get(tabId);
		if (
			current?.expectedKey === expectedKey &&
			current.navigationGeneration === navigationGeneration
		) {
			inFlightThumbnailCaptures.delete(tabId);
		}
		if (navigationGenerations.get(tabId) === navigationGeneration) {
			navigationStartUrls.delete(tabId);
		}
		if (navigationChanged) {
			void browser.tabs
				.get(tabId)
				.then((currentTab) => {
					if (currentTab.active && currentTab.status === "complete") {
						queueMissingThumbnailCapture(tabId, currentTab, currentTab.url);
					}
				})
				.catch(() => undefined);
		}
	}
}

function flashBadge(text: string, color: string) {
	browser.action.setBadgeBackgroundColor({ color });
	browser.action.setBadgeText({ text });
	setTimeout(() => browser.action.setBadgeText({ text: "" }), 1400);
}
