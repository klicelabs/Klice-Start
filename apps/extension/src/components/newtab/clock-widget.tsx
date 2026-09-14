import { useClock } from "../../hooks/use-clock";
import { HERO_TEXT_SHADOW, wallpaperText } from "../../lib/glass";
import { cn } from "../../lib/utils";
import { useSetupStore } from "../../stores/setup-store";

export function ClockWidget() {
	const { time, date, greeting, clockVisible, greetingVisible, visible } =
		useClock();
	// User-configurable clock scale (100 = base 56px).
	const size = useSetupStore((s) => s.settings.clock.size);

	if (!visible) return null;

	const timeFontSize = `${Math.round((56 * (size || 100)) / 100)}px`;

	return (
		<div className="clock-widget flex flex-col items-center gap-2">
			{clockVisible ? (
				<>
					<span
						className={cn(
							wallpaperText("secondary"),
							"clock-date font-semibold text-[20px] leading-[1.15] tracking-[-0.015em]",
						)}
						style={{ textShadow: HERO_TEXT_SHADOW }}
					>
						{date}
					</span>
					<span
						className={cn(
							wallpaperText("primary"),
							"clock-time font-semibold leading-[0.88] tracking-[-0.055em]",
						)}
						style={{ fontSize: timeFontSize, textShadow: HERO_TEXT_SHADOW }}
					>
						{time}
					</span>
				</>
			) : null}
			{greetingVisible ? (
				<span
					className={cn(
						wallpaperText("primary"),
						"clock-greeting mt-4 font-semibold text-[34px] leading-[1.06] tracking-[-0.04em]",
					)}
					style={{ textShadow: HERO_TEXT_SHADOW }}
				>
					{greeting}
				</span>
			) : null}
		</div>
	);
}
