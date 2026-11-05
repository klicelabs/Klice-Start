import { expect, test } from "bun:test";
import { parseHTML } from "linkedom";
import {
	bindSearchShortcut,
	searchAccess,
} from "../src/components/newtab/search/search-access";
import { searchPlacement } from "../src/components/newtab/search/use-search-position";
import { DEFAULT_SETUP } from "../src/lib/constants";
import {
	snapshotFromSetup,
	snapshotPatch,
} from "../src/lib/first-paint-snapshot";
import { normalizeState } from "../src/lib/storage";

function required<T>(value: T | null | undefined): T {
	if (value == null) throw new Error("Expected test fixture value");
	return value;
}

test("older setups with a hidden search bar acquire toolbar and keyboard access", () => {
	const state = normalizeState({
		settings: { search: { enabled: false } },
	} as never);
	expect(searchAccess(state.settings.search)).toEqual({
		available: true,
		showBar: false,
		showToolbar: true,
		shortcutEnabled: true,
	});
});

test("scrolling only promotes Search to the toolbar when quick access is enabled", () => {
	for (const quickAccessEnabled of [false, true]) {
		const search = { enabled: true, quickAccessEnabled };
		expect(searchAccess(search).showBar).toBe(true);
		expect(searchAccess(search).showToolbar).toBe(false);
		expect(searchAccess(search, true).showToolbar).toBe(quickAccessEnabled);
		expect(searchAccess(search).shortcutEnabled).toBe(quickAccessEnabled);
	}
});

test("turning off both access paths persists a fully disabled search", () => {
	const state = structuredClone(DEFAULT_SETUP);
	state.settings.search.enabled = false;
	state.settings.search.quickAccessEnabled = false;
	const restored = normalizeState(JSON.parse(JSON.stringify(state)));
	expect(searchAccess(restored.settings.search, true)).toEqual({
		available: false,
		showBar: false,
		showToolbar: false,
		shortcutEnabled: false,
	});
	// Restoring the Home bar alone does not silently re-enable shortcuts.
	const barOnly = { ...restored.settings.search, enabled: true };
	expect(searchAccess(barOnly)).toMatchObject({
		available: true,
		shortcutEnabled: false,
	});
});

test("the first frame preserves disabled quick access and old mirrors keep its default", () => {
	const state = structuredClone(DEFAULT_SETUP);
	state.settings.search.enabled = false;
	state.settings.search.quickAccessEnabled = false;
	const snapshot = snapshotFromSetup(state);
	const restored = snapshotPatch(structuredClone(DEFAULT_SETUP), snapshot);
	expect(searchAccess(required(restored.settings).search).available).toBe(
		false,
	);
	const legacy = snapshotPatch(structuredClone(DEFAULT_SETUP), {
		searchBarVisible: false,
	});
	expect(searchAccess(required(legacy.settings).search).showToolbar).toBe(true);
});

function inDocument(
	run: (
		document: Document,
		fire: (target: Element, props?: Record<string, unknown>) => Event,
	) => void,
) {
	const { document, window } = parseHTML(
		'<html><body><button>Search</button><input><textarea></textarea><div contenteditable="true"><span>Edit</span></div></body></html>',
	);
	const previous = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement");
	Object.defineProperty(globalThis, "HTMLElement", {
		configurable: true,
		value: window.HTMLElement,
	});
	try {
		run(document, (target, props = {}) => {
			const event = new window.Event("keydown", {
				bubbles: true,
				cancelable: true,
			});
			Object.assign(event, { key: "k", ctrlKey: true, ...props });
			target.dispatchEvent(event);
			return event;
		});
	} finally {
		if (previous) Object.defineProperty(globalThis, "HTMLElement", previous);
		else Reflect.deleteProperty(globalThis, "HTMLElement");
	}
}

test("Ctrl+K and Cmd+K open hidden-bar search and cleanup releases the shortcut", () => {
	inDocument((document, fire) => {
		let opens = 0;
		const access = searchAccess({ enabled: false, quickAccessEnabled: true });
		const unbind = bindSearchShortcut(
			document,
			access.shortcutEnabled,
			() => opens++,
		);
		const target = required(document.querySelector("button"));
		expect(fire(target).defaultPrevented).toBe(true);
		expect(
			fire(target, { key: "K", ctrlKey: false, metaKey: true })
				.defaultPrevented,
		).toBe(true);
		expect(opens).toBe(2);
		unbind();
		expect(fire(target).defaultPrevented).toBe(false);
		expect(opens).toBe(2);
	});
});

test("disabled search leaves Ctrl+K to the browser", () => {
	inDocument((document, fire) => {
		let opens = 0;
		const unbind = bindSearchShortcut(document, false, () => opens++);
		expect(
			fire(required(document.querySelector("button"))).defaultPrevented,
		).toBe(false);
		expect(opens).toBe(0);
		unbind();
	});
});

test("quick access does not interrupt text editing or IME composition", () => {
	inDocument((document, fire) => {
		let opens = 0;
		const unbind = bindSearchShortcut(document, true, () => opens++);
		for (const selector of ["input", "textarea", "[contenteditable] span"])
			expect(
				fire(required(document.querySelector(selector))).defaultPrevented,
			).toBe(false);
		const target = required(document.querySelector("button"));
		expect(fire(target, { isComposing: true }).defaultPrevented).toBe(false);
		expect(fire(target, { altKey: true }).defaultPrevented).toBe(false);
		expect(opens).toBe(0);
		unbind();
	});
});

test("without a Home anchor, search centers in the app frame below the toolbar", () => {
	const position = searchPlacement({
		anchor: null,
		frame: { left: 300, top: 20, width: 900 },
		viewport: { left: 0, top: 0, width: 1280, height: 800 },
		preferredWidth: 560,
	});
	expect(position.left).toBe(470);
	expect(position.top).toBe(88);
	expect(position.width).toBe(560);
	expect(position.floating).toBe(true);
	const narrow = searchPlacement({
		anchor: null,
		frame: { left: 0, top: 0, width: 360 },
		viewport: { left: 0, top: 0, width: 360, height: 400 },
		preferredWidth: 560,
	});
	expect(narrow.left).toBeGreaterThanOrEqual(12);
	expect(narrow.left + narrow.width).toBeLessThanOrEqual(348);
	expect(narrow.top + 78 + narrow.resultsHeight).toBeLessThanOrEqual(400);
});
