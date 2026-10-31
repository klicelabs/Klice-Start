import { expect, test } from "bun:test";
import type {
	RefreshBatchState,
	RefreshProgressEvent,
} from "../src/lib/thumbnail-refresh";
import { useRefreshStore } from "../src/stores/refresh-store";

function progress(
	status: RefreshProgressEvent["status"],
	overrides: Partial<RefreshProgressEvent> = {},
): RefreshProgressEvent {
	return {
		type: "refresh:progress",
		status,
		total: 3,
		completed: 0,
		updated: 0,
		failed: 0,
		...overrides,
	};
}

test("beginLocal seeds an optimistic batch", () => {
	useRefreshStore.getState().clear();
	useRefreshStore.getState().beginLocal(["a", "b"]);
	const state = useRefreshStore.getState();
	expect(state.active).toBe(true);
	expect(state.total).toBe(2);
	expect(state.queuedIds).toEqual(["a", "b"]);
	expect(state.currentCardId).toBeNull();
	expect(state.summary).toBeNull();
});

test("only the active card is marked and the marker advances on real events", () => {
	useRefreshStore.getState().clear();
	useRefreshStore.getState().beginLocal(["a", "b"]);
	useRefreshStore.getState().applyProgress(
		progress("capturing", {
			currentCardId: "a",
			currentTitle: "A",
			queuedIds: ["a", "b"],
		}),
	);
	expect(useRefreshStore.getState().currentCardId).toBe("a");
	useRefreshStore.getState().applyProgress(
		progress("card-done", {
			completed: 1,
			updated: 1,
			currentCardId: "a",
			currentTitle: "A",
			currentUrl: "https://a.test/",
			queuedIds: ["b"],
			recent: [{ cardId: "a", title: "A", url: "https://a.test/", ok: true }],
		}),
	);
	expect(useRefreshStore.getState().currentCardId).toBeNull();
	useRefreshStore.getState().applyProgress(
		progress("capturing", {
			completed: 1,
			updated: 1,
			currentCardId: "b",
			currentTitle: "B",
			queuedIds: ["b"],
		}),
	);
	expect(useRefreshStore.getState().currentCardId).toBe("b");
	useRefreshStore.getState().applyProgress(
		progress("card-failed", {
			completed: 2,
			failed: 1,
			currentCardId: "b",
			currentTitle: "B",
			currentUrl: "https://b.test/",
			queuedIds: [],
			recent: [
				{
					cardId: "a",
					title: "A",
					url: "https://a.test/",
					ok: true,
				},
				{
					cardId: "b",
					title: "B",
					url: "https://b.test/",
					ok: false,
					error: "capture: denied",
				},
			],
		}),
	);
	expect(useRefreshStore.getState().currentCardId).toBeNull();
	expect(useRefreshStore.getState().queuedIds).toEqual([]);
});

test("session hydration restores the active card and completed progress", () => {
	useRefreshStore.getState().clear();
	const snapshot: RefreshBatchState = {
		status: "running",
		cardIds: ["a", "b", "c"],
		doneIds: ["a"],
		failedIds: [],
		sites: {
			a: { title: "A", url: "https://a.test/", ok: true },
			b: { title: "B", url: "https://b.test/", ok: false },
		},
		startedAt: Date.now(),
		activeCardId: "b",
		captureWindowId: 8,
		captureTabId: 9,
		pendingCaptureTabId: 10,
	};
	useRefreshStore.getState().hydrateFromSession(snapshot);
	const state = useRefreshStore.getState();
	expect(state).toMatchObject({
		active: true,
		total: 3,
		completed: 1,
		updated: 1,
		currentCardId: "b",
		currentTitle: "B",
		queuedIds: ["b", "c"],
	});
	expect(state.sites.map((site) => site.cardId)).toEqual(["a"]);
	useRefreshStore.getState().hydrateFromSession({
		...snapshot,
		status: "idle",
	});
	expect(useRefreshStore.getState().active).toBe(false);
	expect(useRefreshStore.getState().currentCardId).toBeNull();
});

test("card events drain the queue and append the site log", () => {
	useRefreshStore.getState().clear();
	useRefreshStore.getState().beginLocal(["a", "b"]);
	useRefreshStore.getState().applyProgress(
		progress("card-done", {
			completed: 1,
			updated: 1,
			currentCardId: "a",
			currentTitle: "A",
			currentUrl: "https://a.test/",
		}),
	);
	let state = useRefreshStore.getState();
	expect(state.queuedIds).toEqual(["b"]);
	expect(state.sites).toEqual([
		{
			cardId: "a",
			title: "A",
			url: "https://a.test/",
			ok: true,
			error: undefined,
		},
	]);
	useRefreshStore.getState().applyProgress(
		progress("card-failed", {
			completed: 2,
			failed: 1,
			currentCardId: "b",
			currentTitle: "B",
			currentUrl: "https://b.test/",
			recent: [
				{
					cardId: "b",
					title: "B",
					url: "https://b.test/",
					ok: false,
					error: "capture: denied",
				},
			],
		}),
	);
	state = useRefreshStore.getState();
	expect(state.queuedIds).toEqual([]);
	expect(state.sites[1]).toMatchObject({
		cardId: "b",
		ok: false,
		error: "capture: denied",
	});
});

test("done carries the dominant failure reason into the summary", () => {
	useRefreshStore.getState().clear();
	useRefreshStore.getState().applyProgress(
		progress("done", {
			completed: 3,
			updated: 1,
			failed: 2,
			recent: [
				{ cardId: "a", title: "A", url: "https://a.test/", ok: true },
				{
					cardId: "b",
					title: "B",
					url: "https://b.test/",
					ok: false,
					error: "capture: denied",
				},
				{
					cardId: "c",
					title: "C",
					url: "https://c.test/",
					ok: false,
					error: "capture: denied",
				},
			],
		}),
	);
	const state = useRefreshStore.getState();
	expect(state.active).toBe(false);
	expect(state.summary).toMatchObject({
		updated: 1,
		failed: 2,
		cancelled: false,
		error: "capture: denied",
	});
});

test("cancelled clears the queue without an error line", () => {
	useRefreshStore.getState().clear();
	useRefreshStore.getState().beginLocal(["a", "b", "c"]);
	useRefreshStore
		.getState()
		.applyProgress(
			progress("cancelled", { completed: 1, updated: 1, total: 3 }),
		);
	const state = useRefreshStore.getState();
	expect(state.active).toBe(false);
	expect(state.queuedIds).toEqual([]);
	expect(state.summary).toMatchObject({ cancelled: true, error: undefined });
});
