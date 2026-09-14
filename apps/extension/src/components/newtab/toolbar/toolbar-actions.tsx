import { Icon } from "@klice-start/ui/icons/icon";
import { glassFocusRing } from "../../../lib/glass";
import {
	TOOLBAR,
	toolbarControlClassic,
	toolbarControlLiquid,
} from "../../../lib/toolbar-tokens";
import { cn } from "../../../lib/utils";
import { useAppearance } from "../appearance-provider";
import { SettingsTransportControl } from "../settings/shared/settings-transport-control";
import { GlassSurface } from "./glass-surface";

interface ToolbarActionsProps {
	onSearch: () => void;
	onSettings: () => void;
	settingsOpen?: boolean;
}

/**
 * Trailing actions on the homepage toolbar: Search + Settings.
 * Minimal, balanced, Apple HIG toolbar layout.
 */
export function ToolbarActions({
	onSearch,
	onSettings,
	settingsOpen = false,
}: ToolbarActionsProps) {
	const { isLiquid } = useAppearance();

	function iconButton(active = false, sharedLayout = false): string {
		return cn(
			TOOLBAR.controlHeight,
			TOOLBAR.controlWidth,
			TOOLBAR.radius,
			"flex items-center justify-center",
			glassFocusRing(isLiquid),
			isLiquid
				? toolbarControlLiquid(active, sharedLayout)
				: toolbarControlClassic(active, sharedLayout),
		);
	}

	return (
		<GlassSurface className={cn(TOOLBAR.groupPadding, "gap-1")}>
			<button
				type="button"
				className={iconButton(false)}
				onClick={onSearch}
				aria-label="Search favorites (Ctrl+K)"
				title="Search favorites (Ctrl+K)"
			>
				<Icon name="search" size={TOOLBAR.iconSize} />
			</button>
			{!settingsOpen && (
				<SettingsTransportControl
					open={false}
					onClick={onSettings}
					className={iconButton(false, true)}
					id="settings-trigger"
					aria-controls="settings-sidebar"
					data-settings-ui="true"
				/>
			)}
		</GlassSurface>
	);
}
