/**
 * Throwaway pre-release audit harness (NOT part of the product).
 * Boots the production-built newtab page in real Chromium with a stubbed
 * `chrome` API surface, so Import and other flows can be reproduced with
 * evidence instead of speculation.
 *
 * Usage: node --experimental-strip-types scripts/zz-audit-harness.mts <scenario>
 * Scenarios: boot | import-html
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const DIST = new URL("../.output/chrome-mv3/", import.meta.url);
const MIME: Record<string, string> = {
	".html": "text/html",
	".js": "text/javascript",
	".mjs": "text/javascript",
	".css": "text/css",
	".json": "application/json",
	".png": "image/png",
	".avif": "image/avif",
	".svg": "image/svg+xml",
	".woff2": "font/woff2",
};

const SEED_SETUP = {
	folders: [{ id: "home", name: "Home", order: 0, parentId: null }],
	cards: [],
	activeFolderId: "home",
	settings: {
		tileSize: "medium",
		maxColumns: 6,
		dialLayout: "card",
		cardAspect: "vertical",
		showTitle: true,
		openInNewTab: true,
		iconShowLabel: true,
		search: { enabled: true },
		background: { type: "gradient" },
		clock: { enabled: true },
		greeting: { enabled: true },
		appearanceMode: "dark",
		thumbnailCapture: { enabled: false },
	},
	itemOrder: { home: [], __root__: ["folder:home"] },
};

const CHROME_BOOKMARKS_HTML = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1700000000" LAST_MODIFIED="1700000001">Work</H3>
    <DL><p>
        <DT><A HREF="https://github.com/" ADD_DATE="1700000002">GitHub</A>
        <DT><A HREF="https://linear.app/">Linear</A>
    </DL><p>
    <DT><A HREF="https://news.ycombinator.com/">Hacker News</A>
</DL><p>`;

function startStatic(root: URL) {
	const rootDir = fileURLToPath(root);
	return new Promise<{ url: string; close: () => void }>((resolve) => {
		const server = createServer(async (req, res) => {
			try {
				const path = new URL(req.url ?? "/", "http://x").pathname;
				const rel = path === "/" ? "newtab.html" : path.replace(/^\//, "");
				const file = join(rootDir, rel);
				const data = await readFile(file);
				res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
				res.end(data);
			} catch {
				res.writeHead(404);
				res.end("nf");
			}
		});
		server.listen(0, "127.0.0.1", () => {
			const addr = server.address();
			const port = typeof addr === "object" && addr ? addr.port : 0;
			resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close() });
		});
	});
}

const scenario = process.argv[2] ?? "boot";

const { url, close } = await startStatic(DIST);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors: string[] = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 300)}`));
page.on("console", (m) => {
	if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
page.on("requestfailed", (r) => errors.push(`reqfail: ${r.url().slice(-80)} ${r.failure()?.errorText}`));
page.on("response", (r) => {
	if (r.status() >= 400) errors.push(`http${r.status()}: ${r.url().slice(-80)}`);
});

await page.addInitScript((seed) => {
	const mem: Record<string, unknown> = { "klice-setup": seed };
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(globalThis as any).chrome = {
		storage: {
			local: {
				get: (keys: unknown, cb?: (v: unknown) => void) => {
					const out: Record<string, unknown> = {};
					const list = Array.isArray(keys) ? keys : keys ? [keys] : Object.keys(mem);
					for (const k of list as string[]) out[k] = mem[k];
					if (cb) cb(out);
					return Promise.resolve(out);
				},
				set: (obj: Record<string, unknown>, cb?: () => void) => {
					Object.assign(mem, obj);
					(globalThis as { __writes?: number }).__writes =
						((globalThis as { __writes?: number }).__writes ?? 0) + 1;
					if (cb) cb();
					return Promise.resolve();
				},
				remove: (keys: unknown, cb?: () => void) => {
					for (const k of (Array.isArray(keys) ? keys : [keys]) as string[]) delete mem[k];
					if (cb) cb();
					return Promise.resolve();
				},
			},
			onChanged: { addListener: () => {}, removeListener: () => {} },
		},
		bookmarks: {
			getTree: async () => [{ id: "0", children: [] }],
		},
		runtime: { id: "audit-stub", lastError: undefined },
		tabs: { query: async () => [] },
		contextMenus: { create: () => {}, removeAll: () => {}, onClicked: { addListener: () => {} } },
		permissions: { contains: (_p: unknown, cb: (v: boolean) => void) => cb?.(true) },
	};
}, SEED_SETUP);

await page.goto(`${url}/newtab.html`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.screenshot({ path: "scripts/zz-shot-boot.png" });

const rootText = await page.evaluate(() => document.getElementById("root")?.textContent?.slice(0, 200) ?? "EMPTY");
console.log("ROOT:", JSON.stringify(rootText));

async function openBookmarksPane(page: import("playwright").Page) {
	const settingsBtn = page.getByRole("button", { name: /settings/i }).first();
	await settingsBtn.click({ timeout: 8000 });
	await page.waitForTimeout(1200);
	for (const label of [/bookmarks/i, /links/i]) {
		const nav = page.getByRole("button", { name: label }).first();
		if ((await nav.count()) > 0) {
			await nav.click({ timeout: 5000 }).catch(() => {});
			await page.waitForTimeout(800);
			break;
		}
	}
}

async function readToasts(page: import("playwright").Page) {
	return page.evaluate(() =>
		Array.from(document.querySelectorAll("li[data-sonner-toast]")).map((t) =>
			(t as HTMLElement).innerText.slice(0, 220),
		),
	);
}

if (scenario === "import-html") {
	await openBookmarksPane(page);
	await page.screenshot({ path: "scripts/zz-shot-settings.png" });
	// Find the hidden file input used by Import from file.
	const input = page.locator('input[type="file"]');
	console.log("file inputs:", await input.count());
	if ((await input.count()) > 0) {
		await input.first().setInputFiles({
			name: "bookmarks.html",
			mimeType: "text/html",
			buffer: Buffer.from(CHROME_BOOKMARKS_HTML),
		});
		await page.waitForTimeout(2500);
		await page.screenshot({ path: "scripts/zz-shot-import.png" });
		const toasts = await page.evaluate(() =>
			Array.from(document.querySelectorAll("li[data-sonner-toast]")).map((t) =>
				(t as HTMLElement).innerText.slice(0, 200),
			),
		);
		console.log("TOASTS:", JSON.stringify(toasts, null, 1));
		// Close settings (X button) and inspect the imported Work folder.
		const closeBtn = page.getByRole("button", { name: /^close$/i }).first();
		if ((await closeBtn.count()) > 0) await closeBtn.click().catch(() => {});
		await page.keyboard.press("Escape").catch(() => {});
		await page.waitForTimeout(800);
		const workTab = page.getByRole("tab", { name: /^work$/i }).first();
		console.log("work tabs:", await workTab.count());
		if ((await workTab.count()) > 0) {
			await workTab.click({ timeout: 5000 }).catch((e) => console.log("work open failed:", String(e).slice(0, 200)));
			await page.waitForTimeout(1200);
		}
		await page.screenshot({ path: "scripts/zz-shot-work.png" });
		const gridText = await page.evaluate(() => document.getElementById("root")?.textContent?.slice(0, 400) ?? "EMPTY");
		console.log("GRID:", JSON.stringify(gridText));
	}
}

if (scenario === "import-keep-dialog" || scenario === "import-replace") {
	await openBookmarksPane(page);
	const input = page.locator('input[type="file"]');
	await input.first().setInputFiles({
		name: "bookmarks.html",
		mimeType: "text/html",
		buffer: Buffer.from(CHROME_BOOKMARKS_HTML),
	});
	await page.waitForTimeout(1200);
	const dialogTitle = await page.getByRole("dialog").textContent().catch(() => "NO-DIALOG");
	console.log("DIALOG:", JSON.stringify((dialogTitle ?? "").slice(0, 400)));
	await page.screenshot({ path: "scripts/zz-shot-dialog.png" });
	if (scenario === "import-replace") {
		await page.getByRole("radio", { name: /replace current/i }).click({ timeout: 5000 });
		await page.waitForTimeout(400);
		await page.getByRole("button", { name: /^replace/i }).click({ timeout: 5000 });
		await page.waitForTimeout(400);
		await page.screenshot({ path: "scripts/zz-shot-replace-confirm.png" });
		await page.getByRole("button", { name: /yes, replace everything/i }).click({ timeout: 5000 });
	} else {
		await page.getByRole("button", { name: /^import$/i }).click({ timeout: 5000 });
	}
	await page.waitForTimeout(2000);
	await page.screenshot({ path: "scripts/zz-shot-after.png" });
	console.log("TOASTS:", JSON.stringify(await readToasts(page), null, 1));
	const gridText = await page.evaluate(() => document.getElementById("root")?.textContent?.slice(0, 300) ?? "EMPTY");
	console.log("GRID:", JSON.stringify(gridText));
}

if (scenario === "backup-restore") {
	const backup = JSON.stringify({
		folders: [
			{ id: "b1", name: "Restored", order: 0, parentId: null },
			{ id: "b2", name: "Nested", order: 0, parentId: "b1" },
		],
		cards: [
			{ id: "c1", folderId: "b2", title: "Example", url: "https://example.com/", favicon: null, thumbId: null, order: 0, origin: "local", capturedAt: null },
		],
		activeFolderId: "b1",
		settings: {},
		itemOrder: {
			__root__: ["folder:b1"],
			b1: ["folder:b2"],
			b2: ["card:c1"],
		},
		thumbnails: {},
		backgrounds: {},
	});
	await openBookmarksPane(page);
	const input = page.locator('input[type="file"]');
	await input.first().setInputFiles({
		name: "klice-start-backup.json",
		mimeType: "application/json",
		buffer: Buffer.from(backup),
	});
	await page.waitForTimeout(1200);
	const dialogTitle = await page.getByRole("dialog").textContent().catch(() => "NO-DIALOG");
	console.log("DIALOG:", JSON.stringify((dialogTitle ?? "").slice(0, 300)));
	await page.screenshot({ path: "scripts/zz-shot-backup-dialog.png" });
	await page.getByRole("button", { name: /^replace/i }).click({ timeout: 5000 });
	await page.waitForTimeout(400);
	await page.getByRole("button", { name: /yes, replace everything/i }).click({ timeout: 5000 });
	await page.waitForTimeout(2000);
	console.log("TOASTS:", JSON.stringify(await readToasts(page), null, 1));
	const gridText = await page.evaluate(() => document.getElementById("root")?.textContent?.slice(0, 300) ?? "EMPTY");
	console.log("GRID:", JSON.stringify(gridText));
	await page.screenshot({ path: "scripts/zz-shot-backup-after.png" });
}

if (scenario === "import-malformed") {
	await openBookmarksPane(page);
	const input = page.locator('input[type="file"]');
	await input.first().setInputFiles({
		name: "broken.html",
		mimeType: "text/html",
		buffer: Buffer.from("<html><body>no bookmarks here</body></html>"),
	});
	await page.waitForTimeout(1500);
	console.log("TOASTS:", JSON.stringify(await readToasts(page), null, 1));
}

console.log("ERRORS:", JSON.stringify(errors.slice(0, 10), null, 1));
await browser.close();
close();
