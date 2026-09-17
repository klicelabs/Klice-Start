import { useEffect } from "react";
import { toast } from "sonner";
import {
	describeHistoryAction,
	describeHistoryGerund,
	describeHistoryPast,
	type HistoryEntry,
	isHistoryEditableTarget,
} from "../../lib/history";
import { useHistoryStore } from "../../stores/history-store";

const NOTICE_TOAST_ID = "history-notice";
const CONFIRM_TOAST_ID = "history-confirm";
const NOTICE_DURATION_MS = 5000;

function findEntry(
	entries: readonly HistoryEntry[],
	id: string,
): HistoryEntry | undefined {
	return entries.find((entry) => entry.id === id);
}

/** Focus the confirmation button so Enter confirms and focus is visible. */
function focusConfirmButton(title: string, label: string): void {
	let frames = 0;
	const tick = () => {
		frames += 1;
		const toasts = document.querySelectorAll("li[data-sonner-toast]");
		for (const node of toasts) {
			const el = node as HTMLElement;
			if (!el.textContent?.includes(title)) continue;
			const buttons = el.querySelectorAll("button");
			for (const button of buttons) {
				if (button.textContent?.trim() === label) {
					button.focus({ preventScroll: true });
					return;
				}
			}
		}
		if (frames < 12) requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);
}

/**
 * Owns every history surface: post-action Undo toasts, the single
 * confirmation toast, and the global shortcuts. Nothing else in the app
 * calls toast/confirm for history, so confirmations can never stack and
 * copy stays centralized.
 */
export function HistoryManager() {
	const notice = useHistoryStore((s) => s.notice);
	const pending = useHistoryStore((s) => s.pending);

	// Post-action feedback: short-lived, Undo opens confirmation (never
	// executes). Dismissal keeps the entry in history.
	useEffect(() => {
		if (!notice) return;
		const state = useHistoryStore.getState();
		const entry = findEntry(state.past, notice.entryId);
		state.consumeNotice();
		if (!entry) return;
		toast.success(describeHistoryPast(entry.summary), {
			id: NOTICE_TOAST_ID,
			duration: NOTICE_DURATION_MS,
			action: {
				label: "Undo",
				onClick: () => useHistoryStore.getState().requestUndo(entry.id),
			},
		});
	}, [notice]);

	// Single confirmation surface. Replaces any previous confirmation;
	// cleared the moment pending resolves (confirm or cancel).
	useEffect(() => {
		if (!pending) {
			toast.dismiss(CONFIRM_TOAST_ID);
			return;
		}
		const state = useHistoryStore.getState();
		const pool = pending.direction === "undo" ? state.past : state.future;
		const entries = pending.entryIds
			.map((id) => findEntry(pool, id))
			.filter((entry): entry is HistoryEntry => entry !== undefined);
		if (entries.length === 0) {
			state.cancelPending();
			return;
		}
		const verb = pending.direction === "undo" ? "Undo" : "Redo";
		let title: string;
		if (entries.length === 1) {
			title = `${verb} ${describeHistoryGerund(entries[0].summary)}?`;
		} else {
			title = `${verb} ${entries.length} actions?`;
		}
		const description =
			entries.length === 1
				? undefined
				: `Through “${describeHistoryAction(entries[entries.length - 1].summary)}”`;
		toast.warning(title, {
			id: CONFIRM_TOAST_ID,
			description,
			duration: Number.POSITIVE_INFINITY,
			cancel: {
				label: "Cancel",
				onClick: () => useHistoryStore.getState().cancelPending(),
			},
			action: {
				label: verb,
				onClick: () => {
					const executed = useHistoryStore.getState().confirmPending();
					if (!executed || executed.entries.length === 0) return;
					announceExecuted(executed.direction, executed.entries);
				},
			},
		});
		focusConfirmButton(title, verb);
	}, [pending]);

	// Esc cancels the active confirmation (never executes).
	useEffect(() => {
		if (!pending) return;
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") {
				e.stopPropagation();
				useHistoryStore.getState().cancelPending();
			}
		}
		window.addEventListener("keydown", onKeyDown, { capture: true });
		return () =>
			window.removeEventListener("keydown", onKeyDown, { capture: true });
	}, [pending]);

	// App-level shortcuts. Editable focus keeps native text undo/redo;
	// every trigger opens confirmation, never mutates directly.
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			const mod = e.metaKey || e.ctrlKey;
			if (!mod || e.altKey) return;
			const key = e.key.toLowerCase();
			const isUndo = key === "z" && !e.shiftKey;
			const isRedo =
				(key === "z" && e.shiftKey) ||
				(key === "y" && e.ctrlKey && !e.metaKey && !e.shiftKey);
			if (!isUndo && !isRedo) return;
			if (isHistoryEditableTarget(e.target)) return;
			const state = useHistoryStore.getState();
			if (isUndo && state.past.length === 0) return;
			if (isRedo && state.future.length === 0) return;
			e.preventDefault();
			if (isUndo) state.requestUndo();
			else state.requestRedo();
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	return null;
}

function announceExecuted(
	direction: "undo" | "redo",
	entries: HistoryEntry[],
): void {
	const state = useHistoryStore.getState();
	if (direction === "undo") {
		const title =
			entries.length === 1
				? `${describeHistoryAction(entries[0].summary)} undone`
				: `${entries.length} actions undone`;
		toast.success(title, {
			id: NOTICE_TOAST_ID,
			duration: NOTICE_DURATION_MS,
			action: {
				label: "Redo",
				onClick: () => state.requestRedo(),
			},
		});
		return;
	}
	const title =
		entries.length === 1
			? describeHistoryPast(entries[0].summary)
			: `${entries.length} actions restored`;
	toast.success(title, {
		id: NOTICE_TOAST_ID,
		duration: NOTICE_DURATION_MS,
		action: {
			label: "Undo",
			onClick: () => state.requestUndo(),
		},
	});
}
