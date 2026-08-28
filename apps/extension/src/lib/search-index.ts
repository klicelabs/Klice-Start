import type { Card, Folder } from "../types";

export interface SearchResult {
	sites: Card[];
	folders: Folder[];
}

function scoreCard(card: Card, q: string): number {
	const title = card.title.toLowerCase();
	const url = card.url.toLowerCase();

	if (title === q) return 100;
	if (title.startsWith(q)) return 80;
	if (title.includes(q)) return 60;
	if (
		url.startsWith(q) ||
		url.startsWith(`https://${q}`) ||
		url.startsWith(`http://${q}`)
	)
		return 40;
	if (url.includes(q)) return 20;
	return 0;
}

function scoreFolder(folder: Folder, q: string): number {
	const name = folder.name.toLowerCase();
	if (name === q) return 100;
	if (name.startsWith(q)) return 80;
	if (name.includes(q)) return 60;
	return 0;
}

/**
 * Ranked search index over cards and folders.
 * Relevance-scored matching on title, URL, and folder name.
 */
export function searchIndex(
	query: string,
	cards: Card[],
	folders: Folder[],
): SearchResult {
	const q = query.trim().toLowerCase();
	if (!q) return { sites: [], folders: [] };

	const scoredSites: Array<{ card: Card; score: number }> = [];
	for (const card of cards) {
		const score = scoreCard(card, q);
		if (score > 0) scoredSites.push({ card, score });
	}
	scoredSites.sort((a, b) => b.score - a.score || a.card.order - b.card.order);

	const scoredFolders: Array<{ folder: Folder; score: number }> = [];
	for (const folder of folders) {
		const score = scoreFolder(folder, q);
		if (score > 0) scoredFolders.push({ folder, score });
	}
	scoredFolders.sort(
		(a, b) => b.score - a.score || a.folder.order - b.folder.order,
	);

	return {
		sites: scoredSites.slice(0, 16).map((s) => s.card),
		folders: scoredFolders.slice(0, 8).map((f) => f.folder),
	};
}
