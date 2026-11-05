/**
 * Reproduces Settings opening over a dense Glass Icon surfaces grid.
 *
 * Run after `bun run build` with:
 *   node scripts/verify-icon-glass-settings-e2e.mjs
 *
 * The assertion checks the compositor-heavy tile filters while the Settings
 * shell is mounted. A screenshot and frame sample are saved under results/.
 */
import fs from "node:fs";
import path from "node:path";
import { launchExtension, openNewtab, waitForGrid } from "./bench-lib.mjs";

const COUNT = 113;

function buildSeed() {
	const folderId = "design";
	const cards = Array.from({ length: COUNT }, (_, index) => ({
		id: `design-${index + 1}`,
		folderId,
		title: `Design app ${index + 1}`,
		url: `https://example.com/design/${index + 1}`,
		favicon: null,
		thumbId: null,
		order: index,
		titleSource: null,
		origin: "local",
		capturedAt: null,
	}));
	return {
		state: {
			folders: [{ id: folderId, name: "Design", order: 0, parentId: null }],
			cards,
			activeFolderId: folderId,
			itemOrder: {
				__root__: [`folder:${folderId}`],
				[folderId]: cards.map((card) => `card:${card.id}`),
			},
			settings: {
				tileSize: "medium",
				maxColumns: 7,
				showTitle: true,
				showDeleteButton: false,
				openInNewTab: true,
				dialLayout: "icon",
				iconTileSurface: true,
				cardAspect: "horizontal",
				iconShowLabel: true,
				defaultTitleSource: null,
				thumbnailCapture: { enabled: false, delayMs: 1200 },
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
					pexelsFrequency: "daily",
					pexelsPreviousFrequency: null,
					pexelsLastFetched: null,
					pexelsLastPeriod: null,
					pexelsImageId: null,
				},
				clock: {
					enabled: true,
					dateEnabled: true,
					format24: true,
					showSeconds: false,
					size: 72,
					dateSize: 16,
					timezone: "auto",
				},
				greeting: { enabled: true, name: "", size: 28 },
				search: {
					enabled: true,
					engine: "https://duckduckgo.com/?q=%s",
					placeholder: "Search the web",
					iconMode: "search",
					width: 560,
				},
				quickLinks: { enabled: true, items: [] },
				appearanceMode: "liquid",
				colorScheme: "dark",
				accentColor: "blue",
				glassIntensity: 60,
			},
		},
		version: 0,
	};
}

async function main() {
	const { context, extensionId } = await launchExtension({ headless: true });
	try {
		const page = await openNewtab(context, extensionId, { seed: buildSeed() });
		await page.setViewportSize({ width: 1600, height: 900 });
		await waitForGrid(page, COUNT, 20000);
		await page.waitForFunction(
			(count) =>
				document.querySelectorAll(
					'.dial-grid[data-layout="icon"] .icon-glass-tile',
				).length === count,
			COUNT,
		);

		const before = await page.evaluate(() => {
			const tiles = [
				...document.querySelectorAll(
					'.dial-grid[data-layout="icon"] .icon-glass-tile',
				),
			];
			return {
				tiles: tiles.length,
				activeFilters: tiles.filter(
					(tile) => getComputedStyle(tile).backdropFilter !== "none",
				).length,
			};
		});
		if (before.tiles !== COUNT || before.activeFilters === 0) {
			throw new Error(
				`Expected ${COUNT} active Glass tile filters before Settings; got ${JSON.stringify(before)}`,
			);
		}

		await page.getByRole("button", { name: "Settings", exact: true }).click();
		await page.waitForSelector(
			'.settings-workspace[data-settings-motion-active="true"] [data-settings-sidebar-slot]',
		);
		const during = await page.evaluate(() => {
			const tiles = [
				...document.querySelectorAll(
					'.dial-grid[data-layout="icon"] .icon-glass-tile',
				),
			];
			return {
				activeFilters: tiles.filter(
					(tile) => getComputedStyle(tile).backdropFilter !== "none",
				).length,
			};
		});
		await page.waitForSelector(
			'.settings-workspace[data-settings-motion-active="false"]',
			{ timeout: 1500 },
		);
		await page.waitForFunction(
			() =>
				[
					...document.querySelectorAll(
						'.dial-grid[data-layout="icon"] .icon-glass-tile',
					),
				].some((tile) => getComputedStyle(tile).backdropFilter !== "none"),
			null,
			{ timeout: 3000 },
		);

		const after = await page.evaluate(() => {
			const tiles = [
				...document.querySelectorAll(
					'.dial-grid[data-layout="icon"] .icon-glass-tile',
				),
			];
			const filters = tiles.map(
				(tile) => getComputedStyle(tile).backdropFilter,
			);
			return {
				activeFilters: filters.filter((filter) => filter !== "none").length,
				filterSamples: [...new Set(filters)].slice(0, 4),
			};
		});

		const resultsDir = path.resolve(".output");
		fs.mkdirSync(resultsDir, { recursive: true });
		await page.screenshot({
			path: path.join(resultsDir, "icon-glass-settings.png"),
			fullPage: false,
		});
		await page
			.getByRole("button", { name: "Close preferences", exact: true })
			.click();
		await page.waitForSelector("[data-settings-sidebar-slot]", {
			state: "detached",
		});
		const restoredFilters = await page.evaluate(
			() =>
				[
					...document.querySelectorAll(
						'.dial-grid[data-layout="icon"] .icon-glass-tile',
					),
				].filter((tile) => getComputedStyle(tile).backdropFilter !== "none")
					.length,
		);
		console.log(
			JSON.stringify({ before, during, after, restoredFilters }, null, 2),
		);
		if (during.activeFilters !== 0) {
			throw new Error(
				`Settings motion retained ${during.activeFilters}/${COUNT} expensive Glass tile filters`,
			);
		}
		if (after.activeFilters === 0) {
			throw new Error(
				"Glass tile filters did not restore after Settings settled",
			);
		}
		if (restoredFilters === 0) {
			throw new Error(
				"Glass tile filters did not restore after Settings closed",
			);
		}
	} finally {
		await context.close();
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
