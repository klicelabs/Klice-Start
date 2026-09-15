import { existsSync } from "node:fs";
import {
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
	basename,
	dirname,
	extname,
	join,
	relative,
	resolve,
	sep,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { brotliCompressSync } from "node:zlib";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT = resolve(SCRIPT_DIR, "out/liquid-glass");
const VIEWPORT = { width: 1440, height: 900 };
const MEASURED_RUNS = 5;
const NOISY_RUNS = 10;
const DRAG_DURATION_MS = 1000;
const POINTER_HZ = 240;
const FRAME_RATE = 60;
const FIREFOX_LAUNCH_TIMEOUT_MS = 15000;
const FIREFOX_EXTENSION_ORIGIN_TIMEOUT_MS = 5000;
const QUERY = "glass-baseline-2026x";
const GLASS_VARIABLES = [
	"--klice-glass-intensity",
	"--klice-glass-blur-clear",
	"--klice-glass-blur-dense",
	"--klice-glass-saturation-clear",
	"--klice-glass-saturation-dense",
	"--klice-glass-brightness-clear",
	"--klice-glass-brightness-dense",
];
const SCENARIOS = [
	"idle",
	"intensity-drag",
	"settings-open",
	"settings-close",
	"settings-pane-navigation",
	"search-open-type-close",
	"card-context-menu",
	"trigger-popover",
	"settings-expandable",
	"resize-lens",
];
const STATIC_EXPECTATIONS = {
	fileCount: 42,
	jsRawBytes: 883674,
	jsBrotliBytes: 232152,
	cssRawBytes: 195593,
	cssBrotliBytes: 23215,
	backdropFilterCount: 36,
	filterCount: 13,
	willChangeCount: 2,
};
const LIQUID_MATRIX = [
	["C-L-S", "chrome", "light", "simple"],
	["C-D-S", "chrome", "dark", "simple"],
	["C-L-W", "chrome", "light", "wallpaper"],
	["C-D-W", "chrome", "dark", "wallpaper"],
	["F-L-S", "firefox", "light", "simple"],
	["F-D-S", "firefox", "dark", "simple"],
	["F-L-W", "firefox", "light", "wallpaper"],
	["F-D-W", "firefox", "dark", "wallpaper"],
].map(([id, browser, theme, background]) => ({
	id,
	browser,
	theme,
	background,
	material: "liquid",
}));

class HarnessError extends Error {
	constructor(message, code = "harness-error") {
		super(message);
		this.name = "HarnessError";
		this.code = code;
	}
}

function printHelp() {
	process.stdout.write("Liquid Glass baseline harness\n\n");
	process.stdout.write(
		"Usage: node .qa/liquid-glass-benchmark.mjs --extension <built-target> [options]\n\n",
	);
	process.stdout.write("Options:\n");
	process.stdout.write(
		"  --extension <path>       Built unpacked extension directory\n",
	);
	process.stdout.write(
		"  --browser <name>        chrome, firefox, or both (default: both)\n",
	);
	process.stdout.write(
		"  --output <path>         Output directory below .qa/out/liquid-glass\n",
	);
	process.stdout.write(
		"  --liquid-only           Run the eight required Liquid rows only\n",
	);
	process.stdout.write(
		"  --headed                Keep the automation browser visible\n",
	);
	process.stdout.write(
		"  --executable <path>     Browser executable (one browser at a time)\n",
	);
	process.stdout.write(
		"  --firefox-addon <path>  Signed or unsigned XPI for Firefox loading\n",
	);
	process.stdout.write(
		"  --manual                Write the full manual-capture checklist\n",
	);
	process.stdout.write("  --help                   Show this help\n");
}

function parseArgs(argv) {
	const options = {
		browser: "both",
		headed: false,
		includeFlat: true,
		manual: false,
		output: DEFAULT_OUTPUT,
	};
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--help" || argument === "-h") {
			options.help = true;
			continue;
		}
		if (argument === "--headed") {
			options.headed = true;
			continue;
		}
		if (argument === "--liquid-only") {
			options.includeFlat = false;
			continue;
		}
		if (argument === "--manual") {
			options.manual = true;
			continue;
		}
		if (
			argument === "--extension" ||
			argument === "--output" ||
			argument === "--browser" ||
			argument === "--executable" ||
			argument === "--firefox-addon"
		) {
			const value = argv[index + 1];
			if (!value || value.startsWith("--")) {
				throw new HarnessError(`${argument} requires a value`, "usage");
			}
			index += 1;
			if (argument === "--extension") options.extension = resolve(value);
			if (argument === "--output") options.output = resolve(value);
			if (argument === "--browser") options.browser = value;
			if (argument === "--executable") options.executable = resolve(value);
			if (argument === "--firefox-addon") options.firefoxAddon = resolve(value);
			continue;
		}
		throw new HarnessError(`Unknown option: ${argument}`, "usage");
	}
	if (options.help) return options;
	if (!options.manual && !options.extension) {
		throw new HarnessError(
			"--extension is required for runtime capture; use --manual for the checklist",
			"usage",
		);
	}
	if (!["chrome", "firefox", "both"].includes(options.browser)) {
		throw new HarnessError(
			`Unsupported browser '${options.browser}'; use chrome, firefox, or both`,
			"usage",
		);
	}
	if (options.executable && options.browser === "both") {
		throw new HarnessError(
			"--executable requires a single --browser selection",
			"usage",
		);
	}
	const outputRoot = resolve(options.output);
	const requiredRoot = resolve(DEFAULT_OUTPUT);
	if (
		outputRoot !== requiredRoot &&
		!outputRoot.startsWith(`${requiredRoot}${sep}`)
	) {
		throw new HarnessError(`Output must remain below ${requiredRoot}`, "usage");
	}
	options.output = outputRoot;
	return options;
}

function matrixFor(options) {
	const rows = options.includeFlat
		? LIQUID_MATRIX.flatMap((row) => [
				row,
				{ ...row, id: `${row.id}-F`, material: "flat" },
			])
		: LIQUID_MATRIX;
	return options.browser === "both"
		? rows
		: rows.filter((row) => row.browser === options.browser);
}

function unavailableMetric(reason, method = "unsupported") {
	return { status: "unavailable", method, reason };
}

function round(value) {
	return Number(value.toFixed(3));
}

function percentile(values, fraction) {
	if (values.length === 0) return null;
	const sorted = [...values].sort((left, right) => left - right);
	const position = (sorted.length - 1) * fraction;
	const lower = Math.floor(position);
	const upper = Math.ceil(position);
	if (lower === upper) return sorted[lower];
	return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function summarize(values, method = "performance.now") {
	const finite = values.filter((value) => Number.isFinite(value));
	if (finite.length === 0)
		return unavailableMetric("No samples were recorded", method);
	const median = percentile(finite, 0.5);
	const p25 = percentile(finite, 0.25);
	const p75 = percentile(finite, 0.75);
	return {
		status: "measured",
		method,
		samples: finite.length,
		median: round(median),
		p95: round(percentile(finite, 0.95)),
		iqr: round(p75 - p25),
	};
}

function relativeOutputPath(outputRoot, filePath) {
	return relative(outputRoot, filePath).split(sep).join("/");
}

function redactMessage(message) {
	return String(message)
		.replace(/https?:\/\/[^\s)]+/gi, "[external-url-redacted]")
		.replace(/chrome-extension:\/\/[^\s)]+/gi, "[extension-url-redacted]")
		.replace(/moz-extension:\/\/[^\s)]+/gi, "[extension-url-redacted]");
}

async function writeJson(filePath, value) {
	await mkdir(dirname(filePath), { recursive: true });
	await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readManifest(extensionPath) {
	const manifestPath = join(extensionPath, "manifest.json");
	try {
		const parsed = JSON.parse(await readFile(manifestPath, "utf8"));
		if (!parsed || typeof parsed !== "object") throw new Error("not an object");
		return parsed;
	} catch (error) {
		throw new HarnessError(
			`Cannot read built extension manifest at ${manifestPath}: ${redactMessage(error.message)}`,
			"extension",
		);
	}
}

async function collectFiles(rootPath) {
	const files = [];
	async function visit(currentPath) {
		const entries = await readdir(currentPath, { withFileTypes: true });
		for (const entry of entries) {
			const child = join(currentPath, entry.name);
			if (entry.isDirectory()) {
				await visit(child);
			} else if (entry.isFile()) {
				files.push(child);
			}
		}
	}
	await visit(rootPath);
	return files;
}

async function collectStaticGuardrails(extensionPath) {
	const files = await collectFiles(extensionPath);
	const javascript = files.filter((file) => extname(file) === ".js");
	const stylesheets = files.filter((file) => extname(file) === ".css");
	const readText = async (file) => readFile(file, "utf8");
	const cssText = await Promise.all(stylesheets.map(readText));
	const countOccurrences = (texts, term) =>
		texts.reduce((total, text) => total + text.split(term).length - 1, 0);
	const countStandaloneFilterDeclarations = (texts) =>
		texts.reduce((total, text) => {
			const withoutComments = text.replace(/\/\*[\s\S]*?\*\//g, "");
			return (
				total +
				[...withoutComments.matchAll(/(?:^|[;{}])\s*filter\s*:/gm)].length
			);
		}, 0);
	const byteTotal = async (paths) => {
		let total = 0;
		let brotli = 0;
		for (const file of paths) {
			const data = await readFile(file);
			total += data.byteLength;
			brotli += brotliCompressSync(data).byteLength;
		}
		return { raw: total, brotli };
	};
	const [jsBytes, cssBytes] = await Promise.all([
		byteTotal(javascript),
		byteTotal(stylesheets),
	]);
	return {
		status: "measured",
		method: "built-output-files",
		fileCount: files.length,
		javascript: { rawBytes: jsBytes.raw, brotliBytes: jsBytes.brotli },
		css: { rawBytes: cssBytes.raw, brotliBytes: cssBytes.brotli },
		occurrences: {
			backdropFilter: countOccurrences(cssText, "backdrop-filter"),
			filter: countStandaloneFilterDeclarations(cssText),
			rawFilterTokens: countOccurrences(cssText, "filter"),
			willChange: countOccurrences(cssText, "will-change"),
		},
		definitions: {
			filter:
				"filter counts standalone filter: declarations; rawFilterTokens is diagnostic only and includes filter substrings in related property names and generated CSS text",
		},
		expected: STATIC_EXPECTATIONS,
	};
}

function makeFavicon(index) {
	const hue = (index * 47) % 360;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="hsl(${hue} 70% 55%)"/><circle cx="16" cy="16" r="7" fill="white" fill-opacity=".85"/></svg>`;
	return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function buildFixture(row) {
	const folders = Array.from({ length: 6 }, (_, index) => ({
		id: `qa-folder-${index + 1}`,
		name: `QA Baseline Folder ${index + 1} / Liquid Glass`,
		order: index,
		parentId: null,
	}));
	const cards = folders.flatMap((folder, folderIndex) =>
		Array.from({ length: 4 }, (_, cardIndex) => ({
			id: `qa-card-${folderIndex + 1}-${cardIndex + 1}`,
			folderId: folder.id,
			title: `QA Bookmark ${folderIndex + 1}.${cardIndex + 1}`,
			url: `https://example.invalid/qa/${folderIndex + 1}/${cardIndex + 1}`,
			favicon: makeFavicon(folderIndex * 4 + cardIndex),
			thumbId: null,
			order: cardIndex,
			origin: "local",
			capturedAt: null,
		})),
	);
	const itemOrder = {
		__root__: folders.map((folder) => `folder:${folder.id}`),
	};
	for (const folder of folders) {
		itemOrder[folder.id] = cards
			.filter((card) => card.folderId === folder.id)
			.map((card) => `card:${card.id}`);
	}
	const simple = row.background === "simple";
	return {
		folders,
		cards,
		activeFolderId: folders[0].id,
		itemOrder,
		settings: {
			tileSize: "medium",
			maxColumns: 7,
			showTitle: true,
			showDeleteButton: true,
			openInNewTab: false,
			dialLayout: "card",
			cardAspect: "vertical",
			iconShowLabel: true,
			thumbnailCapture: { enabled: false, delayMs: 1200 },
			background: {
				type: simple ? "gradient" : "wallpaper",
				color: "#0A0A0C",
				gradientId: simple ? "aurora" : null,
				imageId: null,
				wallpaperId: simple ? null : "tokyo-skyline",
				customWallpaper: null,
				blur: 0,
				brightness: 100,
				opacity: 100,
				pexelsQuery: "curated wallpaper",
				pexelsFrequency: "daily",
				pexelsPreviousFrequency: null,
				pexelsLastFetched: null,
				pexelsLastPeriod: null,
				pexelsImageId: null,
			},
			clock: {
				enabled: true,
				format24: true,
				showSeconds: false,
				size: 200,
				timezone: "auto",
			},
			greeting: { enabled: true, name: "" },
			search: {
				enabled: true,
				engine: "google",
				placeholder: "",
				iconMode: "engine",
			},
			appearanceMode: row.material === "liquid" ? "liquid" : "classic",
			colorScheme: row.theme,
			accentColor: "blue",
			glassIntensity: 60,
		},
	};
}

