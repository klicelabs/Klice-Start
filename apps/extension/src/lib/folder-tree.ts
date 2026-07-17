import type { Folder } from "../types";

export interface FolderTreeNode {
	folder: Folder;
	depth: number;
	children: FolderTreeNode[];
}

export interface FlatFolderOption {
	folder: Folder;
	depth: number;
}

/** Stable sort by order, then name, so tree rendering is deterministic. */
function sortFolders(folders: Folder[]): Folder[] {
	return [...folders].sort((a, b) => {
		if (a.order !== b.order) return a.order - b.order;
		return a.name.localeCompare(b.name);
	});
}

/** Direct children of a folder (or roots when parentId is null), ordered. */
export function getChildren(
	folders: Folder[],
	parentId: string | null,
): Folder[] {
	return sortFolders(folders.filter((f) => (f.parentId ?? null) === parentId));
}

/**
 * Build the full hierarchical tree starting from root folders.
 * Any folder whose parentId does not resolve to a real folder is treated as a root,
 * so orphans never disappear from the UI.
 */
export function buildTree(folders: Folder[]): FolderTreeNode[] {
	const ids = new Set(folders.map((f) => f.id));

	const rootOf = (f: Folder): string | null => {
		const parent = f.parentId ?? null;
		return parent && ids.has(parent) ? parent : null;
	};

	const build = (
		parentId: string | null,
		depth: number,
		seen: Set<string>,
	): FolderTreeNode[] => {
		return sortFolders(folders.filter((f) => rootOf(f) === parentId))
			.filter((f) => !seen.has(f.id))
			.map((folder) => {
				const nextSeen = new Set(seen).add(folder.id);
				return {
					folder,
					depth,
					children: build(folder.id, depth + 1, nextSeen),
				};
			});
	};

	return build(null, 0, new Set());
}

/** Flatten the tree into an indented list, ideal for a <Select>-style picker. */
export function flattenForPicker(folders: Folder[]): FlatFolderOption[] {
	const out: FlatFolderOption[] = [];
	const walk = (nodes: FolderTreeNode[]) => {
		for (const node of nodes) {
			out.push({ folder: node.folder, depth: node.depth });
			walk(node.children);
		}
	};
	walk(buildTree(folders));
	return out;
}

/** All descendant ids of a folder (excluding the folder itself). */
export function getDescendantIds(
	folders: Folder[],
	folderId: string,
): string[] {
	const out: string[] = [];
	const stack = [folderId];
	const guard = new Set<string>([folderId]);
	while (stack.length > 0) {
		const current = stack.pop() as string;
		for (const child of folders.filter(
			(f) => (f.parentId ?? null) === current,
		)) {
			if (guard.has(child.id)) continue;
			guard.add(child.id);
			out.push(child.id);
			stack.push(child.id);
		}
	}
	return out;
}

/** A folder id plus all of its descendants — the full subtree. */
export function getSubtreeIds(folders: Folder[], folderId: string): string[] {
	return [folderId, ...getDescendantIds(folders, folderId)];
}

/** Ancestor chain from the root down to (but not including) the folder. */
export function getAncestors(folders: Folder[], folderId: string): Folder[] {
	const byId = new Map(folders.map((f) => [f.id, f]));
	const chain: Folder[] = [];
	const seen = new Set<string>();
	let current = byId.get(folderId);
	while (current?.parentId) {
		if (seen.has(current.parentId)) break;
		seen.add(current.parentId);
		const parent = byId.get(current.parentId);
		if (!parent) break;
		chain.unshift(parent);
		current = parent;
	}
	return chain;
}

/** Breadcrumb from root to the folder, inclusive. Empty if the folder is missing. */
export function getBreadcrumb(folders: Folder[], folderId: string): Folder[] {
	const folder = folders.find((f) => f.id === folderId);
	if (!folder) return [];
	return [...getAncestors(folders, folderId), folder];
}

/**
 * True if reparenting `folderId` under `newParentId` would create a cycle
 * (i.e. the new parent is the folder itself or one of its descendants).
 */
export function wouldCreateCycle(
	folders: Folder[],
	folderId: string,
	newParentId: string | null,
): boolean {
	if (newParentId === null) return false;
	if (newParentId === folderId) return true;
	return getDescendantIds(folders, folderId).includes(newParentId);
}
