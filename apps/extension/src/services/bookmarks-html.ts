/**
 * Bookmarks interop via the Netscape Bookmark File Format — the HTML format
 * produced by Chrome (chrome://bookmarks → Export) and Firefox (Manage
 * Bookmarks → Export), and accepted by both browsers on import. Klice Start
 * exports its folder tree + cards in that shape and imports the same format back.
 *
 * Import parses with DOMParser on a detached document (never the live page),
 * reuses folders by case-insensitive name at the same level, and de-dupes
 * cards per folder by canonical URL, so re-importing is idempotent. All
 * mutations are committed in a single setState at the end to avoid
 * intermediate re-renders and read-modify-write races on the store.
 */
import {
	type BookmarkTreeFolder,
	planBookmarkMerge,
} from "../lib/bookmark-merge";
import { repairItemOrder } from "../lib/item-order";
import { isAbsoluteHttpUrl } from "../lib/url";
import { useSetupStore } from "../stores/setup-store";
import type { Card, Folder } from "../types";

export interface BookmarkImportResult {
	foldersCreated: number;
	cardsCreated: number;
	/** First folder that gained content (reveal target), if any. */
	revealFolderId: string | null;
}

interface ParsedLink {
	title: string;
	url: string;
}

/** A parsed node from a Netscape bookmark file: a folder with its children. */
interface ParsedFolder {
	name: string;
	links: ParsedLink[];
	children: ParsedFolder[];
}

/** A folder in a normalized bookmark tree (HTML file or browser bookmarks). */
export type { BookmarkTreeFolder };