function pageInitScript(glassVariables) {
	(() => {
		const globalObject = globalThis;
		const originalRaf =
			typeof globalObject.requestAnimationFrame === "function"
				? globalObject.requestAnimationFrame.bind(globalObject)
				: null;
		const eventTimingPrototype = globalObject.PerformanceEventTiming?.prototype;
		const presentationTimeSupported = Boolean(
			eventTimingPrototype && "presentationTime" in eventTimingPrototype,
		);
		const state = {
			frameSampler: { availability: originalRaf ? "available" : "unavailable" },
			active: null,
			canvas: {
				availability: "unavailable",
				toDataURLCalls: 0,
				createImageDataCalls: 0,
				putImageDataCalls: 0,
				durationMs: 0,
			},
			resizeObserver: {
				availability: "unavailable",
				constructors: 0,
				observeCalls: 0,
				unobserveCalls: 0,
				disconnectCalls: 0,
				callbackCalls: 0,
				durationMs: 0,
				active: 0,
			},
			mutationObserver: { availability: "unavailable", active: 0 },
			listeners: { availability: "measured", active: 0 },
			performance: {
				longtask: "unavailable",
				event: "unavailable",
				eventPresentationTime: presentationTimeSupported
					? "available"
					: "unavailable",
				eventPresentationTimeReason: presentationTimeSupported
					? null
					: "PerformanceEventTiming.presentationTime is unavailable in this browser",
			},
			rootStyle: { availability: "unavailable" },
			react: {
				availability: "unavailable",
				rendererSeen: false,
				rootCommits: 0,
			},
		};
		const styleNames = [...glassVariables];
		const harnessListener = Symbol("liquid-glass-harness");
		const listenerRecords = new WeakMap();
		const resizeRecords = new WeakMap();
		const mutationRecords = new WeakMap();

		function durationOf(operation) {
			const started = performance.now();
			try {
				return { value: operation(), duration: performance.now() - started };
			} catch (error) {
				throw Object.assign(error, {
					liquidGlassDuration: performance.now() - started,
				});
			}
		}

		function markHarness(listener) {
			listener[harnessListener] = true;
			return listener;
		}

		function captureEntry(entry, type) {
			if (!state.active || entry.startTime < state.active.started) return;
			if (type === "longtask") {
				state.active.longtasks.push({
					startTime: entry.startTime,
					duration: entry.duration,
				});
			}
			if (type === "event") {
				const presentationTime = Number(entry.presentationTime);
				if (Number.isFinite(presentationTime)) {
					state.performance.eventPresentationTime = "available";
					state.performance.eventPresentationTimeReason = null;
				}
				const event = {
					name: entry.name,
					startTime: entry.startTime,
					duration: entry.duration,
					processingStart: entry.processingStart,
					processingEnd: entry.processingEnd,
					presentationTime: Number.isFinite(presentationTime)
						? presentationTime
						: null,
					nextPaintTime: null,
				};
				state.active.events.push(event);
				recordPresentationTime(state.active, event);
			}
		}

		if (typeof globalObject.HTMLCanvasElement !== "undefined") {
			const canvasPrototype = globalObject.HTMLCanvasElement.prototype;
			const originalToDataURL = canvasPrototype.toDataURL;
			if (typeof originalToDataURL === "function") {
				state.canvas.availability = "measured";
				canvasPrototype.toDataURL = function (...args) {
					state.canvas.toDataURLCalls += 1;
					const measured = durationOf(() =>
						Reflect.apply(originalToDataURL, this, args),
					);
					state.canvas.durationMs += measured.duration;
					return measured.value;
				};
			}
		}
		if (typeof globalObject.CanvasRenderingContext2D !== "undefined") {
			const canvasPrototype = globalObject.CanvasRenderingContext2D.prototype;
			for (const method of ["createImageData", "putImageData"]) {
				const original = canvasPrototype[method];
				if (typeof original !== "function") continue;
				state.canvas.availability = "measured";
				canvasPrototype[method] = function (...args) {
					state.canvas[`${method}Calls`] += 1;
					const measured = durationOf(() =>
						Reflect.apply(original, this, args),
					);
					state.canvas.durationMs += measured.duration;
					return measured.value;
				};
			}
		}

		if (typeof globalObject.ResizeObserver === "function") {
			const OriginalResizeObserver = globalObject.ResizeObserver;
			const originalObserve = OriginalResizeObserver.prototype.observe;
			const originalUnobserve = OriginalResizeObserver.prototype.unobserve;
			const originalDisconnect = OriginalResizeObserver.prototype.disconnect;
			state.resizeObserver.availability = "measured";
			function WrappedResizeObserver(callback) {
				state.resizeObserver.constructors += 1;
				const record = { active: true };
				const wrappedCallback = (entries, observer) => {
					state.resizeObserver.callbackCalls += 1;
					const measured = durationOf(() => callback(entries, observer));
					state.resizeObserver.durationMs += measured.duration;
				};
				const observer = new OriginalResizeObserver(wrappedCallback);
				resizeRecords.set(observer, record);
				state.resizeObserver.active += 1;
				return observer;
			}
			WrappedResizeObserver.prototype = OriginalResizeObserver.prototype;
			Object.setPrototypeOf(WrappedResizeObserver, OriginalResizeObserver);
			globalObject.ResizeObserver = WrappedResizeObserver;
			OriginalResizeObserver.prototype.observe = function (...args) {
				state.resizeObserver.observeCalls += 1;
				return Reflect.apply(originalObserve, this, args);
			};
			OriginalResizeObserver.prototype.unobserve = function (...args) {
				state.resizeObserver.unobserveCalls += 1;
				return Reflect.apply(originalUnobserve, this, args);
			};
			OriginalResizeObserver.prototype.disconnect = function (...args) {
				state.resizeObserver.disconnectCalls += 1;
				const record = resizeRecords.get(this);
				if (record?.active) {
					record.active = false;
					state.resizeObserver.active -= 1;
				}
				return Reflect.apply(originalDisconnect, this, args);
			};
		}

		const OriginalMutationObserver = globalObject.MutationObserver;
		if (typeof OriginalMutationObserver === "function") {
			const originalObserve = OriginalMutationObserver.prototype.observe;
			const originalDisconnect = OriginalMutationObserver.prototype.disconnect;
			state.mutationObserver.availability = "measured";
			function WrappedMutationObserver(callback) {
				const record = { active: true };
				const wrappedCallback = (records, observer) =>
					callback(records, observer);
				const observer = new OriginalMutationObserver(wrappedCallback);
				mutationRecords.set(observer, record);
				state.mutationObserver.active += 1;
				return observer;
			}
			WrappedMutationObserver.prototype = OriginalMutationObserver.prototype;
			Object.setPrototypeOf(WrappedMutationObserver, OriginalMutationObserver);
			globalObject.MutationObserver = WrappedMutationObserver;
			OriginalMutationObserver.prototype.observe = function (...args) {
				return Reflect.apply(originalObserve, this, args);
			};
			OriginalMutationObserver.prototype.disconnect = function (...args) {
				const record = mutationRecords.get(this);
				if (record?.active) {
					record.active = false;
					state.mutationObserver.active -= 1;
				}
				return Reflect.apply(originalDisconnect, this, args);
			};
		}

		const eventTargetPrototype = globalObject.EventTarget?.prototype;
		if (eventTargetPrototype) {
			const originalAddEventListener = eventTargetPrototype.addEventListener;
			const originalRemoveEventListener =
				eventTargetPrototype.removeEventListener;
			eventTargetPrototype.addEventListener = function (
				type,
				listener,
				options,
			) {
				if (listener?.[harnessListener]) {
					return Reflect.apply(originalAddEventListener, this, [
						type,
						listener,
						options,
					]);
				}
				if (typeof listener === "function") {
					let targetRecords = listenerRecords.get(this);
					if (!targetRecords) {
						targetRecords = new Map();
						listenerRecords.set(this, targetRecords);
					}
					const capture =
						typeof options === "boolean" ? options : Boolean(options?.capture);
					const captures = targetRecords.get(listener) ?? new Set();
					if (!captures.has(capture)) {
						captures.add(capture);
						state.listeners.active += 1;
					}
					targetRecords.set(listener, captures);
				}
				return Reflect.apply(originalAddEventListener, this, [
					type,
					listener,
					options,
				]);
			};
			eventTargetPrototype.removeEventListener = function (
				type,
				listener,
				options,
			) {
				if (listener?.[harnessListener]) {
					return Reflect.apply(originalRemoveEventListener, this, [
						type,
						listener,
						options,
					]);
				}
				if (typeof listener === "function") {
					const targetRecords = listenerRecords.get(this);
					const capture =
						typeof options === "boolean" ? options : Boolean(options?.capture);
					const captures = targetRecords?.get(listener);
					if (captures?.delete(capture)) state.listeners.active -= 1;
					if (captures?.size === 0) targetRecords?.delete(listener);
				}
				return Reflect.apply(originalRemoveEventListener, this, [
					type,
					listener,
					options,
				]);
			};
		}

		if (typeof globalObject.PerformanceObserver === "function") {
			const supported =
				globalObject.PerformanceObserver.supportedEntryTypes ?? [];
			for (const type of ["longtask", "event"]) {
				if (!supported.includes(type)) continue;
				try {
					const observer = new globalObject.PerformanceObserver((list) => {
						for (const entry of list.getEntries()) captureEntry(entry, type);
					});
					const options =
						type === "event"
							? { type, buffered: true, durationThreshold: 16 }
							: { type, buffered: true };
					observer.observe(options);
					state.performance[type] = "measured";
				} catch {
					state.performance[type] = "unavailable";
				}
			}
		}

		function recordPresentationTime(active, event) {
			if (
				state.performance.eventPresentationTime !== "available" ||
				event.presentationTime === null ||
				!Number.isFinite(event.processingEnd) ||
				event.presentationTime < event.processingEnd
			)
				return;
			event.nextPaintTime = event.presentationTime;
			active.nextPaints.push({
				eventName: event.name,
				eventStart: event.startTime,
				processingEnd: event.processingEnd,
				paintTime: event.presentationTime,
				latencyMs: event.presentationTime - event.startTime,
			});
		}

		function sampleFrame(timestamp) {
			const active = state.active;
			if (!active?.sampling || !originalRaf) return;
			active.frameSamples.push(timestamp);
			originalRaf(sampleFrame);
		}

		function hasBackdropBlur(style) {
			return ["backdrop-filter", "-webkit-backdrop-filter"].some((name) =>
				style.getPropertyValue(name).includes("blur"),
			);
		}

		function rootSnapshot() {
			const root = document.documentElement;
			const values = Object.fromEntries(
				styleNames.map((name) => [
					name,
					getComputedStyle(root).getPropertyValue(name).trim(),
				]),
			);
			const slot = document.querySelector("[data-settings-sidebar-slot]");
			const panel = document.querySelector('[data-settings-panel="true"]');
			const slider = document.querySelector(
				'[role="slider"][aria-label="Glass intensity"]',
			);
			const target = [...document.querySelectorAll("div")].find((element) => {
				const style = getComputedStyle(element);
				return hasBackdropBlur(style);
			});
			return {
				cssVariables: values,
				material: root.dataset.kliceMaterial ?? null,
				theme: root.classList.contains("dark")
					? "dark"
					: root.classList.contains("light")
						? "light"
						: null,
				sliderValue: slider?.getAttribute("aria-valuenow") ?? null,
				settings: {
					slotConnected: Boolean(slot?.isConnected),
					panelConnected: Boolean(panel?.isConnected),
					open: slot?.getAttribute("data-settings-open") ?? null,
					layoutOpen: slot?.getAttribute("data-settings-layout-open") ?? null,
					ariaHidden: slot?.getAttribute("aria-hidden") ?? null,
					inert: Boolean(slot?.inert),
					heavyDescendantCount: panel?.querySelectorAll("*").length ?? null,
					focusId: document.activeElement?.id ?? null,
				},
				refractiveTarget: target
					? {
							width: Math.round(target.getBoundingClientRect().width),
							height: Math.round(target.getBoundingClientRect().height),
						}
					: null,
				activeListeners: state.listeners.active,
				activeResizeObservers: state.resizeObserver.active,
				activeMutationObservers: state.mutationObserver.active,
			};
		}

		function counterSnapshot() {
			return {
				canvas: { ...state.canvas },
				resizeObserver: { ...state.resizeObserver },
				listeners: { ...state.listeners },
			};
		}

		function subtractCounters(start, end) {
			const subtract = (startValue, endValue) => endValue - startValue;
			return {
				canvas: {
					availability: end.canvas.availability,
					toDataURLCalls: subtract(
						start.canvas.toDataURLCalls,
						end.canvas.toDataURLCalls,
					),
					createImageDataCalls: subtract(
						start.canvas.createImageDataCalls,
						end.canvas.createImageDataCalls,
					),
					putImageDataCalls: subtract(
						start.canvas.putImageDataCalls,
						end.canvas.putImageDataCalls,
					),
					durationMs: subtract(start.canvas.durationMs, end.canvas.durationMs),
				},
				resizeObserver: {
					availability: end.resizeObserver.availability,
					constructors: subtract(
						start.resizeObserver.constructors,
						end.resizeObserver.constructors,
					),
					observeCalls: subtract(
						start.resizeObserver.observeCalls,
						end.resizeObserver.observeCalls,
					),
					unobserveCalls: subtract(
						start.resizeObserver.unobserveCalls,
						end.resizeObserver.unobserveCalls,
					),
					disconnectCalls: subtract(
						start.resizeObserver.disconnectCalls,
						end.resizeObserver.disconnectCalls,
					),
					callbackCalls: subtract(
						start.resizeObserver.callbackCalls,
						end.resizeObserver.callbackCalls,
					),
					durationMs: subtract(
						start.resizeObserver.durationMs,
						end.resizeObserver.durationMs,
					),
					active: end.resizeObserver.active,
				},
			};
		}

		let rootObserver = null;
		if (OriginalMutationObserver) {
			try {
				rootObserver = new OriginalMutationObserver((records) => {
					if (!state.active) return;
					state.active.rootStyleSamplerCallbacks += 1;
					for (const record of records) {
						if (
							record.target === document.documentElement &&
							record.attributeName === "style"
						) {
							state.active.rootStyleMutations += 1;
						}
						if (
							record.target instanceof Element &&
							record.attributeName === "aria-valuenow" &&
							record.target.matches('[role="slider"]')
						) {
							state.active.sliderValueMutations += 1;
						}
					}
				});
				OriginalMutationObserver.prototype.observe.call(
					rootObserver,
					document.documentElement,
					{ attributes: true, subtree: true },
				);
				state.rootStyle.availability = "measured";
			} catch {
				state.rootStyle.availability = "unavailable";
			}
		}
		const pointerMoveListener = markHarness((event) => {
			if (!state.active) return;
			if (
				event.target instanceof Element &&
				event.target.closest('[role="slider"]')
			)
				state.active.pointerMoves += 1;
		});
		const inputListener = markHarness((event) => {
			if (!state.active) return;
			if (
				event.target instanceof Element &&
				event.target.closest('[role="slider"]')
			)
				state.active.sliderInputEvents += 1;
		});
		eventTargetPrototype
			? globalObject.EventTarget.prototype.addEventListener.call(
					document,
					"pointermove",
					pointerMoveListener,
					true,
				)
			: null;
		eventTargetPrototype
			? globalObject.EventTarget.prototype.addEventListener.call(
					document,
					"input",
					inputListener,
					true,
				)
			: null;

		const reactHook = globalObject.__REACT_DEVTOOLS_GLOBAL_HOOK__ ?? {
			inject: () => 0,
			onCommitFiberRoot: () => undefined,
			onCommitFiberUnmount: () => undefined,
		};
		let rendererId = 0;
		const originalInject = reactHook.inject;
		const originalCommit = reactHook.onCommitFiberRoot;
		try {
			reactHook.supportsFiber = true;
			reactHook.inject = (renderer) => {
				state.react.rendererSeen = true;
				state.react.availability = "root-commits-only";
				const id =
					typeof originalInject === "function"
						? originalInject(renderer)
						: rendererId + 1;
				rendererId = Number.isFinite(id) ? id : rendererId + 1;
				return rendererId;
			};
			reactHook.onCommitFiberRoot = (id, root, priority) => {
				state.react.rootCommits += 1;
				if (state.active) state.active.reactRootCommits += 1;
				if (typeof originalCommit === "function")
					originalCommit(id, root, priority);
			};
			globalObject.__REACT_DEVTOOLS_GLOBAL_HOOK__ = reactHook;
		} catch {
			state.react.availability = "unavailable";
		}

		globalObject.__liquidGlassHarness = {
			startInteraction(name) {
				if (state.active) throw new Error("An interaction is already active");
				const started = performance.now();
				state.active = {
					name,
					started,
					frameSamples: [],
					sampling: true,
					longtasks: [],
					events: [],
					nextPaints: [],
					rootStyleMutations: 0,
					rootStyleSamplerCallbacks: 0,
					sliderValueMutations: 0,
					sliderInputEvents: 0,
					pointerMoves: 0,
					reactRootCommits: 0,
					counters: counterSnapshot(),
				};
				if (originalRaf) originalRaf(sampleFrame);
				try {
					performance.mark(`liquid-glass-${name}-start`);
				} catch {}
			},
			markInput(name) {
				const active = state.active;
				if (!active) return;
				try {
					performance.mark(`liquid-glass-${active.name}-${name}`);
				} catch {}
			},
			stopInteraction() {
				const active = state.active;
				if (!active) throw new Error("No interaction is active");
				active.sampling = false;
				const ended = performance.now();
				const counters = counterSnapshot();
				try {
					performance.mark(`liquid-glass-${active.name}-end`);
					performance.measure(
						`liquid-glass-${active.name}`,
						`liquid-glass-${active.name}-start`,
						`liquid-glass-${active.name}-end`,
					);
				} catch {}
				const result = {
					name: active.name,
					started: active.started,
					ended,
					durationMs: ended - active.started,
					frameSamples: active.frameSamples,
					longtasks: active.longtasks,
					events: active.events,
					nextPaints: active.nextPaints,
					rootStyleMutations: active.rootStyleMutations,
					rootStyleSamplerCallbacks: active.rootStyleSamplerCallbacks,
					sliderValueMutations: active.sliderValueMutations,
					sliderInputEvents: active.sliderInputEvents,
					pointerMoves: active.pointerMoves,
					reactRootCommits: active.reactRootCommits,
					counters: subtractCounters(active.counters, counters),
					settled: rootSnapshot(),
					capabilities: {
						frameSampler: { ...state.frameSampler },
						performance: { ...state.performance },
						rootStyle: { ...state.rootStyle },
						react: { ...state.react },
						mutationObserver: { ...state.mutationObserver },
						listeners: { ...state.listeners },
					},
				};
				state.active = null;
				return result;
			},
			getCapabilities() {
				return {
					frameSampler: { ...state.frameSampler },
					canvas: { ...state.canvas },
					resizeObserver: { ...state.resizeObserver },
					mutationObserver: { ...state.mutationObserver },
					performance: { ...state.performance },
					rootStyle: { ...state.rootStyle },
					react: { ...state.react },
				};
			},
		};
	})();
}

