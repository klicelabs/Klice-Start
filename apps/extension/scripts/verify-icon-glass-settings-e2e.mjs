/**
 * Settings regression and timing probe against a clean production build.
 * node scripts/verify-icon-glass-settings-e2e.mjs [count=300] [icon|card] [--cold] [--no-surface]
 * No timing threshold: rAF measures main-thread availability, not GPU FPS.
 * Fails on Home reflow, filter changes, broken controls, focus or reversal.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
	buildSeed,
	launchExtension,
	openNewtab,
	waitForGrid,
} from "./bench-lib.mjs";

const count = Number(process.argv[2] ?? 300);
const layout = process.argv[3] ?? "icon";
const cold = process.argv.includes("--cold");
const surface = !process.argv.includes("--no-surface");
const resultsDir = path.resolve("scripts/results/sidebar-motion");
fs.mkdirSync(resultsDir, { recursive: true });
const { context, extensionId } = await launchExtension();
const reports = [];

async function homeSnapshot(page) {
	return page.evaluate(() => {
		const frame = document.querySelector("[data-speed-dial-frame]");
		const rect = frame.getBoundingClientRect();
		return {
			geometry: [rect.x, rect.y, rect.width, rect.height],
			filters: [...document.querySelectorAll(".icon-glass-tile")].map(
				(tile) => getComputedStyle(tile).backdropFilter,
			),
		};
	});
}

async function measure(page, open) {
	return page.evaluate(async (open) => {
		const frame = document.querySelector("[data-speed-dial-frame]");
		const widths = new Set();
		const transforms = new Set();
		const gaps = [];
		const start = performance.now();
		let previous = start;
		await new Promise((resolve) => {
			function sample(now) {
				gaps.push(now - previous);
				previous = now;
				widths.add(frame.clientWidth);
				const panel = document.querySelector("[data-settings-panel]");
				if (panel) transforms.add(getComputedStyle(panel).transform);
				if (now - start < 500) requestAnimationFrame(sample);
				else resolve();
			}
			requestAnimationFrame(sample);
			document
				.querySelector(
					open ? "#settings-trigger" : 'button[aria-label="Close preferences"]',
				)
				.click();
		});
		gaps.sort((a, b) => a - b);
		return {
			open,
			homeWidths: [...widths],
			panelPositions: transforms.size,
			p95Ms: Math.round(gaps[Math.floor(gaps.length * 0.95)] * 10) / 10,
			maxGapMs: Math.round(gaps.at(-1) * 10) / 10,
		};
	}, open);
}

try {
	for (const mode of ["flat", "liquid"]) {
		for (const scheme of ["light", "dark"]) {
			const seed = buildSeed({ cardsPerFolder: count, folders: 1 });
			Object.assign(seed.state.settings, {
				appearanceMode: mode,
				colorScheme: scheme,
				dialLayout: layout,
				iconTileSurface: surface,
			});
			const page = await openNewtab(context, extensionId, {
				seed,
				// Exercise a click before the idle preparation has run.
				initScripts: cold
					? [
							"window.requestIdleCallback = () => 1; window.cancelIdleCallback = () => {};",
						]
					: [],
			});
			await page.setViewportSize({ width: 1600, height: 900 });
			await waitForGrid(page, count);
			if (!cold)
				await page.waitForSelector("[data-settings-root]", {
					state: "attached",
				});
			await page.waitForTimeout(500);
			const before = await homeSnapshot(page);
			const samples = [];
			for (let rep = 0; rep < 2; rep++) {
				for (const open of [true, false]) {
					const sample = await measure(page, open);
					assert.equal(
						sample.homeWidths.length,
						1,
						"Settings reflows Home per frame",
					);
					assert.ok(
						sample.panelPositions > 2,
						"The panel must still slide in both directions",
					);
					assert.deepEqual(
						await homeSnapshot(page),
						before,
						"Settings changes Home geometry or Glass",
					);
					assert.equal(
						await page
							.locator("[data-settings-sidebar-slot]")
							.getAttribute("aria-hidden"),
						String(!open),
					);
					assert.equal(
						await page
							.locator("[data-settings-sidebar-slot]")
							.evaluate((slot) => slot.hasAttribute("inert")),
						!open,
					);
					samples.push(sample);
				}
			}
			// A real control remains interactive; Escape restores focus.
			await page.locator("#settings-trigger").click();
			if (count === 30 && !cold) {
				await page.waitForFunction(
					() =>
						!document
							.querySelector("[data-settings-sidebar-slot]")
							.hasAttribute("inert"),
				);
				await page.screenshot({
					path: path.join(resultsDir, `${mode}-${scheme}-desktop.png`),
				});
				await page.setViewportSize({ width: 480, height: 800 });
				const box = await page.locator("[data-settings-panel]").boundingBox();
				assert.ok(
					box.x >= 0 && box.x + box.width <= 480 && box.y + box.height <= 800,
					"Panel overflows a narrow viewport",
				);
				await page.screenshot({
					path: path.join(resultsDir, `${mode}-${scheme}-narrow.png`),
				});
				await page.setViewportSize({ width: 1600, height: 900 });
			}
			const control = page.getByRole("button", {
				name: "Use dark appearance",
				exact: true,
			});
			await control.click();
			assert.equal(await control.getAttribute("aria-pressed"), "true");
			await page
				.getByRole("combobox", { name: "Display style", exact: true })
				.click();
			await page.getByRole("listbox").waitFor({ state: "visible" });
			await page.keyboard.press("Escape");
			await page.getByRole("listbox").waitFor({ state: "hidden" });
			assert.equal(
				await page
					.locator("[data-settings-sidebar-slot]")
					.getAttribute("aria-hidden"),
				"false",
				"Escape in a Select must not close Settings",
			);
			await page
				.getByRole("button", { name: "Close preferences", exact: true })
				.focus();
			await page.keyboard.press("Escape");
			await page.waitForTimeout(450);
			assert.equal(
				await page.evaluate(() => document.activeElement?.id),
				"settings-trigger",
			);
			// Reverse a close before its completion: stale callbacks must not win.
			await page.evaluate(() =>
				document.querySelector("#settings-trigger").click(),
			);
			await page.waitForTimeout(100);
			await page.evaluate(() =>
				document
					.querySelector('button[aria-label="Close preferences"]')
					.click(),
			);
			await page.waitForTimeout(60);
			await page.evaluate(() =>
				document.querySelector("#settings-trigger").click(),
			);
			await page.waitForTimeout(500);
			assert.equal(
				await page
					.locator("[data-settings-sidebar-slot]")
					.getAttribute("aria-hidden"),
				"false",
			);
			assert.equal(
				await page
					.locator("[data-settings-sidebar-slot]")
					.evaluate((slot) => slot.hasAttribute("inert")),
				false,
			);
			await page.emulateMedia({ reducedMotion: "reduce" });
			await page.keyboard.press("Escape");
			await page.waitForTimeout(80);
			assert.equal(
				await page
					.locator("[data-settings-sidebar-slot]")
					.evaluate((slot) => getComputedStyle(slot).visibility),
				"hidden",
			);
			await page.locator("#settings-trigger").click();
			assert.equal(
				await page
					.locator("[data-settings-sidebar-slot]")
					.evaluate((slot) => slot.hasAttribute("inert")),
				false,
			);
			reports.push({ count, layout, surface, cold, mode, scheme, samples });
			await page.close();
		}
	}
	fs.writeFileSync(
		path.join(
			resultsDir,
			`motion-${count}-${layout}${cold ? "-cold" : ""}${surface ? "" : "-no-surface"}.json`,
		),
		JSON.stringify(reports, null, 2),
	);
	console.log(JSON.stringify(reports, null, 2));
} finally {
	await context.close();
}
