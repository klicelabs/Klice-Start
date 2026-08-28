import { GlassIcon } from "@klice-start/ui/components/glass-icon";
import { Icon } from "@klice-start/ui/icons/icon";
import type { IconName } from "@klice-start/ui/icons/icon";
import { TOOLBAR } from "../../../lib/toolbar-tokens";
import { cn } from "../../../lib/utils";
import { useAppearance } from "../appearance-provider";

interface ToolbarIconButtonProps {
	icon: IconName;
	label: string;
	onClick: () => void;
	/** Active/pressed visual state (e.g. an open menu). */
	active?: boolean;
	iconSize?: number;
}

/**
 * A standalone circular toolbar control where the *button itself* is the glass
 * material — no surrounding padded pill. This is the glasscn `GlassIcon`
 * (iOS Control Center style) so hover/press paint the whole circle, not an
 * inner element inside a visible container.
 *
 * Diameter is fixed at 42px to match the total height of the grouped pills
 * (p-1 padding + 34px control), so standalone and grouped controls sit on the
 * same visual baseline.
 *
 * Grouped controls (tabs, search+add) stay inside <GlassSurface>; only the
 * lone controls (back, settings) use this.
 */
export function ToolbarIconButton({
	icon,
	label,
	onClick,
	active = false,
	iconSize = TOOLBAR.iconSize,
}: ToolbarIconButtonProps) {
	const { isLiquid } = useAppearance();

	if (isLiquid) {
		return (
			<GlassIcon
				glassVariant="liquid"
				onClick={onClick}
				aria-label={label}
				aria-pressed={active}
				className={cn(
					"aspect-square size-[42px] shrink-0 text-white/70 transition-colors hover:text-white",
					active && "bg-white/25 text-white",
				)}
			>
				<Icon name={icon} size={iconSize} />
			</GlassIcon>
		);
	}

	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			aria-pressed={active}
			className={cn(
				"flex aspect-square size-[42px] shrink-0 items-center justify-center rounded-full border shadow-sm transition-all duration-150 active:scale-95",
				active
					? "border-border bg-primary text-primary-foreground"
					: "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
			)}
		>
			<Icon name={icon} size={iconSize} />
		</button>
	);
}
