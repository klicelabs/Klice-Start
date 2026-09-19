import { expect, test } from "bun:test";
import { normalizeBrowserBookmarkTree } from "../src/lib/browser-bookmark-tree";

const link = (id: string, title: string) => ({
	id,
	title,
	url: `https://${id}.example/`,
});
const folder = (
	id: string,
	title: string,
	children: Array<ReturnType<typeof link> | ReturnType<typeof folder>> = [],
) => ({ id, title, children });

test("Vivaldi user folders directly under root remain root folders", () => {
	const tree = [
		folder("0", "", [
			folder("10", "Work", [folder("11", "Projects", [link("12", "Issue")])]),
			folder("20", "Personal", [link("21", "Home")]),
		]),
	];
	const result = normalizeBrowserBookmarkTree(tree);
	expect(result.topFolders.map((f) => f.name)).toEqual(["Work", "Personal"]);
	expect(result.topFolders[0]?.children[0]?.name).toBe("Projects");
	expect(result.topFolders[0]?.children[0]?.links[0]?.title).toBe("Issue");
});

test("Chromium native containers are hoisted without flattening user folders", () => {
	const tree = [
		folder("0", "", [
			{
				...folder("1", "Bookmarks bar", [
					folder("10", "Work", [link("11", "A")]),
				]),
				folderType: "bookmarks-bar",
			},
			{
				...folder("2", "Other bookmarks", [folder("20", "Personal")]),
				folderType: "other",
			},
		]),
	];
	const result = normalizeBrowserBookmarkTree(tree);
	expect(result.topFolders.map((f) => f.name)).toEqual(["Work", "Personal"]);
	expect(result.topFolders[0]?.children).toEqual([]);
});

test("Firefox special roots hoist and preserve nested order", () => {
	const tree = [
		folder("root________", "", [
			folder("toolbar_____", "Bookmarks Toolbar", [
				folder("w", "Work", [
					link("a", "A"),
					folder("s", "Sub"),
					link("b", "B"),
				]),
			]),
			folder("menu________", "Bookmarks Menu", [folder("p", "Personal")]),
		]),
	];
	const result = normalizeBrowserBookmarkTree(tree);
	expect(result.topFolders.map((f) => f.name)).toEqual(["Work", "Personal"]);
	expect(result.topFolders[0]?.entries?.map((e) => e.kind)).toEqual([
		"link",
		"folder",
		"link",
	]);
});
