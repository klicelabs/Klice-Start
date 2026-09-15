import type { CSSProperties, HTMLAttributes } from "react";
import { LiquidGlass } from "@klice-start/ui/components/liquid-glass";
import { glassVariantStyles } from "@klice-start/ui/lib/glass-variants";
import { flatSurface } from "@klice-start/ui/lib/surface";
import {
	type GlassShape,
	type GlassTier,
	glassLiquidProps,
	glassLensVeil,
	glassShape,
	glassTierVariant,
} from "../../../lib/glass";
import { cn } from "../../../lib/utils";
import { useAppearance } from "../appearance-provider";

type GlassSurfaceProps = HTMLAttributes<HTMLDivElement> & {
	/** Product intent mapped to a glasscn material tier. */
	variant?: GlassTier;
	/**
	 * Shared corner role. Defaults per role: hero → toolbar capsule,
	 * search → caller passes searchCollapsed/searchExpanded explicitly,
	 * everything else → section squircle.
	 */
	shape?: GlassShape;
	/**
	 * Drop the Flat elevation (outer shadow) and keep only the face wash.
	 * Toolbar clusters (Tabbar shell) opt out — they sit on the wallpaper
	 * like macOS controls, never floating above it. Floating panels such as
	 * the Search overlay keep the default elevation.
	 */
	shadowless?: boolean;
};

/** Default corner role per semantic Glass role (concentricity by contract). */
const ROLE_SHAPE: Record<GlassTier, GlassShape> = {
	hero: "toolbar",
	toolbar: "toolbar",
	surface: "section",
	nested: "control",
	search: "searchExpanded",
	menu: "section",
	tooltip: "control",
};

/**
 * The single material entry point for product chrome — `KliceGlassSurface`.
 *
 * Components request a semantic ROLE (hero / toolbar / surface / search /
 * menu / tooltip / nested); raw glasscn details (liquid-refract vs liquid
 * vs subtle, blur / refraction / saturation from the global Glass
 * intensity) stay centralized here. Individual product components must NOT
 * contain raw Glass recipes.
 *
 *   - Liquid Glass → the role's glasscn tier through ONE LiquidGlass node
 *     (refractive lens only for hero; every other role is the calm CSS
 *     material so repeated panels never pay for the SVG filter).
 *   - Flat → the flat shadcn surface from semantic tokens. Zero Glass.
 *
 * All transparency lives inside the library styles — never hardcode
 * bg-white/x here.
 */
export function GlassSurface({
	className,
	children,
	variant = "hero",
	shape,
	shadowless = false,
	style,
	...props
}: GlassSurfaceProps) {
	const { isLiquid, glassParams, prefersContrastMore, resolvedDark } =
		useAppearance();
	// prefers-contrast: more upgrades broad `surface` panels to the dense
	// `menu` tier so text survives any wallpaper. Hero keeps its lens.
	const effectiveVariant: GlassTier =
		prefersContrastMore && variant === "surface" ? "menu" : variant;
	const glassVariant = glassTierVariant(effectiveVariant);
	const resolvedShape = shape ?? ROLE_SHAPE[variant];
	// Refractive tiers own no veil in the variant map (liquid-refract is the
	// bare lens), so the role veil lands here: toolbar gets its isolated
	// milky/smoked recipe, hero its clearer sibling. Non-lens tiers already
	// carry their themed veils in the variant classes — never stack this.
	const lensVeil =
		effectiveVariant === "toolbar" || effectiveVariant === "hero"
			? glassLensVeil(effectiveVariant, resolvedDark)
			: "";
	const surfaceClassName = cn(
		"flex items-center",
		glassShape(resolvedShape),
		(variant === "hero" || variant === "toolbar") && "shadow-none",
		className,
	);

	if (isLiquid) {
		const refract = glassVariant === "liquid-refract";
		const optics = glassLiquidProps(
			glassParams,
			glassVariant === "liquid-menu" ? "dense" : "clear",
		);
		return (
			<LiquidGlass
				{...props}
				blur={optics.blur}
				refract={refract}
				refraction={optics.refraction}
				saturation={optics.saturation}
				brightness={optics.brightness}
				bezel={optics.bezel}
				shape={resolvedShape}
				data-glass-role={variant}
				data-glass-tone={resolvedDark ? "dark" : "light"}
				className={cn(
					surfaceClassName,
					lensVeil,
					glassVariantStyles[glassVariant],
				)}
				style={style as CSSProperties}
			>
				{children}
			</LiquidGlass>
		);
	}

	return (
		<div
			{...props}
			data-glass-role={variant}
			data-glass-tone={resolvedDark ? "dark" : "light"}
			className={cn(
				surfaceClassName,
				flatSurface("floating"),
				shadowless && "shadow-none",
			)}
			style={style}
		>
			{children}
		</div>
	);
}

/**
 * Canonical product name for the shared material primitive. `GlassSurface`
 * remains as the historical alias; new code should read `KliceGlassSurface`
 * as the `KliceTheme → tokens → roles → primitives → components` layer.
 */
export const KliceGlassSurface = GlassSurface;
