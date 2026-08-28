/**
 * Bookmarks interop via the Netscape Bookmark File Format — the HTML format
 * produced by Chrome (chrome://bookmarks → Export) and Firefox (Manage
 * Bookmarks → Export), and accepted by both browsers on import. Perch exports
 * its folder tree + cards in that shape and imports the same format back.
 *
 * Import parses with DOMParser on a detached document (never the live page),
 * reuses folders by case-insensitive name at the same level, and de-dupes
 * cards per folder by canonical URL, so re-importing is idempotent. All
 * mutations are committed in a single setState at the end to avoid
 * intermediate re-renders and read-modify-write races on the store.
 */
import { canonicalUrl, faviconUrl, isAbsoluteHttpUrl } from "../lib/url";
import { uid } from "../lib/utils";
import { useSetupStore } from "../stores/setup-store";
import type { Card, Folder } from "../types";

export interface HtmlImportResult {
	foldersCreated: number;
	cardsCreated: number;
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

/** Escape text for safe embedding in an HTML attribute or text node. */
function escapeHtml(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

/**
 * Export Perch's folders and cards as a Netscape Bookmark File, downloaded as
 * `perch-bookmarks.html`. Hierarchy is preserved (roots → children via
 * parentId) and empty folders are included so the structure round-trips.
 */
export async function exportBookmarksHtml(): Promise<void> {
	const { folders, cards } = useSetupStore.getState();

	const folderIds = new Set(folders.map((f) => f.id));

	// Group folders by parent; orphaned parentId values fall back to root.
	const childrenByParent = new Map<string | null, Folder[]>();
	for (const folder of folders) {
		const parentId =
			folder.parentId !== null && folderIds.has(folder.parentId)
				? folder.parentId
				: null;
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
	a.download = "perch-bookmarks.html";
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
 * Import a Netscape Bookmark File (as exported by Chrome or Firefox) into
 * Perch as folders + cards. Folders are matched by (case-insensitive) name at
 * the same level and reused if present, so re-importing is idempotent. Cards
 * are de-duplicated per folder by canonical URL. Throws when the file
 * contains no folders or links.
 */
export async function importBookmarksHtml(
	fileText: string,
): Promise<HtmlImportResult> {
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

	const store = useSetupStore.getState();

	// Work on local copies, commit once at the end.
	const folders: Folder[] = [...store.folders];
	const cards: Card[] = [...store.cards];

	// Existing folders indexed by (case-insensitive) name per parent level.
	const folderByParentAndName = new Map<string, Folder>();
	for (const f of folders) {
		folderByParentAndName.set(
			`${f.parentId ?? ""}\u0000${f.name.toLowerCase()}`,
			f,
		);
	}

	// Canonical URLs already present per folder id, for dedup.
	const seenByFolder = new Map<string, Set<string>>();
	const seenFor = (folderId: string): Set<string> => {
		let set = seenByFolder.get(folderId);
		if (!set) {
			set = new Set(
				cards
					.filter((c) => c.folderId === folderId)
					.map((c) => canonicalUrl(c.url))
					.filter((u): u is string => u !== null),
			);
			seenByFolder.set(folderId, set);
		}
		return set;
	};

	let foldersCreated = 0;
	let cardsCreated = 0;

	const ensureFolder = (name: string, parentId: string | null): Folder => {
		const key = `${parentId ?? ""}\u0000${name.toLowerCase()}`;
		const existing = folderByParentAndName.get(key);
		if (existing) return existing;
		const folder: Folder = {
			id: uid(),
			name,
			order: folders.reduce(
				(nextOrder, folder) =>
					(folder.parentId ?? null) === parentId
						? Math.max(nextOrder, folder.order + 1)
						: nextOrder,
				0,
			),
			parentId,
		};
		folders.push(folder);
		folderByParentAndName.set(key, folder);
		foldersCreated++;
		return folder;
	};

	const addLinks = (target: Folder, parsedLinks: ParsedLink[]): void => {
		const seen = seenFor(target.id);
		let order = cards.reduce(
			(nextOrder, card) =>
				card.folderId === target.id
					? Math.max(nextOrder, card.order + 1)
					: nextOrder,
			0,
		);
		for (const link of parsedLinks) {
			const canon = canonicalUrl(link.url);
			if (!canon || seen.has(canon)) continue;
			cards.push({
				id: uid(),
				folderId: target.id,
				title: link.title,
				url: link.url,
				favicon: faviconUrl(link.url),
				thumbId: null,
				order: order++,
				origin: "local",
				capturedAt: null,
			});
			seen.add(canon);
			cardsCreated++;
		}
	};

	const merge = (parsedFolder: ParsedFolder, parentId: string | null): void => {
		const folder = ensureFolder(parsedFolder.name, parentId);
		addLinks(folder, parsedFolder.links);
		for (const child of parsedFolder.children) merge(child, folder.id);
	};

	// Loose links outside any folder land in a catch-all root folder.
	if (rootLinks.length > 0) {
		addLinks(ensureFolder("Bookmarks", null), rootLinks);
	}
	for (const parsedFolder of rootFolders) merge(parsedFolder, null);

	if (foldersCreated > 0 || cardsCreated > 0) {
		useSetupStore.setState({ folders, cards });
	}

	return { foldersCreated, cardsCreated };
}
