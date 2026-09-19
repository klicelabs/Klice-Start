import type { Card, TitleSource } from "../types";
import { deriveIconLabel } from "./url";

export function resolveCardTitle(
	card: Pick<Card, "title" | "url" | "titleSource">,
	defaultSource: TitleSource,
): string {
	const saved = card.title.trim() || card.url;
	return (card.titleSource ?? defaultSource) === "site"
		? deriveIconLabel(card.url) || saved
		: saved;
}

/** Rename is a saved-title choice, so the result remains visible immediately. */
export function renameCardTitle(
	name: string,
): Pick<Card, "title" | "titleSource"> {
	return { title: name.trim(), titleSource: "saved" };
}
