import type { ReactNode } from "react";

import { glassShape } from "../../../../lib/glass";
import { cn } from "../../../../lib/utils";
import {
	SETTINGS_CARD,
	SETTINGS_CARD_SURFACE,
	SETTINGS_CARD_SURFACE_DANGER,
} from "./settings-tokens";

interface SectionCardProps {
	children: ReactNode;
	className?: string;
	/** Destructive groups get a faint red wash instead of the neutral one. */
	tone?: "default" | "danger";
}

/**
 * One top-level group of related preferences. Its radius intentionally matches
 * the sidebar content frame; controls and thumbnails inside it use smaller
 * radius tokens, keeping the nesting legible without per-page tuning.
 */
export function SectionCard({
	children,
	className,
	tone = "default",
}: SectionCardProps) {
	return (
		<div
			className={cn(
				glassShape("panel"),
				"relative overflow-visible shadow-none",
				SETTINGS_CARD,
				tone === "danger"
					? SETTINGS_CARD_SURFACE_DANGER
					: SETTINGS_CARD_SURFACE,
				className,
			)}
		>
			{children}
		</div>
	);
}
