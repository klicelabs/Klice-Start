import { GlassIcon } from "@klice-start/ui/components/glass-icon";
import type { IconName } from "@klice-start/ui/icons/icon";
import { Icon } from "@klice-start/ui/icons/icon";
import { flatControl, flatFocusRing } from "@klice-start/ui/lib/surface";
import { glassFocusRing } from "../../../lib/glass";
import {
	TOOLBAR,
	TOOLBAR_ICON,
	toolbarIconClass,
	toolbarIconSize,
} from "../../../lib/toolbar-tokens";
import { cn } from "../../../lib/utils";
import { useAppearance } from "../appearance-provider";

interface ToolbarIconButtonProps {
	icon: IconName;
	label: string;
	onClick: () => void;
	/** Active/pressed visual state (e.g. an open menu). */
	active?: boolean;
	id?: string;
	expanded?: boolean;
	controls?: string;
	dataSettingsUi?: boolean;
	/** Render as a transparent control inside an existing GlassSurface. */
	insideSurface?: boolean;
}

/**
 * A standalone circular toolbar control where the *button itself* is the glass
 * material — no surrounding padded pill. This is the glasscn `GlassIcon`
 * (iOS Control Center style) so hover/press paint the whole circle, not an
 * inner element inside a visible container.
 *
 * Diameter is fixed at the shared toolbar surface height (34px) to match the
 * total height of the grouped pills (3px padding + 28px control), so
 * standalone and grouped controls sit on the same visual baseline.
 *
 * Grouped controls (tabs and history) stay inside one GlassSurface; the lone
 * GlassIcon controls (compact search and settings) use this.
 */
export function ToolbarIconButton({
	icon,
	label,
	onClick,
	active = false,
	id,
	expanded,
	controls,
	dataSettingsUi = false,
	insideSurface = false,
}: ToolbarIconButtonProps) {
	const { isLiquid } = useAppearance();

	// One glyph token drives every toolbar icon: the box size and the class
	// both come from TOOLBAR_ICON, so a chevron and the Settings gear reach the
	// same optical ink height instead of the same nominal box. The stroke is
	// the shared lighter Apple-like weight, not Lucide's default 2.
	const glyph = (
		<Icon
			name={icon}
			size={toolbarIconSize(icon)}
			strokeWidth={TOOLBAR_ICON.strokeWidth}
			className={toolbarIconClass(icon)}
		/>
	);

	if (isLiquid && !insideSurface) {
		return (
			<GlassIcon
				glassVariant="liquid-refract"
				liquidProps={{ blur: 8 }}
				onClick={onClick}
				aria-label={label}
				aria-pressed={active}
				aria-expanded={expanded}
				aria-controls={controls}
				id={id}
				data-settings-ui={dataSettingsUi ? "true" : undefined}
				className={cn(
					TOOLBAR.standaloneSize,
					"shrink-0 text-white/70 shadow-none transition-colors hover:text-white",
					glassFocusRing(isLiquid),
					active && "bg-white/25 text-white",
				)}
			>
				{glyph}
			</GlassIcon>
		);
	}

	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			aria-pressed={active}
			aria-expanded={expanded}
			aria-controls={controls}
			id={id}
			data-settings-ui={dataSettingsUi ? "true" : undefined}
			className={cn(
				insideSurface
					? cn(
							"flex shrink-0 items-center justify-center",
							TOOLBAR.innerSize,
							TOOLBAR.radius,
							TOOLBAR.transition,
						)
					: cn(
							"flex shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 active:scale-95",
							TOOLBAR.standaloneSize,
						),
				insideSurface
					? isLiquid
						? glassFocusRing(isLiquid)
						: flatFocusRing()
					: undefined,
				insideSurface
					? isLiquid
						? active
							? "bg-white/25 text-white"
							: "text-white/70 hover:bg-white/[0.12] hover:text-white active:bg-white/20"
						: active
							? `${flatControl()} text-flat-ink shadow-none`
							: "text-flat-ink hover:bg-flat-sunken-raised active:bg-flat-sunken"
					: cn(
							flatControl(),
							flatFocusRing(),
							"text-flat-ink",
							"shadow-none",
						),
			)}
		>
			{glyph}
		</button>
	);
}
