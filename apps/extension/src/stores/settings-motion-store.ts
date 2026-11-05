import { create } from "zustand";
import type {
	SettingsPaneId,
	SettingsSidebarProps,
} from "../components/newtab/settings";

export type SettingsMotionPhase = "closed" | "opening" | "open" | "closing";

/** The Home frame and its Settings-space reservation transition together. */
export function isSettingsLayoutOpen(phase: SettingsMotionPhase): boolean {
	return phase === "opening" || phase === "open";
}

/** Pause expensive repeated backdrops only while the shell is moving. */
export function isSettingsMotionActive(phase: SettingsMotionPhase): boolean {
	return phase === "opening" || phase === "closing";
}

type SettingsMotionState = {
	phase: SettingsMotionPhase;
	pane: SettingsPaneId | undefined;
	action: SettingsSidebarProps["initialAction"];
	open: (
		pane?: SettingsPaneId,
		action?: SettingsSidebarProps["initialAction"],
	) => void;
	close: () => void;
	finishOpen: () => void;
	finishClose: () => void;
};

/**
 * Settings shell state is intentionally outside App. Opening the sidebar is
 * a visual state change, so it must not re-run the Home data selectors and
 * derived grid computations. Subscribers are limited to the shell surfaces
 * that need the phase, while event handlers can drive it imperatively.
 */
export const useSettingsMotionStore = create<SettingsMotionState>((set) => ({
	phase: "closed",
	pane: undefined,
	action: undefined,
	open: (pane, action) =>
		set((state) => ({
			phase: state.phase === "open" ? "open" : "opening",
			pane,
			action,
		})),
	close: () =>
		set((state) =>
			state.phase === "closed"
				? state
				: { ...state, phase: "closing", action: undefined },
		),
	finishOpen: () =>
		set((state) =>
			state.phase === "opening" ? { ...state, phase: "open" } : state,
		),
	finishClose: () =>
		set((state) =>
			state.phase === "closing"
				? { ...state, phase: "closed", action: undefined }
				: state,
		),
}));

export const settingsMotionStore = useSettingsMotionStore;
