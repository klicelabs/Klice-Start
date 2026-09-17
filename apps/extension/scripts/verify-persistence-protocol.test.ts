/**
 * N1/D2 regression tests — the shared write protocol.
 * Run: cd apps/extension && bun test scripts/verify-persistence-protocol.test.ts
 *
 * N1: the background's read/write helpers must honor the reset-generation
 * protocol — a stamped envelope survives; an envelope older than the current
 * generation reads as "nothing stored"; writes carry the current stamp, so a
 * post-reset quick-save can no longer resurrect dead state invisibly.
 *
 * D2: a corrupt envelope must NOT be absorbed silently — the adapter
 * quarantines it (removes the bad bytes) and reports, matching the
 * localStorage branch's try/catch semantics.
 */

// In-memory chrome.storage.local shim. Functions in storage.ts consult the
// global `chrome` at call time, so setting this before the dynamic import
// (and even on a cached module instance) exercises the real protocol.
const mem = new Map<string, unknown>();
const storageArea = {
	async get(keys: string | string[] | Record<string, unknown>) {
		const wanted = Array.isArray(keys)
			? keys
			: typeof keys === "string"
				? [keys]
				: Object.keys(keys);
		const out: Record<string, unknown> = {};
		for (const key of wanted) {
			if (mem.has(key)) out[key] = mem.get(key);
		}
		return out;
	},
	async set(items: Record<string, unknown>) {
		for (const [key, value] of Object.entries(items)) mem.set(key, value);
	},
	async remove(keys: string | string[]) {
		for (const key of Array.isArray(keys) ? keys : [keys]) mem.delete(key);
	},
	async clear() {
		mem.clear();
	},
};
(globalThis as Record<string, unknown>).chrome = {
	storage: {
		local: storageArea,
		onChanged: {
			addListener: () => undefined,
			removeListener: () => undefined,
		},
	},
};
(globalThis as Record<string, unknown>).localStorage = {
	getItem: (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
	setItem: (k: string, v: string) => void mem.set(k, String(v)),
	removeItem: (k: string) => void mem.delete(k),
	clear: () => mem.clear(),
} as Storage;
(globalThis as Record<string, unknown>).window = {
	addEventListener: () => undefined,
	removeEventListener: () => undefined,
};
(globalThis as Record<string, unknown>).document = {
	addEventListener: () => undefined,
	removeEventListener: () => undefined,
	visibilityState: "visible",
};

import { expect, test } from "bun:test";

const {
	readSetupEnvelope,
	writeSetupEnvelope,
	chromeStorageAdapter,
	RESET_GENERATION_KEY,
	PERSIST_GENERATION_KEY,
} = await import("../src/lib/storage");

function sampleSetup() {
	return {
		folders: [{ id: "f1", name: "Home", order: 0, parentId: null }],
		cards: [],
		activeFolderId: "f1",
		itemOrder: { f1: [] },
		settings: {},
	} as never;
}

test("N1: envelope helpers stamp the generation and treat stale reads as empty", async () => {
	mem.clear();
	// Fresh install: no generation key, generation 0.
	await writeSetupEnvelope("perch-setup", sampleSetup());
	const raw = JSON.parse(mem.get("perch-setup") as string) as Record<
		string,
		unknown
	>;
	// The write carries the current stamp (previously the background wrote a
	// bare { state } envelope that every hydration discarded as generation 0
	// after a reset — N1's resurrect-dead-state mechanism).
	expect(typeof raw[PERSIST_GENERATION_KEY]).toBe("number");
	// Round-trip: the background reads back what it wrote.
	const readBack = await readSetupEnvelope("perch-setup");
	expect(readBack?.folders[0]?.id).toBe("f1");

	// A reset happened elsewhere: generation bumps to 1 (beginReset writes
	// the new barrier before deleting state).
	mem.set(RESET_GENERATION_KEY, 1);
	// The PRE-reset envelope must read as "nothing stored" — a quick-save
	// must never build on dead state (N1's core assertion).
	const stale = await readSetupEnvelope("perch-setup");
	expect(stale).toBeNull();

	// The post-reset save: writeSetupEnvelope stamps generation 1…
	await writeSetupEnvelope("perch-setup", sampleSetup());
	const raw2 = JSON.parse(mem.get("perch-setup") as string) as Record<
		string,
		unknown
	>;
	expect(raw2[PERSIST_GENERATION_KEY]).toBe(1);
	// …and the new envelope survives reads (the badge "✓" finally means the
	// data landed).
	const fresh = await readSetupEnvelope("perch-setup");
	expect(fresh?.folders[0]?.id).toBe("f1");
});

test("D2: corrupt envelope is quarantined and reported, not silently absorbed", async () => {
	mem.clear();
	mem.set("perch-setup", "{not valid json");
	// Pre-fix behavior: unguarded JSON.parse threw, zustand absorbed the
	// rejection, the app ran on defaults with hasHydrated=false forever and
	// the bad bytes stayed in storage.
	const result = await chromeStorageAdapter.getItem("perch-setup");
	expect(result).toBeNull();
	// Quarantine: the corrupt value is gone from storage, so the next write
	// replaces it cleanly and the session is not permanently degraded.
	expect(mem.has("perch-setup")).toBe(false);
	// A subsequent normal write + read round-trips.
	await writeSetupEnvelope("perch-setup", sampleSetup());
	const readBack = await readSetupEnvelope("perch-setup");
	expect(readBack?.folders[0]?.id).toBe("f1");
});
