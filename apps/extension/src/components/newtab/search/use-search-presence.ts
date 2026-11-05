import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useReducer } from "react";

export const SEARCH_TRANSITION_MS = 160;
export type SearchPhase = "closed" | "open" | "closing";
export function canRestoreSearchFocus(
	phase: SearchPhase,
	requestedVersion: number,
	currentVersion: number,
	neutralFocus: boolean,
): boolean {
	return (
		phase === "closed" && requestedVersion === currentVersion && neutralFocus
	);
}
type SearchEvent =
	| { type: "open" | "finish" }
	| { type: "close"; immediate: boolean };

export function searchPresence(
	phase: SearchPhase,
	event: SearchEvent,
): SearchPhase {
	if (event.type === "open") return "open";
	if (event.type === "close")
		return phase === "closed" || event.immediate ? "closed" : "closing";
	return phase === "closing" ? "closed" : phase;
}

/** Retain content through exit; a stale close can never dismiss a reopened search. */
export function useSearchPresence() {
	const reduceMotion = useReducedMotion() ?? false;
	const [phase, dispatch] = useReducer(searchPresence, "closed");
	useEffect(() => {
		if (phase !== "closing") return;
		if (reduceMotion) {
			dispatch({ type: "finish" });
			return;
		}
		const timeout = window.setTimeout(
			() => dispatch({ type: "finish" }),
			SEARCH_TRANSITION_MS,
		);
		return () => window.clearTimeout(timeout);
	}, [phase, reduceMotion]);
	const show = useCallback(() => dispatch({ type: "open" }), []);
	const hide = useCallback(
		() => dispatch({ type: "close", immediate: reduceMotion }),
		[reduceMotion],
	);
	return {
		phase,
		open: phase === "open",
		present: phase !== "closed",
		show,
		hide,
	};
}
