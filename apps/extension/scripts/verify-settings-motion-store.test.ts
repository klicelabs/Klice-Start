import {
	isSettingsLayoutOpen,
	settingsMotionStore,
} from "../src/stores/settings-motion-store";

beforeEach(() => {
	settingsMotionStore.getState().finishClose();
});

test("uses one reversible phase path for open and close", () => {
	const store = settingsMotionStore.getState();
	store.open("appearance");
	expect(settingsMotionStore.getState()).toMatchObject({
		phase: "open",
		pane: "appearance",
	});

	store.close();
	expect(settingsMotionStore.getState()).toMatchObject({
		phase: "closing",
		action: undefined,
	});

	store.open("bookmarks", { type: "add-link" });
	expect(settingsMotionStore.getState()).toMatchObject({
		phase: "open",
		pane: "bookmarks",
		action: { type: "add-link" },
	});
});

test("starts the Home return while keeping Settings mounted through its exit", () => {
	settingsMotionStore.getState().open();
	expect(isSettingsLayoutOpen(settingsMotionStore.getState().phase)).toBe(true);

	settingsMotionStore.getState().close();
	expect(settingsMotionStore.getState().phase).toBe("closing");
	expect(isSettingsLayoutOpen(settingsMotionStore.getState().phase)).toBe(false);

	settingsMotionStore.getState().finishClose();
	expect(settingsMotionStore.getState().phase).toBe("closed");
	expect(isSettingsLayoutOpen(settingsMotionStore.getState().phase)).toBe(false);
});
