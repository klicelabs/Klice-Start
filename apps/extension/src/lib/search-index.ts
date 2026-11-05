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
	path: string;
}

interface IndexedFolder {
	data: Folder;
	name: string;
}

export function normalizeSearchText(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim();
}

export function matchesSearchTerms(value: string, query: string): boolean {
	const text = normalizeSearchText(value);
	return normalizeSearchText(query)
		.split(/\s+/)
		.every((term) => text.includes(term));
}

function scoreCard(card: IndexedCard, q: string, terms: string[]): number {
	const { title, url, path } = card;
	if (
		!terms.every(
			(term) =>
				title.includes(term) || url.includes(term) || path.includes(term),
		)
	)
		return 0;

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
	return (
		10 +
		terms.reduce(
			(score, term) =>
				score + (title.includes(term) ? 8 : url.includes(term) ? 4 : 1),
			0,
		)
	);
}

function scoreFolder(
	folder: IndexedFolder,
	q: string,
	terms: string[],
): number {
	const { name } = folder;
	if (name === q) return 100;
	if (name.startsWith(q)) return 80;
	if (name.includes(q)) return 60;
	return terms.every((term) => name.includes(term)) ? 20 : 0;
}

/**
 * Build the normalized search data once for a cards/folders snapshot.
 * Queries only score the cached strings and never rebuild the index.
 */
export function createSearchIndex(
	cards: Card[],
	folders: Folder[],
): SearchIndex {
	const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
	const folderPath = (id: string): string => {
		const names: string[] = [];
		const visited = new Set<string>();
		let folder = foldersById.get(id);
		while (folder && !visited.has(folder.id)) {
			visited.add(folder.id);
			names.push(folder.name);
			folder = folder.parentId ? foldersById.get(folder.parentId) : undefined;
		}
		return normalizeSearchText(names.join(" "));
	};
	const indexedCards: IndexedCard[] = cards.map((card) => ({
		data: card,
		title: normalizeSearchText(card.title),
		url: normalizeSearchText(card.url),
		path: folderPath(card.folderId),
	}));
	const indexedFolders: IndexedFolder[] = folders.map((folder) => ({
		data: folder,
		name: normalizeSearchText(folder.name),
	}));

	return (query) => {
		const q = normalizeSearchText(query);
		if (!q) return { sites: [], folders: [] };
		const terms = q.split(/\s+/);

		const scoredSites: Array<{ card: IndexedCard; score: number }> = [];
		for (const card of indexedCards) {
			const score = scoreCard(card, q, terms);
			if (score > 0) scoredSites.push({ card, score });
		}
		scoredSites.sort(
			(a, b) => b.score - a.score || a.card.data.order - b.card.data.order,
		);

		const scoredFolders: Array<{ folder: IndexedFolder; score: number }> = [];
		for (const folder of indexedFolders) {
			const score = scoreFolder(folder, q, terms);
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
