/**
 * Diagnostic: what does the REAL ladder pick for a domain?
 *
 * Run: cd apps/extension && bun run scripts/probe-icon-sources.ts
 *
 * This runs the production resolver (src/lib/icon-resolver.ts) against live
 * sites, with the browser's canvas measurement replaced by the equivalent
 * offline PNG decoder (scripts/probe-image-metrics.ts). The output is the
 * proof of WHAT each domain resolves to: the exact asset URL, its decoded
 * size, the edge-alpha ratio and the resulting treatment (app tile vs
 * glyph) — plus the candidates that were rejected and why.
 *
 * Diagnostic tooling (not a test, not CI).
 */

import { DOMParser } from "linkedom";
import { resolveIconForDomain } from "../src/lib/icon-resolver";
import { useIconCacheStore } from "../src/stores/icon-cache-store";
import { measureRemoteAsset } from "./probe-image-metrics";

Object.assign(globalThis, { DOMParser });

const TARGETS = [
	"https://www.google.com/",
	"https://www.youtube.com/",
	"https://github.com/",
	"https://www.reddit.com/",
	"https://open.spotify.com/",
	"https://news.ycombinator.com/",
	"https://en.wikipedia.org/",
	"https://www.notion.so/",
	"https://linear.app/",
	"https://figma.com/",
	"https://x.com/",
	"https://discord.com/app",
	"https://vercel.com/",
];

const measuredCache = new Map<
	string,
	Awaited<ReturnType<typeof measureRemoteAsset>>
>();

// A browser sends its own User-Agent on every fetch; bun sends "Bun/x".
// Sites that refuse unknown agents (YouTube, Vercel) would then look like
// they have no icons at all, so the probe emulates the browser's UA —
// exactly what the extension gets for free inside Chrome/Firefox.
const BROWSER_UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const nativeFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
	const headers = new Headers(init?.headers ?? {});
	if (!headers.has("User-Agent")) headers.set("User-Agent", BROWSER_UA);
	return nativeFetch(input, { ...init, headers });
}) as typeof globalThis.fetch;

async function measure(url: string) {
	if (!measuredCache.has(url)) {
		measuredCache.set(url, await measureRemoteAsset(url));
	}
	return measuredCache.get(url) ?? null;
}

function domainOf(url: string): string {
	return new URL(url).hostname.replace(/^www\./, "");
}

for (const target of TARGETS) {
	const key = domainOf(target);
	await resolveIconForDomain(key, target, measure);
	const record = useIconCacheStore.getState().records[key];
	if (!record) {
		console.log(`${key.padEnd(16)} → NO RECORD (unreachable / offline)`);
		continue;
	}
	if (record.kind === "none") {
		console.log(`${key.padEnd(16)} → letter-mark (provider verified miss)`);
		continue;
	}
	if (record.kind === "svg") {
		console.log(
			`${key.padEnd(16)} → svg  ${record.source.padEnd(12)} ${record.src}`,
		);
		continue;
	}
	const decoded = await measure(record.src);
	const size = decoded
		? `${decoded.naturalWidth}x${decoded.naturalHeight}`
		: "unknown";
	const ratio = decoded
		? `edge=${(decoded.opaqueEdgeRatio * 100).toFixed(0)}%`
		: "";
	console.log(
		`${key.padEnd(16)} → ${record.treatment.padEnd(5)} ${record.source.padEnd(12)} ${size.padEnd(10)} ${ratio.padEnd(9)} ${record.src}`,
	);
}