function serializedPageInitScript() {
	return `(${pageInitScript.toString()})(${JSON.stringify(GLASS_VARIABLES)})`;
}

function getExecutable(browser, explicit) {
	if (explicit) return explicit;
	const candidates =
		browser === "chrome"
			? [
					// biome-ignore lint/suspicious/noUndeclaredEnvVars: the harness accepts an optional local browser override.
					process.env.CHROME_PATH,
					"C:/Program Files/Google/Chrome/Application/chrome.exe",
					"C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
					"C:/Users/joao/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe",
					"/usr/bin/google-chrome",
					"/usr/bin/chromium",
					"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
				]
			: [
					// biome-ignore lint/suspicious/noUndeclaredEnvVars: the harness accepts an optional local browser override.
					process.env.FIREFOX_PATH,
					"C:/Program Files/Mozilla Firefox/firefox.exe",
					"C:/Program Files (x86)/Mozilla Firefox/firefox.exe",
					"/usr/bin/firefox",
					"/Applications/Firefox.app/Contents/MacOS/firefox",
				];
	for (const candidate of candidates) {
		if (candidate && existsSync(candidate)) return candidate;
	}
	throw new HarnessError(
		`No ${browser} executable was supplied or found; pass --executable or use --manual`,
		"environment",
	);
}

async function loadPlaywright() {
	const packageNames = ["playwright-core", "playwright"];
	for (const packageName of packageNames) {
		try {
			return await import(packageName);
		} catch {}
	}
	// biome-ignore lint/suspicious/noUndeclaredEnvVars: the harness accepts an optional local runtime override.
	const explicitPath = process.env.PLAYWRIGHT_CORE_PATH;
	if (explicitPath) {
		try {
			return await import(pathToFileURL(resolve(explicitPath)).href);
		} catch (error) {
			throw new HarnessError(
				`PLAYWRIGHT_CORE_PATH could not be loaded: ${redactMessage(error.message)}`,
				"environment",
			);
		}
	}
	throw new HarnessError(
		"No Playwright package is installed; install/use an existing local Playwright runtime or use --manual",
		"environment",
	);
}

function extensionOriginFromUrl(value) {
	let parsed;
	try {
		parsed = new URL(value);
	} catch {
		return null;
	}
	if (
		!["chrome-extension:", "moz-extension:"].includes(parsed.protocol) ||
		!parsed.hostname ||
		parsed.username ||
		parsed.password ||
		parsed.port ||
		parsed.host !== parsed.hostname ||
		!/^[A-Za-z0-9-]+$/.test(parsed.hostname)
	) {
		return null;
	}
	return `${parsed.protocol}//${parsed.hostname}`;
}

