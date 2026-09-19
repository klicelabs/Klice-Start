import type { Card, Folder } from "../types";
import {
	containerKeyOf,
	type ItemOrder,
	itemKey,
	repairItemOrder,
} from "./item-order";
import { canonicalUrl, faviconUrl } from "./url";
import { uid } from "./utils";

/**
 * Pure bookmark-tree merge planner (no store access — unit-testable).
 *
 * Merge rules (the product contract for every Import path):
 * - folders match by case-insensitive name AT THE SAME LEVEL and are
 *   reused, so re-importing is idempotent and nested structure merges
 *   instead of duplicating;
 * - cards de-dupe per folder by canonical URL; the SAME url in DIFFERENT
 *   folders is kept in both (location is part of identity);
 * - malformed links (non-http(s), unparseable) are skipped, never fatal;
 * - empty titles fall back to the URL; empty folder names to "Untitled";
 * - loose root links land in a catch-all "Bookmarks" root folder;
 * - planning never mutates its inputs; the caller commits atomically.
 */

export interface BookmarkTreeLink {
	title: string;
	url: string;
}

export interface BookmarkTreeFolder {
	name: string;
	links: BookmarkTreeLink[];
	children: BookmarkTreeFolder[];
	/** Original mixed sibling order, when supplied by an API or HTML parser. */
	entries?: BookmarkTreeEntry[];
}

export type BookmarkTreeEntry =
	| ({ kind: "link" } & BookmarkTreeLink)
	| { kind: "folder"; folder: BookmarkTreeFolder };

export interface BookmarkMergePlan {
	folders: Folder[];
	cards: Card[];
	itemOrder: ItemOrder;
	foldersCreated: number;
	cardsCreated: number;
	/** Folder ids that gained content (reveal targets), in touch order. */
	touchedFolderIds: string[];
}

export function planBookmarkMerge(
	existingFolders: readonly Folder[],
	existingCards: readonly Card[],
	rootFolders: readonly BookmarkTreeFolder[],
	rootLinks: readonly BookmarkTreeLink[],
	existingItemOrder?: ItemOrder,
): BookmarkMergePlan {
	const folders: Folder[] = existingFolders.map((f) => ({ ...f }));
	const cards: Card[] = existingCards.map((c) => ({ ...c }));
	const order = repairItemOrder(existingItemOrder, folders, cards);
	const appendOrder = (
		container: string,
		kind: "card" | "folder",
		id: string,
	) => {
		const keys = order[container] ?? [];
		keys.push(itemKey(kind, id));
		order[container] = keys;
	};
	const touched: string[] = [];
	const touch = (id: string) => {
		if (!touched.includes(id)) touched.push(id);
	};

	// M8: BOTH sides of the match use the same key — NFC-normalized,
	// trimmed, lowercased. The old map keyed on raw toLowerCase() while
	// ensureFolder trimmed, so " Docs" (existing) and "Docs" (incoming)
	// missed each other and duplicated the folder.
	const folderNameKey = (name: string): string =>
		name.normalize("NFC").trim().toLowerCase();

	const folderByParentAndName = new Map<string, Folder[]>();
	for (const f of folders) {
		const key = `${f.parentId ?? ""}\u0000${folderNameKey(f.name)}`;
		const matches = folderByParentAndName.get(key) ?? [];
		matches.push(f);
		folderByParentAndName.set(key, matches);
	}
	const claimedFolders = new Set<string>();

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
		const clean = name.trim() || "Untitled";
		const key = `${parentId ?? ""}\u0000${folderNameKey(clean)}`;
		const existing = folderByParentAndName
			.get(key)
			?.find((candidate) => !claimedFolders.has(candidate.id));
		if (existing) {
			claimedFolders.add(existing.id);
			return existing;
		}
		const folder: Folder = {
			id: uid(),
			name: clean,
			order: folders.reduce(
				(nextOrder, f) =>
					(f.parentId ?? null) === parentId
						? Math.max(nextOrder, f.order + 1)
						: nextOrder,
				0,
			),
			parentId,
		};
		folders.push(folder);
		appendOrder(containerKeyOf(parentId), "folder", folder.id);
		const matches = folderByParentAndName.get(key) ?? [];
		matches.push(folder);
		folderByParentAndName.set(key, matches);
		claimedFolders.add(folder.id);
		foldersCreated++;
		touch(folder.id);
		return folder;
	};

	const addLinks = (
		target: Folder,
		links: readonly BookmarkTreeLink[],
	): void => {
		const seen = seenFor(target.id);
		let order = cards.reduce(
			(nextOrder, card) =>
				card.folderId === target.id
					? Math.max(nextOrder, card.order + 1)
					: nextOrder,
			0,
		);
		for (const link of links) {
			const canon = canonicalUrl(link.url);
			if (!canon || seen.has(canon)) continue;
			const id = uid();
			cards.push({
				id,
				folderId: target.id,
				title: link.title.trim() || link.url,
				url: link.url,
				favicon: faviconUrl(link.url),
				thumbId: null,
				order: order++,
				origin: "local",
				capturedAt: null,
			});
			appendOrder(target.id, "card", id);
			seen.add(canon);
			cardsCreated++;
			touch(target.id);
		}
	};

	const merge = (
		treeFolder: BookmarkTreeFolder,
		parentId: string | null,
	): void => {
		const folder = ensureFolder(treeFolder.name, parentId);
		if (treeFolder.entries) {
			for (const entry of treeFolder.entries) {
				if (entry.kind === "link") addLinks(folder, [entry]);
				else merge(entry.folder, folder.id);
			}
		} else {
			addLinks(folder, treeFolder.links);
			for (const child of treeFolder.children) merge(child, folder.id);
		}
	};

	if (rootLinks.length > 0) {
		addLinks(ensureFolder("Bookmarks", null), rootLinks);
	}
	for (const treeFolder of rootFolders) merge(treeFolder, null);

	return {
		folders,
		cards,
		itemOrder: repairItemOrder(order, folders, cards),
		foldersCreated,
		cardsCreated,
		touchedFolderIds: touched,
	};
}

/** "3 links in 2 folders" preview copy for the import choice dialog. */
export function summarizeBookmarkTree(
	rootFolders: readonly BookmarkTreeFolder[],
	rootLinks: readonly { title: string; url: string }[],
): { folders: number; links: number; text: string } {
	let folders = 0;
	let links = rootLinks.length;
	const walk = (nodes: readonly BookmarkTreeFolder[]): void => {
		for (const node of nodes) {
			folders++;
			links += node.links.length;
			walk(node.children);
		}
	};
	walk(rootFolders);
	const parts: string[] = [];
	if (links > 0) parts.push(`${links} link${links === 1 ? "" : "s"}`);
	if (folders > 0) parts.push(`${folders} folder${folders === 1 ? "" : "s"}`);
	return { folders, links, text: parts.join(" in ") || "nothing importable" };
}
