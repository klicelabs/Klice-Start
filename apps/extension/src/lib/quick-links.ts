import type { QuickLink } from "../types";

export function prepareQuickLink(
	label: string,
	url: string,
): Omit<QuickLink, "id"> | null {
	const trimmed = url.trim();
	if (!trimmed || /\s/.test(trimmed)) return null;
	const destination = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
		? trimmed
		: `https://${trimmed}`;
	try {
		const parsed = new URL(destination);
		if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname)
			return null;
		return {
			label: label.trim() || parsed.hostname.replace(/^www\./, ""),
			url: parsed.href,
		};
	} catch {
		return null;
	}
}

/** Move by stable ids so concurrent edits or deletions cannot drop a link. */
export function reorderQuickLinks(
	items: QuickLink[],
	id: string,
	targetId: string,
	position: "before" | "after",
): QuickLink[] {
	if (id === targetId) return items;
	const item = items.find((link) => link.id === id);
	if (!item || !items.some((link) => link.id === targetId)) return items;
	const next = items.filter((link) => link.id !== id);
	const targetIndex = next.findIndex((link) => link.id === targetId);
	next.splice(targetIndex + (position === "after" ? 1 : 0), 0, item);
	return next.every((link, index) => link === items[index]) ? items : next;
}
