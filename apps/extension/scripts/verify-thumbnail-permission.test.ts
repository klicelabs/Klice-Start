import { afterEach, expect, test } from "bun:test";
import { extApi } from "../src/lib/extension-api";
import { requestThumbnailCapturePermission } from "../src/lib/thumbnail-permission";
import {
	startBatchRefresh,
	startSingleRefresh,
} from "../src/lib/thumbnail-refresh-client";
import { useRefreshStore } from "../src/stores/refresh-store";

const scope = globalThis as unknown as { browser?: unknown; chrome?: unknown };
const originalBrowser = scope.browser;
const originalChrome = scope.chrome;
afterEach(() => {
	scope.browser = originalBrowser;
	scope.chrome = originalChrome;
	useRefreshStore.getState().clear();
});

test("Firefox uses its native promise namespace, not the chrome compatibility API", async () => {
	const calls: string[] = [];
	scope.chrome = {
		permissions: {
			request: () => {
				calls.push("chrome");
				return undefined;
			},
		},
	};
	scope.browser = {
		permissions: {
			request: (permission: unknown) => {
				calls.push("browser");
				expect(permission).toEqual({ origins: ["<all_urls>"] });
				return Promise.resolve(true);
			},
		},
	};
	expect(await requestThumbnailCapturePermission()).toBe(true);
	expect(calls).toEqual(["browser"]);
});

test("permission request runs synchronously in the click stack, without contains first", async () => {
	const calls: string[] = [];
	scope.browser = undefined;
	scope.chrome = {
		permissions: {
			contains: () => {
				throw new Error("must not await contains before requesting");
			},
			request: () => {
				calls.push("request");
				return Promise.resolve(false);
			},
		},
	};
	const pending = requestThumbnailCapturePermission();
	expect(calls).toEqual(["request"]);
	expect(await pending).toBe(false);
	expect(extApi()).toBe(scope.chrome);
});

test("refresh requests in the gesture stack and resumes the exact batch after consent", async () => {
	useRefreshStore.getState().clear();
	const calls: unknown[] = [];
	let grant!: (value: boolean) => void;
	scope.browser = undefined;
	scope.chrome = {
		permissions: {
			request: () => {
				calls.push("request");
				return new Promise<boolean>((resolve) => {
					grant = resolve;
				});
			},
		},
		runtime: {
			sendMessage: async (message: unknown) => {
				calls.push(message);
				return { ok: true, accepted: true };
			},
		},
	};
	const pending = startBatchRefresh(["a", "b", "a"]);
	expect(calls).toEqual(["request"]);
	// A second click while the native prompt is open must not request again.
	expect(await startSingleRefresh("c")).toBe(false);
	grant(true);
	expect(await pending).toBe(true);
	expect(calls).toEqual([
		"request",
		{ type: "refresh:batch", cardIds: ["a", "b"] },
	]);
	expect(useRefreshStore.getState().queuedIds).toEqual(["a", "b"]);
});

test("denial sends no operation; a subsequent explicit click can retry", async () => {
	useRefreshStore.getState().clear();
	let requests = 0;
	const messages: unknown[] = [];
	scope.browser = undefined;
	scope.chrome = {
		permissions: { request: async () => ++requests > 1 },
		runtime: {
			sendMessage: async (message: unknown) => {
				messages.push(message);
				return { ok: true, accepted: true };
			},
		},
	};
	expect(await startSingleRefresh("a")).toBe(false);
	expect(messages).toEqual([]);
	expect(useRefreshStore.getState().active).toBe(false);
	expect(await startSingleRefresh("a")).toBe(true);
	expect(requests).toBe(2);
	expect(messages).toEqual([{ type: "refresh:single", cardId: "a" }]);
});