async function waitForExtensionOrigin(context, browser, timeoutMs = 12000) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		const pages = context.pages();
		const workers =
			typeof context.serviceWorkers === "function"
				? context.serviceWorkers()
				: [];
		const backgroundPages =
			typeof context.backgroundPages === "function"
				? context.backgroundPages()
				: [];
		const urls = [
			...pages.map((page) => page.url()),
			...workers.map((worker) => worker.url()),
			...backgroundPages.map((page) => page.url()),
		];
		const origin = urls.map(extensionOriginFromUrl).find(Boolean);
		if (origin) return origin;
		await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
	}
	if (browser === "firefox") {
		throw new HarnessError(
			`Firefox automatic extension loading is unavailable: no extension origin appeared within ${timeoutMs} ms after Playwright passed -install-addon; Firefox reports that flag as unrecognized in this environment. Use --manual`,
			"extension-loading",
		);
	}
	throw new HarnessError(
		`The ${browser} browser did not expose a loaded extension page or background worker; automatic extension loading is unavailable`,
		"extension-loading",
	);
}

async function readLoadedManifest(context, origin) {
	const page = await context.newPage();
	try {
		await page.goto(`${origin}/manifest.json`, {
			waitUntil: "domcontentloaded",
		});
		const manifest = await page.evaluate(async () => {
			const response = await fetch("manifest.json");
			return response.json();
		});
		if (!manifest?.chrome_url_overrides?.newtab) {
			throw new HarnessError(
				"Loaded manifest has no chrome_url_overrides.newtab entry",
				"extension",
			);
		}
		return manifest;
	} finally {
		await page.close();
	}
}

async function launchBrowser(
	playwright,
	row,
	options,
	extensionPath,
	outputRoot,
) {
	const browserType =
		row.browser === "chrome" ? playwright.chromium : playwright.firefox;
	if (!browserType)
		throw new HarnessError(
			`Playwright has no ${row.browser} browser adapter`,
			"environment",
		);
	if (row.browser === "firefox" && !options.firefoxAddon) {
		throw new HarnessError(
			"Firefox automatic extension loading is unavailable without --firefox-addon <xpi>; use --manual",
			"extension-loading",
		);
	}
	if (row.browser === "firefox" && !existsSync(options.firefoxAddon)) {
		throw new HarnessError(
			`Firefox add-on archive was not found at ${options.firefoxAddon}; use --manual`,
			"extension-loading",
		);
	}
	const executablePath = getExecutable(row.browser, options.executable);
	const profilePath = await mkdtemp(join(tmpdir(), "klice-liquid-glass-"));
	const args =
		row.browser === "chrome"
			? [
					`--disable-extensions-except=${extensionPath}`,
					`--load-extension=${extensionPath}`,
					"--disable-background-networking",
					"--disable-component-update",
					"--disable-default-apps",
					"--no-first-run",
					"--no-default-browser-check",
				]
			: ["-install-addon", options.firefoxAddon];
	const contextOptions = {
		headless: !options.headed,
		executablePath,
		viewport: VIEWPORT,
		deviceScaleFactor: 1,
		args,
		...(row.browser === "firefox"
			? { timeout: FIREFOX_LAUNCH_TIMEOUT_MS }
			: {}),
	};
	if (row.browser === "firefox") {
		contextOptions.firefoxUserPrefs = {
			"xpinstall.signatures.required": false,
			"extensions.autoDisableScopes": 0,
			"extensions.enabledScopes": 15,
		};
	}
	let context;
	try {
		context = await browserType.launchPersistentContext(
			profilePath,
			contextOptions,
		);
		const origin = await waitForExtensionOrigin(
			context,
			row.browser,
			row.browser === "firefox" ? FIREFOX_EXTENSION_ORIGIN_TIMEOUT_MS : 12000,
		);
		const manifest = await readLoadedManifest(context, origin);
		const extensionPage = await context.newPage();
		const newtabPath = String(manifest.chrome_url_overrides.newtab).replace(
			/^\/+/,
			"",
		);
		const newtabUrl = `${origin}/${newtabPath}`;
		await context.addInitScript({ content: serializedPageInitScript() });
		const blockedExternalRequests = [];
		await context.route("**/*", async (route) => {
			const requestUrl = route.request().url();
			if (requestUrl.startsWith(origin)) {
				await route.continue();
				return;
			}
			blockedExternalRequests.push({
				resourceType: route.request().resourceType(),
			});
			await route.abort();
		});
		const pageErrors = [];
		extensionPage.on("pageerror", (error) =>
			pageErrors.push(redactMessage(error.message)),
		);
		await extensionPage.goto(newtabUrl, { waitUntil: "domcontentloaded" });
		await waitForReady(extensionPage);
		return {
			context,
			page: extensionPage,
			origin,
			manifest,
			newtabUrl,
			blockedExternalRequests,
			pageErrors,
			profilePath,
			traceClient: null,
			outputRoot,
		};
	} catch (error) {
		if (context) await context.close().catch(() => undefined);
		await rm(profilePath, { recursive: true, force: true }).catch(
			() => undefined,
		);
		if (error instanceof HarnessError) throw error;
		if (
			row.browser === "firefox" &&
			(error.name === "TimeoutError" ||
				String(error.message).includes("launchPersistentContext: Timeout"))
		) {
			throw new HarnessError(
				`Firefox automatic extension loading is unavailable: this Firefox executable did not expose an extension origin within ${FIREFOX_LAUNCH_TIMEOUT_MS} ms after Playwright passed -install-addon. Firefox reports that flag as unrecognized; use --manual`,
				"extension-loading",
			);
		}
		throw new HarnessError(
			`Could not launch ${row.browser}: ${redactMessage(error.message)}`,
			"environment",
		);
	}
}

async function waitForReady(page) {
	await page.waitForFunction(
		() =>
			document.querySelector("#bg-layer") &&
			document.querySelector("#settings-trigger"),
		undefined,
		{ timeout: 12000 },
	);
	await page.waitForTimeout(500);
}

async function seedPage(page, row) {
	const fixture = buildFixture(row);
	await page.evaluate(async (value) => {
		const payload = JSON.stringify({ state: value, version: 0 });
		const chromeStorage = globalThis.chrome?.storage?.local;
		const browserStorage = globalThis.browser?.storage?.local;
		const storage = chromeStorage ?? browserStorage;
		if (storage) {
			await storage.clear();
			await storage.set({ "perch-setup": payload });
			return;
		}
		localStorage.clear();
		localStorage.setItem("perch-setup", payload);
	}, fixture);
	await page.reload({ waitUntil: "domcontentloaded" });
	await waitForReady(page);
	await page.waitForTimeout(350);
}

async function visibleLocator(page, selectorOrLocator) {
	const locator =
		typeof selectorOrLocator === "string"
			? page.locator(selectorOrLocator)
			: selectorOrLocator;
	const label =
		typeof selectorOrLocator === "string" ? selectorOrLocator : "locator";
	const count = await locator.count();
	for (let index = 0; index < count; index += 1) {
		const candidate = locator.nth(index);
		if (await candidate.isVisible().catch(() => false)) return candidate;
	}
	throw new HarnessError(`Visible selector not found: ${label}`, "interaction");
}

async function namedButton(page, name) {
	const byRole = page.getByRole("button", { name, exact: true });
	if (await byRole.count()) {
		for (let index = 0; index < (await byRole.count()); index += 1) {
			const candidate = byRole.nth(index);
			if (await candidate.isVisible().catch(() => false)) return candidate;
		}
	}
	return visibleLocator(page, `button[aria-label="${name}"]`);
}

async function textButton(page, name) {
	const byRole = page.getByRole("button", { name, exact: true });
	if (await byRole.count()) {
		for (let index = 0; index < (await byRole.count()); index += 1) {
			const candidate = byRole.nth(index);
			if (await candidate.isVisible().catch(() => false)) return candidate;
		}
	}
	const candidates = page.locator("button").filter({ hasText: name });
	return visibleLocator(page, candidates);
}

async function markInput(page, name) {
	await page.evaluate(
		(value) => globalThis.__liquidGlassHarness?.markInput(value),
		name,
	);
}

async function openSettings(page, mark = true) {
	const trigger = await visibleLocator(page, "#settings-trigger");
	const openSlot = page.locator(
		'[data-settings-sidebar-slot][data-settings-open="true"]',
	);
	if (await openSlot.count()) return;
	if (mark) await markInput(page, "settings-open");
	await trigger.click();
	await openSlot.waitFor({ state: "attached", timeout: 5000 });
	await page.waitForTimeout(360);
	if ((await openSlot.getAttribute("data-settings-open")) !== "true") {
		throw new HarnessError(
			"Settings did not reach the open state",
			"interaction",
		);
	}
}

async function closeSettings(page) {
	const openSlot = page.locator(
		'[data-settings-sidebar-slot][data-settings-open="true"]',
	);
	if (!(await openSlot.count()))
		throw new HarnessError("Settings was not open before close", "interaction");
	const close = await namedButton(page, "Close preferences");
	await markInput(page, "settings-close");
	await close.click();
	await openSlot.waitFor({ state: "detached", timeout: 5000 });
	await page.waitForTimeout(500);
	const slot = page.locator("[data-settings-sidebar-slot]");
	if ((await slot.getAttribute("data-settings-open")) !== "false") {
		throw new HarnessError(
			"Settings did not reach the closed state",
			"interaction",
		);
	}
}

async function scenarioIdle(page) {
	await page.waitForTimeout(1000);
}

async function scenarioIntensityDrag(page) {
	await openSettings(page);
	const fieldset = await visibleLocator(
		page,
		'fieldset[aria-label="Glass intensity slider"]',
	);
	const track = fieldset.locator(":scope > div").first();
	const box = await track.boundingBox();
	if (!box || box.width < 40 || box.height < 10)
		throw new HarnessError(
			"Glass intensity track has no usable geometry",
			"interaction",
		);
	const y = box.y + box.height / 2;
	const left = box.x;
	const right = box.x + box.width;
	await page.mouse.move(left, y);
	await markInput(page, "intensity-pointer-down");
	await page.mouse.down();
	const started = Date.now();
	const moveCount = POINTER_HZ;
	for (let index = 0; index <= moveCount; index += 1) {
		const targetTime = (index / moveCount) * DRAG_DURATION_MS;
		const elapsed = Date.now() - started;
		if (targetTime > elapsed) await page.waitForTimeout(targetTime - elapsed);
		const progress =
			index <= moveCount / 2
				? index / (moveCount / 2)
				: 1 - (index - moveCount / 2) / (moveCount / 2);
		await page.mouse.move(left + (right - left) * progress, y);
	}
	await markInput(page, "intensity-pointer-up");
	await page.mouse.up();
	await page.waitForTimeout(450);
	const finalValue = await page
		.locator('[role="slider"][aria-label="Glass intensity"]')
		.getAttribute("aria-valuenow");
	if (finalValue !== "0")
		throw new HarnessError(
			`Intensity terminal value was ${finalValue}, expected 0`,
			"interaction",
		);
	await closeSettings(page);
	return { settingsClosed: true, slider: true };
}

async function scenarioSettingsOpen(page) {
	const slot = page.locator("[data-settings-sidebar-slot]");
	await slot.waitFor({ state: "attached", timeout: 5000 });
	const before = await slot.getAttribute("data-settings-open");
	if (before !== "false")
		throw new HarnessError(
			`Settings open precondition was ${before ?? "missing"}, expected false`,
			"interaction",
		);
	await openSettings(page);
	const open = page.locator(
		'[data-settings-sidebar-slot][data-settings-open="true"]',
	);
	if (!(await open.count()))
		throw new HarnessError("Settings open assertion failed", "interaction");
	return { settingsOpenAfter: "true", settingsOpenBefore: before };
}

