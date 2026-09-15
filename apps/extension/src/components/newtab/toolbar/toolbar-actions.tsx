import { GlassIcon } from "@klice-start/ui/components/glass-icon";
import { Icon } from "@klice-start/ui/icons/icon";
import { glassFocusRing } from "../../../lib/glass";
import {
	TOOLBAR,
	TOOLBAR_ICON,
	toolbarIconClass,
	toolbarIconSize,
} from "../../../lib/toolbar-tokens";
import { cn } from "../../../lib/utils";
import { useAppearance } from "../appearance-provider";
import { ToolbarIconButton } from "./toolbar-icon-button";

interface ToolbarActionsProps {
	onSettings: () => void;
}

/** Settings remains the persistent app-level action when the sidebar is closed. */
export function ToolbarActions({ onSettings }: ToolbarActionsProps) {
	const { isLiquid } = useAppearance();

	return (
		<div className="relative flex items-center">
			{isLiquid ? (
				<GlassIcon
					glassVariant="liquid-refract"
					liquidProps={{ blur: 8 }}
					onClick={onSettings}
					aria-label="Settings"
					aria-pressed={false}
					aria-expanded={false}
					aria-controls="settings-sidebar"
					id="settings-trigger"
					data-settings-ui="true"
					className={cn(
						TOOLBAR.standaloneSize,
						"shrink-0 text-white/70 shadow-none transition-colors hover:text-white",
						glassFocusRing(true),
					)}
				>
					<Icon
						name="settings"
						size={toolbarIconSize("settings")}
						strokeWidth={TOOLBAR_ICON.strokeWidth}
						className={toolbarIconClass("settings")}
					/>
				</GlassIcon>
			) : (
				<ToolbarIconButton
					icon="settings"
					label="Settings"
					onClick={onSettings}
					id="settings-trigger"
					expanded={false}
					controls="settings-sidebar"
					dataSettingsUi
				/>
			)}
		</div>
	);
}
