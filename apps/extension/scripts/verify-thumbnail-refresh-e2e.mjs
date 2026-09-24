/**
 * E2E verification: single + batch thumbnail refresh with canonical matching.
 *
 * Loads the built MV3 extension (.output/chrome-mv3) in a real Chromium via
 * Playwright (same launch pattern as bench-lib.mjs), seeds folders of cards,
 * and walks the refresh scenarios with real captureVisibleTab captures
 * (route-fulfilled local pages, no network, no mocked browser APIs):
 *
 *   1. single refresh via card context menu → thumbId replaced
 *   2. batch of 5 via selection tray → progress toast → all thumbs updated
 *   3. batch of 10 cancelled mid-run → "Cancelled at N of 10" summary
 *   4. auto-capture on a DIFFERENT path of the same domain → thumbless card fills
 *   5. manual save of a different path → NEW card (exact match preserved)
 *   6. rate limit: batches complete with no MAX_CAPTURE_VISIBLE_TAB error
 *   7. SW sleep resume: mid-batch chrome.storage.session holds resumable state
 *
 * Run: cd apps/extension && node scripts/verify-thumbnail-refresh-e2e.mjs
 * (node, not bun: Bun's launchPersistentContext pipe hangs in this
 * environment while plain node connects in ~1s; the harness itself is
 * runtime-agnostic plain JS.)
 * Read-only diagnostic harness — writes nothing to the repo (throwaway profile).
 */
import fs from "node:fs";
import path from "node:path";
import { launchExtension } from "./bench-lib.mjs";

function patchBuiltManifestForGrantedAccess() {
	const manifestPath = path.resolve("./.output/chrome-mv3/manifest.json");
	const original = fs.readFileSync(manifestPath, "utf8");
	const manifest = JSON.parse(original);
	const optional = manifest.optional_host_permissions ?? [];
	manifest.host_permissions = [
		...(manifest.host_permissions ?? []),
		...optional,
	];
	manifest.optional_host_permissions = [];
	fs.writeFileSync(manifestPath, JSON.stringify(manifest));
	return () => fs.writeFileSync(manifestPath, original);
}
const restoreManifest = patchBuiltManifestForGrantedAccess();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FAVICON_PNG_1X1 = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
	"base64",
);

const COLORS = {
	"s5-r1": "#b5442d",
	"s5-r2": "#2d6fb5",
	"s5-r3": "#3d8f4e",
	"s5-r4": "#8f3d8f",
	"s5-r5": "#b5782d",
	single: "#2d7fb5",
	dom: "#4e8f3d",
	default: "#555555",
};

const pageHtml = (url) => {
	const u = new URL(url);
	const key = u.hostname
		.replace(/\.test$/, "")
		.split("-")
		.slice(0, 2)
		.join("-");
	const color =
		COLORS[key] ?? COLORS[u.hostname.replace(/\.test$/, "")] ?? COLORS.default;
	return `<!doctype html><html><head><title>${u.hostname}${u.pathname}</title></head><body style="background:${color};color:#fff;font:48px sans-serif;padding:40px">${u.hostname}${u.pathname}</body></html>`;
};

const MANUAL_THUMB_ID = "thumb-manual-single";

function baseSettings() {
	return {
		tileSize: "medium",
		maxColumns: 7,
		showTitle: true,
		showDeleteButton: false,
		openInNewTab: true,
		dialLayout: "card",
		cardAspect: "horizontal",
		iconShowLabel: true,
		defaultTitleSource: null,
		thumbnailCapture: { enabled: true, delayMs: 1200 },
		background: {
			type: "solid",
			color: "#7c9cc4",
			gradientId: null,
			imageId: null,
			wallpaperId: null,
			customWallpaper: null,
			blur: 0,
			brightness: 100,
			opacity: 100,
			pexelsQuery: "nature",
			pexelsFrequency: "locked",
			pexelsPreviousFrequency: null,
			pexelsLastFetched: null,
			pexelsLastPeriod: null,
			pexelsImageId: null,
		},
		clock: {
			enabled: false,
			format24: true,
			showSeconds: false,
			size: 72,
			timezone: "auto",
		},
		greeting: { enabled: false, name: "", size: 28 },
		search: {
			enabled: false,
			engine: "https://duckduckgo.com/?q=%s",
			placeholder: "",
			iconMode: "search",
			width: 560,
		},
		quickLinks: { enabled: false, items: [] },
		appearanceMode: "flat",
		colorScheme: "dark",
	};
}