async function scenarioSettingsClose(page) {
	await openSettings(page, false);
	await closeSettings(page);
	const focusId = await page.evaluate(() => document.activeElement?.id ?? null);
	if (focusId !== "settings-trigger")
		throw new HarnessError(
			`Settings focus restored to ${focusId ?? "nothing"}`,
			"interaction",
		);
}

async function scenarioPaneNavigation(page) {
	await openSettings(page);
	const visited = ["root"];
	const inline = await page.evaluate(() => ({
		general: Boolean(
			document.querySelector(
				'[data-settings-panel="true"] [aria-label="Show clock"]',
			),
		),
		search: Boolean(
			document.querySelector(
				'[data-settings-panel="true"] [aria-label="Show search bar"]',
			),
		),
		appearance: Boolean(
			document.querySelector(
				'[data-settings-panel="true"] fieldset[aria-label="Glass intensity slider"]',
			),
		),
	}));
	const bookmarks = await textButton(page, "Manage bookmarks");
	await markInput(page, "pane-bookmarks");
	await bookmarks.click();
	await page.waitForTimeout(350);
	visited.push("bookmarks");
	await (await namedButton(page, "Back to Preferences")).click();
	await page.waitForTimeout(350);
	const advanced = await textButton(page, "Advanced");
	await markInput(page, "pane-advanced");
	await advanced.click();
	await page.waitForTimeout(350);
	visited.push("advanced");
	await (await namedButton(page, "Back to Preferences")).click();
	await page.waitForTimeout(350);
	const wallpaper = await visibleLocator(
		page,
		'button[aria-label^="Change wallpaper"]',
	);
	await markInput(page, "pane-wallpaper");
	await wallpaper.click();
	await page.waitForTimeout(350);
	visited.push("wallpaper");
	await (await namedButton(page, "Back to Preferences")).click();
	await page.waitForTimeout(350);
	await closeSettings(page);
	return { visited, inline };
}

async function scenarioSearch(page) {
	const input = await visibleLocator(page, "[data-unified-search-input]");
	await markInput(page, "search-open");
	await input.click();
	const shell = page.locator('[data-unified-search][data-search-open="true"]');
	await shell.waitFor({ state: "attached", timeout: 5000 });
	await markInput(page, "search-type");
	await page.keyboard.type(QUERY);
	if ((await input.inputValue()) !== QUERY)
		throw new HarnessError(
			"Keyboard search input did not receive the fixed query",
			"interaction",
		);
	await page.waitForTimeout(260);
	await markInput(page, "search-close");
	await page.keyboard.press("Escape");
	await shell.waitFor({ state: "detached", timeout: 5000 });
	await page.waitForTimeout(240);
	if (
		(await page
			.locator("[data-unified-search]")
			.getAttribute("data-search-open")) !== "false"
	) {
		throw new HarnessError(
			"Search did not reach the closed state",
			"interaction",
		);
	}
}

async function scenarioCardContextMenu(page) {
	const card = await visibleLocator(page, "a[data-local-context-menu]");
	await markInput(page, "card-context-open");
	await card.click({ button: "right" });
	const openPortal = page.locator(
		'[data-context-menu-portal][aria-hidden="false"]',
	);
	await openPortal
		.locator('[role="menu"]')
		.waitFor({ state: "visible", timeout: 5000 });
	await markInput(page, "card-context-close");
	await page.keyboard.press("Escape");
	await page.waitForFunction(
		() =>
			![...document.querySelectorAll("[data-context-menu-portal]")].some(
				(element) => element.getAttribute("aria-hidden") === "false",
			),
		undefined,
		{ timeout: 5000 },
	);
	await page.waitForTimeout(350);
	if (
		await page
			.locator('[data-context-menu-portal][aria-hidden="false"]')
			.count()
	) {
		throw new HarnessError(
			"Card context menu did not reach the closed state",
			"interaction",
		);
	}
}

async function scenarioPopover(page) {
	const trigger = await namedButton(page, "More folders");
	await markInput(page, "popover-open");
	await trigger.click();
	const portal = await visibleLocator(page, "[data-morph-popover-portal]");
	await markInput(page, "popover-close");
	await page.keyboard.press("Escape");
	await portal.waitFor({ state: "detached", timeout: 5000 });
	await page.waitForTimeout(400);
	if (await page.locator("[data-morph-popover-portal]").count()) {
		throw new HarnessError(
			"Folder popover did not reach the closed state",
			"interaction",
		);
	}
}

async function scenarioExpandable(page) {
	await openSettings(page);
	const clock = await visibleLocator(page, '[aria-label="Show clock"]');
	for (let cycle = 0; cycle < 2; cycle += 1) {
		await markInput(page, `expand-collapse-${cycle + 1}-collapse`);
		await clock.click();
		await page.waitForTimeout(300);
		await markInput(page, `expand-collapse-${cycle + 1}-expand`);
		await clock.click();
		await page.waitForTimeout(300);
	}
	const region = page.locator('[role="region"][aria-label="Clock options"]');
	if (!(await region.count()))
		throw new HarnessError(
			"Clock expandable did not return to expanded state",
			"interaction",
		);
	await closeSettings(page);
}

async function scenarioResize(page) {
	await openSettings(page);
	const before = await page.evaluate(() => {
		const target = [...document.querySelectorAll("div")].find((element) => {
			const style = getComputedStyle(element);
			return ["backdrop-filter", "-webkit-backdrop-filter"].some((name) =>
				style.getPropertyValue(name).includes("blur"),
			);
		});
		if (!target) return null;
		const rect = target.getBoundingClientRect();
		return { width: rect.width, height: rect.height };
	});
	if (!before)
		throw new HarnessError(
			"No refractive inline surface was found before resize",
			"interaction",
		);
	await page.setViewportSize({
		width: VIEWPORT.width - 37,
		height: VIEWPORT.height,
	});
	await page.waitForTimeout(180);
	const resized = await page.evaluate(() => {
		const element = [...document.querySelectorAll("div")].find((candidate) => {
			const style = getComputedStyle(candidate);
			return ["backdrop-filter", "-webkit-backdrop-filter"].some((name) =>
				style.getPropertyValue(name).includes("blur"),
			);
		});
		return element
			? {
					width: Math.round(element.getBoundingClientRect().width),
					height: Math.round(element.getBoundingClientRect().height),
				}
			: null;
	});
	await page.setViewportSize(VIEWPORT);
	await page.waitForTimeout(450);
	if (
		!resized ||
		(Math.round(before.width) === resized.width &&
			Math.round(before.height) === resized.height)
	) {
		throw new HarnessError(
			"Viewport resize did not change a refractive element's integer geometry",
			"interaction",
		);
	}
	await closeSettings(page);
	return {
		before: {
			width: Math.round(before.width),
			height: Math.round(before.height),
		},
		resized,
	};
}

const SCENARIO_ACTIONS = {
	idle: { action: scenarioIdle, checkpointDuration: 1000 },
	"intensity-drag": {
		action: scenarioIntensityDrag,
		checkpointDuration: DRAG_DURATION_MS,
	},
	"settings-open": { action: scenarioSettingsOpen, checkpointDuration: 500 },
	"settings-close": { action: scenarioSettingsClose, checkpointDuration: 900 },
	"settings-pane-navigation": {
		action: scenarioPaneNavigation,
		checkpointDuration: 1400,
	},
	"search-open-type-close": { action: scenarioSearch, checkpointDuration: 900 },
	"card-context-menu": {
		action: scenarioCardContextMenu,
		checkpointDuration: 700,
	},
	"trigger-popover": { action: scenarioPopover, checkpointDuration: 700 },
	"settings-expandable": {
		action: scenarioExpandable,
		checkpointDuration: 1600,
	},
	"resize-lens": { action: scenarioResize, checkpointDuration: 1100 },
};

async function captureCheckpoints(
	page,
	directory,
	caseId,
	runNumber,
	scenario,
	duration,
) {
	const checkpoints = [];
	const captures = Array.from(
		{ length: 10 },
		(_, index) =>
			new Promise((resolvePromise) => {
				setTimeout(
					async () => {
						const filePath = join(
							directory,
							`${caseId}-run-${runNumber}-${scenario}-checkpoint-${String(index + 1).padStart(2, "0")}.png`,
						);
						try {
							await page.screenshot({ path: filePath });
							checkpoints.push({
								index: index + 1,
								kind: "motion-checkpoint",
								path: relativeOutputPath(DEFAULT_OUTPUT, filePath),
								status: "captured",
							});
						} catch (error) {
							checkpoints.push({
								index: index + 1,
								kind: "motion-checkpoint",
								status: "unavailable",
								reason: redactMessage(error.message),
							});
						}
						resolvePromise();
					},
					Math.round((duration * (index + 1)) / 10),
				);
			}),
	);
	await Promise.all(captures);
	return checkpoints.sort((left, right) => left.index - right.index);
}

function frameMetric(snapshot) {
	const duration = snapshot.durationMs;
	const frameSamples = (snapshot.frameSamples ?? []).filter((sample) =>
		Number.isFinite(sample),
	);
	if (snapshot.capabilities.frameSampler?.availability !== "available") {
		return unavailableMetric(
			"requestAnimationFrame is unavailable",
			"requestAnimationFrame-sampler",
		);
	}
	if (frameSamples.length < 2) {
		return unavailableMetric(
			"requestAnimationFrame sampler produced fewer than two samples",
			"requestAnimationFrame-sampler",
		);
	}
	const intervals = frameSamples
		.slice(1)
		.map((timestamp, index) => timestamp - frameSamples[index])
		.filter((interval) => Number.isFinite(interval));
	if (intervals.length === 0) {
		return unavailableMetric(
			"requestAnimationFrame sampler produced no interval samples",
			"requestAnimationFrame-sampler",
		);
	}
	const expected = Math.max(1, Math.floor((duration * FRAME_RATE) / 1000));
	const observed = frameSamples.length;
	const dropped = Math.max(0, expected - observed);
	return {
		status: "measured",
		sampleDefinition:
			"rAF callback timestamps occurring while the interaction is active",
		method: "requestAnimationFrame callback samples during the active window",
		interval: summarize(intervals, "requestAnimationFrame timestamp deltas"),
		expectedFrames: expected,
		observedFrames: observed,
		droppedFrames: dropped,
		droppedFrameRatio: round(dropped / expected),
	};
}

function rootStyleMetric(snapshot) {
	const sampler = snapshot.capabilities.rootStyle;
	if (sampler?.availability !== "measured") {
		return unavailableMetric(
			"documentElement style MutationObserver is unavailable",
			"MutationObserver:documentElement-style",
		);
	}
	if (snapshot.rootStyleMutations === 0) {
		return unavailableMetric(
			"documentElement style sampler produced no style mutations",
			"MutationObserver:documentElement-style",
		);
	}
	return {
		status: "measured",
		method: "MutationObserver:documentElement-style",
		samplerCallbacks: snapshot.rootStyleSamplerCallbacks,
		mutations: snapshot.rootStyleMutations,
	};
}

