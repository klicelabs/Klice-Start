/** Native, headful Chromium rendering probe. Run only when other focus tests are stopped. */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { launchExtension } from "./bench-lib.mjs";

const output = process.env.BB_THREAD_STORAGE;
if (!output) throw new Error("BB_THREAD_STORAGE required");
const results = [];
const manifestPath = path.resolve(".output/chrome-mv3/manifest.json");
const originalManifest = fs.readFileSync(manifestPath, "utf8");
let manifest;
try {
	manifest = JSON.parse(originalManifest);
} catch (error) {
	throw new Error("Invalid built manifest", { cause: error });
}
manifest.host_permissions = [
	...new Set([...(manifest.host_permissions ?? []), "<all_urls>"]),
];
manifest.optional_host_permissions = [];
fs.writeFileSync(manifestPath, JSON.stringify(manifest));
const server = http.createServer((_, res) => {
	res.writeHead(200, { "content-type": "text/html" });
	res.end(
		'<html style="margin:0;background:#2d7fb5"><body style="margin:0;background:#2d7fb5"></body></html>',
	);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { context, extensionId } = await launchExtension({
	headless: false,
	backgroundRenderingOverrides: false,
	nativeWindowGeometry: true,
});
try {
	const page = await context.newPage();
	await page.goto(`chrome-extension://${extensionId}/newtab.html`);
	const url = `http://127.0.0.1:${server.address().port}/`;
	for (const state of ["normal", "minimized"]) {
		const result = await page.evaluate(
			async ({ url, state }) => {
				const events = [];
				const listener = (id) => events.push(id);
				chrome.windows.onFocusChanged.addListener(listener);
				const original = await chrome.windows.getCurrent();
				let target;
				try {
					target = await chrome.windows.create({
						url,
						focused: false,
						state,
						...(state === "normal" ? { width: 1000, height: 700 } : {}),
					});
					const tab = target.tabs[0];
					const start = Date.now();
					while (
						(await chrome.tabs.get(tab.id)).status !== "complete" &&
						Date.now() - start < 15000
					)
						await new Promise((r) => setTimeout(r, 100));
					await new Promise((r) => setTimeout(r, 2000));
					const initial = await chrome.windows.get(target.id);
					if (state === "minimized")
						await chrome.windows.update(target.id, {
							state: "minimized",
							focused: false,
						});
					await new Promise((r) => setTimeout(r, 300));
					const beforeCapture = await chrome.windows.get(target.id);
					const dataUrl = await chrome.tabs.captureVisibleTab(target.id, {
						format: "jpeg",
						quality: 82,
					});
					const image = new Image();
					image.src = dataUrl;
					await image.decode();
					const canvas = document.createElement("canvas");
					canvas.width = image.naturalWidth;
					canvas.height = image.naturalHeight;
					const ctx = canvas.getContext("2d");
					ctx.drawImage(image, 0, 0);
					return {
						state,
						initial,
						beforeCapture,
						original: original.id,
						target: await chrome.windows.get(target.id),
						events,
						rgb: [...ctx.getImageData(20, 20, 1, 1).data],
						width: canvas.width,
						height: canvas.height,
						dataUrl,
					};
				} catch (error) {
					return { state, events, error: String(error) };
				} finally {
					if (target) await chrome.windows.remove(target.id);
					chrome.windows.onFocusChanged.removeListener(listener);
				}
			},
			{ url, state },
		);
		if (result.dataUrl) {
			fs.writeFileSync(
				path.join(output, `strategy-chrome-${state}.jpg`),
				Buffer.from(result.dataUrl.split(",")[1], "base64"),
			);
			delete result.dataUrl;
		}
		results.push(result);
	}
} finally {
	fs.writeFileSync(
		path.join(output, "chrome-strategies.json"),
		JSON.stringify(results, null, 2),
	);
	await context.close();
	await new Promise((resolve) => server.close(resolve));
	fs.writeFileSync(manifestPath, originalManifest);
}
