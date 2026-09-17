import type { Folder } from "../types";
import { getBreadcrumb, getChildren } from "./folder-tree";

export type NavigationDirection = "forward" | "back";
export type NavigationKind = "root" | "depth";

export interface NavigationState {
	direction: NavigationDirection;
	kind: NavigationKind;
}

export interface NavigationHistory {
	back: string[];
	forward: string[];
}

export interface NavigationTraversal {
	history: NavigationHistory;
	targetId: string | null;
}

/** Derive tab/grid motion from the actual paths, unless history says otherwise. */
export function getNavigationState(
	folders: Folder[],
	currentId: string,
	nextId: string,
	directionOverride?: NavigationDirection,
): NavigationState {
	const currentPath = getBreadcrumb(folders, currentId);
	const nextPath = getBreadcrumb(folders, nextId);
	const currentRootId = currentPath[0]?.id ?? currentId;
	const nextRootId = nextPath[0]?.id ?? nextId;
	const rootChanged = currentRootId !== nextRootId;

	if (directionOverride) {
		return {
			direction: directionOverride,
			kind: rootChanged ? "root" : "depth",
		};
	}

	if (rootChanged) {
		const roots = getChildren(folders, null);
		const currentIndex = roots.findIndex(
			(folder) => folder.id === currentRootId,
		);
		const nextIndex = roots.findIndex((folder) => folder.id === nextRootId);
		return {
			direction:
				currentIndex >= 0 && nextIndex >= 0 && nextIndex < currentIndex
					? "back"
					: "forward",
			kind: "root",
		};
	}

	return {
		direction: nextPath.length < currentPath.length ? "back" : "forward",
		kind: "depth",
	};
}

export function createNavigationHistory(): NavigationHistory {
	return { back: [], forward: [] };
}

/** Add a manual location change and discard the forward branch. */
export function pushNavigation(
	history: NavigationHistory,
	currentId: string,
	nextId: string,
): NavigationHistory {
	if (currentId === nextId) return history;
	return {
		back: [...history.back, currentId],
		forward: [],
	};
}

function filterValidIds(
	ids: string[],
	validIds: ReadonlySet<string>,
): string[] {
	return ids.filter((id) => validIds.has(id));
}

/** Remove stale folder IDs without changing the order of a valid branch. */
export function pruneNavigationHistory(
	history: NavigationHistory,
	validIds: ReadonlySet<string>,
): NavigationHistory {
	return {
		back: filterValidIds(history.back, validIds),
		forward: filterValidIds(history.forward, validIds),
	};
}

export function traverseBack(
	history: NavigationHistory,
	currentId: string,
	validIds: ReadonlySet<string>,
): NavigationTraversal {
	const back = filterValidIds(history.back, validIds);
	const forward = filterValidIds(history.forward, validIds);
	let targetId: string | null = null;

	while (back.length > 0 && targetId === null) {
		const candidate = back.pop();
		if (candidate && candidate !== currentId) targetId = candidate;
	}

	if (targetId === null) {
		return { history: { back, forward }, targetId: null };
	}

	return {
		history: {
			back,
			forward: validIds.has(currentId) ? [...forward, currentId] : forward,
		},
		targetId,
	};
}

export function traverseForward(
	history: NavigationHistory,
	currentId: string,
	validIds: ReadonlySet<string>,
): NavigationTraversal {
	const back = filterValidIds(history.back, validIds);
	const forward = filterValidIds(history.forward, validIds);
	let targetId: string | null = null;

	while (forward.length > 0 && targetId === null) {
		const candidate = forward.pop();
		if (candidate && candidate !== currentId) targetId = candidate;
	}

	if (targetId === null) {
		return { history: { back, forward }, targetId: null };
	}

	return {
		history: {
			back: validIds.has(currentId) ? [...back, currentId] : back,
			forward,
		},
		targetId,
	};
}
