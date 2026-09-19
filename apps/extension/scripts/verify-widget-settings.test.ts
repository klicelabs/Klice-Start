import { expect, test } from "bun:test";
import { DEFAULT_SETUP } from "../src/lib/constants";
import { normalizeState } from "../src/lib/storage";

test("normalizes independent widget scales and search width at hydration", () => {
	const state = structuredClone(DEFAULT_SETUP);
	state.settings.clock.enabled = false;
	state.settings.clock.dateEnabled = true;
	state.settings.clock.size = -20;
	state.settings.clock.dateSize = Number.POSITIVE_INFINITY;
	state.settings.greeting.size = 999;
	state.settings.search.width = 1200;

	const normalized = normalizeState(state);

	expect(normalized.settings.clock.enabled).toBe(false);
	expect(normalized.settings.clock.dateEnabled).toBe(true);
	expect(normalized.settings.clock.size).toBe(60);
	expect(normalized.settings.clock.dateSize).toBe(100);
	expect(normalized.settings.greeting.size).toBe(200);
	expect(normalized.settings.search.width).toBe(800);
});

test("keeps the date enabled when hydrating a legacy clock payload", () => {
	const state = structuredClone(DEFAULT_SETUP);
	const clock = state.settings.clock as Record<string, unknown>;
	delete clock.dateEnabled;
	delete clock.dateSize;

	const normalized = normalizeState(state);

	expect(normalized.settings.clock.dateEnabled).toBe(true);
	expect(normalized.settings.clock.dateSize).toBe(100);
});

test("preserves a legacy hidden clock as a hidden date", () => {
	const state = structuredClone(DEFAULT_SETUP);
	const clock = state.settings.clock as Record<string, unknown>;
	clock.enabled = false;
	delete clock.dateEnabled;

	const normalized = normalizeState(state);

	expect(normalized.settings.clock.dateEnabled).toBe(false);
});

test("enables automatic missing-thumbnail capture by default and preserves opt-out", () => {
	const defaults = normalizeState(null);
	expect(defaults.settings.thumbnailCapture.enabled).toBe(true);

	const optedOut = normalizeState({
		...structuredClone(DEFAULT_SETUP),
		settings: {
			...structuredClone(DEFAULT_SETUP.settings),
			thumbnailCapture: { enabled: false, delayMs: 2000 },
		},
	});
	expect(optedOut.settings.thumbnailCapture).toEqual({
		enabled: false,
		delayMs: 2000,
	});
});
