import type { Card, Folder } from "../types";

export interface SearchResult {
	sites: Card[];
	folders: Folder[];
}

/**
 * Simple search index over cards and folders.
 * Case-insensitive substring matching on title, URL, and folder name.
 */
export function searchIndex(
	query: string,
	cards: Card[],
	folders: Folder[],
): SearchResult {
	const q = query.trim().toLowerCase();
	if (!q) return { sites: [], folders: [] };

	const sites = cards.filter(
		(c) => c.title.toLowerCase().includes(q) || c.url.toLowerCase().includes(q),
	);

	const folderResults = folders.filter((f) => f.name.toLowerCase().includes(q));

	return { sites, folders: folderResults };
}
