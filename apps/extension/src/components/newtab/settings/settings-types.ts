export type SettingsPaneId =
	| "general"
	| "appearance"
	| "search"
	| "bookmarks"
	| "advanced";

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
