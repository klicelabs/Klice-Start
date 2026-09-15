import { RangeSlider } from "@klice-start/ui/components/motion/range-slider";
import { useEffect, useRef, useState } from "react";
import { glassShape } from "../../../../lib/glass";
import { flushPersist } from "../../../../lib/storage";
import { cn } from "../../../../lib/utils";

interface SettingsRangeSliderProps {
	label: string;
	value: number;
	suffix?: string;
	min: number;
	max: number;
	step?: number;
	onChange: (value: number) => void;
	className?: string;
}

/**
 * The one continuous-control primitive in Settings. The beUI RangeSlider
 * owns pointer and keyboard semantics; this wrapper owns the compact Klice
 * readout and coalesces the final persistence flush for live settings.
 */
export function SettingsRangeSlider({
	label,
	value,
	suffix = "",
	min,
	max,
	step,
	onChange,
	className,
}: SettingsRangeSliderProps) {
	const [local, setLocal] = useState(value);
	const interacting = useRef(false);
	const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!interacting.current) setLocal(value);
	}, [value]);

	useEffect(
		() => () => {
			if (flushTimer.current) clearTimeout(flushTimer.current);
			void flushPersist().catch(() => undefined);
		},
		[],
	);

	function flushInteraction() {
		if (flushTimer.current) clearTimeout(flushTimer.current);
		flushTimer.current = null;
		interacting.current = false;
		void flushPersist().catch(() => undefined);
	}

	function scheduleInteractionFlush() {
		if (flushTimer.current) clearTimeout(flushTimer.current);
		flushTimer.current = setTimeout(() => {
			flushTimer.current = null;
			interacting.current = false;
			void flushPersist().catch(() => undefined);
		}, 400);
	}

	return (
		<fieldset
			aria-label={`${label} slider`}
			className={cn("m-0 min-w-0 border-0 p-0", className)}
			onPointerDown={() => {
				interacting.current = true;
			}}
			onPointerUp={flushInteraction}
			onPointerCancel={flushInteraction}
			onLostPointerCapture={flushInteraction}
			onKeyUp={flushInteraction}
			onBlur={flushInteraction}
		>
			<RangeSlider
				value={local}
				min={min}
				max={max}
				step={step}
				showTicks={false}
				aria-label={label}
				formatValueText={(next) => `${next}${suffix}`}
				valueLabel={`${local}${suffix}`}
				className={cn(
					"h-8 bg-neutral-900/[0.05] dark:bg-white/[0.06]",
					glassShape("control"),
				)}
				onValueChange={(next) => {
					interacting.current = true;
					setLocal(next);
					onChange(next);
					scheduleInteractionFlush();
				}}
			/>
		</fieldset>
	);
}
