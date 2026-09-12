import { glassVariantStyles } from "@klice-start/ui/lib/glass-variants";
import { cn } from "./utils";

/**
 * Refractive sheen shared by every Glass-mode transient surface. A light top
 * edge that fades into a darker veil keeps white menu text readable in both
 * themes while still letting the wallpaper read through the blur — this is
 * what keeps menus in the same family as the tabbar instead of reading as
 * generic opaque panels.
 */
const GLASS_SHEEN =
	"[background-image:linear-gradient(180deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0.07)_42%,rgba(0,0,0,0.10)_100%)]";
const GLASS_SHEEN_DARK =
	"dark:[background-image:linear-gradient(180deg,rgba(255,255,255,0.10)_0%,rgba(0,0,0,0.14)_55%,rgba(0,0,0,0.30)_100%)]";

/**
 * Dropdown menu surface (overflow / search popovers).
 * Liquid: the shared glasscn "liquid" material — visually connected to the
 *   tabbar it hangs from, so the two read as one material.
 * Classic: standard opaque popover.
 */
export function glassDropdown(isLiquid: boolean): string {
	if (isLiquid) {
		return cn(
			glassVariantStyles.liquid,
			"rounded-2xl p-1.5 text-white/95 shadow-2xl",
		);
	}
	return cn(
		"rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg",
	);
}

/**
 * Dropdown menu item.
 * Liquid: translucent hover.
 * Classic: standard muted hover.
 *
 * No cursor override: Klice Start uses the platform arrow cursor for normal
 * clickable UI (menu rows included), matching native desktop menus.
 */
export function glassDropdownItem(isLiquid: boolean): string {
	if (isLiquid) {
		return "rounded-xl px-3 py-2 text-[13px] text-white/90 transition-colors duration-100 hover:bg-white/[0.12] hover:text-white focus:bg-white/[0.16] focus:text-white";
	}
	return "rounded-xl px-3 py-2 text-[13px] text-foreground transition-colors duration-100 hover:bg-muted focus:bg-muted focus:text-foreground";
}

/**
 * Menu surface shared by card, tab, page, and overflow context menus — one
 * recipe so every menu reads as the same layer.
 *
 * Glass mode: the dense sibling of the tabbar's liquid material. It carries a
 * real translucent fill + blur + sheen + hairline highlight (never an opaque
 * black panel), just with a heavier veil than a dropdown so item text stays
 * readable over any wallpaper.
 * Flat mode: the existing solid popover, with the primitive's inherited
 * pseudo-element blur cleared so the surface is genuinely opaque.
 */
export function glassMenu(isLiquid: boolean): string {
	const layout = "min-w-44 rounded-xl p-1 shadow-xl";
	const clearInheritedBackdrop =
		"before:bg-transparent before:backdrop-blur-none before:backdrop-saturate-100";

	if (isLiquid) {
		return cn(
			layout,
			"text-white/95",
			"backdrop-blur-[20px] backdrop-saturate-[1.8] backdrop-brightness-[1.02]",
			"dark:backdrop-saturate-[1.6] dark:backdrop-brightness-[0.96]",
			"bg-black/[0.16] dark:bg-black/[0.28]",
			GLASS_SHEEN,
			GLASS_SHEEN_DARK,
			"border-[0.5px] border-white/[0.34] dark:border-white/[0.12]",
			"shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),inset_0_-12px_22px_-12px_rgba(255,255,255,0.30),0_18px_40px_-10px_rgba(15,23,42,0.34)]",
			"dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.20),inset_0_-12px_24px_-12px_rgba(180,210,255,0.10),0_20px_48px_-12px_rgba(0,0,0,0.55)]",
			clearInheritedBackdrop,
		);
	}

	return cn(
		layout,
		"border border-border bg-popover text-popover-foreground",
		clearInheritedBackdrop,
	);
}

/**
 * Quiet inset field for use INSIDE a menu surface (e.g. the overflow
 * dropdown's search/create input). The parent surface already provides the
 * material, so this only draws a hairline boundary directly on it: no second
 * filled panel, no raised inner card, no brightness jump — just a restrained
 * border that firms up on focus.
 */
export function glassField(isLiquid: boolean): string {
	if (isLiquid) {
		return cn(
			"border border-white/[0.16] bg-transparent text-white/90 placeholder-white/70 outline-none transition-[border-color,box-shadow] duration-150",
			"focus:border-white/45 focus:ring-1 focus:ring-white/20",
			"focus-within:border-white/45 focus-within:ring-1 focus-within:ring-white/20",
			"has-[[data-slot=input-group-control]:focus-visible]:border-white/45 has-[[data-slot=input-group-control]:focus-visible]:ring-1 has-[[data-slot=input-group-control]:focus-visible]:ring-white/20",
		);
	}
	return cn(
		"border border-border/70 bg-transparent text-foreground placeholder-muted-foreground outline-none transition-[border-color,box-shadow] duration-150",
		"focus:border-ring/60 focus:ring-1 focus:ring-ring/25",
		"focus-within:border-ring/60 focus-within:ring-1 focus-within:ring-ring/25",
		"has-[[data-slot=input-group-control]:focus-visible]:border-ring/60 has-[[data-slot=input-group-control]:focus-visible]:ring-1 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/25",
	);
}

/**
 * Speed-Dial card footer surface (the strip housing favicon + title beneath a
 * card's thumbnail). Centralized here so DialCard and FolderPreviewCard never
 * hand-roll `bg-black/25` / `bg-card` — the footer is part of the glasscn
 * material and reacts to the global transparency theme toggle.
 *
 * There is intentionally NO border/divider between body and footer: the
 * transition is carried by material/background hierarchy alone, so the card
 * reads as one coherent object.
 *
 * Liquid: a translucent frosted strip (backdrop blur) that lets the wallpaper
 *   bloom through, matching the "liquid" glass variant.
 * Classic: the opaque flat card surface.
 */
export function glassCardFooter(isLiquid: boolean): string {
	if (isLiquid) {
		return cn(
			"bg-white/[0.10] text-white/90",
			"backdrop-blur-[12px] backdrop-saturate-[1.8]",
		);
	}
	return "bg-muted text-foreground";
}

/**
 * Elegant keyboard-focus ring that stays legible on glass and flat alike.
 * Liquid surfaces get a soft white ring (visible over any wallpaper);
 * classic surfaces use the theme ring. Never remove focus — integrate it.
 */
export function glassFocusRing(isLiquid: boolean): string {
	return cn(
		"focus-visible:outline-none focus-visible:ring-2",
		isLiquid ? "focus-visible:ring-white/70" : "focus-visible:ring-ring",
	);
}

/**
 * Bonjourr-style clean shadow — guarantees legibility for hero text that sits
 * directly on the wallpaper (clock, empty state) on any wallpaper, bright or
 * busy, without a heavy scrim. Shared so every piece of unbacked hero text
 * uses the same treatment.
 */
export const HERO_TEXT_SHADOW =
	"0 1px 12px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.35)";

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
				return "text-white/85";
			case "muted":
				return "text-white/75";
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
