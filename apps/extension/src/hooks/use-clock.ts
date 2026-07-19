import { useEffect, useState } from "react";
import { useSetupStore } from "../stores/setup-store";

export interface ClockState {
	time: string;
	date: string;
	greeting: string;
	visible: boolean;
}

function formatTime(
	date: Date,
	format24: boolean,
	showSeconds: boolean,
	timezone: string,
): string {
	const opts: Intl.DateTimeFormatOptions =
		timezone !== "auto" ? { timeZone: timezone } : {};
	const h = Number.parseInt(
		date.toLocaleString("en-US", { ...opts, hour: "2-digit", hour12: false }),
		10,
	);
	const m = date
		.toLocaleString("en-US", { ...opts, minute: "2-digit" })
		.padStart(2, "0");
	const s = date
		.toLocaleString("en-US", { ...opts, second: "2-digit" })
		.padStart(2, "0");

	let hDisplay = h;
	let suffix = "";
	if (!format24) {
		suffix = h >= 12 ? " PM" : " AM";
		hDisplay = h % 12 === 0 ? 12 : h % 12;
	}

	return `${String(hDisplay).padStart(2, "0")}:${m}${showSeconds ? ":" + s : ""}${suffix}`;
}

function formatDate(date: Date, timezone: string): string {
	const opts: Intl.DateTimeFormatOptions =
		timezone !== "auto" ? { timeZone: timezone } : {};
	return date.toLocaleDateString("en-US", {
		...opts,
		weekday: "long",
		day: "numeric",
		month: "long",
	});
}

function computeGreeting(date: Date, name: string): string {
	if (!name) return "";
	const h = date.getHours();
	const period =
		h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
	return `${period}, ${name}`;
}

export function useClock(): ClockState {
	const enabled = useSetupStore((s) => s.settings.clock.enabled);
	const format24 = useSetupStore((s) => s.settings.clock.format24);
	const showSeconds = useSetupStore((s) => s.settings.clock.showSeconds);
	const timezone = useSetupStore((s) => s.settings.clock.timezone);
	const greetingEnabled = useSetupStore((s) => s.settings.greeting.enabled);
	const name = useSetupStore((s) => s.settings.greeting.name);
	const [now, setNow] = useState(new Date());

	useEffect(() => {
		const timer = setInterval(() => setNow(new Date()), 1000);
		return () => clearInterval(timer);
	}, []);

	if (!enabled) {
		return { time: "", date: "", greeting: "", visible: false };
	}

	return {
		time: formatTime(now, format24, showSeconds, timezone),
		date: formatDate(now, timezone),
		greeting: greetingEnabled ? computeGreeting(now, name) : "",
		visible: true,
	};
}