function makeSample(snapshot, details, screenshots, checkpoints) {
	const longtaskSamples = snapshot.longtasks.filter((entry) =>
		Number.isFinite(entry.duration),
	);
	const longtaskMetric =
		snapshot.capabilities.performance.longtask === "measured" &&
		longtaskSamples.length > 0
			? {
					status: "measured",
					method: "PerformanceObserver:longtask",
					count: longtaskSamples.length,
					totalMs: round(
						longtaskSamples.reduce((total, entry) => total + entry.duration, 0),
					),
					p95Ms: round(
						percentile(
							longtaskSamples.map((entry) => entry.duration),
							0.95,
						),
					),
				}
			: unavailableMetric(
					snapshot.capabilities.performance.longtask === "measured"
						? "PerformanceObserver longtask observer produced no samples"
						: "PerformanceObserver longtask entries are unsupported",
					"PerformanceObserver:longtask",
				);
	const eventSamples = snapshot.events.filter((entry) =>
		Number.isFinite(entry.duration),
	);
	const eventMetric =
		snapshot.capabilities.performance.event === "measured" &&
		eventSamples.length > 0
			? {
					status: "measured",
					method: "PerformanceObserver:event entry duration",
					entries: eventSamples.length,
					p95DurationMs: round(
						percentile(
							eventSamples.map((entry) => entry.duration),
							0.95,
						),
					),
				}
			: unavailableMetric(
					snapshot.capabilities.performance.event === "measured"
						? "PerformanceObserver event observer produced no samples"
						: "PerformanceObserver event entries are unsupported",
					"PerformanceObserver:event",
				);
	const presentationTimeCapability =
		snapshot.capabilities.performance.eventPresentationTime;
	const presentationSamples = snapshot.nextPaints.filter((sample) =>
		Number.isFinite(sample.latencyMs),
	);
	const nextPaint =
		snapshot.capabilities.performance.event === "measured" &&
		presentationTimeCapability === "available" &&
		presentationSamples.length > 0
			? summarize(
					presentationSamples.map((sample) => sample.latencyMs),
					"PerformanceEventTiming.presentationTime",
				)
			: unavailableMetric(
					presentationTimeCapability !== "available"
						? (snapshot.capabilities.performance.eventPresentationTimeReason ??
								"PerformanceEventTiming.presentationTime is unavailable")
						: snapshot.capabilities.performance.event !== "measured"
							? "PerformanceEventTiming event entries are unsupported"
							: "PerformanceEventTiming produced no finite presentationTime samples",
					"PerformanceEventTiming.presentationTime",
				);
	const react =
		snapshot.capabilities.react.rendererSeen && snapshot.reactRootCommits > 0
			? {
					status: "measured",
					method: "React DevTools global hook",
					rootCommits: snapshot.reactRootCommits,
					componentCommits: unavailableMetric(
						"Production build exposes root commits only; component Profiler data is unavailable",
						"React-DevTools-root-hook",
					),
				}
			: {
					status: "unavailable",
					rootCommits: unavailableMetric(
						snapshot.capabilities.react.rendererSeen
							? "React DevTools hook exposed no commits in the active interaction"
							: "React renderer did not expose a DevTools hook",
						"React-DevTools-root-hook",
					),
					componentCommits: unavailableMetric(
						"React renderer did not expose a DevTools hook",
						"React-DevTools-root-hook",
					),
				};
	const slider =
		details?.slider &&
		(snapshot.pointerMoves > 0 ||
			snapshot.sliderInputEvents > 0 ||
			snapshot.sliderValueMutations > 0)
			? {
					status: "measured",
					method:
						"captured pointermove and aria-valuenow mutations; callback body is not externally observable",
					pointerMoves: snapshot.pointerMoves,
					observableValueUpdates: snapshot.sliderValueMutations,
					inputEvents: snapshot.sliderInputEvents,
					onValueChangeDeliveries: unavailableMetric(
						"Application callback delivery is not externally observable in a production build",
						"production-callback-boundary",
					),
					finalValue: snapshot.settled.sliderValue,
					expectedFinalValue: "0",
					finalValueExact: snapshot.settled.sliderValue === "0",
				}
			: unavailableMetric(
					details?.slider
						? "Slider instrumentation produced no samples"
						: "Slider stream is not the active interaction",
					"slider-only",
				);
	return {
		durationMs: round(snapshot.durationMs),
		frameBudget: frameMetric(snapshot),
		nextPaint,
		longTasks: longtaskMetric,
		eventEntries: eventMetric,
		rootStyleMutations: rootStyleMetric(snapshot),
		slider,
		canvas:
			snapshot.counters.canvas.availability === "measured" &&
			snapshot.counters.canvas.toDataURLCalls +
				snapshot.counters.canvas.createImageDataCalls +
				snapshot.counters.canvas.putImageDataCalls >
				0
				? {
						status: "measured",
						method: "page-init canvas shim",
						...snapshot.counters.canvas,
					}
				: unavailableMetric(
						snapshot.counters.canvas.availability === "measured"
							? "Canvas instrumentation produced no calls"
							: "Canvas instrumentation API is unavailable",
						"page-init-canvas-shim",
					),
		resizeObserver:
			snapshot.counters.resizeObserver.availability === "measured" &&
			snapshot.counters.resizeObserver.callbackCalls > 0
				? {
						status: "measured",
						method: "page-init ResizeObserver shim",
						...snapshot.counters.resizeObserver,
					}
				: unavailableMetric(
						snapshot.counters.resizeObserver.availability === "measured"
							? "ResizeObserver produced no callback samples"
							: "ResizeObserver instrumentation API is unavailable",
						"page-init-resize-observer-shim",
					),
		settingsCost: {
			status: "measured",
			method:
				"DOM snapshot plus tracked EventTarget/ResizeObserver/MutationObserver registrations",
			settled: snapshot.settled.settings,
			activeListeners: snapshot.settled.activeListeners,
			activeResizeObservers: snapshot.settled.activeResizeObservers,
			activeMutationObservers: snapshot.settled.activeMutationObservers,
			settingsSpecificEffectAttribution: unavailableMetric(
				"Instrumentation cannot attribute a listener or observer to a React component without changing application source",
				"page-init-registration-tracker",
			),
		},
		react,
		settledValues: snapshot.settled,
		details: details ?? null,
		screenshots,
		animationCheckpoints: checkpoints,
	};
}

function aggregateMetric(values, method) {
	return summarize(values, method);
}

function aggregateInteraction(name, samples) {
	const valid = samples.filter((sample) => sample.status === "measured");
	if (valid.length === 0) {
		return {
			status: "unavailable",
			reason: "No measured repetitions completed",
			name,
			samples: samples.length,
		};
	}
	const frameIntervals = valid.flatMap((sample) =>
		sample.frameBudget.interval.status === "measured"
			? [sample.frameBudget.interval.p95]
			: [],
	);
	const nextPaints = valid.flatMap((sample) =>
		sample.nextPaint.status === "measured" ? [sample.nextPaint.p95] : [],
	);
	const longTaskTotals = valid.flatMap((sample) =>
		sample.longTasks.status === "measured" ? [sample.longTasks.totalMs] : [],
	);
	const durations = valid.map((sample) => sample.durationMs);
	const dropped = valid.map((sample) => sample.frameBudget.droppedFrameRatio);
	const noisy = (metric) =>
		metric.status === "measured" && metric.iqr > metric.median * 0.2;
	const summary = {
		status: "measured",
		name,
		runs: samples.length,
		durationMs: aggregateMetric(durations, "interaction-duration"),
		frameIntervalP95Ms: aggregateMetric(
			frameIntervals,
			"requestAnimationFrame-sampler",
		),
		droppedFrameRatio: aggregateMetric(
			dropped,
			"expected-60Hz-minus-observed-frames",
		),
		nextPaintP95Ms: aggregateMetric(
			nextPaints,
			"PerformanceEventTiming event-to-next-paint",
		),
		longTaskTotalMs: aggregateMetric(
			longTaskTotals,
			"PerformanceObserver:longtask",
		),
		noise: {
			status: "controlled",
			initialRunCount: samples.length,
			varianceExceeded: false,
			metrics: [],
		},
	};
	const noisyMetrics = [
		["durationMs", summary.durationMs],
		["frameIntervalP95Ms", summary.frameIntervalP95Ms],
		["droppedFrameRatio", summary.droppedFrameRatio],
		["nextPaintP95Ms", summary.nextPaintP95Ms],
		["longTaskTotalMs", summary.longTaskTotalMs],
	]
		.filter(([, metric]) => noisy(metric))
		.map(([metric]) => metric);
	if (noisyMetrics.length) {
		summary.noise = {
			status: "noisy",
			initialRunCount: samples.length,
			varianceExceeded: true,
			metrics: noisyMetrics,
		};
	}
	return summary;
}

function caseSummary(row, interactionSummaries) {
	const measured = Object.values(interactionSummaries).filter(
		(entry) => entry.status === "measured",
	);
	const worst = measured
		.slice()
		.sort(
			(left, right) =>
				(right.durationMs.p95 ?? -1) - (left.durationMs.p95 ?? -1),
		)[0];
	return {
		status: measured.length ? "measured" : "unavailable",
		case: row.id,
		material: row.material,
		interactions: interactionSummaries,
		worstInteraction: worst?.name ?? null,
	};
}

function unavailableRendering(reason) {
	const method = "automated-global-trace";
	return {
		status: "unavailable",
		scope:
			"global trace totals only; region and layer attribution is unavailable",
		style: unavailableMetric(reason, method),
		layout: unavailableMetric(reason, method),
		paint: unavailableMetric(reason, method),
		composite: unavailableMetric(reason, method),
	};
}

function traceDurationMetric(events, names, method) {
	const durations = events
		.filter(
			(event) =>
				event?.ph === "X" &&
				names.has(event.name) &&
				Number.isFinite(event.dur),
		)
		.map((event) => event.dur / 1000);
	if (durations.length === 0)
		return unavailableMetric(
			"Trace contains no matching duration events",
			method,
		);
	return {
		...summarize(durations, method),
		count: durations.length,
		totalMs: round(durations.reduce((total, duration) => total + duration, 0)),
	};
}

function traceRenderingMetrics(traceText) {
	try {
		const parsed = JSON.parse(traceText);
		const events =
			parsed && typeof parsed === "object" && Array.isArray(parsed.traceEvents)
				? parsed.traceEvents
				: null;
		if (!events)
			return unavailableRendering("Chrome trace has no traceEvents array");
		return {
			status: "captured",
			scope:
				"global events in this interaction trace; not region or layer attributed",
			traceEventCount: events.length,
			style: traceDurationMetric(
				events,
				new Set(["RecalculateStyles", "UpdateLayoutTree"]),
				"Chrome trace style events",
			),
			layout: traceDurationMetric(
				events,
				new Set(["Layout"]),
				"Chrome trace layout events",
			),
			paint: traceDurationMetric(
				events,
				new Set(["Paint", "PaintImage"]),
				"Chrome trace paint events",
			),
			composite: traceDurationMetric(
				events,
				new Set(["CompositeLayers", "UpdateLayerTree"]),
				"Chrome trace composite events",
			),
		};
	} catch (error) {
		return unavailableRendering(
			`Chrome trace could not be parsed: ${redactMessage(error.message)}`,
		);
	}
}

const TRACE_ATTRIBUTION_REGIONS = [
	{ id: "background", selector: "#bg-layer" },
	{ id: "liquid-surfaces", selector: "[data-glass-variant]" },
	{ id: "toolbar-surfaces", selector: "[data-glass-role]" },
	{ id: "settings", selector: "[data-settings-panel]" },
	{ id: "search", selector: "[data-unified-search]" },
];

function manualAttribution(reason) {
	return {
		status: "unavailable",
		method: "manual-DevTools-isolation-and-layer-inspection",
		reason,
		isolatedBackground: {
			status: "unavailable",
			selector: "#bg-layer",
			fields: ["isolated", "filter", "opacity", "paintMs", "compositeMs"],
			checklist: [
				"Isolate #bg-layer in DevTools while replaying the active interaction.",
				"Record the background filter, opacity, paint time, and composite time.",
			],
		},
		regionLayer: {
			status: "unavailable",
			fields: [
				"region",
				"selector",
				"layerId",
				"filter",
				"backdropFilter",
				"paintMs",
				"compositeMs",
			],
			regions: TRACE_ATTRIBUTION_REGIONS,
			checklist: [
				"Record the matching DevTools layer id for each listed region.",
				"Record filter, backdrop-filter, paint, and composite attribution per region/layer.",
				"Keep these manual fields separate from automated global trace totals.",
			],
		},
	};
}

