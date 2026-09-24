import type { Card } from "../types";
import {
	canonicalizeForAutoCapture,
	canonicalUrl,
	isAbsoluteHttpUrl,
} from "./url";

/** Automatic screenshots only support ordinary web pages. */
export function isThumbnailCaptureUrl(rawUrl: string): boolean {
	return isAbsoluteHttpUrl(rawUrl);
}

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

/**
 * Find thumbnail-less cards whose ORIGIN matches any of the given URLs.
 * This is the on-visit auto-capture matcher: any visit to the same site
 * (any path) refreshes the card. Thumbnail-ed cards never match; hosts
 * stay distinct (www vs bare, subdomains, scheme).
 */
export function findBookmarksByDomain(
	cards: readonly Card[],
	rawUrls: readonly string[],
): Card[] {
	const origins = new Set<string>();
	for (const rawUrl of rawUrls) {
		const origin = canonicalizeForAutoCapture(rawUrl);
		if (origin) origins.add(origin);
	}
	if (origins.size === 0) return [];

	return cards.filter(
		(card) =>
			!card.thumbId && origins.has(canonicalizeForAutoCapture(card.url) ?? ""),
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
