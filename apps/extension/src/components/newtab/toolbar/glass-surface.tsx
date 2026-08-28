import { glassVariantStyles } from "@klice-start/ui/lib/glass-variants";
import type { HTMLAttributes } from "react";
import { cn } from "../../../lib/utils";
import { useAppearance } from "../appearance-provider";

type GlassSurfaceProps = HTMLAttributes<HTMLDivElement>;

/**
 * The single pill "material" for every toolbar group.
 *
 *   - Liquid  → glasscn's rich CSS material (backdrop blur + gradient sheen +
 *               ambient drift). Works everywhere.
 *   - Classic → flat shadcn surface from semantic tokens.
 *
 * All transparency lives inside the library styles — we never hardcode
 * bg-white/x here.
 */
export function GlassSurface({
	className,
	children,
	...props
}: GlassSurfaceProps) {
	const { isLiquid } = useAppearance();

	if (isLiquid) {
		return (
			<div
				className={cn(
					"flex items-center rounded-full",
					glassVariantStyles.liquid,
					className,
				)}
				{...props}
			>
				{children}
			</div>
		);
	}

	return (
		<div
			className={cn(
				"flex items-center rounded-full border border-border bg-card shadow-sm",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}
