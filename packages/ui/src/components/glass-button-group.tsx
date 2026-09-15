"use client";

import {
	type FrostGlassVariantProp,
	glassVariantStyles,
} from "@klice-start/ui/lib/glass-variants";
import { kliceShape, type KliceShapeName } from "@klice-start/ui/lib/shapes";
import { cn } from "@klice-start/ui/lib/utils";

import { ButtonGroup } from "./button-group";
import { LiquidGlass } from "./liquid-glass";

type GlassButtonGroupProps = React.ComponentProps<typeof ButtonGroup> &
	FrostGlassVariantProp & {
		/**
		 * Corner role for the whole group. Applied to the refractive surface
		 * AND to the ButtonGroup, so the surface and the outer ends of its
		 * segments resolve to the same geometry. Defaults to the grouped
		 * toolbar capsule.
		 */
		shape?: KliceShapeName;
		/** Extra classes applied to the outer LiquidGlass surface only. */
		surfaceClassName?: string;
	};

/**
 * Glasscn's grouped button material. The refractive surface owns one shared
 * material while ButtonGroup owns segment clipping and focus order.
 *
 * The group is ONE object: the surface cannot carry a different corner role
 * from the segments inside it. Passing `shape` through to both — instead of
 * letting each layer append its own `rounded-*` class — is what guarantees
 * that, because the Klice corner roles are plain CSS classes and two of them
 * on one element would both apply, with only stylesheet order deciding which
 * one rendered.
 */
function GlassButtonGroup({
	className,
	glassVariant = "liquid-refract",
	shape = "toolbarGroup",
	surfaceClassName,
	children,
	...props
}: GlassButtonGroupProps) {
	const groupShape = kliceShape(shape);

	if (glassVariant === "liquid-refract") {
		return (
			<LiquidGlass
				shape={shape}
				className={cn("w-fit", surfaceClassName)}
			>
				<ButtonGroup
					data-slot="glass-button-group"
					data-glass-variant={glassVariant}
					className={cn(groupShape, "bg-transparent", className)}
					{...props}
				>
					{children}
				</ButtonGroup>
			</LiquidGlass>
		);
	}

	return (
		<ButtonGroup
			data-slot="glass-button-group"
			data-glass-variant={glassVariant}
			className={cn(
				groupShape,
				glassVariantStyles[glassVariant],
				className,
			)}
			{...props}
		>
			{children}
		</ButtonGroup>
	);
}

export { GlassButtonGroup };
