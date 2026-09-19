import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { DOMParser } from "linkedom";
import { planBookmarkMerge } from "../src/lib/bookmark-merge";
import {
	parseNetscapeBookmarkFile,
	serializeBookmarksHtml,
} from "../src/services/bookmarks-html";

Object.assign(globalThis, { DOMParser });

const fixture = (name: string) =>
	readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

for (const [browser, name] of [
	["Chromium", "bookmarks-chromium.html"],
	["Vivaldi", "bookmarks-vivaldi.html"],
	["Firefox", "bookmarks-firefox.html"],
] as const) {
	test(`${browser} Netscape HTML keeps every folder level`, () => {
		const parsed = parseNetscapeBookmarkFile(fixture(name));
		expect(parsed.rootFolders.length).toBe(2);
		expect(parsed.rootFolders.map((folder) => folder.name)).toEqual([
			"Work",
			"Personal",
		]);
		if (browser !== "Firefox")
			expect(parsed.rootFolders[0]?.children[0]?.name).toBe("Projects");
		const plan = planBookmarkMerge(
			[],
			[],
			parsed.rootFolders,
			parsed.rootLinks,
		);
		expect(
			plan.folders.filter((folder) => folder.parentId == null).length,
		).toBe(2);
		const work = plan.folders.find((folder) => folder.name === "Work");
		if (browser === "Chromium" && work) {
			const order = plan.itemOrder[work.id];
			expect(order?.map((key) => key.split(":")[0])).toEqual([
				"card",
				"folder",
				"card",
			]);
		}
	});
}

test("export and reimport retain hierarchy, empty folders, and mixed order", () => {
	const source = parseNetscapeBookmarkFile(fixture("bookmarks-chromium.html"));
	const imported = planBookmarkMerge(
		[],
		[],
		source.rootFolders,
		source.rootLinks,
	);
	const empty = { id: "empty", name: "Empty", parentId: null, order: 99 };
	const folders = [...imported.folders, empty];
	const html = serializeBookmarksHtml(
		folders,
		imported.cards,
		imported.itemOrder,
	);
	const parsed = parseNetscapeBookmarkFile(html);
	const roundtrip = planBookmarkMerge(
		[],
		[],
		parsed.rootFolders,
		parsed.rootLinks,
	);
	expect(roundtrip.folders.map((folder) => folder.name)).toContain("Empty");
	expect(roundtrip.folders.map((folder) => folder.name)).toContain("Projects");
	const work = roundtrip.folders.find((folder) => folder.name === "Work");
	expect(
		work && roundtrip.itemOrder[work.id].map((key) => key.split(":")[0]),
	).toEqual(["card", "folder", "card"]);
});
