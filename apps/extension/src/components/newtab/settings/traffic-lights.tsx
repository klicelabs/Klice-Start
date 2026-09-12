import { cn } from "../../../lib/utils";

interface TrafficLightsProps {
	onClose: () => void;
	className?: string;
}

/**
 * macOS-style traffic lights embedded in the Settings sidebar.
 *
 * Settings is a centered dialog, so only close has a meaningful action. The
 * yellow and green lights stay full-strength window chrome rather than
 * implying unsupported minimize/zoom behaviour — they are deliberately inert
 * (no pointer cursor, no handlers) instead of faking desktop-window actions.
 */
export function TrafficLights({ onClose, className }: TrafficLightsProps) {
	return (
		<div className={cn("flex shrink-0 items-center gap-2", className)}>
			<button
				type="button"
				onClick={onClose}
				aria-label="Close Settings"
				title="Close Settings"
				className={cn(
					"group relative flex size-3 items-center justify-center rounded-full",
					"before:absolute before:-inset-1.5 before:content-['']",
					"transition-[filter] duration-150",
					"hover:brightness-95 active:brightness-90",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-transparent",
				)}
			>
				<span className="relative flex size-3 items-center justify-center rounded-full border border-black/15 bg-[#FF5F57] shadow-[inset_0_0_2px_rgba(0,0,0,0.18)] dark:border-black/30">
					<svg
						aria-hidden="true"
						width="7"
						height="7"
						viewBox="0 0 8 8"
						className="opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100"
					>
						<path
							d="M1.5 1.5l5 5M6.5 1.5l-5 5"
							stroke="rgba(0,0,0,0.6)"
							strokeWidth="1.2"
							strokeLinecap="round"
						/>
					</svg>
				</span>
			</button>
			<span
				aria-hidden="true"
				className="size-3 rounded-full border border-black/15 bg-[#FEBC2E] shadow-[inset_0_0_2px_rgba(0,0,0,0.18)] dark:border-black/30"
			/>
			<span
				aria-hidden="true"
				className="size-3 rounded-full border border-black/15 bg-[#28C940] shadow-[inset_0_0_2px_rgba(0,0,0,0.18)] dark:border-black/30"
			/>
		</div>
	);
}
