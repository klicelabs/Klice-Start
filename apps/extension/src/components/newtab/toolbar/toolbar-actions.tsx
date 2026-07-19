import { Icon } from "@perch/ui/icons/icon";
import {
	TOOLBAR,
	toolbarControlClassic,
	toolbarControlLiquid,
} from "../../../lib/toolbar-tokens";
import { cn } from "../../../lib/utils";
import { useAppearance } from "../appearance-provider";
import { GlassSurface } from "./glass-surface";
import { ToolbarIconButton } from "./toolbar-icon-button";

interface ToolbarActionsProps {
	onSearch: () => void;
	onSettings: () => void;
	onAdd: () => void;
	addOpen: boolean;
}

/**
 * Trailing actions. Search + Add share one glass pill; Settings gets its own.
 * Both pills use the same inner padding, so every icon button is an identical
 * circle — no more undersized settings button.
 */
export function ToolbarActions({
	onSearch,
	onSettings,
	onAdd,
	addOpen,
}: ToolbarActionsProps) {
	const { isLiquid } = useAppearance();

	function iconButton(active: boolean): string {
		return cn(
			TOOLBAR.controlHeight,
			TOOLBAR.controlWidth,
			TOOLBAR.radius,
			"flex items-center justify-center",
			isLiquid ? toolbarControlLiquid(active) : toolbarControlClassic(active),
		);
	}

	return (
		<div className="flex items-center gap-1.5">
			{/* Group 1: Search + Add */}
			<GlassSurface className={TOOLBAR.groupPadding}>
				<button
					type="button"
					className={iconButton(false)}
					onClick={onSearch}
					aria-label="Search"
				>
					<Icon name="search" size={TOOLBAR.iconSize} />
				</button>
				<button
					type="button"
					className={iconButton(addOpen)}
					onClick={onAdd}
					aria-label="Add new"
				>
					<Icon name="plus" size={TOOLBAR.iconSize} />
				</button>
			</GlassSurface>

			{/* Settings — standalone: the button itself is the glass circle */}
			<ToolbarIconButton
				icon="settings"
				label="Open settings"
				onClick={onSettings}
			/>
		</div>
	);
}
