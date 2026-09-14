import { flatControl } from "@klice-start/ui/lib/surface";

/**
 * Shared toolbar design tokens. Every control in the toolbar must use these
 * exact values so all pills share one height, radius, and inner padding.
 *
 * The pill *material* (glass / flat) is provided by <GlassSurface>. Controls
 * themselves are transparent and only paint hover / active states — never a
 * hardcoded translucent background.
 */
export const TOOLBAR = {
	/** Toolbar container height. */
	height: "h-14",
	/** All interactive controls (buttons, tabs). 34px reads closer to iOS. */
	controlHeight: "h-[34px]",
	/** Square icon-button width — matches controlHeight for a perfect circle. */
	controlWidth: "w-[34px]",
	/** Universal border radius — pill shape. */
	radius: "rounded-full",
	/** Universal glyph size (px) for every toolbar icon — one consistent size
	    across back, search, settings. Sized up to read closer to macOS. */
	iconSize: 18,
	/** Inner padding of every group pill (identical for all groups). */
	groupPadding: "p-1",
	/** Transition for all interactive states — explicit properties, never transition-all. */
	transition:
		"transition-[background-color,color,transform,box-shadow,opacity] duration-150 ease-out active:scale-[0.97]",
	/**
	 * Same feedback language without transform interpolation. Motion layout
	 * projection owns transform while this control travels into Settings.
	 */
	layoutTransition:
		"transition-[background-color,color,box-shadow,opacity] duration-150 ease-out active:scale-[0.97]",
} as const;

/**
 * Shared control styles — liquid mode. Transparent by default; the enclosing
 * GlassSurface is the material. Active/hover paint over it.
 */

export function toolbarControlLiquid(
	active: boolean,
	sharedLayout = false,
): string {
	const transition = sharedLayout
		? TOOLBAR.layoutTransition
		: TOOLBAR.transition;
	if (active) {
		return `${TOOLBAR.controlHeight} ${TOOLBAR.radius} ${transition} bg-white/25 text-white shadow-sm`;
	}
	return `${TOOLBAR.controlHeight} ${TOOLBAR.radius} ${transition} text-white/70 hover:text-white hover:bg-white/[0.12] active:bg-white/20`;
}

/**
 * Shared control styles — classic mode.
 */

export function toolbarControlClassic(
	active: boolean,
	sharedLayout = false,
): string {
	const transition = sharedLayout
		? TOOLBAR.layoutTransition
		: TOOLBAR.transition;
	if (active) {
		return `${TOOLBAR.controlHeight} ${TOOLBAR.radius} ${transition} ${flatControl()} text-flat-ink`;
	}
	return `${TOOLBAR.controlHeight} ${TOOLBAR.radius} ${transition} text-flat-ink-muted hover:text-flat-ink hover:bg-flat-sunken-raised active:bg-flat-sunken`;
}
