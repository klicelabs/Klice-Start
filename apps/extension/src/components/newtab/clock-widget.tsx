import { useClock } from "../../hooks/use-clock";
import { useSetupStore } from "../../stores/setup-store";

// Bonjourr-style clean shadow — guarantees legibility on any wallpaper,
// bright or busy, without a heavy scrim.
const HERO_TEXT_SHADOW = "0 1px 12px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.35)";

export function ClockWidget() {
	const { time, date, greeting, visible } = useClock();
	// User-configurable clock scale (100 = base 56px).
	const size = useSetupStore((s) => s.settings.clock.size);

	if (!visible) return null;

	const timeFontSize = `${Math.round((56 * (size || 100)) / 100)}px`;

	return (
		<div className="clock-widget flex flex-col items-center gap-1">
			{greeting && (
				<span
					className="clock-greeting font-bold text-[15px] opacity-90"
					style={{ textShadow: HERO_TEXT_SHADOW }}
				>
					{greeting}
				</span>
			)}
			<span
				className="clock-time font-bold leading-none tracking-tight"
				style={{ fontSize: timeFontSize, textShadow: HERO_TEXT_SHADOW }}
			>
				{time}
			</span>
			<span
				className="clock-date font-bold text-[13px] opacity-80"
				style={{ textShadow: HERO_TEXT_SHADOW }}
			>
				{date}
			</span>
		</div>
	);
}
