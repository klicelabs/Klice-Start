import { Input as InputPrimitive } from "@base-ui/react/input";
import {
	type FrostGlassVariant,
	glassVariantStyles,
} from "@klice-start/ui/lib/glass-variants";
import { cn } from "@klice-start/ui/lib/utils";
import type * as React from "react";

function Input({
	className,
	type,
	glassVariant,
	...props
}: React.ComponentProps<"input"> & {
	glassVariant?: FrostGlassVariant | "classic";
}) {
	const isGlass = glassVariant && glassVariant !== "classic";

	return (
		<InputPrimitive
			type={type}
			data-slot="input"
			className={cn(
				"squircle h-9 w-full min-w-0 rounded-lg border px-3 py-1 text-base outline-none transition-[border-color,background-color,color,box-shadow] duration-200 ease-in-out [--squircle-r:7px] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
				isGlass
					? cn(
							glassVariantStyles[glassVariant],
							"border-white/[0.25] text-white placeholder-white/75",
						)
					: "border-transparent bg-input/50 file:text-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
