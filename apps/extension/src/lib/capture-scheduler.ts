import { captureDelayMs } from "./thumbnail-refresh";

/** One lane for every worker screenshot (manual, visit and quick-save).
 * Rejected attempts count too: Chromium applies its quota at invocation time.
 */
export function createCaptureScheduler(
	now: () => number = Date.now,
	wait: (ms: number) => Promise<void> = (ms) =>
		new Promise((resolve) => setTimeout(resolve, ms)),
) {
	let lane: Promise<unknown> = Promise.resolve();
	let lastAttempt: number | null = null;
	return function schedule<T>(capture: () => Promise<T>): Promise<T> {
		const next = lane
			.catch(() => undefined)
			.then(async () => {
				const delay = captureDelayMs(lastAttempt, now());
				if (delay > 0) await wait(delay);
				lastAttempt = now();
				return capture();
			});
		lane = next;
		return next;
	};
}
