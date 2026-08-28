import { Slider } from "@klice-start/ui/components/slider";
import { useEffect, useRef, useState } from "react";
import { flushPersist } from "../../../../lib/storage";
import { cn } from "../../../../lib/utils";

interface SliderRowProps {
	label: string;
	description?: string;
	value: number;
	suffix?: string;
	min: number;
	max: number;
	step?: number;
	onChange: (value: number) => void;
	className?: string;
}

export function SliderRow({
	label,
	description,
	value,
	suffix = "",
	min,
	max,
	step = 1,
	onChange,
	className,
}: SliderRowProps) {
	const [local, setLocal] = useState(value);
	const dragging = useRef(false);

	useEffect(() => {
		if (!dragging.current) setLocal(value);
	}, [value]);

	return (
		<div
			className={cn(
				"flex min-h-[44px] items-center gap-4 border-border/40 border-b px-1 py-2.5 last:border-b-0",
				className,
			)}
		>
			<div className="flex min-w-0 shrink-0 basis-[46%] flex-col">
				<span className="font-normal text-foreground text-sm leading-snug">
					{label}
				</span>
				{description ? (
					<span className="text-muted-foreground text-xs">{description}</span>
				) : (
					<span className="text-muted-foreground text-xs tabular-nums">
						{local}
						{suffix}
					</span>
				)}
			</div>
			<div className="flex flex-1 items-center gap-3">
				<Slider
					min={min}
					max={max}
					step={step}
					value={[local]}
					onValueChange={([v]) => {
						dragging.current = true;
						setLocal(v);
						onChange(v);
					}}
					onValueCommit={() => {
						dragging.current = false;
						flushPersist();
					}}
					className="flex-1"
					aria-label={label}
				/>
				{description && (
					<span className="min-w-[40px] text-right text-muted-foreground text-xs tabular-nums">
						{local}
						{suffix}
					</span>
				)}
			</div>
		</div>
	);
}
