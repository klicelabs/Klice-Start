import { expect, test } from "bun:test";
import {
	findBookmarkInFolder,
	findBookmarksWithoutScreenshot,
} from "../src/lib/bookmark-match";
import type { Card } from "../src/types";

function card(
	id: string,
	url: string,
	folderId = "folder-1",
	thumbId: string | null = null,
): Card {
	return {
		id,
		folderId,
		title: id,
		url,
		favicon: null,
		thumbId,
		order: 0,
	};
}

test("findBookmarkInFolder only reuses an exact URL in the same destination", () => {
	const saved = card("saved", "https://example.com/article/1");
	const cards = [saved, card("other-folder", saved.url, "folder-2")];

	expect(findBookmarkInFolder(cards, "folder-1", saved.url)?.id).toBe("saved");
	expect(findBookmarkInFolder(cards, "folder-2", saved.url)?.id).toBe(
		"other-folder",
	);
	expect(
		findBookmarkInFolder(cards, "folder-1", "https://example.com/article/2"),
	).toBeUndefined();
	expect(
		findBookmarkInFolder(
			cards,
			"folder-1",
			"https://example.com/article/1?ref=home",
		),
	).toBeUndefined();
	expect(
		findBookmarkInFolder(
			cards,
			"folder-1",
			"https://example.com/article/1#comments",
		),
	).toBeUndefined();
});

test("bookmark URL matching only normalizes safe browser serialization", () => {
	const saved = card("saved", "https://example.com");

	expect(
		findBookmarkInFolder([saved], "folder-1", "https://example.com/")?.id,
	).toBe("saved");
	expect(
		findBookmarkInFolder(
			[card("port", "https://example.com:443/path/")],
			"folder-1",
			"https://example.com/path",
		)?.id,
	).toBe("port");
});

test("navigation matching ignores cards that already have a screenshot", () => {
	const missing = card("missing", "https://example.com");
	const complete = card(
		"complete",
		"https://example.com",
		"folder-1",
		"thumb-1",
	);

	expect(
		findBookmarksWithoutScreenshot(
			[missing, complete],
			["https://example.com/", "https://example.com/home"],
		).map((item) => item.id),
	).toEqual(["missing"]);
});
