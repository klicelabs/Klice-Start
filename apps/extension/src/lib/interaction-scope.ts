/**
 * Shared interaction-ownership selectors. The blank-surface selection
 * clearer and marquee selection must agree on what counts as interactive,
 * so the list lives here — not as two drifting copies.
 */
export const SPEED_DIAL_INTERACTIVE_SELECTOR = [
	"[data-unified-search]",
	"[data-speed-dial-navigation]",
	"[data-speed-dial-app-toolbar]",
	"[data-local-context-menu]",
	"[data-selection-tray]",
	"[data-selection-checkbox]",
	"[data-context-menu-portal]",
	"[data-morph-popover-portal]",
	"[data-settings-sidebar-slot]",
	"[data-settings-ui]",
	".dial-cell",
	".settings-scope",
	".clock-widget",
	"button",
	"a",
	"input",
	"textarea",
	"select",
	'[contenteditable="true"]',
	'[role="button"]',
	'[role="tab"]',
	'[role="menu"]',
	'[role="menuitem"]',
	'[role="listbox"]',
	'[role="tree"]',
].join(",");

/** Extra vetoes for marquee start (toasts, dialogs, page chrome). */
export const MARQUEE_EXTRA_VETO_SELECTOR = [
	"[data-sonner-toaster]",
	"[data-settings-panel]",
	"header",
	'[role="dialog"]',
].join(",");

/** Native scrollbar presses are scrolling intent, never blank-space selection. */
export function isScrollGutterPress(event: PointerEvent): boolean {
	const target = event.target;
	if (!(target instanceof HTMLElement)) return false;
	const scroller = target.closest<HTMLElement>("[data-speed-dial-scroll]");
	if (!scroller || target !== scroller) return false;
	const rect = scroller.getBoundingClientRect();
	const x = event.clientX - rect.left;
	const y = event.clientY - rect.top;
	return (
		x < scroller.clientLeft ||
		x >= scroller.clientLeft + scroller.clientWidth ||
		y < scroller.clientTop ||
		y >= scroller.clientTop + scroller.clientHeight
	);
}

export function isInteractiveTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return true;
	return Boolean(
		target.closest(
			`${SPEED_DIAL_INTERACTIVE_SELECTOR},${MARQUEE_EXTRA_VETO_SELECTOR}`,
		),
	);
}
