import { canonicalUrl, faviconUrl } from "../lib/url";
import { uid } from "../lib/utils";
import { useSetupStore } from "../stores/setup-store";
import type { Card, Folder } from "../types";

export interface BookmarkImportResult {
	foldersCreated: number;
	cardsCreated: number;
}

/**
 * Import the browser's bookmarks into Perch as folders + cards.
 *
 * Folders are matched by (case-insensitive) name and reused if present, so
 * re-running the import is idempotent. Cards are de-duplicated per folder by
 * canonical URL. All mutations are committed in a single setState at the end
 * to avoid intermediate re-renders and read-modify-write races on the store.
 */
export async function importBrowserBookmarks(): Promise<BookmarkImportResult> {
	if (!chrome.bookmarks) {
		throw new Error("Bookmarks permission not available.");
	}

	const tree = await chrome.bookmarks.getTree();
	const store = useSetupStore.getState();

	// Work on local copies, commit once at the end.
	const folders: Folder[] = [...store.folders];
	const cards: Card[] = [...store.cards];

	const folderByName = new Map<string, Folder>();
	for (const f of folders) folderByName.set(f.name.toLowerCase(), f);

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

	const ensureFolder = (name: string): Folder => {
		const key = name.toLowerCase();
		const existing = folderByName.get(key);
		if (existing) return existing;
		const folder: Folder = {
			id: uid(),
			name,
			order: folders.length,
			parentId: null,
		};
		folders.push(folder);
		folderByName.set(key, folder);
		foldersCreated++;
		return folder;
	};

	const walk = (
		node: chrome.bookmarks.BookmarkTreeNode,
		inheritedName: string | null,
	): void => {
		if (!node.children) return;
		const leaves = node.children.filter((n) => n.url);
		const subFolders = node.children.filter((n) => !n.url && n.children);

		if (leaves.length > 0) {
			const folderName = inheritedName || node.title || "Bookmarks";
			const folder = ensureFolder(folderName);
			const seen = seenFor(folder.id);
			let order = cards.filter((c) => c.folderId === folder.id).length;

			for (const bm of leaves) {
				const url = bm.url;
				if (!url) continue;
				const canon = canonicalUrl(url);
				if (!canon || seen.has(canon)) continue;
				cards.push({
					id: uid(),
					folderId: folder.id,
					title: bm.title || url,
					url,
					favicon: faviconUrl(url),
					thumbId: null,
					order: order++,
					origin: "local",
					capturedAt: null,
				});
				seen.add(canon);
				cardsCreated++;
			}
		}

		for (const sub of subFolders) walk(sub, sub.title);
	};

	for (const root of tree) walk(root, null);

	if (foldersCreated > 0 || cardsCreated > 0) {
		useSetupStore.setState({ folders, cards });
	}

	return { foldersCreated, cardsCreated };
}
