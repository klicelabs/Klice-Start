import { glassVariantStyles } from "@perch/ui/lib/glass-variants";
import { cn } from "./utils";

/**
 * Dropdown menu surface.
 * Liquid: the shared glasscn "liquid" material — never a hand-rolled blur.
 * Classic: standard opaque popover.
 */
export function glassDropdown(isLiquid: boolean): string {
	if (isLiquid) {
		return cn(glassVariantStyles.liquid, "rounded-2xl p-1");
	}
	return cn("rounded-2xl border border-border bg-popover p-1 shadow-lg");
}

/**
 * Dropdown menu item.
 * Liquid: translucent hover.
 * Classic: standard muted hover.
 */
export function glassDropdownItem(isLiquid: boolean): string {
	if (isLiquid) {
		return "rounded-xl px-3 py-2 text-[13px] text-white/80 hover:bg-white/[0.1] hover:text-white transition-colors duration-100 cursor-pointer";
	}
	return "rounded-xl px-3 py-2 text-[13px] text-foreground hover:bg-muted transition-colors duration-100 cursor-pointer";
}

/**
 * Search input style for overlays.
 * Liquid: translucent glass input.
 * Classic: standard input.
 */
export function glassInput(isLiquid: boolean): string {
	if (isLiquid) {
		return cn(
			glassVariantStyles.liquid,
			"rounded-xl px-4 py-2.5 text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-white/25 transition-all duration-150",
		);
	}
	return "bg-background border border-input rounded-xl px-4 py-2.5 text-foreground placeholder-muted-foreground outline-none focus:ring-2 focus:ring-ring transition-all duration-150";
}

/**
 * Speed-Dial card footer surface (the strip housing favicon + title beneath a
 * card's thumbnail). Centralized here so DialCard and FolderPreviewCard never
 * hand-roll `bg-black/25` / `bg-card` — the footer is part of the glasscn
 * material and reacts to the global transparency theme toggle.
 *
 * Liquid: a translucent frosted strip (backdrop blur + hairline top edge) that
 *   lets the wallpaper bloom through, matching the "liquid" glass variant.
 * Classic: the opaque flat card surface.
 */
export function glassCardFooter(isLiquid: boolean): string {
	if (isLiquid) {
		return cn(
			"border-white/[0.12] border-t bg-white/[0.10] text-white/90",
			"backdrop-blur-[12px] backdrop-saturate-[1.8]",
		);
	}
	return "border-border border-t bg-card text-foreground";
}

/**
 * Text color utility for liquid vs classic contexts.
 */
export function glassText(
	isLiquid: boolean,
	variant: "primary" | "secondary" | "muted" = "primary",
): string {
	if (isLiquid) {
		switch (variant) {
			case "primary":
				return "text-white";
			case "secondary":
				return "text-white/80";
			case "muted":
				return "text-white/50";
		}
	}
	switch (variant) {
		case "primary":
			return "text-foreground";
		case "secondary":
			return "text-foreground/80";
		case "muted":
			return "text-muted-foreground";
	}
}
