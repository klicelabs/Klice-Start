import { expect, test } from "bun:test";
import {
	createNavigationHistory,
	getNavigationState,
	pruneNavigationHistory,
	pushNavigation,
	traverseBack,
	traverseForward,
} from "../src/lib/navigation";
import type { Folder } from "../src/types";

const folders: Folder[] = [
	{ id: "home", name: "Home", order: 0, parentId: null },
	{ id: "design", name: "Design", order: 1, parentId: null },
	{ id: "ui", name: "UI", order: 0, parentId: "design" },
	{ id: "figma", name: "Figma", order: 0, parentId: "ui" },
	{ id: "work", name: "Work", order: 2, parentId: null },
];

const validIds = new Set(folders.map((folder) => folder.id));

test("navigation history traverses nested locations in both directions", () => {
	let history = createNavigationHistory();
	history = pushNavigation(history, "home", "design");
	history = pushNavigation(history, "design", "ui");
	history = pushNavigation(history, "ui", "figma");

	const toUi = traverseBack(history, "figma", validIds);
	expect(toUi.targetId).toBe("ui");
	const toDesign = traverseBack(toUi.history, "ui", validIds);
	expect(toDesign.targetId).toBe("design");
	const toHome = traverseBack(toDesign.history, "design", validIds);
	expect(toHome.targetId).toBe("home");

	const toDesignAgain = traverseForward(toHome.history, "home", validIds);
	expect(toDesignAgain.targetId).toBe("design");
	expect(toDesignAgain.history.forward).toEqual(["figma", "ui"]);
});

test("new manual navigation clears the forward branch and same-location is a no-op", () => {
	let history = createNavigationHistory();
	history = pushNavigation(history, "home", "design");
	history = pushNavigation(history, "design", "ui");
	const back = traverseBack(history, "ui", validIds);

	const unchanged = pushNavigation(back.history, "design", "design");
	expect(unchanged).toBe(back.history);
	const branched = pushNavigation(unchanged, "design", "work");
	expect(branched.back).toEqual(["home", "design"]);
	expect(branched.forward).toEqual([]);
});

test("pruning removes deleted folders without disturbing valid order", () => {
	const history = {
		back: ["home", "deleted", "design"],
		forward: ["deleted", "ui"],
	};

	expect(
		pruneNavigationHistory(history, new Set(["home", "design", "ui"])),
	).toEqual({
		back: ["home", "design"],
		forward: ["ui"],
	});
});

test("navigation state distinguishes root and nested transitions", () => {
	expect(getNavigationState(folders, "design", "ui")).toEqual({
		direction: "forward",
		kind: "depth",
	});
	expect(getNavigationState(folders, "ui", "design", "back")).toEqual({
		direction: "back",
		kind: "depth",
	});
	expect(getNavigationState(folders, "design", "work")).toEqual({
		direction: "forward",
		kind: "root",
	});
});
