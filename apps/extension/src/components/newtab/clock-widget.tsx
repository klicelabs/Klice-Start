import { useClock } from "../../hooks/use-clock";
import { HERO_TEXT_SHADOW } from "../../lib/glass";
import { useSetupStore } from "../../stores/setup-store";

export function ClockWidget() {
	const { time, date, greeting, clockVisible, greetingVisible, visible } =
		useClock();
	// User-configurable clock scale (100 = base 56px).
	const size = useSetupStore((s) => s.settings.clock.size);

	if (!visible) return null;

	const timeFontSize = `${Math.round((56 * (size || 100)) / 100)}px`;

	return (
		<div className="clock-widget flex flex-col items-center gap-1">
			{greetingVisible && greeting ? (
				<span
					className="clock-greeting font-bold text-[15px] opacity-90"
					style={{ textShadow: HERO_TEXT_SHADOW }}
				>
					{greeting}
				</span>
			) : null}
			{clockVisible ? (
				<>
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
				</>
			) : null}
		</div>
	);
}
