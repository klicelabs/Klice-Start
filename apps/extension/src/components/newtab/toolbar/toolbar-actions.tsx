import { ToolbarIconButton } from "./toolbar-icon-button";

interface ToolbarActionsProps {
	onSettings: () => void;
}

/**
 * The one persistent app action. Search intentionally does not live here:
 * the in-flow UnifiedSearch is the only search surface and Ctrl/Cmd+K focuses
 * that same object.
 */
export function ToolbarActions({ onSettings }: ToolbarActionsProps) {
	return (
		<ToolbarIconButton
			icon="settings"
			label="Settings"
			onClick={onSettings}
			id="settings-trigger"
			expanded={false}
			controls="settings-sidebar"
			dataSettingsUi
		/>
	);
}
