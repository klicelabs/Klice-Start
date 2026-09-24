import { Icon } from "@klice-start/ui/icons/icon";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { toast } from "sonner";
import { glassForeground, glassMaterial, glassShape } from "../../lib/glass";
import {
	REFRESH_STRINGS,
	type RefreshProgressEvent,
} from "../../lib/thumbnail-refresh";
import {
	sendRefreshCancel,
	subscribeRefreshProgress,
} from "../../lib/thumbnail-refresh-client";
import { cn } from "../../lib/utils";
import { useRefreshStore } from "../../stores/refresh-store";
import { useAppearance } from "./appearance-provider";

/** Single persistent toast id — one refresh toast at a time, by construction. */
const REFRESH_TOAST_ID = "klice-refresh-progress";
const SUMMARY_DURATION_MS = 4000;
const RING_RADIUS = 18;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * Calm background-operation feedback for thumbnail refresh. A single
 * persistent bottom-center Sonner custom toast: circular progress ring +
 * "Capturing N of M", a real-time site log (latest at bottom, scrollable
 * past 5), and a keyboard-accessible cancel. On completion it morphs into a
 * short summary ("10 updated, 2 failed" / "Cancelled at 3 of 10").
 *
 * No modal, no blocking, no banners — invisible until a refresh runs.
 */
export function RefreshProgressToast() {
	const active = useRefreshStore((s) => s.active);
	const summary = useRefreshStore((s) => s.summary);

	useEffect(() => subscribeRefreshProgress(handleRefreshEvent), []);

	// One toast id for the whole lifecycle: progress MORPHS into the summary
	// via same-id update. Deliberately no effect cleanup that dismisses —
	// React runs the previous cleanup before the next effect, so a
	// dismiss-then-recreate in the same commit loses the toast in Sonner.
	// Dismissal happens only when neither state remains (or on unmount).
	useEffect(() => {
		if (active) {
			toast.custom(() => <RefreshRunningCard />, {
				id: REFRESH_TOAST_ID,
				duration: Number.POSITIVE_INFINITY,
				position: "bottom-center",
			});
			return undefined;
		}
		if (summary) {
			toast.custom(() => <RefreshSummaryCard />, {
				id: REFRESH_TOAST_ID,
				duration: SUMMARY_DURATION_MS,
				position: "bottom-center",
			});
			const timer = setTimeout(
				() => useRefreshStore.getState().dismissSummary(),
				SUMMARY_DURATION_MS,
			);
			return () => clearTimeout(timer);
		}
		toast.dismiss(REFRESH_TOAST_ID);
		return undefined;
	}, [active, summary]);

	useEffect(
		() => () => {
			toast.dismiss(REFRESH_TOAST_ID);
		},
		[],
	);

	return null;
}

function handleRefreshEvent(event: RefreshProgressEvent): void {
	useRefreshStore.getState().applyProgress(event);
	if (event.status === "already-running") {
		toast.info(REFRESH_STRINGS.alreadyRunning);
	} else if (event.status === "needs-permission") {
		toast.error(REFRESH_STRINGS.needsPermission, { duration: 6000 });
	}
}

function toastSurface(isLiquid: boolean): string {
	return cn(
		"pointer-events-auto w-[min(22rem,calc(100vw-2rem))]",
		glassShape("panel"),
		glassMaterial(isLiquid, "menu", "dense"),
		isLiquid ? glassForeground() : "text-flat-ink",
		"p-3.5 shadow-lg",
	);
}

/**
 * Motion language for the toast log: y-slide + opacity, 200ms, the repo's
 * signature ease. Static when the user prefers reduced motion.
 */
const TOAST_ROW_TRANSITION = {
	duration: 0.2,
	ease: [0.23, 1, 0.32, 1] as const,
};

