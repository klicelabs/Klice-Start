import { useEffect, useRef } from "react";
import { normalizeState } from "../lib/storage";
import { useSetupStore } from "../stores/setup-store";
import type { Setup } from "../types";

/** Helper to serialize only the database state fields, ensuring key order. */
function serializeSetupState(state: Setup): string {
	return JSON.stringify({
		folders: state.folders,
		cards: state.cards,
		activeFolderId: state.activeFolderId,
		settings: state.settings,
	});
}

/**
 * Listen for storage changes from other tabs and update the store.
 * Uses a strict echo guard that compares only serializable state fields.
 */
export function useCrossTabSync() {
	const lastKnownJSON = useRef(serializeSetupState(useSetupStore.getState()));

	useEffect(() => {
		// Keep lastKnownJSON in sync whenever store changes (including from persist)
		const unsub = useSetupStore.subscribe((state) => {
			lastKnownJSON.current = serializeSetupState(state);
		});

		const handler = (
			changes: Record<string, chrome.storage.StorageChange>,
			area: string,
		) => {
			if (area !== "local" || !changes["perch-setup"]) return;

			const newValue = changes["perch-setup"].newValue;
			if (!newValue) return;

			try {
				const parsed =
					typeof newValue === "string" ? JSON.parse(newValue) : newValue;

				// Ensure we got a valid Zustand persist state shape
				if (!parsed || typeof parsed !== "object" || !("state" in parsed))
					return;

				const current = useSetupStore.getState();
				const incoming = normalizeState(parsed.state as Partial<Setup>);

				const incomingJSON = serializeSetupState(incoming);
				if (incomingJSON === lastKnownJSON.current) return;

				lastKnownJSON.current = incomingJSON;

				// Apply incoming state, keeping the active folder if it still exists
				const keepActive = current.activeFolderId;
				useSetupStore.setState(incoming);
				if (keepActive && incoming.folders.some((f) => f.id === keepActive)) {
					useSetupStore.setState({ activeFolderId: keepActive });
				}
			} catch {
				// Ignore parse errors
			}
		};

		chrome.storage.onChanged.addListener(handler);
		return () => {
			chrome.storage.onChanged.removeListener(handler);
			unsub();
		};
	}, []);
}
