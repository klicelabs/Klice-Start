import { isHistoryEditableTarget } from "../../../lib/history";
import type { SearchSettings } from "../../../types";

export function searchAccess(
	settings: Pick<SearchSettings, "enabled" | "quickAccessEnabled">,
	barOffscreen = false,
) {
	return {
		available: settings.enabled || settings.quickAccessEnabled,
		showBar: settings.enabled,
		showToolbar:
			settings.quickAccessEnabled && (!settings.enabled || barOffscreen),
		shortcutEnabled: settings.quickAccessEnabled,
	};
}

/** Disabled access leaves the browser's shortcut untouched. */
export function bindSearchShortcut(
	document: Document,
	enabled: boolean,
	onOpen: () => void,
) {
	if (!enabled) return () => {};
	const handleKey = (event: KeyboardEvent) => {
		if (
			event.defaultPrevented ||
			event.isComposing ||
			event.altKey ||
			!(event.metaKey || event.ctrlKey) ||
			event.key.toLowerCase() !== "k" ||
			isHistoryEditableTarget(event.target)
		)
			return;
		event.preventDefault();
		onOpen();
	};
	document.addEventListener("keydown", handleKey);
	return () => document.removeEventListener("keydown", handleKey);
}
