import { ToolbarIconButton } from "./toolbar-icon-button";

interface ToolbarActionsProps {
	onSettings: () => void;
}

/** Settings remains the persistent app-level action when the sidebar is closed. */
export function ToolbarActions({ onSettings }: ToolbarActionsProps) {
	return (
		<div className="relative flex items-center">
			<ToolbarIconButton
				icon="settings"
				label="Settings"
				onClick={onSettings}
				id="settings-trigger"
				expanded={false}
				controls="settings-sidebar"
				dataSettingsUi
			/>
		</div>
	);
}
