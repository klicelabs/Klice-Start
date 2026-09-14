import { glassVariantStyles } from "@klice-start/ui/lib/glass-variants";
import {
	type FlatElevation,
	flatSunken,
	flatSurface,
} from "@klice-start/ui/lib/surface";
import { cn } from "./utils";

/**
 * Shared material entry point for extension surfaces.
 *
 * Liquid Glass is intentionally the exact glasscn recipe used by the toolbar
 * and search field. Flat mode keeps its own opaque elevation system instead of
 * inheriting any translucent glass styling. Components should choose geometry
 * and interaction states around this helper, never re-create the material.
 */
export function glassMaterial(
	isLiquid: boolean,
	elevation: Extract<
		FlatElevation,
		"floating" | "menu" | "panel" | "dialog"
	> = "floating",
): string {
	return isLiquid ? glassVariantStyles.liquid : flatSurface(elevation);
}

/**
 * Dropdown menu surface (overflow / search popovers).
 * Liquid: the shared glasscn "liquid" material — visually connected to the
 *   tabbar it hangs from, so the two read as one material.
 * Classic: standard opaque popover.
 */
export function glassDropdown(isLiquid: boolean): string {
	return cn(
		glassMaterial(isLiquid, "menu"),
		"rounded-2xl p-1.5",
		isLiquid ? "text-white/95" : "text-popover-foreground",
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
	return "rounded-xl px-3 py-2 text-[13px] text-flat-ink transition-colors duration-100 hover:bg-flat-sunken-raised focus:bg-flat-sunken-raised focus:text-flat-ink";
}

/**
 * Menu surface shared by card, tab, page, and overflow context menus — one
 * recipe so every menu reads as the same layer.
 *
 * Glass mode uses the same liquid material as the tabbar and cards. The menu
 * primitive supplies its own layout and animation; it must not introduce a
 * second glass recipe with different blur, tint, stroke, or shadow values.
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
			glassMaterial(true, "menu"),
			"text-white/95",
			clearInheritedBackdrop,
		);
	}

	return cn(
		layout,
		glassMaterial(false, "menu"),
		"text-flat-ink",
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
		flatSunken("controlPressed"),
		"text-flat-ink placeholder-flat-ink-muted outline-none transition-[box-shadow,color] duration-150",
		"focus-within:ring-1 focus-within:ring-ring/35 focus:ring-1 focus:ring-ring/35",
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
 * Liquid: a restrained tonal veil inside the already-materialised card. It
 *   preserves the card's shared blur and highlight instead of creating a
 *   second, brighter glass panel in the footer.
 * Classic: the opaque flat card surface.
 */
export function glassCardFooter(isLiquid: boolean): string {
	if (isLiquid) {
		return cn(
			"bg-black/[0.06] text-white/90",
			"backdrop-blur-[4px] backdrop-saturate-[1.15]",
			"shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]",
		);
	}
	return "bg-flat-sunken-raised text-flat-ink";
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
 * Drop-target emphasis that preserves the material's own elevation. The ring
 * is mode-aware, while the shared surface underneath stays untouched.
 */
export function glassDropRing(isLiquid: boolean): string {
	return isLiquid ? "ring-2 ring-white/80" : "ring-2 ring-ring/80";
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

/**
 * Semantic ink for content painted directly over the wallpaper. This role is
 * independent from both theme and material: unlike Settings or a card/menu
 * surface, the wallpaper underneath can change at any time.
 */
export function wallpaperText(
	variant: "primary" | "secondary" | "muted" = "primary",
): string {
	switch (variant) {
		case "primary":
			return "text-[var(--foreground-on-wallpaper)]";
		case "secondary":
			return "text-[var(--foreground-on-wallpaper-muted)]";
		case "muted":
			return "text-[var(--foreground-on-wallpaper-subtle)]";
	}
}
