import { beforeEach, expect, test } from "bun:test";
import { buildItemOrder } from "../src/lib/item-order";
import { selectedAncestorOf } from "../src/lib/selection-model";
import { useSelectionStore } from "../src/stores/selection-store";
import { useSetupStore } from "../src/stores/setup-store";
import type { Card, Folder } from "../src/types";

const folders: Folder[] = [
	{ id: "root", name: "Root", order: 0, parentId: null },
	{ id: "sub", name: "Sub", order: 0, parentId: "root" },
	{ id: "other", name: "Other", order: 1, parentId: "root" },
	{ id: "deep", name: "Deep", order: 0, parentId: "sub" },
];
const cards: Card[] = [
	{
		id: "one",
		folderId: "root",
		title: "One",
		url: "https://example.com/1",
		favicon: null,
		thumbId: null,
		order: 0,
	},
	{
		id: "two",
		folderId: "sub",
		title: "Two",
		url: "https://example.com/2",
		favicon: null,
		thumbId: null,
		order: 0,
	},
	{
		id: "three",
		folderId: "sub",
		title: "Three",
		url: "https://example.com/3",
		favicon: null,
		thumbId: null,
		order: 1,
	},
	{
		id: "four",
		folderId: "deep",
		title: "Four",
		url: "https://example.com/4",
		favicon: null,
		thumbId: null,
		order: 0,
	},
];

beforeEach(() => {
	useSetupStore.setState({
		folders,
		cards,
		itemOrder: buildItemOrder(folders, cards),
	});
	useSelectionStore.getState().clear();
});

test("selected folder covers descendants while remaining one operation item", () => {
	useSelectionStore
		.getState()
		.select({ id: "root", kind: "folder", sourceId: null });
	const selection = useSelectionStore.getState().items;
	expect(selection).toEqual([{ id: "root", kind: "folder", sourceId: null }]);
	expect(
		selectedAncestorOf(
			{ id: "two", kind: "card", sourceId: "sub" },
			selection,
			folders,
		),
	).toBe("root");
	expect(
		selectedAncestorOf(
			{ id: "sub", kind: "folder", sourceId: "root" },
			selection,
			folders,
		),
	).toBe("root");
});

test("deselecting a child materializes the folder and preserves siblings", () => {
	useSelectionStore
		.getState()
		.select({ id: "root", kind: "folder", sourceId: null });
	useSelectionStore
		.getState()
		.toggle({ id: "two", kind: "card", sourceId: "sub" });
	const ids = useSelectionStore.getState().selectedIds;
	expect(ids).not.toContain("root");
	expect(ids).not.toContain("sub");
	expect(ids).not.toContain("two");
	expect(ids).toEqual(
		expect.arrayContaining(["one", "other", "three", "deep"]),
	);
	expect(useSelectionStore.getState().scope).toBe("content");
});

test("deselect all in an inherited page keeps selection in other branches", () => {
	useSelectionStore
		.getState()
		.select({ id: "root", kind: "folder", sourceId: null });
	useSelectionStore.getState().removeAll([
		{ id: "two", kind: "card", sourceId: "sub" },
		{ id: "three", kind: "card", sourceId: "sub" },
		{ id: "deep", kind: "folder", sourceId: "sub" },
	]);
	expect(useSelectionStore.getState().selectedIds).toEqual(["other", "one"]);
});

test("adding a descendant to selected folder does not duplicate operation units", () => {
	useSelectionStore
		.getState()
		.select({ id: "root", kind: "folder", sourceId: null });
	useSelectionStore
		.getState()
		.addAll([{ id: "two", kind: "card", sourceId: "sub" }]);
	expect(useSelectionStore.getState().selectedIds).toEqual(["root"]);
});