async function startChromeTrace(context, page) {
	if (typeof context.newCDPSession !== "function") {
		return {
			status: "unavailable",
			method: "Chrome DevTools Protocol Tracing",
			reason: "Selected automation API has no CDP session",
		};
	}
	try {
		const client = await context.newCDPSession(page);
		await client.send("Tracing.start", {
			categories:
				"devtools.timeline,v8.execute,blink.user_timing,devtools.timeline.frame,disabled-by-default-devtools.timeline,latencyInfo",
			transferMode: "ReturnAsStream",
		});
		return { status: "started", client };
	} catch (error) {
		return {
			status: "unavailable",
			method: "Chrome DevTools Protocol Tracing",
			reason: redactMessage(error.message),
		};
	}
}

async function stopChromeTrace(trace, filePath) {
	if (trace.status !== "started") {
		return {
			...trace,
			globalRendering: unavailableRendering(
				trace.reason ?? "Chrome trace did not start",
			),
			attribution: manualAttribution(
				"Chrome trace capture was unavailable; DevTools region/layer inspection is required",
			),
		};
	}
	try {
		const complete = new Promise((resolvePromise) =>
			trace.client.once("Tracing.tracingComplete", resolvePromise),
		);
		await trace.client.send("Tracing.end");
		const event = await complete;
		let traceText = "";
		let eof = false;
		while (!eof) {
			const chunk = await trace.client.send("IO.read", {
				handle: event.stream,
			});
			traceText += chunk.data ?? "";
			eof = Boolean(chunk.eof);
		}
		await trace.client.send("IO.close", { handle: event.stream });
		await writeFile(filePath, traceText, "utf8");
		return {
			status: "captured",
			method: "Chrome DevTools Protocol Tracing",
			file: relativeOutputPath(DEFAULT_OUTPUT, filePath),
			globalRendering: traceRenderingMetrics(traceText),
			attribution: manualAttribution(
				"Automated Chrome traces provide global totals only; DevTools region/layer inspection is required",
			),
		};
	} catch (error) {
		return {
			status: "unavailable",
			reason: redactMessage(error.message),
			method: "Chrome DevTools Protocol Tracing",
			globalRendering: unavailableRendering(
				`Chrome trace capture failed: ${redactMessage(error.message)}`,
			),
			attribution: manualAttribution(
				"Chrome trace capture failed; DevTools region/layer inspection is required",
			),
		};
	}
}

async function writeFirefoxPerformanceArtifact(
	directory,
	row,
	runNumber,
	scenario,
	snapshot,
	details,
) {
	const filePath = join(
		directory,
		`${row.id}-run-${runNumber}-${scenario}.firefox-performance.json`,
	);
	try {
		await writeJson(filePath, {
			schemaVersion: 1,
			browser: "firefox",
			case: row,
			run: runNumber,
			scenario,
			performance: snapshot,
			details,
			globalRendering: unavailableRendering(
				"Firefox page Performance data does not provide style, layout, paint, or composite attribution",
			),
			attribution: manualAttribution(
				"Playwright Firefox has no equivalent DevTools trace export; use manual Firefox Performance/DevTools inspection",
			),
		});
		return {
			status: "captured",
			method: "Firefox page Performance data artifact (not a DevTools trace)",
			file: relativeOutputPath(DEFAULT_OUTPUT, filePath),
			globalRendering: unavailableRendering(
				"Firefox page Performance data does not provide style, layout, paint, or composite attribution",
			),
			attribution: manualAttribution(
				"Playwright Firefox has no equivalent DevTools trace export; use manual Firefox Performance/DevTools inspection",
			),
		};
	} catch (error) {
		return {
			status: "unavailable",
			method: "Firefox page Performance data artifact",
			reason: redactMessage(error.message),
			globalRendering: unavailableRendering(
				`Firefox performance artifact capture failed: ${redactMessage(error.message)}`,
			),
			attribution: manualAttribution(
				"Firefox performance artifact capture failed; DevTools region/layer inspection is required",
			),
		};
	}
}

function traceArtifactSummary(warmup, repetitions) {
	const warmupArtifacts = Object.values(warmup)
		.map((interaction) => interaction.trace)
		.filter(Boolean);
	const measuredArtifacts = repetitions.flatMap((repetition) =>
		Object.values(repetition.interactions).map(
			(interaction) => interaction.trace,
		),
	);
	const artifacts = [...warmupArtifacts, ...measuredArtifacts];
	const capturedCount = artifacts.filter(
		(artifact) => artifact?.status === "captured",
	).length;
	return {
		status:
			capturedCount === artifacts.length
				? "captured"
				: capturedCount > 0
					? "partial"
					: "unavailable",
		method: "one trace or performance artifact per interaction invocation",
		scope:
			"per-interaction artifacts; automated global totals do not provide region/layer attribution",
		count: artifacts.length,
		capturedCount,
		warmupCount: warmupArtifacts.length,
		measuredCount: measuredArtifacts.length,
		artifacts,
	};
}

async function stopInteractionIfStarted(page, started) {
	if (!started) return { snapshot: null, error: null };
	try {
		const snapshot = await page.evaluate(() => {
			const harness = globalThis.__liquidGlassHarness;
			if (!harness) throw new Error("Page-init harness is unavailable");
			return harness.stopInteraction();
		});
		return { snapshot, error: null };
	} catch (error) {
		return {
			snapshot: null,
			error: normalizeFailure(error, "instrumentation"),
		};
	}
}

function normalizeFailure(error, code) {
	if (error instanceof HarnessError) return error;
	const message = error instanceof Error ? error.message : String(error);
	return new HarnessError(redactMessage(message), code);
}

async function runInteraction(
	page,
	context,
	directory,
	row,
	runNumber,
	scenario,
	measured,
) {
	const actionSpec = SCENARIO_ACTIONS[scenario];
	const screenshots = [];
	const checkpoints = [];
	let details = null;
	let checkpointPromise = null;
	let cleanupResult = { snapshot: null, error: null };
	let interactionStarted = false;
	const tracePath = join(
		directory,
		`${row.id}-run-${runNumber}-${scenario}.chrome-trace.json`,
	);
	let traceCapture = {
		status: "unavailable",
		method: "Chrome DevTools Protocol Tracing",
		reason: "Chrome trace was not started",
	};
	if (row.browser === "chrome") {
		try {
			traceCapture = await startChromeTrace(context, page);
		} catch (error) {
			traceCapture = {
				status: "unavailable",
				method: "Chrome DevTools Protocol Tracing",
				reason: redactMessage(error.message),
			};
		}
	}
	const failures = [];
	try {
		try {
			await page.evaluate((name) => {
				const harness = globalThis.__liquidGlassHarness;
				if (!harness) throw new Error("Page-init harness is unavailable");
				harness.startInteraction(name);
			}, scenario);
			interactionStarted = true;
			checkpointPromise = captureCheckpoints(
				page,
				directory,
				row.id,
				runNumber,
				scenario,
				actionSpec.checkpointDuration,
			);
			details = await actionSpec.action(page);
		} catch (error) {
			failures.push(normalizeFailure(error, "interaction"));
		}
		if (checkpointPromise) {
			try {
				checkpoints.push(...(await checkpointPromise));
			} catch (error) {
				failures.push(normalizeFailure(error, "checkpoint"));
			}
		}
		if (interactionStarted && failures.length === 0) {
			try {
				await page.waitForTimeout(420);
			} catch (error) {
				failures.push(normalizeFailure(error, "interaction"));
			}
		}
	} finally {
		cleanupResult = await stopInteractionIfStarted(page, interactionStarted);
	}
	if (cleanupResult.error) failures.push(cleanupResult.error);
	const snapshot = cleanupResult.snapshot;
	const traceResult =
		row.browser === "chrome"
			? await stopChromeTrace(traceCapture, tracePath)
			: await writeFirefoxPerformanceArtifact(
					directory,
					row,
					runNumber,
					scenario,
					snapshot,
					details,
				);
	if (!snapshot) {
		return {
			status: "unavailable",
			name: scenario,
			reason: failures[0]?.message ?? "Instrumentation returned no snapshot",
			failures: failures.slice(1).map((failure) => failure.message),
			trace: traceResult,
			animationCheckpoints: checkpoints,
		};
	}
	if (failures.length) {
		return {
			status: "unavailable",
			name: scenario,
			reason: failures[0].message,
			failures: failures.slice(1).map((failure) => failure.message),
			snapshot,
			trace: traceResult,
			animationCheckpoints: checkpoints,
		};
	}
	if (measured) {
		const filePath = join(
			directory,
			`${row.id}-run-${runNumber}-${scenario}-settled.png`,
		);
		try {
			await page.screenshot({ path: filePath, animations: "disabled" });
			screenshots.push({
				kind: "settled-stable",
				status: "captured",
				path: relativeOutputPath(DEFAULT_OUTPUT, filePath),
			});
		} catch (error) {
			screenshots.push({
				kind: "settled-stable",
				status: "unavailable",
				reason: redactMessage(error.message),
			});
		}
	}
	return {
		status: "measured",
		name: scenario,
		trace: traceResult,
		...makeSample(snapshot, details, screenshots, checkpoints),
	};
}

async function runCase(runtime, row, result) {
	const { page, context, outputRoot } = runtime;
	const directory = join(outputRoot, row.id);
	await mkdir(directory, { recursive: true });
	const warmup = {};
	for (const scenario of SCENARIOS) {
		await seedPage(page, row);
		const warmupResult = await runInteraction(
			page,
			context,
			directory,
			row,
			0,
			scenario,
			false,
		);
		warmup[scenario] = {
			status: warmupResult.status,
			reason: warmupResult.reason ?? null,
			trace: warmupResult.trace ?? null,
		};
	}
	const repetitions = [];
	for (let runNumber = 1; runNumber <= MEASURED_RUNS; runNumber += 1) {
		const interactions = {};
		for (const scenario of SCENARIOS) {
			await seedPage(page, row);
			interactions[scenario] = await runInteraction(
				page,
				context,
				directory,
				row,
				runNumber,
				scenario,
				runNumber === 1,
			);
		}
		repetitions.push({ run: runNumber, interactions });
	}
	const initialSummaries = Object.fromEntries(
		SCENARIOS.map((scenario) => [
			scenario,
			aggregateInteraction(
				scenario,
				repetitions.map((repetition) => repetition.interactions[scenario]),
			),
		]),
	);
	const noisy = Object.values(initialSummaries).some(
		(summary) => summary.noise?.status === "noisy",
	);
	if (noisy) {
		for (
			let runNumber = MEASURED_RUNS + 1;
			runNumber <= NOISY_RUNS;
			runNumber += 1
		) {
			const interactions = {};
			for (const scenario of SCENARIOS) {
				await seedPage(page, row);
				interactions[scenario] = await runInteraction(
					page,
					context,
					directory,
					row,
					runNumber,
					scenario,
					false,
				);
			}
			repetitions.push({ run: runNumber, interactions });
		}
	}
	const interactionSummaries = Object.fromEntries(
		SCENARIOS.map((scenario) => [
			scenario,
			aggregateInteraction(
				scenario,
				repetitions.map((repetition) => repetition.interactions[scenario]),
			),
		]),
	);
	for (const summary of Object.values(interactionSummaries)) {
		if (summary.status === "measured" && noisy) {
			summary.noise.status = "noisy-repeat";
			summary.noise.initialRunCount = MEASURED_RUNS;
			summary.noise.repeatRunCount = NOISY_RUNS;
		}
	}
	const caseResult = {
		status: "runtime",
		case: row,
		measurementSource: "real-browser-runtime",
		protocol: {
			viewport: VIEWPORT,
			deviceScaleFactor: 1,
			warmupRuns: 1,
			measuredRuns: MEASURED_RUNS,
			noisyRepeatRuns: NOISY_RUNS,
			dragDurationMs: DRAG_DURATION_MS,
			pointerScheduleHz: POINTER_HZ,
			query: QUERY,
		},
		capabilities: await page.evaluate(() =>
			globalThis.__liquidGlassHarness?.getCapabilities(),
		),
		warmup,
		repetitions,
		summary: caseSummary(row, interactionSummaries),
		traceArtifacts: traceArtifactSummary(warmup, repetitions),
		attribution: manualAttribution(
			"Automated interaction artifacts provide global metrics only; isolated-background and region/layer attribution require manual DevTools inspection",
		),
		blockedExternalRequestCount: runtime.blockedExternalRequests.length,
		pageErrors: runtime.pageErrors,
		staticGuardrails: result.staticGuardrails,
	};
	result.cases.push(caseResult);
	await writeJson(join(outputRoot, "liquid-glass-benchmark.json"), result);
}