function buildSeedState() {
	const folders = [
		{ id: "folder-5", name: "BatchFive", order: 0, parentId: null },
		{ id: "folder-10", name: "BatchTen", order: 1, parentId: null },
		{ id: "folder-dom", name: "Domain", order: 2, parentId: null },
	];
	const cards = [];
	const itemOrder = {
		__root__: ["folder:folder-5", "folder:folder-10", "folder:folder-dom"],
		"folder-5": [],
		"folder-10": [],
		"folder-dom": [],
	};
	let order = 0;
	const push = (folderId, title, url, thumbId) => {
		const id = `card-${title}`;
		cards.push({
			id,
			folderId,
			title,
			url,
			favicon: null,
			thumbId,
			order: order++,
			titleSource: null,
			origin: "local",
			capturedAt: thumbId ? Date.now() - 100000 : null,
		});
		itemOrder[folderId].push(`card:${id}`);
	};
	// folder-5: one card WITH a thumb (single-refresh target) + 4 thumbless.
	push("folder-5", "single", "http://single.test/", MANUAL_THUMB_ID);
	for (let i = 1; i <= 4; i += 1)
		push("folder-5", `s5-r${i}`, `http://s5-r${i}.test/`, null);
	push("folder-5", "s5-r5", "http://s5-r5.test/", null);
	// folder-10: ten thumbless cards for the cancel test.
	for (let i = 1; i <= 10; i += 1)
		push("folder-10", `c10-${i}`, `http://c10-${i}.test/`, null);
	// folder-dom: thumbless card on one path; the visit uses another path.
	push("folder-dom", "domcard", "http://dom.test/notebook/abc", null);
	return {
		state: {
			folders,
			cards,
			activeFolderId: "folder-5",
			itemOrder,
			settings: baseSettings(),
		},
		version: 0,
	};
}

async function readCards(observer) {
	const raw = await observer.evaluate(
		() =>
			new Promise((resolve) =>
				chrome.storage.local.get(["perch-setup"], (d) =>
					resolve(d["perch-setup"] ?? null),
				),
			),
	);
	if (!raw) return null;
	return JSON.parse(raw).state.cards;
}

async function readRefreshSession(observer) {
	return observer.evaluate(() =>
		chrome.storage.session
			.get("klice-refresh-batch")
			.then((d) => d["klice-refresh-batch"] ?? null),
	);
}

async function windowCount(observer) {
	return observer.evaluate(() => chrome.windows.getAll().then((w) => w.length));
}

async function waitFor(fn, timeoutMs, label) {
	const t0 = Date.now();
	for (;;) {
		const value = await fn().catch(() => null);
		if (value) return value;
		if (Date.now() - t0 > timeoutMs)
			throw new Error(`timeout after ${timeoutMs}ms waiting for ${label}`);
		await sleep(300);
	}
}

async function cardShowsThumb(observer, title) {
	const card = observer
		.locator("[data-marquee-id]", { hasText: title })
		.first();
	try {
		return (await card.locator(".thumb img.thumb-media").count()) > 0;
	} catch {
		return false;
	}
}

const results = [];
const record = (scenario, pass, detail) => {
	results.push({ scenario, pass, detail });
	console.log(
		`${pass ? "PASS" : "FAIL"}  ${scenario}${detail ? ` — ${detail}` : ""}`,
	);
};

