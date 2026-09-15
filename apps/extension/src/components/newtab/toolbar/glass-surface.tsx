import type { HTMLAttributes } from "react";
import { LiquidGlass } from "@klice-start/ui/components/liquid-glass";
import { glassVariantStyles } from "@klice-start/ui/lib/glass-variants";
import { flatSurface } from "@klice-start/ui/lib/surface";
import {
	glassShape,
	glassTierVariant,
	type GlassTier,
	type GlassShape,
} from "../../../lib/glass";
import { cn } from "../../../lib/utils";
import { useAppearance } from "../appearance-provider";

type GlassSurfaceProps = HTMLAttributes<HTMLDivElement> & {
	/** Product intent mapped to a glasscn material tier. */
	variant?: GlassTier;
	/** Shared corner role; toolbar is the default for this primitive. */
	shape?: GlassShape;
};

/**
 * The single pill "material" for every toolbar group.
 *
 *   - Liquid  → the shared glasscn liquid material for larger/calm surfaces.
 *   - Refract → the glasscn liquid-refract material for compact hero controls.
 *   - Classic → flat shadcn surface from semantic tokens.
 *
 * All transparency lives inside the library styles — we never hardcode
 * bg-white/x here.
 */
export function GlassSurface({
	className,
	children,
	variant = "hero",
	shape = "toolbar",
	...props
}: GlassSurfaceProps) {
	const { isLiquid } = useAppearance();
	const glassVariant = glassTierVariant(variant);
	const surfaceClassName = cn(
		"flex items-center",
		glassShape(shape),
		variant === "hero" && "shadow-none",
		className,
	);

	if (isLiquid) {
		return (
			<LiquidGlass
				{...props}
				blur={8}
				refract={glassVariant === "liquid-refract"}
				className={cn(
					surfaceClassName,
					glassVariantStyles[glassVariant],
				)}
			>
				{children}
			</LiquidGlass>
		);
	}

	return (
		<div
			{...props}
			className={cn(surfaceClassName, flatSurface("floating"))}
		>
			{children}
		</div>
	);
}
