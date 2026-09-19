import { expect, test } from "bun:test";
import { renameCardTitle, resolveCardTitle } from "../src/lib/card-title";
import { DEFAULT_SETUP } from "../src/lib/constants";
import { normalizeState } from "../src/lib/storage";
import type { Card } from "../src/types";

const card: Card = {
	id: "link",
	folderId: "default",
	title: "My long personal bookmark name",
	url: "https://github.com/example/repo",
	favicon: null,
	thumbId: null,
	order: 0,
	origin: "local",
	capturedAt: null,
};

test("global title source applies to links without an override", () => {
	expect(resolveCardTitle(card, "saved")).toBe(card.title);
	expect(resolveCardTitle(card, "site")).toBe("GitHub");
});

test("per-link title source overrides the global source", () => {
	expect(resolveCardTitle({ ...card, titleSource: "saved" }, "site")).toBe(
		card.title,
	);
	expect(resolveCardTitle({ ...card, titleSource: "site" }, "saved")).toBe(
		"GitHub",
	);
	expect(
		resolveCardTitle({ ...card, titleSource: "site", url: "" }, "saved"),
	).toBe(card.title);
});

test("inline rename selects the saved title source", () => {
	const renamed = { ...card, ...renameCardTitle(" Custom name ") };
	expect(resolveCardTitle(renamed, "site")).toBe("Custom name");
});

test("legacy and invalid title sources hydrate safely", () => {
	const state = structuredClone(DEFAULT_SETUP);
	state.cards = [card];
	expect(normalizeState(state).settings.defaultTitleSource).toBe("saved");
	const malformed = structuredClone(state) as unknown as Record<
		string,
		unknown
	>;
	(malformed.settings as Record<string, unknown>).defaultTitleSource =
		"unknown";
	const malformedCard = (malformed.cards as Record<string, unknown>[])[0];
	if (!malformedCard) throw new Error("fixture card missing");
	malformedCard.titleSource = "unknown";
	const normalized = normalizeState(malformed);
	expect(normalized.settings.defaultTitleSource).toBe("saved");
	expect(normalized.cards[0]?.titleSource).toBeUndefined();
});
