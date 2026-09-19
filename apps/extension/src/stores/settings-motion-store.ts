import { create } from "zustand";
import type {
	SettingsPaneId,
	SettingsSidebarProps,
} from "../components/newtab/settings";

export type SettingsMotionPhase = "closed" | "open" | "closing";

type SettingsMotionState = {
	phase: SettingsMotionPhase;
	pane: SettingsPaneId | undefined;
	action: SettingsSidebarProps["initialAction"];
	open: (
		pane?: SettingsPaneId,
		action?: SettingsSidebarProps["initialAction"],
	) => void;
	close: () => void;
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
	open: (pane, action) => set({ phase: "open", pane, action }),
	close: () =>
		set((state) =>
			state.phase === "closed"
				? state
				: { ...state, phase: "closing", action: undefined },
		),
	finishClose: () =>
		set((state) =>
			state.phase === "closed"
				? state
				: { ...state, phase: "closed", action: undefined },
		),
}));

export const settingsMotionStore = useSettingsMotionStore;
