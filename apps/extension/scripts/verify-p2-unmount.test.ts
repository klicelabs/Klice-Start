import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * P2 regression guard (perf/p2-unmount-overlays): closed overlays stay
 * unmounted, and the mount-open path must never arm `inert` (a fresh mount
 * starts open, so no enter-transform transitionend would ever lift it —
 * the panel would render visible-but-dead). Live-verified once with a
 * throwaway playwright check (slot present without `inert` after
 * mount-open; a real "Show site titles" Switch click toggles state;
 * slot gone after close); these assertions pin the guards in place.
 * Run: cd apps/extension && bun test scripts/verify-p2-unmount.test.ts
 */
function source(path: string): string {
	return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("settings subtree unmounts while closed", () => {
	const workspace = source(
		"../src/components/newtab/settings/settings-motion-workspace.tsx",
	);
	expect(workspace).toContain('if (phase === "closed") return null;');
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
