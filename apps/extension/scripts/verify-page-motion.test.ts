import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { type PageMotionContext, pageMotion } from "../src/lib/page-motion";

function offset(
	context: PageMotionContext,
	phase: "initial" | "animate" | "exit",
) {
	return pageMotion(context, phase).transform;
}

test("forward and back enter/exit through reversible positions", () => {
	for (const kind of ["root", "depth", "settings"] as const) {
		const forward = {
			kind,
			direction: "forward",
			reduceMotion: false,
		} as const;
		const back = { kind, direction: "back", reduceMotion: false } as const;
		expect(offset(forward, "initial")).toBe(offset(back, "exit"));
		expect(offset(forward, "exit")).toBe(offset(back, "initial"));
		expect(offset(forward, "animate")).toBe("translate3d(0px, 0, 0)");
	}
});

test("page motion is bounded, quick, and removes travel for reduced motion", () => {
	for (const kind of ["root", "depth", "settings"] as const) {
		const context = {
			kind,
			direction: "forward",
			reduceMotion: false,
		} as const;
		const entering = pageMotion(context, "initial");
		const leaving = pageMotion(context, "exit");
		const travel = Number(
			String(entering.transform).match(/translate3d\((-?\d+)px/)?.[1],
		);
		expect(travel).toBeGreaterThan(0);
		expect(travel).toBeLessThanOrEqual(32);
		expect(Number(leaving.transition?.duration)).toBeLessThan(0.3);
		expect(offset({ ...context, reduceMotion: true }, "initial")).toBe(
			"translate3d(0px, 0, 0)",
		);
	}
});

test("Settings keeps the Home frame in the inset state through close motion", () => {
	const app = readFileSync(
		new URL("../entrypoints/newtab/App.tsx", import.meta.url),
		"utf8",
	);
	const tokens = readFileSync(
		new URL("../src/styles/tokens.css", import.meta.url),
		"utf8",
	);
	expect(app).toContain(
		'data-settings-open={settingsLayoutOpen ? "true" : "false"}',
	);
	expect(app).not.toContain(
		'data-settings-open={showSettings ? "true" : "false"}',
	);
	expect(tokens).toContain(
		"transition: border-radius var(--workspace-motion-duration)",
	);
	expect(tokens).not.toContain("--workspace-home-scale");
	expect(tokens).not.toContain("transform: scale(var(--workspace-home-scale))");
});

test("Settings toolbar shares Home toolbar geometry", () => {
	const sidebar = readFileSync(
		new URL(
			"../src/components/newtab/settings/settings-sidebar.tsx",
			import.meta.url,
		),
		"utf8",
	);
	const settingsTokens = readFileSync(
		new URL(
			"../src/components/newtab/settings/shared/settings-tokens.ts",
			import.meta.url,
		),
		"utf8",
	);

	expect(settingsTokens).toContain(
		"export const SETTINGS_HEADER_HEIGHT = TOOLBAR.height",
	);
	expect(settingsTokens).toContain(
		'export const SETTINGS_HEADER_INSET = "px-[var(--speed-dial-toolbar-gutter)]"',
	);
	expect(sidebar).toContain("SETTINGS_HEADER_HEIGHT,");
	expect(sidebar).toContain("SETTINGS_HEADER_INSET,");
	expect(sidebar).toContain('"flex shrink-0 items-center gap-3",');
});