// Headless by default (CI has no display; the chromium channel's new
// headless still loads MV3 extensions and captureVisibleTab works there).
// Set HEADFUL=1 to watch the run in a visible browser.
const { context, extensionId } = await launchExtension({
	headless: process.env.HEADFUL !== "1",
});
const swErrors = [];
try {
	context.on("serviceworker", (worker) => {
		worker.on("console", (msg) => {
			if (msg.type() === "error")
				swErrors.push(`sw console error: ${msg.text()}`);
		});
		worker.on("pageerror", (err) =>
			swErrors.push(`sw pageerror: ${err.message}`),
		);
	});
} catch {
	// Event subscription unsupported — skip SW console capture.
}

try {
	await context.route(/http:\/\/[^/]+\.test\//, (route) =>
		route.fulfill({
			contentType: "text/html",
			body: pageHtml(route.request().url()),
		}),
	);
	await context.route("**/s2/favicons*", (route) =>
		route.fulfill({ contentType: "image/png", body: FAVICON_PNG_1X1 }),
	);

	let [sw] = context.serviceWorkers();
	if (!sw) sw = await context.waitForEvent("serviceworker", { timeout: 15000 });

	const granted = await sw.evaluate(() =>
		chrome.permissions.contains({ origins: ["<all_urls>"] }),
	);
	console.log(`permission probe: <all_urls> granted = ${granted}`);

	const observer = await context.newPage();
	await observer.goto(`chrome-extension://${extensionId}/newtab.html`);
	await observer.evaluate(
		(seed) =>
			new Promise((resolve, reject) => {
				chrome.storage.local.set(
					{ "perch-setup": JSON.stringify(seed) },
					() => {
						if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
						else resolve();
					},
				);
			}),
		buildSeedState(),
	);
	await observer.evaluate(
		(thumbId) =>
			new Promise((resolve, reject) => {
				const open = indexedDB.open("perch-db", 1);
				open.onerror = () => reject(open.error);
				open.onupgradeneeded = () => {
					const db = open.result;
					if (!db.objectStoreNames.contains("thumbnails"))
						db.createObjectStore("thumbnails");
					if (!db.objectStoreNames.contains("backgrounds"))
						db.createObjectStore("backgrounds");
				};
				open.onsuccess = () => {
					const db = open.result;
					const tx = db.transaction("thumbnails", "readwrite");
					tx.objectStore("thumbnails").put(
						"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
						thumbId,
					);
					tx.oncomplete = () => {
						db.close();
						resolve();
					};
					tx.onerror = () => {
						db.close();
						reject(tx.error);
					};
				};
			}),
		MANUAL_THUMB_ID,
	);
	await observer.reload({ waitUntil: "load" });
	await observer
		.waitForFunction(
			() => document.querySelectorAll("[data-marquee-id]").length >= 6,
			null,
			{
				timeout: 15000,
			},
		)
		.catch(() => {});
	// Ground-truth event tap (independent of the product's own listener).
	// Installed after the seed reload so navigation never wipes it.
	await observer.evaluate(() => {
		window.__refreshEvents = [];
		chrome.runtime.onMessage.addListener((m) => {
			if (m?.type === "refresh:progress")
				window.__refreshEvents.push(`${m.status}:${m.completed}/${m.total}`);
		});
	});
	const windowsBefore = await windowCount(observer);

	// ── 1. single refresh via card context menu ──
	{
		const before = await readCards(observer);
		const thumbBefore = before.find((c) => c.title === "single")?.thumbId;
		const card = observer
			.locator("[data-marquee-id]", { hasText: "single" })
			.first();
		await card.click({ button: "right" });
		const item = observer.getByRole("menuitem", { name: "Refresh thumbnail" });
		await item.waitFor({ state: "visible", timeout: 8000 });
		await item.click();
		const updated = await waitFor(
			async () => {
				const cards = await readCards(observer);
				const found = cards?.find((c) => c.title === "single");
				return found?.thumbId && found.thumbId !== thumbBefore ? found : null;
			},
			25000,
			"single refresh thumbId change",
		);
		const ui = await cardShowsThumb(observer, "single");
		record(
			"1. single refresh replaces the thumbnail",
			!!updated && ui,
			`thumbId ${thumbBefore} → ${updated?.thumbId}, ui=${ui}`,
		);
	}

	// ── 2. batch of 5 via selection tray ──
	{
		const before = await readCards(observer);
		const beforeIds = new Map(
			before
				.filter((c) => c.folderId === "folder-5")
				.map((c) => [c.title, c.thumbId]),
		);
		await observer.keyboard.press("Control+A");
		await observer
			.locator("[data-selection-tray]")
			.waitFor({ state: "visible", timeout: 8000 });
		async function clickTrayRefreshOnce() {
			await observer.getByRole("button", { name: "Selection actions" }).click();
			const item = observer.getByRole("menuitem", {
				name: "Refresh previews (6)",
			});
			await item.waitFor({ state: "visible", timeout: 8000 });
			await item.click();
		}
		async function batchRunning() {
			const [text, session] = await Promise.all([
				observer
					.locator("[data-sonner-toaster]")
					.innerText()
					.catch(() => ""),
				readRefreshSession(observer).catch(() => null),
			]);
			return {
				toast: /Capturing \d+ of 6/.test(text),
				session: session?.status === "running",
			};
		}
		await clickTrayRefreshOnce();
		// Progress toast appears with the ring + label (one retry: a click
		// racing the menu's motion transition can land without selecting).
		let running = await waitFor(
			async () => {
				const state = await batchRunning();
				return state.toast || state.session ? state : null;
			},
			20000,
			"batch start",
		).catch(() => null);
		if (!running) {
			await clickTrayRefreshOnce();
			running = await waitFor(
				async () => {
					const state = await batchRunning();
					return state.toast || state.session ? state : null;
				},
				20000,
				"batch start retry",
			).catch(() => null);
		}
		record(
			"2a. batch starts (toast + worker state)",
			!!running && (running.toast || running.session),
			`toast=${running?.toast}, workerSession=${running?.session}`,
		);
		if (!running) throw new Error("batch of 6 never started");
		const done = await waitFor(
			async () => {
				const cards = await readCards(observer);
				const five = cards?.filter((c) => c.folderId === "folder-5") ?? [];
				return five.length === 6 && five.every((c) => !!c.thumbId)
					? five
					: null;
			},
			90000,
			"batch of 6 completion",
		);
		let allChanged = false;
		if (done) {
			allChanged = done.every((c) => beforeIds.get(c.title) !== c.thumbId);
		}
		const summaryVisible = await observer
			.getByText(/preview.*updated/)
			.waitFor({ state: "visible", timeout: 10000 })
			.then(() => true)
			.catch(() => false);
		if (!summaryVisible) {
			const dbg = await observer
				.locator("[data-sonner-toaster]")
				.innerText()
				.catch(() => "(no toaster)");
			const sess = await readRefreshSession(observer).catch(() => "read-error");
			const evts = await observer
				.evaluate(() => window.__refreshEvents)
				.catch(() => "tap-error");
			console.log(
				"2b debug toaster:",
				JSON.stringify(dbg.slice(0, 300)),
				"session:",
				JSON.stringify(sess)?.slice(0, 200),
				"events:",
				JSON.stringify(evts)?.slice(0, 400),
			);
		}
		record(
			"2b. batch of 6 completes, every thumb replaced",
			!!done && allChanged && summaryVisible,
			`allChanged=${allChanged}, summary=${summaryVisible}`,
		);
		await sleep(4500); // let the summary toast expire
	}

	// ── 3 + 7. batch of 10 with cancel; session persistence mid-run ──
	{
		await observer
			.getByRole("tab", { name: "BatchTen" })
			.click()
			.catch(() => undefined);
		// Fallback: click the folder tab by text if role query missed.
		const gridReady = await observer
			.waitForFunction(
				() => document.querySelectorAll("[data-marquee-id]").length >= 10,
				null,
				{
					timeout: 10000,
				},
			)
			.then(() => true)
			.catch(() => false);
		if (!gridReady) {
			await observer.getByText("BatchTen", { exact: true }).first().click();
			await observer.waitForFunction(
				() => document.querySelectorAll("[data-marquee-id]").length >= 10,
				null,
				{ timeout: 10000 },
			);
		}
		await observer.keyboard.press("Escape").catch(() => undefined);
		await observer.keyboard.press("Control+A");
		await observer
			.locator("[data-selection-tray]")
			.waitFor({ state: "visible", timeout: 8000 });
		async function clickTrayRefresh10() {
			await observer.getByRole("button", { name: "Selection actions" }).click();
			const item10 = observer.getByRole("menuitem", {
				name: "Refresh previews (10)",
			});
			await item10.waitFor({ state: "visible", timeout: 8000 });
			await item10.click();
		}
		async function batch10Running() {
			const [text, session] = await Promise.all([
				observer
					.locator("[data-sonner-toaster]")
					.innerText()
					.catch(() => ""),
				readRefreshSession(observer).catch(() => null),
			]);
			return {
				toast: /Capturing \d+ of 10/.test(text),
				session: session?.status === "running",
			};
		}
		await clickTrayRefresh10();
		let running10 = await waitFor(
			async () => {
				const state = await batch10Running();
				return state.toast || state.session ? state : null;
			},
			30000,
			"batch-10 start",
		).catch(() => null);
		if (!running10) {
			await clickTrayRefresh10();
			running10 = await waitFor(
				async () => {
					const state = await batch10Running();
					return state.toast || state.session ? state : null;
				},
				30000,
				"batch-10 start retry",
			).catch(() => null);
		}
		if (!running10) {
			const dbg = await observer
				.locator("[data-sonner-toaster]")
				.innerText()
				.catch(() => "(no toaster)");
			const sess = await readRefreshSession(observer).catch(() => "read-error");
			throw new Error(
				`batch of 10 never started (toaster=${JSON.stringify(dbg.slice(0, 200))} session=${JSON.stringify(sess)?.slice(0, 200)})`,
			);
		}

		// (7) mid-batch: the worker persisted resumable state to storage.session.
		await waitFor(
			async () => {
				const text = await observer
					.locator("[data-sonner-toaster]")
					.innerText()
					.catch(() => "");
				return /Capturing [3-9] of 10/.test(text) ? text : null;
			},
			60000,
			"batch reaching mid-run",
		);
		const session = await readRefreshSession(observer);
		record(
			"7. SW-sleep resume state persisted mid-batch",
			!!session &&
				session.status === "running" &&
				session.cardIds?.length === 10,
			`status=${session?.status}, queued=${session?.cardIds?.length}, done=${session?.doneIds?.length}`,
		);

		// (3) cancel now; the toast must confirm with counts.
		await observer.getByRole("button", { name: "Cancel refresh" }).click();
		const cancelledText = await waitFor(
			async () => {
				const text = await observer
					.locator("[data-sonner-toaster]")
					.innerText()
					.catch(() => "");
				const m = text.match(/Cancelled at (\d+) of 10/);
				return m ? m[0] : null;
			},
			20000,
			"cancelled summary",
		);
		const stoppedCount = Number(
			cancelledText?.match(/Cancelled at (\d+) of 10/)?.[1] ?? -1,
		);
		const sessionAfter = await readRefreshSession(observer);
		const windowsAfter = await windowCount(observer);
		// Give any in-flight capture a beat, then confirm the queue is parked.
		await sleep(6000);
		const cardsAfter = await readCards(observer);
		const doneAfterWait =
			cardsAfter?.filter((c) => c.folderId === "folder-10" && !!c.thumbId)
				.length ?? -1;
		record(
			"3. cancel stops the queue with an honest count",
			!!cancelledText &&
				stoppedCount >= 1 &&
				stoppedCount < 10 &&
				sessionAfter === null &&
				windowsAfter === windowsBefore &&
				doneAfterWait <= stoppedCount + 1,
			`${cancelledText}, session=${sessionAfter === null ? "cleared" : "LEAKED"}, windows=${windowsAfter}/${windowsBefore}, thumbsSettled=${doneAfterWait}`,
		);
		await sleep(4500);
	}

	// ── 4. auto-capture on a different path of the same domain ──
	{
		const visit = await context.newPage();
		await visit.bringToFront();
		await visit.goto("http://dom.test/notebook/xyz", { waitUntil: "load" });
		const captured = await waitFor(
			async () => {
				const cards = await readCards(observer);
				const found = cards?.find((c) => c.title === "domcard");
				return found?.thumbId ? found : null;
			},
			15000,
			"domain auto-capture",
		);
		await visit.close();
		await observer.bringToFront();
		record(
			"4. visit to sibling path captures the thumbless card (domain match)",
			!!captured,
			`thumbId=${captured?.thumbId}`,
		);
	}

	// ── 5. manual save of a different path creates a NEW card ──
	{
		// Seed a same-folder card for site-m path /a, then add /b via the
		// real Settings form (the exact-match path: findBookmarkInFolder).
		await observer.evaluate(() => {
			chrome.storage.local.get(["perch-setup"], (d) => {
				const envelope = JSON.parse(d["perch-setup"]);
				envelope.state.cards.push({
					id: "card-manual-m",
					folderId: "folder-dom",
					title: "manual-m",
					url: "http://manual.test/a",
					favicon: null,
					thumbId: null,
					order: 99,
					titleSource: null,
					origin: "local",
					capturedAt: null,
				});
				envelope.state.itemOrder["folder-dom"].push("card:card-manual-m");
				chrome.storage.local.set({ "perch-setup": JSON.stringify(envelope) });
			});
		});
		await context.route("http://manual.test/*", (route) =>
			route.fulfill({
				contentType: "text/html",
				body: pageHtml(route.request().url()),
			}),
		);
		const before = await readCards(observer);
		const beforeCount = before?.length ?? 0;
		await observer.click('[aria-label="Settings"]');
		await sleep(700);
		await observer.getByText("Manage bookmarks", { exact: true }).click();
		await sleep(700);
		// The inspected folder follows the active folder; pick Domain.
		const folderPicker = observer
			.getByRole("button", { name: /Folder/ })
			.first();
		await folderPicker.click().catch(() => undefined);
		await sleep(300);
		await observer.keyboard.press("Escape").catch(() => undefined);
		await observer.getByRole("button", { name: "Add link" }).first().click();
		await observer.locator("#bookmark-url-input").fill("http://manual.test/b");
		await observer.locator("#bookmark-title-input").fill("manual-b");
		await observer.getByRole("button", { name: "Add link" }).last().click();
		await sleep(1000);
		const after = await readCards(observer);
		const cardA = after?.find((c) => c.url === "http://manual.test/a");
		const cardB = after?.find((c) => c.url === "http://manual.test/b");
		await observer.keyboard.press("Escape").catch(() => undefined);
		record(
			"5. different path creates a new card (exact match preserved)",
			after?.length === beforeCount + 1 &&
				!!cardA &&
				!!cardB &&
				cardA.id !== cardB.id,
			`cards ${beforeCount} → ${after?.length}`,
		);
	}

	// ── 6. rate limit: no quota errors across the whole run ──
	{
		const quotaErrors = swErrors.filter((e) =>
			/MAX_CAPTURE|quota|rate/i.test(e),
		);
		record(
			"6. no capture rate-limit errors",
			quotaErrors.length === 0 && swErrors.length === 0,
			`swErrors=[${swErrors.join(" | ")}]`,
		);
	}
} finally {
	await context.close().catch(() => undefined);
	restoreManifest();
}

const failed = results.filter((r) => !r.pass);
console.log(
	`\n${results.length - failed.length}/${results.length} checks passed` +
		(failed.length
			? ` — FAILED: ${failed.map((f) => f.scenario).join("; ")}`
			: ""),
);
process.exitCode = failed.length ? 1 : 0;
