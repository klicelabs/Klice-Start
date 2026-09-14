import type { Card, Folder } from "../types";

export interface SearchResult {
	sites: Card[];
	folders: Folder[];
}

export type SearchIndex = (query: string) => SearchResult;

interface IndexedCard {
	data: Card;
	title: string;
	url: string;
}

interface IndexedFolder {
	data: Folder;
	name: string;
}

function scoreCard(card: IndexedCard, q: string): number {
	const { title, url } = card;

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

function scoreFolder(folder: IndexedFolder, q: string): number {
	const { name } = folder;
	if (name === q) return 100;
	if (name.startsWith(q)) return 80;
	if (name.includes(q)) return 60;
	return 0;
}

/**
 * Build the normalized search data once for a cards/folders snapshot.
 * Queries only score the cached strings and never rebuild the index.
 */
export function createSearchIndex(
	cards: Card[],
	folders: Folder[],
): SearchIndex {
	const indexedCards: IndexedCard[] = cards.map((card) => ({
		data: card,
		title: card.title.toLowerCase(),
		url: card.url.toLowerCase(),
	}));
	const indexedFolders: IndexedFolder[] = folders.map((folder) => ({
		data: folder,
		name: folder.name.toLowerCase(),
	}));

	return (query) => {
		const q = query.trim().toLowerCase();
		if (!q) return { sites: [], folders: [] };

		const scoredSites: Array<{ card: IndexedCard; score: number }> = [];
		for (const card of indexedCards) {
			const score = scoreCard(card, q);
			if (score > 0) scoredSites.push({ card, score });
		}
		scoredSites.sort(
			(a, b) => b.score - a.score || a.card.data.order - b.card.data.order,
		);

		const scoredFolders: Array<{ folder: IndexedFolder; score: number }> = [];
		for (const folder of indexedFolders) {
			const score = scoreFolder(folder, q);
			if (score > 0) scoredFolders.push({ folder, score });
		}
		scoredFolders.sort(
			(a, b) => b.score - a.score || a.folder.data.order - b.folder.data.order,
		);

		return {
			sites: scoredSites.slice(0, 16).map(({ card }) => card.data),
			folders: scoredFolders.slice(0, 8).map(({ folder }) => folder.data),
		};
	};
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
	return createSearchIndex(cards, folders)(query);
}
