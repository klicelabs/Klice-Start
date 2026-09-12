/**
 * Dev-only store verification (DnD model + persistence round-trip).
 * Run: bunx tsx apps/extension/scripts/verify-store.ts (from repo root).
 * Never bundled — wxt only ships entrypoints.
 *
 * Covers the premium-pass invariants:
 *  - mixed reorder / moves are single-set and order-preserving
 *  - cycle-unsafe and unknown ids are rejected without mutation
 *  - createSubfolderFromCards is atomic (null on invalid, nothing half-moved)
 *  - coalesced persistence round-trips through normalizeState (incl. legacy
 *    payloads without itemOrder, which must migrate folders-first)
 */

export {};

// ---- Minimal browser shims (storage.ts guards chrome; idb stays lazy). ----
const mem = new Map<string, string>();
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

const { useSetupStore } = await import("../src/stores/setup-store.ts");
const { normalizeState } = await import("../src/lib/storage.ts");
const { buildItemOrder } = await import("../src/lib/item-order.ts");

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
	if (cond) {
		console.log(`ok   ${name}`);
	} else {
		failures += 1;
		console.error(`FAIL ${name}`, extra ?? "");
	}
}
const S = () => useSetupStore.getState();
const orderOf = (container: string) => S().itemOrder?.[container] ?? [];

function freshCard(folderId: string, title: string): string {
	return S().addCard({
		folderId,
		title,
		url: `https://example.com/${title}`,
		favicon: null,
		thumbId: null,
	});
}

// ---- Fixture: Home(+sub) + Design(+UI child) + Work roots. ----
const home = S().folders.find((f) => f.parentId === null)?.id ?? "default";
const design = S().addFolder("Design", null);
const ui = S().addFolder("UI", design);
const subFolder = S().addFolder("Sub", home);
const work = S().addFolder("Work", null);
const c1 = freshCard(home, "a");
const c2 = freshCard(home, "b");
const c3 = freshCard(home, "c");

check("fixture containers exist", orderOf(home).length === 4, orderOf(home));

// ---- 1. Mixed reorder inside one container. ----
S().reorderItems(
	home,
	{ kind: "card", id: c3 },
	{ kind: "card", id: c1 },
	"before",
);
check(
	"reorderItems moves card before target",
	JSON.stringify(orderOf(home)) ===
		JSON.stringify([
			`folder:${subFolder}`,
			`card:${c3}`,
			`card:${c1}`,
			`card:${c2}`,
		]),
	orderOf(home),
);

// Folders participate in the same sequence.
S().reorderItems(
	home,
	{ kind: "card", id: c2 },
	{ kind: "folder", id: subFolder },
	"after",
);
check(
	"folder participates in mixed order",
	JSON.stringify(orderOf(home)) ===
		JSON.stringify([
			`folder:${subFolder}`,
			`card:${c2}`,
			`card:${c3}`,
			`card:${c1}`,
		]),
	orderOf(home),
);

// Unknown ids are no-ops.
const before = JSON.stringify(orderOf(home));
S().reorderItems(
	home,
	{ kind: "card", id: "nope" },
	{ kind: "card", id: c1 },
	"before",
);
check(
	"reorderItems ignores unknown ids",
	JSON.stringify(orderOf(home)) === before,
);

// ---- 2. Atomic mixed move into a folder. ----
S().moveItemsToContainer(work, [c1, c2], [ui]);
const st = S();
check("cards reparented", st.cards.find((c) => c.id === c1)?.folderId === work);
check(
	"folder reparented (nested)",
	st.folders.find((f) => f.id === ui)?.parentId === work,
);
check(
	"destination order preserves input order",
	JSON.stringify(orderOf(work)) ===
		JSON.stringify([`card:${c1}`, `card:${c2}`, `folder:${ui}`]),
	orderOf(work),
);
check(
	"sources stripped",
	!orderOf(home).some((k) => k.endsWith(c1) || k.endsWith(c2)) &&
		!orderOf(design).some((k) => k.endsWith(ui)),
);

// Cycle rejected without mutation (work is an ancestor of ui).
const snapBefore = JSON.stringify({
	f: st.folders,
	c: st.cards,
	o: st.itemOrder,
});
S().moveItemsToContainer(ui, [], [work]);
const snapAfter = JSON.stringify({
	f: S().folders,
	c: S().cards,
	o: S().itemOrder,
});
check("cycle move rejected atomically", snapBefore === snapAfter);

// ---- 3. Combine is atomic. ----
const bad = S().createSubfolderFromCards(home, c3, "missing", "New Folder");
check("combine returns null on invalid pair", bad === null);
check(
	"combine failure mutates nothing",
	JSON.stringify(orderOf(home)) === JSON.stringify(S().itemOrder?.[home] ?? []),
);
const d1 = freshCard(home, "d");
const d2 = freshCard(home, "e");
const sub = S().createSubfolderFromCards(home, d1, d2, "New Folder");
check("combine returns id on valid pair", typeof sub === "string" && !!sub);
if (sub) {
	check(
		"combine reparents both cards",
		S().cards.find((c) => c.id === d1)?.folderId === sub &&
			S().cards.find((c) => c.id === d2)?.folderId === sub,
	);
	check(
		"combine container holds both in order",
		JSON.stringify(orderOf(sub)) ===
			JSON.stringify([`card:${d1}`, `card:${d2}`]),
		orderOf(sub),
	);
}

// ---- 4. Persistence round-trip (coalesced write + normalize). ----
await new Promise((r) => setTimeout(r, 400)); // let the 200ms coalescer flush
const raw = mem.get("perch-setup");
check("persisted snapshot written", typeof raw === "string" && raw.length > 0);
if (raw) {
	const parsed = JSON.parse(raw) as {
		state: Parameters<typeof normalizeState>[0];
	};
	const revived = normalizeState(parsed.state);
	check(
		"round-trip preserves folders",
		JSON.stringify(revived.folders) === JSON.stringify(S().folders),
	);
	check(
		"round-trip preserves cards",
		JSON.stringify(revived.cards) === JSON.stringify(S().cards),
	);
	check(
		"round-trip preserves itemOrder",
		JSON.stringify(revived.itemOrder) === JSON.stringify(S().itemOrder),
	);
}

// ---- 5. Legacy migration (no itemOrder) preserves folders-first order. ----
const legacy = {
	folders: [
		{ id: "r", name: "R", order: 0, parentId: null },
		{ id: "s", name: "S", order: 0, parentId: "r" },
	],
	cards: [
		{
			id: "x",
			folderId: "r",
			title: "X",
			url: "https://example.com/x",
			favicon: null,
			thumbId: null,
			order: 0,
		},
	],
	activeFolderId: "r",
	settings: S().settings,
};
const migrated = normalizeState(legacy as never);
check(
	"legacy migrates folders-first",
	JSON.stringify(migrated.itemOrder?.["r"]) ===
		JSON.stringify(["folder:s", "card:x"]),
	migrated.itemOrder,
);
check(
	"buildItemOrder matches migrated shape",
	JSON.stringify(buildItemOrder(migrated.folders, migrated.cards)["r"]) ===
		JSON.stringify(["folder:s", "card:x"]),
);

if (failures > 0) {
	console.error(`\n${failures} FAILURE(S)`);
	process.exit(1);
}
console.log("\nAll store invariants hold.");
