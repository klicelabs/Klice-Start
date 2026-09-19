import type { Setup } from "../types";

/** Keep Home's structural references when another tab changes only settings. */
export function mergeExternalSetup(
	current: Setup,
	incoming: Setup,
): Partial<Setup> | null {
	const folders = sameData(current.folders, incoming.folders)
		? current.folders
		: incoming.folders;
	const cards = sameData(current.cards, incoming.cards)
		? current.cards
		: incoming.cards;
	const itemOrder = sameData(current.itemOrder, incoming.itemOrder)
		? current.itemOrder
		: incoming.itemOrder;
	const settings = sameData(current.settings, incoming.settings)
		? current.settings
		: incoming.settings;
	const activeFolderId = folders.some(
		(folder) => folder.id === current.activeFolderId,
	)
		? current.activeFolderId
		: incoming.activeFolderId;

	if (
		folders === current.folders &&
		cards === current.cards &&
		itemOrder === current.itemOrder &&
		settings === current.settings &&
		activeFolderId === current.activeFolderId
	)
		return null;

	return { folders, cards, itemOrder, settings, activeFolderId };
}

function sameData<T>(left: T, right: T): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}
