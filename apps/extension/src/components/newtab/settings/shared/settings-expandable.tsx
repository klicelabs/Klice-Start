import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

interface SettingsExpandableProps {
	/** Whether the extra region is shown. */
	expanded: boolean;
	/** Accessible name for the expanded region. */
	label: string;
	children: ReactNode;
}

/**
 * The one expandable region for Settings.
 *
 * Anatomy is always:
 *
 *   base row (a plain SettingRow — untouched by expansion)
 *   ↓
 *   this animated region
 *
 * The base row keeps the exact height/padding of every standard row. When
 * collapsed the region unmounts completely — zero height, zero margin, zero
 * gap — so a collapsed expandable row is indistinguishable from a standard
 * row. Expansion uses the same clean height recipe as the wallpaper
 * uploader: ease-out, no bounce, motion-safe.
 */
export function SettingsExpandable({
	expanded,
	label,
	children,
}: SettingsExpandableProps) {
	const reduce = useReducedMotion() ?? false;

	return (
		<AnimatePresence initial={false}>
			{expanded ? (
				<motion.div
					key="settings-expanded"
					role="region"
					aria-label={label}
					initial={{ height: 0, opacity: 0 }}
					animate={{ height: "auto", opacity: 1 }}
					exit={{ height: 0, opacity: 0 }}
					transition={
						reduce
							? { duration: 0 }
							: { duration: 0.22, ease: [0.23, 1, 0.32, 1] }
					}
					className="overflow-hidden"
				>
					{children}
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
