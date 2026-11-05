import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
	SettingsMotionFrame,
	SettingsMotionWorkspace,
} from "../src/components/newtab/settings/settings-motion-workspace";
import { type PageMotionContext, pageMotion } from "../src/lib/page-motion";
import { settingsMotionStore } from "../src/stores/settings-motion-store";

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

test("Settings animates only its isolated panel, never Home layout or paint", () => {
	const app = readFileSync(
		new URL("../entrypoints/newtab/App.tsx", import.meta.url),
		"utf8",
	);
	const tokens = readFileSync(
		new URL("../src/styles/tokens.css", import.meta.url),
		"utf8",
	);
	const motionWorkspace = readFileSync(
		new URL(
			"../src/components/newtab/settings/settings-motion-workspace.tsx",
			import.meta.url,
		),
		"utf8",
	);
	const sidebar = readFileSync(
		new URL(
			"../src/components/newtab/settings/settings-sidebar.tsx",
			import.meta.url,
		),
		"utf8",
	);
	expect(motionWorkspace).toContain("isSettingsLayoutOpen(phase)");
	expect(motionWorkspace).not.toContain("layoutDependency");
	expect(motionWorkspace).not.toContain("motion.div");
	expect(app).not.toContain("settingsOpenFrameRef");
	expect(app).not.toContain("settingsOpenRef");
	expect(sidebar).not.toContain("inert={!open}");
	expect(sidebar).toContain('setAttribute("inert", "")');
	expect(tokens).toContain("@starting-style");
	expect(tokens).not.toContain("padding-top var(--workspace-motion-duration)");
	expect(tokens).not.toContain("padding-inline-end: calc(");
	expect(tokens).not.toContain(
		"transition: border-radius var(--workspace-motion-duration)",
	);
	expect(tokens).toContain("contain: layout paint");
	expect(motionWorkspace).not.toContain("data-settings-motion-active");
	expect(motionWorkspace).not.toContain("data-settings-layout-open");
	expect(tokens).toContain("position: absolute;");
	expect(tokens).toContain("pointer-events: none");
	expect(tokens).toContain("pointer-events: auto");
	expect(tokens).toContain("transform var(--workspace-motion-duration)");
	expect(tokens).not.toContain("--workspace-home-scale");
	expect(tokens).not.toContain("transform: scale(var(--workspace-home-scale))");
});

test("wallpaper uses the original Home frame and a single squircle clip throughout Settings motion", () => {
	try {
		let initialMarkup: string | undefined;
		for (const phase of ["closed", "opening", "open", "closing"] as const) {
			settingsMotionStore.setState({ phase });
			const markup = renderToStaticMarkup(
				createElement(SettingsMotionWorkspace, {
					// biome-ignore lint/correctness/noChildrenProp: required children prop in this non-JSX test.
					children: createElement(SettingsMotionFrame, {
						"data-speed-dial-frame": "true",
						className: "squircle",
					}),
				}),
			);
			initialMarkup ??= markup;
			// No ancestor attribute, geometry or material changes may invalidate
			// Home when Settings changes phase, regardless of the grid contents.
			expect(markup).toBe(initialMarkup);
			const { document } = parseHTML(markup);
			const wallpaper = document.querySelector("#bg-layer");
			expect(wallpaper).not.toBeNull();
			expect(document.querySelectorAll("#bg-layer")).toHaveLength(1);
			expect(wallpaper?.closest("[data-speed-dial-frame]")?.className).toBe(
				"squircle",
			);
			expect(document.querySelector(".settings-wallpaper")).toBeNull();
		}
	} finally {
		settingsMotionStore.setState({ phase: "closed" });
	}
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
		'export const SETTINGS_HEADER_HEIGHT = "h-12"',
	);
	expect(settingsTokens).toContain(
		'export const SETTINGS_FRAME_INSET = "px-[var(--workspace-gutter)]"',
	);
	expect(settingsTokens).toContain(
		"export const SETTINGS_HEADER_INSET = SETTINGS_FRAME_INSET",
	);
	expect(sidebar).toContain("SETTINGS_HEADER_HEIGHT,");
	expect(sidebar).toContain("SETTINGS_HEADER_INSET,");
	expect(sidebar).toContain("SETTINGS_FRAME_INSET,");
	expect(sidebar).toContain('"flex shrink-0 items-center gap-3",');
});
