export type SettingsPaneId =
	| "general"
	| "appearance"
	| "search"
	| "bookmarks"
	| "advanced";

export const SETTINGS_PANE_LABELS: Record<SettingsPaneId, string> = {
	general: "General",
	appearance: "Appearance",
	search: "Search",
	bookmarks: "Bookmarks",
	advanced: "Advanced",
};

export interface SettingsNavigationState {
	entries: SettingsPaneId[];
	index: number;
}

export function createSettingsNavigation(
	initialPane: SettingsPaneId,
): SettingsNavigationState {
	return { entries: [initialPane], index: 0 };
}

export function pushSettingsNavigation(
	state: SettingsNavigationState,
	nextPane: SettingsPaneId,
): SettingsNavigationState {
	if (state.entries[state.index] === nextPane) return state;

	return {
		entries: [...state.entries.slice(0, state.index + 1), nextPane],
		index: state.index + 1,
	};
}

export function stepSettingsNavigation(
	state: SettingsNavigationState,
	direction: "back" | "forward",
): SettingsNavigationState {
	const delta = direction === "back" ? -1 : 1;
	const index = Math.min(
		state.entries.length - 1,
		Math.max(0, state.index + delta),
	);

	return index === state.index ? state : { ...state, index };
}

export interface SettingsPaneProps {
	className?: string;
}

export interface SettingsDialogProps {
	open: boolean;
	onClose: () => void;
	initialPane?: SettingsPaneId;
	initialAction?: {
		type: "add-link" | "edit-link" | "add-folder" | "edit-folder";
		cardId?: string;
		folderId?: string;
	};
}
