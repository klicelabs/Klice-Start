import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { KliceShape } from "@klice-start/ui/lib/shapes";

const tokens = readFileSync(
	new URL("../src/styles/tokens.css", import.meta.url),
	"utf8",
);

/** One semantic token per shape role (thumbnail reads --shape-thumb). */
const ROLE_TOKENS = {
	panel: "--shape-panel",
	section: "--shape-section",
	surface: "--shape-surface",
	card: "--shape-card",
	control: "--shape-control",
	thumbnail: "--shape-thumb",
	pill: "--shape-pill",
} as const;

function tierBlock(name: "discreet" | "rounded"): string {
	const start = tokens.indexOf(`:root[data-klice-corner="${name}"]`);
	expect(start).toBeGreaterThan(-1);
	const next = tokens.indexOf(":root[data-klice-corner=", start + 1);
	return tokens.slice(start, next === -1 ? undefined : next);
}

/** The default (:root) corner table — the block that defines --shape-panel. */
function softBlock(): string {
	const match = tokens.match(/:root\s*\{[^}]*--shape-panel[^}]*\}/);
	expect(match).not.toBeNull();
	return match?.[0] ?? "";
}

test("every shape role reads a semantic --shape-* token", () => {
	for (const [role, token] of Object.entries(ROLE_TOKENS)) {
		expect(KliceShape[role as keyof typeof ROLE_TOKENS]).toContain(token);
		expect(KliceShape[role as keyof typeof ROLE_TOKENS]).toContain(
			"klice-squircle",
		);
	}
	// The tier table must define a Chromium radius AND a calibrated Gecko
	// fallback for every squircle role, or the engines diverge silently.
	for (const token of [
		"panel",
		"section",
		"surface",
		"card",
		"control",
		"pill",
		"thumb",
	]) {
		expect(tokens).toContain(`--shape-${token}:`);
		expect(tokens).toContain(`--shape-${token}-fallback:`);
	}
});

test("toolbar surfaces stay capsules regardless of the corner tier", () => {
	for (const role of [
		"toolbar",
		"toolbarControl",
		"toolbarIcon",
		"toolbarGroup",
	] as const) {
		expect(KliceShape[role]).toContain("rounded-full");
		expect(KliceShape[role]).not.toContain("--shape-");
	}
});

test("search surfaces keep tier geometry and calibrated squircle corners", () => {
	for (const role of ["searchCollapsed", "searchExpanded", "panel"] as const) {
		expect(KliceShape[role]).toContain("klice-squircle");
		expect(KliceShape[role]).not.toContain("rounded-full");
	}
	expect(KliceShape.searchCollapsed).toContain("--shape-search-collapsed");
	expect(KliceShape.searchCollapsed).toContain("--shape-section-fallback");
	expect(KliceShape.panel).toContain("--shape-panel-fallback");
	expect(KliceShape.searchExpanded.startsWith(KliceShape.surface)).toBe(true);
	expect(tokens).not.toContain("--shape-search-expanded");

	const px = (block: string, token: string) =>
		Number(block.match(new RegExp(`--shape-${token}: (\\d+)px`))?.[1]);
	expect(px(softBlock(), "search-collapsed")).toBe(22);
	expect(px(tierBlock("discreet"), "search-collapsed")).toBe(12);
	expect(px(tierBlock("rounded"), "search-collapsed")).toBe(28);
});

test("subfolder preview tiles consume the thumbnail role", () => {
	const source = readFileSync(
		new URL(
			"../src/components/newtab/folders/folder-preview-card.tsx",
			import.meta.url,
		),
		"utf8",
	);
	// The 2×2 mini-tile grid (and its empty slots) must follow the corner
	// scale like every other thumbnail, not pin a 7px literal.
	expect(source).not.toContain("rounded-[7px]");
	expect(source.match(/kliceShape\("thumbnail"\)/g)?.length).toBe(2);
});

test("the preference drives the shadcn scale only in non-default tiers", () => {
	// Soft is the shipped geometry: --radius keeps the globals.css base value
	// (0.625rem). The other tiers remap it so rounded-sm…4xl follow the scale.
	expect(tierBlock("discreet")).toContain("--radius: 0.375rem;");
	expect(tierBlock("rounded")).toContain("--radius: 0.9375rem;");
	expect(softBlock()).not.toContain("--radius:");
});

test("tier tables keep the semantic ladder monotonic", () => {
	const px = (block: string, token: string) =>
		Number(block.match(new RegExp(`--shape-${token}: (\\d+)px`))?.[1]);
	const soft = softBlock();
	const discreet = tierBlock("discreet");
	const rounded = tierBlock("rounded");
	const ladder = ["panel", "section", "surface", "card", "control", "pill"];
	for (const token of ladder) {
		expect(px(soft, token)).toBeGreaterThan(px(discreet, token));
		expect(px(rounded, token)).toBeGreaterThan(px(soft, token));
	}
	// Within one tier the ladder never inverts: panel ≥ section ≥ surface ≥
	// card ≥ control ≥ pill.
	for (const block of [soft, discreet, rounded]) {
		const values = ladder.map((token) => px(block, token));
		for (let i = 1; i < values.length; i += 1) {
			expect(values[i - 1]).toBeGreaterThanOrEqual(values[i]);
		}
	}
});

test("the workspace frame consumes the panel token, not a private literal", () => {
	expect(tokens).toContain("border-radius: var(--shape-panel, 28px);");
	expect(tokens).toContain("border-radius: var(--shape-panel-fallback, 17px);");
});
