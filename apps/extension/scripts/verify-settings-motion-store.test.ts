import { settingsMotionStore } from "../src/stores/settings-motion-store";

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

test("releases the layout only after the close transition completes", () => {
	settingsMotionStore.getState().open();
	settingsMotionStore.getState().close();
	expect(settingsMotionStore.getState().phase).toBe("closing");

	settingsMotionStore.getState().finishClose();
	expect(settingsMotionStore.getState().phase).toBe("closed");
});
