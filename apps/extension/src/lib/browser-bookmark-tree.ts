import type { BookmarkTreeFolder, BookmarkTreeLink } from "./bookmark-merge";
import { isAbsoluteHttpUrl } from "./url";

/** Bookmark APIs return one root node, but only some of its children are browser-owned containers. */
export interface BrowserBookmarkNode {
	id: string;
	title: string;
	url?: string;
	children?: BrowserBookmarkNode[];
	folderType?: string;
}

const FIREFOX_CONTAINERS = new Set([
	"toolbar_____",
	"menu________",
	"unfiled_____",
	"mobile______",
]);
const CHROMIUM_CONTAINERS = new Set(["1", "2", "3"]);
const MAX_DEPTH = 100;

/** Browser-owned roots are identified by API metadata or stable IDs, never translated titles. */
function isNativeContainer(
	node: BrowserBookmarkNode,
	parent: BrowserBookmarkNode,
): boolean {
	if (node.folderType) return true;
	if (parent.id === "root________") return FIREFOX_CONTAINERS.has(node.id);
	// Older Chromium APIs omit folderType. Require the browser's root and its
	// standard pair, avoiding accidental hoisting of Vivaldi user folders.
	if (parent.id !== "0") return false;
	const ids = new Set(parent.children?.map((child) => child.id));
	return ids.has("1") && ids.has("2") && CHROMIUM_CONTAINERS.has(node.id);
}

export function normalizeBrowserBookmarkTree(
	tree: readonly BrowserBookmarkNode[],
): {
	topFolders: BookmarkTreeFolder[];
	topLinks: BookmarkTreeLink[];
} {
	const root = tree[0];
	const topFolders: BookmarkTreeFolder[] = [];
	const topLinks: BookmarkTreeLink[] = [];
	if (!root) return { topFolders, topLinks };

	const convert = (
		node: BrowserBookmarkNode,
		depth: number,
	): BookmarkTreeFolder => {
		if (depth > MAX_DEPTH)
			throw new Error(
				`Browser bookmarks exceed maximum folder nesting depth (${MAX_DEPTH}).`,
			);
		const result: BookmarkTreeFolder = {
			name: node.title.trim() || "Untitled",
			links: [],
			children: [],
			entries: [],
		};
		for (const child of node.children ?? []) {
			if (child.url) {
				if (!isAbsoluteHttpUrl(child.url)) continue;
				const link = { title: child.title.trim() || child.url, url: child.url };
				result.links.push(link);
				result.entries?.push({ kind: "link", ...link });
			} else {
				const folder = convert(child, depth + 1);
				result.children.push(folder);
				result.entries?.push({ kind: "folder", folder });
			}
		}
		return result;
	};

	const append = (node: BrowserBookmarkNode, depth: number): void => {
		if (node.url) {
			if (isAbsoluteHttpUrl(node.url))
				topLinks.push({ title: node.title.trim() || node.url, url: node.url });
		} else {
			topFolders.push(convert(node, depth));
		}
	};
	for (const node of root.children ?? []) {
		if (isNativeContainer(node, root)) {
			for (const child of node.children ?? []) append(child, 1);
		} else append(node, 1);
	}
	return { topFolders, topLinks };
}