function manualRows(options, reason) {
	return matrixFor({ ...options, browser: "both" }).map((row) => ({
		status: "unavailable",
		case: row,
		measurementSource: "manual-capture-required",
		reason,
		protocol: {
			viewport: VIEWPORT,
			deviceScaleFactor: 1,
			warmupRuns: 1,
			measuredRuns: MEASURED_RUNS,
			noisyRepeatRuns: NOISY_RUNS,
			dragDurationMs: DRAG_DURATION_MS,
			pointerScheduleHz: POINTER_HZ,
		},
		interactions: Object.fromEntries(
			SCENARIOS.map((scenario) => [
				scenario,
				{
					...unavailableMetric(
						"Manual DevTools capture required",
						"manual-checklist",
					),
					trace: unavailableMetric(
						"Runtime unavailable; capture one trace or performance artifact for this interaction",
						"manual-checklist",
					),
					attribution: manualAttribution(
						"Runtime unavailable; manual isolated-background and region/layer inspection is required",
					),
				},
			]),
		),
		traceArtifacts: unavailableMetric(
			"Runtime unavailable; capture one artifact per interaction",
			"manual-checklist",
		),
		attribution: manualAttribution(
			"Runtime unavailable; manual isolated-background and region/layer inspection is required",
		),
	}));
}

function manualChecklist(options, reason) {
	const rows = matrixFor({ ...options, browser: "both" });
	const lines = [
		"# Liquid Glass baseline manual-capture checklist",
		"",
		"This file is a capture checklist, not runtime data. No unavailable metric is represented as zero.",
		`Automatic capture limitation: ${reason}`,
		"",
		"Use a temporary browser profile and load the already-built extension target. Do not start `.qa/serve.mjs`, a dev server, or a network service. Block external requests and do not enter secrets.",
		"",
		"Protocol",
		"- Viewport: 1440 × 900 CSS pixels, device scale factor 1.",
		"- For each row: set the listed theme, background, and material; reseed and reload the deterministic fixture immediately before every warm-up and measured scenario invocation; record five measured runs.",
		"- Record median, p95, and IQR. If IQR exceeds 20% of the median, run ten measured repetitions and mark the row noisy.",
		"- Capture separately labeled stable settled screenshots only after each interaction settles, plus ten animation-preserving motion checkpoints during each motion interaction.",
		"- Capture one Chrome trace or Firefox page-performance artifact per interaction invocation when runtime exists; automated rendering totals are global and are not region/layer attribution. Redact URLs, profile paths, storage values, and all secrets.",
		"",
		"Rows",
	];
	for (const row of rows) {
		lines.push(
			`- [ ] ${row.id}: ${row.browser}, ${row.theme}, ${row.background}, ${row.material}`,
		);
	}
	lines.push(
		"",
		"Interactions for every row",
		"- [ ] Idle window.",
		"- [ ] Intensity drag from 0 → 100 → 0 over exactly 1,000 ms with a fixed 240 Hz pointer schedule; record pointer moves, observable callback/value updates, root style mutations, and exact final value; restore Settings to closed before the next scenario.",
		"- [ ] From an observed closed Settings state, open Settings and assert the closed-to-open transition.",
		"- [ ] Close Settings and assert the closed state plus focus return to `#settings-trigger`.",
		"- [ ] Navigate every visible Settings pane once: root inline General/Appearance/Search, Bookmarks, Advanced, and Wallpaper where exposed.",
		`- [ ] Open Search, type the fixed 20-character query \`${QUERY}\`, then close it.`,
		"- [ ] Open and close one card context menu.",
		"- [ ] Open and close one trigger-anchored popover, such as More folders.",
		"- [ ] Expand and collapse an available Settings expandable twice.",
		"- [ ] Resize the viewport once so a refractive element’s rounded integer width or height changes, then restore 1440 × 900.",
		"",
		"Metrics to capture",
		"- [ ] requestAnimationFrame frame intervals, expected/observed callback samples, and dropped-frame ratio; require real frame samples or mark the metric unavailable.",
		"- [ ] PerformanceEventTiming.presentationTime event-to-next-paint latency only when finite presentationTime values are exposed; never substitute requestAnimationFrame timestamps, and otherwise record the explicit unavailable reason.",
		"- [ ] PerformanceObserver longtask and event entries where supported; otherwise mark unavailable.",
		"- [ ] Root documentElement style mutations and the final seven Glass CSS variable values.",
		"- [ ] Canvas toDataURL/createImageData/putImageData calls and duration; ResizeObserver construction/observe/callback work and duration.",
		"- [ ] React Profiler commit data. If only a root hook or no hook is available, mark component commits unavailable.",
		"- [ ] Closed Settings subtree count, tracked listeners/observers, and focus state; do not infer component-specific effect absence from total counts.",
		"- [ ] Per-interaction Chrome trace or Firefox page-performance artifact, settled screenshots, and motion checkpoints.",
		"- [ ] Isolated-background inspection for #bg-layer: record isolation state, filter, opacity, paint time, and composite time.",
		`- [ ] Region/layer inspection for ${TRACE_ATTRIBUTION_REGIONS.map((region) => `${region.id} (${region.selector})`).join(", ")}: record region, selector, DevTools layer id, filter/backdrop-filter, paint time, composite time, and evidence. Mark manual/unavailable when DevTools attribution is not available.`,
		"",
		"Acceptance reminders",
		"- [ ] Firefox unsupported SVG displacement-map work is distinguishable from a measured zero; Chrome settled refraction is visually equivalent.",
		"- [ ] Treat automated global trace totals as supporting evidence only; the isolated-background and region/layer fields must be manually inspected or remain unavailable.",
		"- [ ] Flat rows are regression controls and do not replace the eight required Liquid rows.",
		"- [ ] No source optimization is approved from this checklist alone; preserve the current visual recipe until a measured gate is cleared.",
		"",
	);
	return `${lines.join("\n")}\n`;
}

async function writeUnavailableOutput(options, reason, staticGuardrails) {
	const result = {
		schemaVersion: 1,
		harness: "liquid-glass-baseline",
		status: "unavailable",
		measurementSource: "manual-capture-required",
		generatedAt: new Date().toISOString(),
		protocol: {
			viewport: VIEWPORT,
			deviceScaleFactor: 1,
			warmupRuns: 1,
			measuredRuns: MEASURED_RUNS,
			noisyRepeatRuns: NOISY_RUNS,
			dragDurationMs: DRAG_DURATION_MS,
			pointerScheduleHz: POINTER_HZ,
		},
		staticGuardrails:
			staticGuardrails ??
			unavailableMetric(
				"Built target could not be inspected",
				"built-output-files",
			),
		cases: manualRows(options, reason),
	};
	await mkdir(options.output, { recursive: true });
	await writeJson(join(options.output, "liquid-glass-benchmark.json"), result);
	await writeFile(
		join(options.output, "manual-capture-checklist.md"),
		manualChecklist(options, reason),
		"utf8",
	);
	return result;
}

async function run() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return;
	}
	if (options.manual) {
		const result = await writeUnavailableOutput(
			options,
			"Manual mode was requested; no runtime numbers were generated",
			null,
		);
		process.stdout.write(
			`Wrote manual checklist and ${result.cases.length} unavailable matrix rows to ${options.output}\n`,
		);
		return;
	}
	const manifest = await readManifest(options.extension);
	if (!manifest.chrome_url_overrides?.newtab) {
		throw new HarnessError(
			"Built target manifest does not expose newtab.html",
			"extension",
		);
	}
	let staticGuardrails;
	try {
		staticGuardrails = await collectStaticGuardrails(options.extension);
	} catch (error) {
		staticGuardrails = unavailableMetric(
			redactMessage(error.message),
			"built-output-files",
		);
	}
	const result = {
		schemaVersion: 1,
		harness: "liquid-glass-baseline",
		status: "partial",
		measurementSource: "real-browser-runtime-or-manual-capture-required",
		generatedAt: new Date().toISOString(),
		buildTarget: basename(options.extension),
		protocol: {
			viewport: VIEWPORT,
			deviceScaleFactor: 1,
			warmupRuns: 1,
			measuredRuns: MEASURED_RUNS,
			noisyRepeatRuns: NOISY_RUNS,
			dragDurationMs: DRAG_DURATION_MS,
			pointerScheduleHz: POINTER_HZ,
			query: QUERY,
		},
		staticGuardrails,
		cases: [],
	};
	const browsers =
		options.browser === "both" ? ["chrome", "firefox"] : [options.browser];
	let automaticFailure = null;
	for (const browser of browsers) {
		const row = matrixFor({ ...options, browser }).find(
			(candidate) => candidate.browser === browser,
		);
		try {
			const playwright = await loadPlaywright();
			const runtime = await launchBrowser(
				playwright,
				row,
				options,
				options.extension,
				options.output,
			);
			try {
				for (const candidate of matrixFor({ ...options, browser }))
					await runCase(runtime, candidate, result);
			} finally {
				await runtime.context.close().catch(() => undefined);
				await rm(runtime.profilePath, { recursive: true, force: true }).catch(
					() => undefined,
				);
			}
		} catch (error) {
			automaticFailure = automaticFailure ?? redactMessage(error.message);
			const unavailable = manualRows(
				{ ...options, browser },
				redactMessage(error.message),
			);
			result.cases.push(
				...unavailable.filter(
					(candidate) => candidate.case.browser === browser,
				),
			);
			await writeJson(
				join(options.output, "liquid-glass-benchmark.json"),
				result,
			);
		}
	}
	result.status = result.cases.every(
		(candidate) => candidate.status === "runtime",
	)
		? "runtime"
		: "unavailable";
	if (automaticFailure) {
		await writeFile(
			join(options.output, "manual-capture-checklist.md"),
			manualChecklist(options, automaticFailure),
			"utf8",
		);
	}
	await writeJson(join(options.output, "liquid-glass-benchmark.json"), result);
	if (automaticFailure) {
		throw new HarnessError(
			`Automatic baseline capture is unavailable: ${automaticFailure}. See ${join(options.output, "manual-capture-checklist.md")}`,
			"environment",
		);
	}
	process.stdout.write(
		`Captured ${result.cases.length} matrix rows under ${options.output}\n`,
	);
}

try {
	await run();
} catch (error) {
	const message =
		error instanceof HarnessError
			? error.message
			: redactMessage(error.message);
	process.stderr.write(`liquid-glass-benchmark: ${message}\n`);
	if (error.code === "usage") printHelp();
	process.exitCode = error.code === "usage" ? 2 : 1;
}
