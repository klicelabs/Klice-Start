import { useClock } from "../../hooks/use-clock";

export function ClockWidget() {
	const { time, date, greeting, visible } = useClock();

	if (!visible) return null;

	return (
		<div className="clock-widget flex flex-col items-center gap-1">
			{greeting && (
				<span className="clock-greeting font-medium text-[15px] opacity-70">
					{greeting}
				</span>
			)}
			<span className="clock-time font-light text-[56px] leading-none tracking-tight">
				{time}
			</span>
			<span className="clock-date text-[13px] opacity-50">{date}</span>
		</div>
	);
}
