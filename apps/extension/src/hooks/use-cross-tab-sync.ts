import type { Browser } from "wxt/browser";
import { useEffect } from "react";
import {
	getLastWrittenJSON,
	getResetGeneration,
	normalizeState,
	PERSIST_GENERATION_KEY,
} from "../lib/storage";
import { extApi } from "../lib/extension-api";
import { useHistoryStore } from "../stores/history-store";
import { useSetupStore } from "../stores/setup-store";
import type { Setup } from "../types";

/**
 * Listen for storage changes from other tabs and update the store.
 *
 * Echo guard: compares the raw incoming JSON against the last successfully
 * written JSON string from the storage adapter. If they match exactly, the
 * change was written by this tab — skip it. This prevents the classic
 * out-of-order write race (write A completes → onChanged fires with A →
 * store gets overwritten with stale value).
 */
export function useCrossTabSync() {
	useEffect(() => {
		if (!extApi() || !extApi().storage?.onChanged) return;
		type OnChangedCb = Parameters<
			(typeof Browser.storage.onChanged)["addListener"]
		>[0];
		const handler: OnChangedCb = (changes, area) => {
			// "perch-setup" is the legacy persist name; kept for data continuity.
			if (area !== "local" || !changes["perch-setup"]) return;

			const newValue = changes["perch-setup"].newValue;
			if (!newValue) return;

			const raw =
				typeof newValue === "string" ? newValue : JSON.stringify(newValue);

			// Our own echo — skip
			if (raw === getLastWrittenJSON()) return;

			try {
				const parsed =
					typeof newValue === "string" ? JSON.parse(newValue) : newValue;

				if (!parsed || typeof parsed !== "object" || !("state" in parsed))
					return;

				const persistedGenerationValue = (parsed as Record<string, unknown>)[
					PERSIST_GENERATION_KEY
				];
				const persistedGeneration =
					typeof persistedGenerationValue === "number" &&
					Number.isSafeInteger(persistedGenerationValue) &&
					persistedGenerationValue >= 0
						? persistedGenerationValue
						: 0;
				if (persistedGeneration < getResetGeneration()) return;

				const current = useSetupStore.getState();
				const incoming = normalizeState(parsed.state as Partial<Setup>);

				// Apply incoming state, keeping the active folder if it still exists
				const keepActive = current.activeFolderId;
				useSetupStore.setState(incoming);
				if (keepActive && incoming.folders.some((f) => f.id === keepActive)) {
					useSetupStore.setState({ activeFolderId: keepActive });
				}

				// M4/NPD-3: external state arrived. Invalidate the redo branch and
				// prune undo entries whose snapshots no longer match live state —
				// stale cascades must never replay over another tab's writes.
				useHistoryStore
					.getState()
					.invalidateForExternalSync(buildLiveShape(incoming));
			} catch {
				// Ignore parse errors
			}
		};

		extApi().storage.onChanged.addListener(handler);
		return () => {
			extApi().storage.onChanged.removeListener(handler);
		};
	}, []);
}

/**
 * Extract the id → parent/container shape the history store compares its
 * snapshots against (see invalidateForExternalSync).
 */
function buildLiveShape(setup: Setup): {
	cards: Map<string, string>;
	folders: Map<string, string | null>;
	containers: Record<string, string[]>;
} {
	const cards = new Map(setup.cards.map((card) => [card.id, card.folderId]));
	const folders = new Map(
		setup.folders.map((folder) => [folder.id, folder.parentId ?? null]),
	);
	const containers: Record<string, string[]> = {};
	for (const [container, keys] of Object.entries(setup.itemOrder ?? {})) {
		containers[container] = [...keys];
	}
	return { cards, folders, containers };
}
