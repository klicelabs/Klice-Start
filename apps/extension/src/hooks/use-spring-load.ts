import { useCallback, useEffect, useRef } from "react";

/**
 * Spring-loaded folders: when a drag hovers a drop target for `delayMs`, fire
 * `onTrigger` (typically: navigate into that folder). Any drag movement that
 * leaves the target cancels the pending trigger. The timer is cleaned up on
 * unmount so a pending navigation never fires after the component is gone.
 */
export function useSpringLoad(onTrigger: () => void, delayMs = 620) {
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const triggerRef = useRef(onTrigger);
	triggerRef.current = onTrigger;

	const cancel = useCallback(() => {
		if (timer.current !== null) {
			clearTimeout(timer.current);
			timer.current = null;
		}
	}, []);

	const start = useCallback(() => {
		if (timer.current !== null) return; // already counting down
		timer.current = setTimeout(() => {
			timer.current = null;
			triggerRef.current();
		}, delayMs);
	}, [delayMs]);

	useEffect(() => cancel, [cancel]);

	return { start, cancel };
}
