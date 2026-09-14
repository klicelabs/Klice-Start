import { RangeSlider } from "@klice-start/ui/components/motion/range-slider";
import { Icon, type IconName } from "@klice-start/ui/icons/icon";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { flushPersist } from "../../../../lib/storage";
import { cn } from "../../../../lib/utils";
import { SettingsLabel } from "./settings-label";
import {
	SETTINGS_DESCRIPTION,
	SETTINGS_FOCUS_RING_WITHIN,
	SETTINGS_RADIUS,
} from "./settings-tokens";

interface SliderRowProps {
	label: string;
	icon?: IconName;
	value: number;
	suffix?: string;
	min: number;
	max: number;
	/**
	 * Value granularity. The track renders no tick dots in Settings — every
	 * continuous control (opacity, blur, brightness…) is a clean fill + thumb.
	 */
	step?: number;
	onChange: (value: number) => void;
	description?: string;
	tooltip?: ReactNode;
	className?: string;
}

/**
 * A settings slider built on BEUI's RangeSlider.
 *
 * The row reads top-to-bottom — label and live value on one line, then the
 * track at full width — so every slider in the panel shares the same track
 * length and the same value column, and none of them has to fight the label
 * for horizontal space. The label is never repeated inside the control.
 *
 * The value is mirrored locally while dragging so the track stays smooth. Store
 * updates remain live for preview, while the storage adapter coalesces writes
 * and the final pointer/key interaction flushes the latest value.
 */
export function SliderRow({
	label,
	icon,
	value,
	suffix = "",
	min,
	max,
	step,
	onChange,
	description,
	tooltip,
	className,
}: SliderRowProps) {
	const [local, setLocal] = useState(value);
	const interacting = useRef(false);
	const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!interacting.current) setLocal(value);
	}, [value]);

	// One write per gesture instead of one per animation frame.
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
		<div className={cn("flex min-w-0 flex-col gap-2 px-1.5 py-2.5", className)}>
			<div className="flex min-w-0 items-center justify-between gap-3">
				<span className="flex min-w-0 items-center gap-2.5">
					{icon ? (
						<Icon
							name={icon}
							size={16}
							strokeWidth={1.75}
							className="shrink-0 text-neutral-400 dark:text-neutral-400"
							aria-hidden="true"
						/>
					) : null}
					<span className="min-w-0">
						<SettingsLabel
							tooltip={tooltip && !description ? tooltip : undefined}
						>
							<span className="block truncate">{label}</span>
						</SettingsLabel>
						{description ? (
							<span className={SETTINGS_DESCRIPTION}>{description}</span>
						) : null}
					</span>
				</span>
				<span className="shrink-0 font-medium text-[12px] text-neutral-500 tabular-nums leading-[1.35] dark:text-neutral-300">
					{local}
					{suffix}
				</span>
			</div>
			{/* The ring lives on the track wrapper because the slider's own
			    focusable node is the 4px thumb. The wrapper's first child is the
			    track's fill clip, which the component rounds independently — it
			    has to follow or the tint's corner would not match the track's. */}
			<fieldset
				aria-label={`${label} slider`}
				className={cn(
					"m-0 min-w-0 border-0 p-0",
					"squircle",
					SETTINGS_RADIUS.surface,
					"[&>div:first-child]:rounded-[16px]",
					SETTINGS_FOCUS_RING_WITHIN,
				)}
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
					className={cn(
						"h-8 bg-neutral-900/[0.05] dark:bg-white/[0.06]",
						SETTINGS_RADIUS.surface,
					)}
					onValueChange={(next) => {
						interacting.current = true;
						setLocal(next);
						onChange(next);
						scheduleInteractionFlush();
					}}
				/>
			</fieldset>
		</div>
	);
}
