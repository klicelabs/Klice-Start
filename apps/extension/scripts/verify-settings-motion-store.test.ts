import {
	isSettingsLayoutOpen,
	isSettingsMotionActive,
	settingsMotionStore,
} from "../src/stores/settings-motion-store";

beforeEach(() => {
	settingsMotionStore.setState({
		phase: "closed",
		pane: undefined,
		action: undefined,
	});
});

test("stale close completion cannot dismiss a reopened sidebar", () => {
	const store = settingsMotionStore.getState();
	store.open();
	store.close();
	store.open("appearance");
	store.finishClose();
	expect(settingsMotionStore.getState()).toMatchObject({
		phase: "opening",
		pane: "appearance",
	});
	store.finishOpen();
	store.close();
	store.finishClose();
	expect(settingsMotionStore.getState()).toMatchObject({
		phase: "closed",
	});
});

test("uses one reversible phase path for open and close", () => {
	const store = settingsMotionStore.getState();
	store.open("appearance");
	expect(settingsMotionStore.getState()).toMatchObject({
		phase: "opening",
		pane: "appearance",
	});
	expect(isSettingsLayoutOpen(settingsMotionStore.getState().phase)).toBe(true);
	expect(isSettingsMotionActive(settingsMotionStore.getState().phase)).toBe(
		true,
	);
	store.finishOpen();
	expect(settingsMotionStore.getState().phase).toBe("open");
	expect(isSettingsMotionActive(settingsMotionStore.getState().phase)).toBe(
		false,
	);

	store.close();
	expect(settingsMotionStore.getState()).toMatchObject({
		phase: "closing",
		action: undefined,
	});
	expect(isSettingsMotionActive(settingsMotionStore.getState().phase)).toBe(
		true,
	);

	store.open("bookmarks", { type: "add-link" });
	expect(settingsMotionStore.getState()).toMatchObject({
		phase: "opening",
		pane: "bookmarks",
		action: { type: "add-link" },
	});
});

test("starts the Home return while keeping Settings mounted through its exit", () => {
	settingsMotionStore.getState().open();
	expect(isSettingsLayoutOpen(settingsMotionStore.getState().phase)).toBe(true);
	settingsMotionStore.getState().finishOpen();

	settingsMotionStore.getState().close();
	expect(settingsMotionStore.getState().phase).toBe("closing");
	expect(isSettingsLayoutOpen(settingsMotionStore.getState().phase)).toBe(
		false,
	);

	settingsMotionStore.getState().finishClose();
	expect(settingsMotionStore.getState().phase).toBe("closed");
	expect(isSettingsLayoutOpen(settingsMotionStore.getState().phase)).toBe(
		false,
	);
});
