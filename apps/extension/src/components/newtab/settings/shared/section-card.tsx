import type { ReactNode } from "react";

import { cn } from "../../../../lib/utils";
import {
	SETTINGS_CARD,
	SETTINGS_CARD_SURFACE,
	SETTINGS_CARD_SURFACE_DANGER,
	SETTINGS_RADIUS,
} from "./settings-tokens";

interface SectionCardProps {
	children: ReactNode;
	className?: string;
	/** Destructive groups get a faint red wash instead of the neutral one. */
	tone?: "default" | "danger";
}

/**
 * One group of related preferences. Rows provide their own inset, so the card
 * only owns the surface, the radius and a thin edge — enough to group without
 * adding visual weight. Never nest a card inside a card.
 */
export function SectionCard({
	children,
	className,
	tone = "default",
}: SectionCardProps) {
	return (
		<div
			className={cn(
				"squircle relative overflow-visible shadow-none",
				SETTINGS_RADIUS.section,
				SETTINGS_CARD,
				tone === "danger" ? SETTINGS_CARD_SURFACE_DANGER : SETTINGS_CARD_SURFACE,
				className,
			)}
		>
			{children}
		</div>
	);
}
