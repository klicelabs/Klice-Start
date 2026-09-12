import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

interface InlineRenameInputProps {
	/** Current committed name. Focused + selected on mount. */
	value: string;
	/** Commit a trimmed, non-empty name. */
	onCommit: (name: string) => void;
	/** Revert to the previous value. */
	onCancel: () => void;
	className?: string;
	ariaLabel?: string;
}

/**
 * Shared inline-rename field. One interaction everywhere names are edited:
 *
 *   - Enter commits, Escape cancels (both stop propagation so grid/tabbar
 *     keyboard handlers don't also react);
 *   - blur commits when the trimmed value is non-empty, otherwise reverts;
 *   - whitespace-only input can never overwrite the previous value.
 */
export function InlineRenameInput({
	value,
	onCommit,
	onCancel,
	className,
	ariaLabel = "Rename",
}: InlineRenameInputProps) {
	const [draft, setDraft] = useState(value);
	const inputRef = useRef<HTMLInputElement>(null);
	const doneRef = useRef(false);
	const mountedAt = useRef(0);

	useEffect(() => {
		const input = inputRef.current;
		if (!input) return;
		mountedAt.current = Date.now();
		input.focus();
		input.select();
	}, []);

	function finish(commit: boolean) {
		if (doneRef.current) return;
		doneRef.current = true;
		if (commit) {
			const name = draft.trim();
			if (name.length > 0 && name !== value) onCommit(name);
			else onCancel();
		} else {
			onCancel();
		}
	}

	function handleBlur() {
		// Mount grace: opening a session from a menu races the menu-close
		// focus restoration, which briefly steals focus back to the trigger
		// and would instantly cancel the fresh session via blur. Ignore such
		// blurs and reclaim focus once; genuine user blurs (after the grace
		// window) still commit as usual.
		if (Date.now() - mountedAt.current < 350) {
			inputRef.current?.focus();
			return;
		}
		finish(true);
	}

	return (
		<input
			ref={inputRef}
			type="text"
			value={draft}
			aria-label={ariaLabel}
			spellCheck={false}
			autoComplete="off"
			onChange={(e) => setDraft(e.target.value)}
			onKeyDown={(e) => {
				// Never leak editing keystrokes to global shortcuts (Ctrl+K,
				// grid Escape-to-clear-selection, …). React delegates at the
				// root, so this synthetic stopPropagation also shields native
				// document/window bubble listeners above it. NOTE: never add
				// an onKeyDownCapture stopPropagation here — React invokes
				// capture handlers at an ancestor during descent, which would
				// halt the event before it reaches this input's own handlers.
				e.stopPropagation();
				if (e.key === "Enter") {
					e.preventDefault();
					finish(true);
				} else if (e.key === "Escape") {
					e.preventDefault();
					finish(false);
				}
			}}
			onBlur={handleBlur}
			onClick={(e) => e.stopPropagation()}
			onDoubleClick={(e) => e.stopPropagation()}
			onPointerDown={(e) => e.stopPropagation()}
			onMouseDown={(e) => e.stopPropagation()}
			onDragStart={(e) => {
				e.preventDefault();
				e.stopPropagation();
			}}
			draggable={false}
			className={cn(
				"min-w-0 flex-1 truncate rounded-sm border-0 bg-transparent p-0 font-medium text-[11px] outline-none focus-visible:ring-1 focus-visible:ring-white/40",
				className,
			)}
		/>
	);
}
