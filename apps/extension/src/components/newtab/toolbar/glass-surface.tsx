import type { HTMLAttributes } from "react";
import { glassMaterial } from "../../../lib/glass";
import { cn } from "../../../lib/utils";
import { useAppearance } from "../appearance-provider";

type GlassSurfaceProps = HTMLAttributes<HTMLDivElement>;

/**
 * The single pill "material" for every toolbar group.
 *
 *   - Liquid  → the shared Liquid Glass material (backdrop blur + gradient
 *               sheen + bevel). Works everywhere.
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

	return (
		<div
			className={cn(
				"flex items-center rounded-full",
				glassMaterial(isLiquid, "floating", "regular"),
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}
