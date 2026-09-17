import type { Card } from "../types";
import { canonicalUrl } from "./url";

/** Find one bookmark with the same URL in the requested destination. */
export function findBookmarkInFolder(
	cards: readonly Card[],
	folderId: string,
	rawUrl: string,
): Card | undefined {
	const key = canonicalUrl(rawUrl);
	if (!key) return undefined;
	return cards.find(
		(card) => card.folderId === folderId && canonicalUrl(card.url) === key,
	);
}

/** Find screenshot-less bookmarks matching any URL in one navigation. */
export function findBookmarksWithoutScreenshot(
	cards: readonly Card[],
	rawUrls: readonly string[],
): Card[] {
	const keys = new Set<string>();
	for (const rawUrl of rawUrls) {
		const key = canonicalUrl(rawUrl);
		if (key) keys.add(key);
	}
	if (keys.size === 0) return [];

	return cards.filter(
		(card) => !card.thumbId && keys.has(canonicalUrl(card.url) ?? ""),
	);
}
