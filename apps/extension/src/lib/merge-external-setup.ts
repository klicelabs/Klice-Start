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

/**
 * Three-way merge for two extension pages writing between storage events.
 * Each side keeps changes the other side did not make relative to the last
 * common snapshot. If both changed the same scalar, the local page wins
 * deterministically; unrelated settings/entity fields still converge.
 */
export function mergeConcurrentSetup(
	base: Setup,
	local: Setup,
	incoming: Setup,
): Partial<Setup> | null {
	const folders = mergeEntities(base.folders, local.folders, incoming.folders);
	const cards = mergeEntities(base.cards, local.cards, incoming.cards);
	const itemOrder = mergeItemOrder(
		base.itemOrder,
		local.itemOrder,
		incoming.itemOrder,
	);
	const settings = mergeRecord(
		base.settings,
		local.settings,
		incoming.settings,
	);
	const activeFolderId = mergeScalar(
		base.activeFolderId,
		local.activeFolderId,
		incoming.activeFolderId,
	);
	if (
		JSON.stringify(folders) === JSON.stringify(local.folders) &&
		JSON.stringify(cards) === JSON.stringify(local.cards) &&
		JSON.stringify(itemOrder) === JSON.stringify(local.itemOrder) &&
		JSON.stringify(settings) === JSON.stringify(local.settings) &&
		activeFolderId === local.activeFolderId
	)
		return null;
	return { folders, cards, itemOrder, settings, activeFolderId };
}

function mergeScalar<T>(base: T, local: T, incoming: T): T {
	if (JSON.stringify(local) === JSON.stringify(base)) return incoming;
	return local;
}

function mergeRecord<T extends object>(base: T, local: T, incoming: T): T {
	const result: Record<string, unknown> = {};
	const baseRecord = base as Record<string, unknown>;
	const localRecord = local as Record<string, unknown>;
	const incomingRecord = incoming as Record<string, unknown>;
	for (const key of new Set([
		...Object.keys(baseRecord),
		...Object.keys(localRecord),
		...Object.keys(incomingRecord),
	])) {
		result[key] = mergeScalar(
			baseRecord[key],
			localRecord[key],
			incomingRecord[key],
		);
	}
	return result as T;
}

function mergeEntities<T extends { id: string }>(
	base: readonly T[],
	local: readonly T[],
	incoming: readonly T[],
): T[] {
	if (sameData(local, base)) return [...incoming];
	if (sameData(incoming, base)) return [...local];
	const baseById = new Map(base.map((entry) => [entry.id, entry]));
	const localById = new Map(local.map((entry) => [entry.id, entry]));
	const incomingById = new Map(incoming.map((entry) => [entry.id, entry]));
	const ids = new Set([
		...baseById.keys(),
		...localById.keys(),
		...incomingById.keys(),
	]);
	const result: T[] = [];
	for (const id of ids) {
		const before = baseById.get(id);
		const left = localById.get(id);
		const right = incomingById.get(id);
		if (!left && !right) continue;
		if (!before) {
			if (left) result.push(left);
			else if (right) result.push(right);
			continue;
		}
		if (!left) {
			// Local deletion is a deliberate conflict winner; remote edits cannot
			// silently resurrect an item the user removed.
			if (sameData(right, before)) continue;
			continue;
		}
		if (!right) {
			if (sameData(left, before)) continue;
			result.push(left);
			continue;
		}
		result.push(
			mergeRecord(
				before as T & Record<string, unknown>,
				left as T & Record<string, unknown>,
				right as T & Record<string, unknown>,
			) as T,
		);
	}
	const order = new Map(local.map((entry) => [entry.id, entry]));
	return result.sort(
		(a, b) => (order.has(a.id) ? 0 : 1) - (order.has(b.id) ? 0 : 1),
	);
}

function mergeItemOrder(
	base: Setup["itemOrder"],
	local: Setup["itemOrder"],
	incoming: Setup["itemOrder"],
): Setup["itemOrder"] {
	if (sameData(local, base)) return incoming;
	if (sameData(incoming, base)) return local;
	const result: NonNullable<Setup["itemOrder"]> = {};
	for (const container of new Set([
		...Object.keys(base ?? {}),
		...Object.keys(local ?? {}),
		...Object.keys(incoming ?? {}),
	])) {
		const before = base?.[container] ?? [];
		const left = local?.[container] ?? [];
		const right = incoming?.[container] ?? [];
		result[container] = sameData(left, before)
			? [...right]
			: sameData(right, before)
				? [...left]
				: [...left, ...right.filter((key) => !left.includes(key))];
	}
	return result;
}

function sameData<T>(left: T, right: T): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}
