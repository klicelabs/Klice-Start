/**
 * Newtab-side client for the thumbnail refresh control plane.
 *
 * Sends refresh:single / refresh:batch / refresh:cancel to the background
 * worker and subscribes to refresh:progress events. Uses extApi() (call-time
 * namespace resolution) so unit-test chrome shims installed after import
 * still take effect.
 */
import { toast } from "sonner";
import { useRefreshStore } from "../stores/refresh-store";
import { useSetupStore } from "../stores/setup-store";
import { extApi } from "./extension-api";
import {
	isRefreshMessage,
	REFRESH_SESSION_KEY,
	REFRESH_STRINGS,
	type RefreshProgressEvent,
} from "./thumbnail-refresh";

export interface RefreshSendResult {
	accepted: boolean;
	reason?: "already-running" | "needs-permission" | "empty" | "unreachable";
}

function runtime(): {
	sendMessage?: (message: unknown) => Promise<unknown> | unknown;
	onMessage?: {
		addListener: (listener: (...args: never[]) => unknown) => void;
		removeListener: (listener: (...args: never[]) => unknown) => void;
	};
} {
	try {
		return extApi().runtime as unknown as {
			sendMessage?: (message: unknown) => Promise<unknown> | unknown;
			onMessage?: {
				addListener: (listener: (...args: never[]) => unknown) => void;
				removeListener: (listener: (...args: never[]) => unknown) => void;
			};
		};
	} catch {
		return {};
	}
}

async function send(
	message: unknown,
): Promise<{ ok?: boolean } & Record<string, unknown>> {
	const rt = runtime();
	if (typeof rt.sendMessage !== "function") return { ok: false };
	try {
		const result = (await rt.sendMessage(message)) as
			| ({ ok?: boolean } & Record<string, unknown>)
			| undefined;
		return result ?? { ok: false };
	} catch {
		return { ok: false };
	}
}

export async function sendRefreshSingle(
	cardId: string,
): Promise<RefreshSendResult> {
	const result = await send({ type: "refresh:single", cardId });
	if (result.ok !== true) return { accepted: false, reason: "unreachable" };
	if (result.accepted === false)
		return {
			accepted: false,
			reason: (result.reason as RefreshSendResult["reason"]) ?? "empty",
		};
	return { accepted: true };
}

export async function sendRefreshBatch(
	cardIds: string[],
): Promise<RefreshSendResult> {
	const result = await send({ type: "refresh:batch", cardIds });
	if (result.ok !== true) return { accepted: false, reason: "unreachable" };
	if (result.accepted === false)
		return {
			accepted: false,
			reason: (result.reason as RefreshSendResult["reason"]) ?? "empty",
		};
	return { accepted: true };
}

export async function sendRefreshCancel(): Promise<void> {
	await send({ type: "refresh:cancel" });
}

/** Non-refresh messages pass through untouched (listener returns nothing). */
export function subscribeRefreshProgress(
	onEvent: (event: RefreshProgressEvent) => void,
): () => void {
	const onMessage = runtime().onMessage;
	if (!onMessage) return () => undefined;
	const listener = (message: unknown): undefined => {
		if (
			message &&
			typeof message === "object" &&
			(message as { type?: unknown }).type === "refresh:progress"
		) {
			onEvent(message as RefreshProgressEvent);
		}
		return undefined;
	};
	try {
		onMessage.addListener(listener as (...args: never[]) => unknown);
	} catch {
		return () => undefined;
	}
	return () => {
		try {
			onMessage.removeListener(listener as (...args: never[]) => unknown);
		} catch {
			// Listener already gone.
		}
	};
}

export function isRefreshProgressMessage(
	value: unknown,
): value is RefreshProgressEvent {
	return (
		!!value &&
		typeof value === "object" &&
		(value as { type?: unknown }).type === "refresh:progress"
	);
}

/**
 * Send-first starts: the worker accepts before any local state is touched,
 * so a rejected start (another batch running, missing permission) can never
 * clobber the running batch's toast. Accepted starts paint optimistically
 * via beginLocal; the worker's `started` event confirms a frame later.
 */
export async function startSingleRefresh(cardId: string): Promise<boolean> {
	const result = await sendRefreshSingle(cardId);
	if (!result.accepted) {
		notifyRefreshRejected(result.reason);
		return false;
	}
	useRefreshStore.getState().beginLocal([cardId]);
	return true;
}

export async function startBatchRefresh(cardIds: string[]): Promise<boolean> {
	const unique = [...new Set(cardIds)];
	if (unique.length === 0) return false;
	const result = await sendRefreshBatch(unique);
	if (!result.accepted) {
		notifyRefreshRejected(result.reason);
		return false;
	}
	useRefreshStore.getState().beginLocal(unique);
	return true;
}

function notifyRefreshRejected(reason: RefreshSendResult["reason"]): void {
	if (reason === "already-running") {
		toast.info(REFRESH_STRINGS.alreadyRunning);
	} else if (reason === "needs-permission") {
		toast.error(REFRESH_STRINGS.needsPermission, { duration: 6000 });
	}
}

/**
 * Shared "refresh everything missing" action behind the Settings button and
 * the page context-menu entry. Large libraries confirm first (N > 20).
 */
export async function requestMissingRefresh(): Promise<boolean> {
	const ids = useSetupStore
		.getState()
		.cards.filter((card) => !card.thumbId)
		.map((card) => card.id);
	if (ids.length === 0) return false;
	if (
		ids.length > 20 &&
		!window.confirm(REFRESH_STRINGS.confirmMany(ids.length))
	) {
		return false;
	}
	return startBatchRefresh(ids);
}

export { isRefreshMessage, REFRESH_SESSION_KEY };
