import { Icon } from "@klice-start/ui/icons/icon";
import { DURATION, SHARED_LAYOUT_TRANSITION } from "@klice-start/ui/lib/motion";
import { motion, useReducedMotion } from "motion/react";
import { forwardRef } from "react";
import { cn } from "../../../../lib/utils";

const SETTINGS_TRANSPORT_LAYOUT_ID = "settings-transport-control";
const SETTINGS_TRANSPORT_ICON_LAYOUT_ID = "settings-transport-icon";

interface SettingsTransportControlProps {
	open: boolean;
	onClick: () => void;
	className?: string;
	id?: string;
	"aria-controls"?: string;
	"data-settings-ui"?: string;
}

/**
 * The single Settings affordance rendered in two layout locations. Motion
 * treats the closed toolbar button and open sidebar button as one shared
 * element, so the control travels instead of cross-fading between siblings.
 */
export const SettingsTransportControl = forwardRef<
	HTMLButtonElement,
	SettingsTransportControlProps
>(function SettingsTransportControl(
	{
		open,
		onClick,
		className,
		id,
		"aria-controls": ariaControls,
		"data-settings-ui": dataSettingsUi,
	},
	ref,
) {
	const reduceMotion = useReducedMotion() ?? false;
	const transition = reduceMotion ? { duration: 0 } : SHARED_LAYOUT_TRANSITION;

	return (
		<motion.button
			ref={ref}
			layoutId={SETTINGS_TRANSPORT_LAYOUT_ID}
			transition={transition}
			type="button"
			className={cn("relative", className)}
			onClick={onClick}
			aria-label={open ? "Close preferences" : "Settings"}
			aria-expanded={open}
			aria-controls={ariaControls}
			id={id}
			title={open ? "Close preferences" : "Settings"}
			data-settings-ui={dataSettingsUi}
			data-settings-transport-control="true"
		>
			<motion.span
				layoutId={SETTINGS_TRANSPORT_ICON_LAYOUT_ID}
				transition={
					reduceMotion
						? { duration: 0 }
						: {
								duration: DURATION.control,
								ease: SHARED_LAYOUT_TRANSITION.ease,
							}
				}
				className="inline-flex items-center justify-center"
				aria-hidden="true"
			>
				<Icon name={open ? "x" : "settings"} size={18} />
			</motion.span>
		</motion.button>
	);
});