/** Escape text for safe embedding in an HTML attribute or text node. */
function escapeHtml(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

/**
 * Export Klice Start's folders and cards as a Netscape Bookmark File, downloaded
 * as `klice-start-bookmarks.html`. Hierarchy is preserved (roots → children via
 * parentId) and empty folders are included so the structure round-trips.
 */
export async function exportBookmarksHtml(): Promise<void> {
	const { folders, cards } = useSetupStore.getState();

	const folderIds = new Set(folders.map((f) => f.id));

	// Group folders by parent; orphaned parentId values fall back to root.
	const childrenByParent = new Map<string | null, Folder[]>();
	for (const folder of folders) {
		const rawParentId = folder.parentId ?? null;
		const parentId =
			rawParentId !== null && folderIds.has(rawParentId) ? rawParentId : null;
		const list = childrenByParent.get(parentId);
		if (list) list.push(folder);
		else childrenByParent.set(parentId, [folder]);
	}
	for (const list of childrenByParent.values()) {
		list.sort((a, b) => a.order - b.order);
	}

	// Group cards by folder; cards whose folder is missing are skipped.
	const cardsByFolder = new Map<string, Card[]>();
	for (const card of cards) {
		if (!folderIds.has(card.folderId)) continue;
		const list = cardsByFolder.get(card.folderId);
		if (list) list.push(card);
		else cardsByFolder.set(card.folderId, [card]);
	}
	for (const list of cardsByFolder.values()) {
		list.sort((a, b) => a.order - b.order);
	}

	const lines: string[] = [
		"<!DOCTYPE NETSCAPE-Bookmark-file-1>",
		"<!-- This is an automatically generated file.",
		"It will be read and overwritten.",
		"DO NOT EDIT! -->",
		'<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
		"<TITLE>Bookmarks</TITLE>",
		"<H1>Bookmarks</H1>",
		"<DL><p>",
	];

	const emitFolder = (folder: Folder, depth: number): void => {
		const indent = "    ".repeat(depth);
		lines.push(`${indent}<DT><H3>${escapeHtml(folder.name)}</H3>`);
		lines.push(`${indent}<DL><p>`);
		for (const card of cardsByFolder.get(folder.id) ?? []) {
			if (!isAllowedScheme(card.url)) continue;
			lines.push(
				`${indent}    <DT><A HREF="${escapeHtml(card.url)}">${escapeHtml(card.title)}</A>`,
			);
		}
		for (const child of childrenByParent.get(folder.id) ?? []) {
			emitFolder(child, depth + 1);
		}
		lines.push(`${indent}</DL><p>`);
	};

	for (const root of childrenByParent.get(null) ?? []) {
		emitFolder(root, 1);
	}
	lines.push("</DL><p>");

	const blob = new Blob([lines.join("\n")], { type: "text/html" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = "klice-start-bookmarks.html";
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** True when the href is an absolute http: or https: URL. */
function isAllowedScheme(href: string): boolean {
	return isAbsoluteHttpUrl(href);
}

/**
 * Parse one `<DL>` level: `<DT><A>` entries are links of this level, and
 * `<DT><H3>` entries open folders. Links and subfolders may be interleaved in
 * document order.
 *
 * The folder's content `<DL>` is a CHILD of the `<DT>` in the DOM that
 * browsers actually produce: the HTML5 parser does not close an open `<DT>`
 * before a `<DL>` start tag (verified against the spec tree construction).
 * Exporters that emit explicit `</DT>` produce a sibling `<DL>` instead, so
 * both shapes are accepted.
 */
interface ParseBudget {
	dtNodes: number;
}

const MAX_BOOKMARK_INPUT_LENGTH = 10 * 1024 * 1024;
const MAX_BOOKMARK_NESTING_DEPTH = 100;
const MAX_BOOKMARK_DT_NODES = 100_000;

function parseLevel(
	dl: Element,
	budget: ParseBudget,
	depth: number,
): {
	links: ParsedLink[];
	folders: ParsedFolder[];
} {
	const links: ParsedLink[] = [];
	const folders: ParsedFolder[] = [];

	if (depth > MAX_BOOKMARK_NESTING_DEPTH) {
		throw new Error(
			`Bookmark file exceeds maximum folder nesting depth (${MAX_BOOKMARK_NESTING_DEPTH}).`,
		);
	}
	for (const dt of Array.from(dl.children)) {
		if (dt.tagName !== "DT") continue;
		budget.dtNodes++;
		if (budget.dtNodes > MAX_BOOKMARK_DT_NODES) {
			throw new Error(
				`Bookmark file contains too many entries (maximum ${MAX_BOOKMARK_DT_NODES}).`,
			);
		}

		const heading = dt.querySelector(":scope > H3");
		if (heading) {
			const folder: ParsedFolder = {
				name: heading.textContent?.trim() || "Untitled",
				links: [],
				children: [],
			};
			folders.push(folder);

			// The folder's content <DL> appears in one of three shapes:
			// child of the <DT> (browser-parsed files — the HTML5 parser does
			// not close an open <DT> before <DL>), inside a <DD> sibling (the
			// <DD> start tag does close the <DT>), or as a plain <DL> sibling
			// when the exporter wrote explicit </DT>.
			let innerDl = dt.querySelector(":scope > DL");
			if (!innerDl) {
				const sibling = dt.nextElementSibling;
				if (sibling?.tagName === "DL") innerDl = sibling;
				else if (sibling?.tagName === "DD") {
					innerDl = sibling.querySelector(":scope > DL");
				}
			}
			if (innerDl) {
				const inner = parseLevel(innerDl, budget, depth + 1);
				folder.links = inner.links;
				folder.children = inner.folders;
			}
			continue;
		}

		const anchor = dt.querySelector(":scope > A");
		if (!anchor) continue;
		const href = anchor.getAttribute("href") ?? "";
		if (!href || !isAllowedScheme(href)) continue;
		links.push({ title: anchor.textContent?.trim() || href, url: href });
	}

	return { links, folders };
}

/**
 * Merge a normalized bookmark tree into Klice Start as folders + cards.
 * Plans purely, then commits a single store update (plus the repaired
 * ordering) so a failed import can never leave a half-written library.
 * See lib/bookmark-merge for the merge rules.
 */
export function mergeBookmarkTree(
	rootFolders: BookmarkTreeFolder[],
	rootLinks: { title: string; url: string }[],
): BookmarkImportResult {
	const store = useSetupStore.getState();
	const plan = planBookmarkMerge(
		store.folders,
		store.cards,
		rootFolders,
		rootLinks,
	);

	if (plan.foldersCreated > 0 || plan.cardsCreated > 0) {
		// repairItemOrder appends the newly imported entities to their
		// containers, so the unified ordering survives bulk imports.
		useSetupStore.setState({
			folders: plan.folders,
			cards: plan.cards,
			itemOrder: repairItemOrder(store.itemOrder, plan.folders, plan.cards),
		});
	}

	return {
		foldersCreated: plan.foldersCreated,
		cardsCreated: plan.cardsCreated,
		revealFolderId: plan.touchedFolderIds[0] ?? null,
	};
}

export interface BookmarkReplaceResult extends BookmarkImportResult {
	/** First folder with imported content (reveal target), if any. */
	revealFolderId: string | null;
}

/**
 * Replace the library with a bookmark tree: plan against an empty library,
 * then swap folders/cards/active folder in one commit. Settings are kept.
 */
export function replaceBookmarkLibrary(
	rootFolders: BookmarkTreeFolder[],
	rootLinks: { title: string; url: string }[],
): BookmarkReplaceResult {
	const plan = planBookmarkMerge([], [], rootFolders, rootLinks);
	const firstFolder = plan.folders[0] ?? null;
	useSetupStore.setState({
		folders: plan.folders,
		cards: plan.cards,
		activeFolderId: firstFolder?.id ?? "default",
		itemOrder: repairItemOrder(undefined, plan.folders, plan.cards),
	});
	return {
		foldersCreated: plan.foldersCreated,
		cardsCreated: plan.cardsCreated,
		revealFolderId: plan.touchedFolderIds[0] ?? firstFolder?.id ?? null,
	};
}

export interface ParsedBookmarkFile {
	rootFolders: ParsedFolder[];
	rootLinks: ParsedLink[];
}

/**
 * Parse a Netscape Bookmark File without touching state: used for the
 * pre-import preview (counts) in the Keep/Replace choice, so malformed or
 * empty files fail before any dialog opens. Throws on the same conditions
 * as the import itself.
 */
export function parseNetscapeBookmarkFile(fileText: string): ParsedBookmarkFile {
	if (typeof fileText !== "string") {
		throw new Error("Bookmark file must be provided as text.");
	}
	if (fileText.length > MAX_BOOKMARK_INPUT_LENGTH) {
		throw new Error(
			`Bookmark file exceeds maximum input length (${MAX_BOOKMARK_INPUT_LENGTH} characters).`,
		);
	}
	const doc = new DOMParser().parseFromString(fileText, "text/html");
	const budget: ParseBudget = { dtNodes: 0 };

	// Parse only top-level <DL> lists; nested ones are reached via recursion.
	const rootLinks: ParsedLink[] = [];
	const rootFolders: ParsedFolder[] = [];
	for (const dl of Array.from(doc.querySelectorAll("DL"))) {
		let ancestor = dl.parentElement;
		let nested = false;
		while (ancestor) {
			if (ancestor.tagName === "DL") {
				nested = true;
				break;
			}
			ancestor = ancestor.parentElement;
		}
		if (nested) continue;

		const level = parseLevel(dl, budget, 0);
		rootLinks.push(...level.links);
		rootFolders.push(...level.folders);
	}

	if (rootLinks.length === 0 && rootFolders.length === 0) {
		throw new Error("No bookmarks found in file.");
	}

	return { rootFolders, rootLinks };
}

export interface BookmarkImportOptions {
	/** Replace the library instead of merging into it. */
	replace?: boolean;
}

/**
 * Import a Netscape Bookmark File (as exported by Chrome or Firefox) into
 * Klice Start as folders + cards. Throws when the file contains no folders
 * or links. Merge semantics are provided by {@link mergeBookmarkTree};
 * replace mode swaps the whole library via {@link replaceBookmarkLibrary}.
 */
export async function importBookmarksHtml(
	fileText: string,
	options: BookmarkImportOptions = {},
): Promise<BookmarkImportResult> {
	const { rootFolders, rootLinks } = parseNetscapeBookmarkFile(fileText);
	if (options.replace) return replaceBookmarkLibrary(rootFolders, rootLinks);
	return mergeBookmarkTree(rootFolders, rootLinks);
}

/**
 * Import the browser's own bookmark tree (chrome.bookmarks) into Klice Start.
 * The native root containers ("Bookmarks Bar", "Other Bookmarks", Firefox's
 * "Bookmarks Menu" and "Mobile Bookmarks") are containers, not user folders:
 * their children are hoisted to the top level, and a hoisted container's
 * direct links join the loose root links (merged into the catch-all
 * "Bookmarks" folder). Only http(s) links are imported. Merge semantics are
 * provided by {@link mergeBookmarkTree}.
 */
/**
 * Read + convert the browser tree without touching state (preview step).
 * Throws when unsupported, unreadable, or empty — before any dialog opens.
 */
export async function readBrowserBookmarks(): Promise<{
	topFolders: BookmarkTreeFolder[];
	topLinks: { title: string; url: string }[];
}> {
	if (typeof chrome === "undefined" || !chrome.bookmarks?.getTree) {
		throw new Error("Bookmark import is not supported in this browser.");
	}

	let tree: chrome.bookmarks.BookmarkTreeNode[];
	try {
		tree = await chrome.bookmarks.getTree();
	} catch (err) {
		throw new Error(
			"Could not read browser bookmarks. Check the extension permissions.",
			{ cause: err },
		);
	}

	const topFolders: BookmarkTreeFolder[] = [];
	const topLinks: { title: string; url: string }[] = [];

	const convertFolder = (
		node: chrome.bookmarks.BookmarkTreeNode,
		depth: number,
	): BookmarkTreeFolder => {
		if (depth > MAX_BOOKMARK_NESTING_DEPTH) {
			throw new Error(
				`Browser bookmarks exceed maximum folder nesting depth (${MAX_BOOKMARK_NESTING_DEPTH}).`,
			);
		}
		const folder: BookmarkTreeFolder = {
			name: node.title.trim() || "Untitled",
			links: [],
			children: [],
		};
		for (const child of node.children ?? []) {
			if (child.url) {
				if (isAbsoluteHttpUrl(child.url)) {
					folder.links.push({
						title: child.title.trim() || child.url,
						url: child.url,
					});
				}
				continue;
			}
			folder.children.push(convertFolder(child, depth + 1));
		}
		return folder;
	};

	// tree[0] is the browser root node; its children are the root containers
	// (bookmark bar, other bookmarks, …). Hoist each container's children to
	// the top level instead of creating a wrapper folder per container.
	for (const rootContainer of tree[0]?.children ?? []) {
		if (rootContainer.url) {
			if (isAbsoluteHttpUrl(rootContainer.url)) {
				topLinks.push({
					title: rootContainer.title.trim() || rootContainer.url,
					url: rootContainer.url,
				});
			}
			continue;
		}
		for (const child of rootContainer.children ?? []) {
			if (child.url) {
				if (isAbsoluteHttpUrl(child.url)) {
					topLinks.push({
						title: child.title.trim() || child.url,
						url: child.url,
					});
				}
				continue;
			}
			topFolders.push(convertFolder(child, 2));
		}
	}

	const hasLinks = (folder: BookmarkTreeFolder): boolean =>
		folder.links.length > 0 || folder.children.some(hasLinks);
	if (topLinks.length === 0 && !topFolders.some(hasLinks)) {
		throw new Error("No bookmarks found in this browser.");
	}

	return { topFolders, topLinks };
}

export async function importBookmarksFromBrowser(
	options: BookmarkImportOptions = {},
): Promise<BookmarkImportResult> {
	const { topFolders, topLinks } = await readBrowserBookmarks();
	if (options.replace) return replaceBookmarkLibrary(topFolders, topLinks);
	return mergeBookmarkTree(topFolders, topLinks);
}
