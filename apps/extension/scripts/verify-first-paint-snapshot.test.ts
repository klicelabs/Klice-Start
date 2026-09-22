import { expect, test } from "bun:test";

// In-memory localStorage shim, set before the dynamic import (the module
// touches localStorage lazily, inside functions, typeof-guarded).
const mem = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
	getItem: (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
	setItem: (k: string, v: string) => void mem.set(k, String(v)),
	removeItem: (k: string) => void mem.delete(k),
	clear: () => mem.clear(),
};

const {
	FIRST_PAINT_SNAPSHOT_KEY,
	snapshotFromSetup,
	writeFirstPaintSnapshot,
	readFirstPaintSnapshot,
	snapshotPatch,
} = await import("../src/lib/first-paint-snapshot");

function setup(overrides: Record<string, unknown> = {}) {
	return {
		folders: [{ id: "f1", name: "Home", order: 0, parentId: null }],
		cards: [],
		activeFolderId: "f1",
		itemOrder: { f1: [] },
		settings: {
			tileSize: "medium",
			clock: {
				enabled: true,
				dateEnabled: true,
				format24: true,
				showSeconds: false,
			},
			greeting: { enabled: true, name: "Ada" },
			quickLinks: { enabled: true, items: [] },
			dialLayout: "card",
			search: { enabled: true },
			...overrides,
		},
	} as never;
}

test("writer stores exactly the nine display flags", () => {
	mem.clear();
	writeFirstPaintSnapshot(setup());
	expect(JSON.parse(mem.get(FIRST_PAINT_SNAPSHOT_KEY) as string)).toEqual({
		clockEnabled: true,
		clockShowSeconds: false,
		clockFormat24: true,
		dateEnabled: true,
		greetingEnabled: true,
		greetingText: "Ada",
		quickLinksVisible: true,
		displayMode: "card",
		searchBarVisible: true,
	});
});

test("full snapshot round-trips and patches onto live state", () => {
	mem.clear();
	writeFirstPaintSnapshot(
		setup({
			clock: { enabled: false, dateEnabled: false, format24: false, showSeconds: true },
			greeting: { enabled: false, name: "Bo" },
			quickLinks: { enabled: false, items: [] },
			dialLayout: "icon",
			search: { enabled: false },
		}),
	);
	const snap = readFirstPaintSnapshot();
	expect(snap).toEqual({
		clockEnabled: false,
		clockShowSeconds: true,
		clockFormat24: false,
		dateEnabled: false,
		greetingEnabled: false,
		greetingText: "Bo",
		quickLinksVisible: false,
		displayMode: "icon",
		searchBarVisible: false,
	});
	const live = setup();
	const patched = snapshotPatch(live, snap!) as unknown as {
		settings: Record<string, Record<string, unknown> | string>;
	};
	expect(patched.settings.clock).toMatchObject({ enabled: false });
	expect(patched.settings.dialLayout).toBe("icon");
	// Non-flag state survives untouched once merged (setState semantics).
	const merged = { ...live, ...patched };
	expect(merged.folders).toEqual(live.folders);
	expect(merged.settings.tileSize).toBe("medium");
});

test("empty / malformed mirror falls back to defaults without crashing", () => {
	mem.clear();
	expect(readFirstPaintSnapshot()).toBeNull();
	mem.set(FIRST_PAINT_SNAPSHOT_KEY, "{not json");
	expect(readFirstPaintSnapshot()).toBeNull();
	mem.set(FIRST_PAINT_SNAPSHOT_KEY, JSON.stringify([1, 2, 3]));
	expect(readFirstPaintSnapshot()).toBeNull();
	mem.set(FIRST_PAINT_SNAPSHOT_KEY, JSON.stringify(null));
	expect(readFirstPaintSnapshot()).toBeNull();
});

test("partial snapshot keeps valid fields, live state covers the rest", () => {
	mem.clear();
	mem.set(
		FIRST_PAINT_SNAPSHOT_KEY,
		JSON.stringify({
			clockEnabled: false,
			displayMode: "icon",
			greetingText: 42,
			displayModeX: "card",
			clockFormat24: "yes",
		}),
	);
	const snap = readFirstPaintSnapshot();
	expect(snap).toEqual({ clockEnabled: false, displayMode: "icon" });
	const patched = snapshotPatch(setup(), snap!) as unknown as {
		settings: Record<string, Record<string, unknown> | string>;
	};
	expect(patched.settings.clock).toMatchObject({
		enabled: false,
		format24: true, // invalid "yes" dropped → live default kept
		showSeconds: false,
		dateEnabled: true,
	});
	expect(patched.settings.greeting).toMatchObject({
		enabled: true, // uncovered → live default kept
		name: "Ada", // invalid 42 dropped → live default kept
	});
	expect(snapshotFromSetup(setup())).toEqual({
		clockEnabled: true,
		clockShowSeconds: false,
		clockFormat24: true,
		dateEnabled: true,
		greetingEnabled: true,
		greetingText: "Ada",
		quickLinksVisible: true,
		displayMode: "card",
		searchBarVisible: true,
	});
});
