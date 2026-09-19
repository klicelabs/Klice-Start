import { useClock } from "../../hooks/use-clock";
import { HERO_TEXT_SHADOW, wallpaperText } from "../../lib/glass";
import { cn } from "../../lib/utils";
import { useSetupStore } from "../../stores/setup-store";

export function ClockWidget() {
	const {
		time,
		date,
		greeting,
		clockVisible,
		dateVisible,
		greetingVisible,
		visible,
	} = useClock();
	// User-configurable clock scale (100 = base 56px).
	const clockSize = useSetupStore((s) => s.settings.clock.size);
	const dateSize = useSetupStore((s) => s.settings.clock.dateSize);
	const greetingSize = useSetupStore((s) => s.settings.greeting.size);

	if (!visible) return null;

	const timeFontSize = `${Math.round((56 * (clockSize || 100)) / 100)}px`;
	const dateFontSize = `${Math.round((20 * (dateSize || 100)) / 100)}px`;
	const greetingFontSize = `${Math.round((34 * (greetingSize || 100)) / 100)}px`;

	return (
		<div className="clock-widget flex flex-col items-center">
			{clockVisible || dateVisible ? (
				<div className="clock-readout flex flex-col items-center gap-[var(--speed-dial-space-tight)]">
					{dateVisible ? (
						<span
							className={cn(
								wallpaperText("secondary"),
								"clock-date font-semibold leading-[1.15] tracking-[-0.015em]",
							)}
							style={{ fontSize: dateFontSize, textShadow: HERO_TEXT_SHADOW }}
						>
							{date}
						</span>
					) : null}
					{clockVisible ? (
						<span
							className={cn(
								wallpaperText("primary"),
								"clock-time font-semibold leading-[0.88] tracking-[-0.055em]",
							)}
							style={{ fontSize: timeFontSize, textShadow: HERO_TEXT_SHADOW }}
						>
							{time}
						</span>
					) : null}
				</div>
			) : null}
			{greetingVisible ? (
				<span
					className={cn(
						wallpaperText("primary"),
						"clock-greeting font-semibold leading-[1.06] tracking-[-0.04em]",
						(clockVisible || dateVisible) &&
							"mt-[var(--speed-dial-space-medium)]",
					)}
					style={{ fontSize: greetingFontSize, textShadow: HERO_TEXT_SHADOW }}
				>
					{greeting}
				</span>
			) : null}
		</div>
	);
}