function RefreshRunningCard() {
	const { isLiquid } = useAppearance();
	const reduceMotion = useReducedMotion() ?? false;
	const total = useRefreshStore((s) => s.total);
	const completed = useRefreshStore((s) => s.completed);
	const currentTitle = useRefreshStore((s) => s.currentTitle);
	const sites = useRefreshStore((s) => s.sites);

	const fraction = total > 0 ? Math.min(1, completed / total) : 0;
	// Two entries, never a scrolling log: the card under the camera at full
	// opacity, the previous one fading behind it like smoke.
	const visible = sites.slice(-2);

	return (
		<div className={toastSurface(isLiquid)}>
			<div className="flex items-center gap-3">
				<ProgressRing fraction={fraction} />
				<div role="status" aria-live="polite" className="min-w-0 flex-1">
					<p className="truncate font-medium text-[13px] leading-tight">
						{REFRESH_STRINGS.capturing(completed, total)}
					</p>
					{currentTitle ? (
						<p className="truncate text-[12px] opacity-70">{currentTitle}</p>
					) : null}
				</div>
				<button
					type="button"
					onClick={() => void sendRefreshCancel()}
					aria-label={REFRESH_STRINGS.cancelRefresh}
					title={REFRESH_STRINGS.cancelRefresh}
					className={cn(
						"inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
						isLiquid
							? "bg-foreground/10 hover:bg-foreground/15"
							: "bg-flat-sunken-raised text-flat-ink-muted hover:text-flat-ink",
					)}
				>
					<Icon name="x" size={15} aria-hidden="true" />
				</button>
			</div>
			{visible.length > 0 ? (
				<div
					role="log"
					aria-label="Capture log"
					className="mt-2.5 flex flex-col gap-1 overflow-hidden"
				>
					{/* wait: the entering row mounts only after the outgoing
					    one clears, so the log never holds more than two rows. */}
					<AnimatePresence initial={false} mode="wait">
						{visible.map((site, index) => {
							const isCurrent = index === visible.length - 1;
							return (
								<motion.div
									key={site.cardId}
									initial={
										reduceMotion
											? { opacity: isCurrent ? 1 : 0.3 }
											: { opacity: 0, y: 8 }
									}
									animate={{ opacity: isCurrent ? 1 : 0.3, y: 0 }}
									exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
									transition={TOAST_ROW_TRANSITION}
									className={cn(
										"flex min-w-0 items-center gap-2 text-[12px]",
										// The previous entry smokes out: motion fades it
										// to ~30% (see animate above) with a gradient
										// mask dissolving toward the top. Mask stops
										// are an alpha technique, not theme colors.
										!isCurrent &&
											"[mask-image:linear-gradient(to_bottom,transparent,black)]",
										!site.ok && "text-red-600 dark:text-red-400",
									)}
								>
									<Icon
										name={site.ok ? "check" : "alert"}
										size={13}
										aria-hidden="true"
										className="shrink-0 opacity-70"
									/>
									<span className="min-w-0 flex-1 truncate opacity-80">
										{site.title}
									</span>
								</motion.div>
							);
						})}
					</AnimatePresence>
				</div>
			) : null}
		</div>
	);
}

function ProgressRing({ fraction }: { fraction: number }) {
	return (
		<div
			role="progressbar"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(fraction * 100)}
			className="relative size-10 shrink-0"
		>
			<svg
				viewBox="0 0 44 44"
				className="size-10 -rotate-90"
				aria-hidden="true"
			>
				<circle
					cx="22"
					cy="22"
					r={RING_RADIUS}
					fill="none"
					strokeWidth="4"
					className="stroke-foreground/15"
				/>
				<circle
					cx="22"
					cy="22"
					r={RING_RADIUS}
					fill="none"
					strokeWidth="4"
					strokeLinecap="round"
					strokeDasharray={RING_CIRCUMFERENCE}
					strokeDashoffset={RING_CIRCUMFERENCE * (1 - fraction)}
					className="stroke-[var(--klice-accent)] transition-[stroke-dashoffset] duration-300 motion-reduce:transition-none"
				/>
			</svg>
		</div>
	);
}

function RefreshSummaryCard() {
	const { isLiquid } = useAppearance();
	const summary = useRefreshStore((s) => s.summary);
	if (!summary) return null;
	const text = summary.cancelled
		? REFRESH_STRINGS.cancelledAt(
				summary.updated + summary.failed,
				useRefreshStore.getState().total,
			)
		: REFRESH_STRINGS.completeSummary(summary.updated, summary.failed);
	return (
		<div className={toastSurface(isLiquid)}>
			<div role="status" className="flex items-center gap-2.5">
				<Icon
					name={summary.failed === 0 && !summary.cancelled ? "check" : "info"}
					size={15}
					aria-hidden="true"
					className="shrink-0"
				/>
				<div className="min-w-0 flex-1">
					<p className="font-medium text-[13px]">{text}</p>
					{summary.error ? (
						<p
							className="truncate text-[12px] opacity-70"
							title={summary.error}
						>
							{summary.error}
						</p>
					) : null}
				</div>
			</div>
		</div>
	);
}
