import { GlassIcon } from "@klice-start/ui/components/glass-icon";
import { Icon } from "@klice-start/ui/icons/icon";
import {
	glassFocusRing,
	glassForeground,
	glassLensVeil,
	glassLiquidProps,
} from "../../../lib/glass";
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
	const { isLiquid, glassParams, resolvedDark } = useAppearance();
	const optics = glassLiquidProps(glassParams, "clear");

	return (
		<div className="relative flex items-center">
			{isLiquid ? (
				<GlassIcon
					glassVariant="liquid-refract"
					liquidProps={{
						blur: optics.blur,
						refraction: optics.refraction,
						saturation: optics.saturation,
						brightness: optics.brightness,
						bezel: optics.bezel,
					}}
					surfaceClassName={glassLensVeil("toolbar", resolvedDark)}
					onClick={onSettings}
					aria-label="Settings"
					aria-pressed={false}
					aria-expanded={false}
					aria-controls="settings-sidebar"
					id="settings-trigger"
					data-settings-ui="true"
					className={cn(
						TOOLBAR.standaloneSize,
						"shrink-0 shadow-none transition-colors",
						glassForeground(),
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
