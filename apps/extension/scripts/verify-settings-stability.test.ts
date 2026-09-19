import { expect, test } from "bun:test";
import { DEFAULT_SETUP } from "../src/lib/constants";
import { mergeExternalSetup } from "../src/lib/merge-external-setup";
import { useSetupStore } from "../src/stores/setup-store";

test("visual preference updates retain Home's content and order references", () => {
	const before = useSetupStore.getState();
	before.updateSettings({ tileSize: "large" });
	before.updateBackground({ blur: 16 });
	before.updateClock({ size: 120 });
	before.updateGreeting({ size: 120 });
	const after = useSetupStore.getState();
	expect(after.folders).toBe(before.folders);
	expect(after.cards).toBe(before.cards);
	expect(after.itemOrder).toBe(before.itemOrder);
});

test("external settings-only update preserves Home references and location", () => {
	const current = structuredClone(DEFAULT_SETUP);
	const incoming = structuredClone(current);
	incoming.settings.tileSize = "large";
	const update = mergeExternalSetup(current, incoming);
	expect(update).not.toBeNull();
	expect(update?.folders).toBe(current.folders);
	expect(update?.cards).toBe(current.cards);
	expect(update?.itemOrder).toBe(current.itemOrder);
	expect(update?.activeFolderId).toBe(current.activeFolderId);
	expect(update?.settings).toBe(incoming.settings);
});

test("identical external snapshots do not notify the store", () => {
	const current = structuredClone(DEFAULT_SETUP);
	expect(mergeExternalSetup(current, structuredClone(current))).toBeNull();
});
