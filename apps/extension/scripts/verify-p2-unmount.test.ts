import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * Settings stays out of Home's initial render, then prepares at idle and
 * retains its controls offscreen. Context menus still unmount while closed.
 * A cold mount-open must never leave the panel visible-but-inert.
 * Run: cd apps/extension && bun test scripts/verify-p2-unmount.test.ts
 */
function source(path: string): string {
	return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("settings starts unmounted and prepares only after Home's initial render", () => {
	const workspace = source(
		"../src/components/newtab/settings/settings-motion-workspace.tsx",
	);
	expect(workspace).toContain(
		'if (phase === "closed" && !prepared) return null;',
	);
	expect(workspace).toContain("window.requestIdleCallback(prepare)");
});

test("mount-open never arms the initial inert", () => {
	const sidebar = source(
		"../src/components/newtab/settings/settings-sidebar.tsx",
	);
	expect(sidebar).toContain(
		'if (!open) slotRef.current?.setAttribute("inert", "");',
	);
});

test("context menu portal unmounts while closed", () => {
	const menu = source(
		"../../../packages/ui/src/components/motion/context-menu.tsx",
	);
	expect(menu).toContain("if (!context.open) return null;");
});
