import { expect, test } from "bun:test";
import {
	findBookmarkInFolder,
	findBookmarksByDomain,
} from "../src/lib/bookmark-match";
import {
	REFRESH_BATCH_STALE_MS,
	REFRESH_THROTTLE_MS,
	captureDelayMs,
	isResumableRefreshState,
} from "../src/lib/thumbnail-refresh";
import {
	canonicalizeForAutoCapture,
	canonicalizeForManualSave,
} from "../src/lib/url";
import type { Card } from "../src/types";

function card(
	id: string,
	url: string,
	folderId = "folder-1",
	thumbId: string | null = null,
): Card {
	return {
		id,
		folderId,
		title: id,
		url,
		favicon: null,
		thumbId,
		order: 0,
	};
}

// ── canonicalizeForAutoCapture: origin only ─────────────────────────────

const AUTO_CASES: Array<[input: string, expected: string | null]> = [
	["https://example.com", "https://example.com"],
	["https://example.com/", "https://example.com"],
	["https://example.com/a/b/c?x=1#frag", "https://example.com"],
	["HTTPS://EXAMPLE.COM/Path", "https://example.com"],
	["https://example.com:443/deep", "https://example.com"],
	["http://example.com:80/", "http://example.com"],
	["http://example.com:8080/", "http://example.com:8080"],
	["https://www.example.com/page", "https://www.example.com"],
	[
		"https://notebooklm.google.com/notebook/abc",
		"https://notebooklm.google.com",
	],
	[
		"https://notebooklm.google.com/notebook/xyz?q=1",
		"https://notebooklm.google.com",
	],
	["https://sub.domain.example.co.uk/p", "https://sub.domain.example.co.uk"],
	["  https://example.com/pad  ", "https://example.com"],
	["example.com/some/path", "https://example.com"],
	["http://127.0.0.1:3000/app", "http://127.0.0.1:3000"],
	["https://example.com./trailing-dot", "https://example.com."],
	// Bare hostnames upgrade to https by design (normalizeUrl semantics,
	// same as the existing canonicalUrl).
	["not-a-url", "https://not-a-url"],
	["chrome://settings", null],
	["about:blank", null],
	["moz-extension://abc/newtab.html", null],
	["data:text/html,hello", null],
	["file:///tmp/example.html", null],
	["", null],
];

test("canonicalizeForAutoCapture keeps origin only", () => {
	expect(AUTO_CASES.length).toBeGreaterThanOrEqual(15);
	for (const [input, expected] of AUTO_CASES) {
		expect(canonicalizeForAutoCapture(input)).toBe(expected);
	}
});

test("canonicalizeForAutoCapture matches across paths on one domain", () => {
	expect(
		canonicalizeForAutoCapture("https://notebooklm.google.com/notebook/abc"),
	).toBe(
		canonicalizeForAutoCapture("https://notebooklm.google.com/notebook/xyz"),
	);
});

test("canonicalizeForAutoCapture keeps hosts distinct", () => {
	expect(canonicalizeForAutoCapture("https://www.example.com/x")).not.toBe(
		canonicalizeForAutoCapture("https://example.com/x"),
	);
	expect(canonicalizeForAutoCapture("https://a.example.com")).not.toBe(
		canonicalizeForAutoCapture("https://b.example.com"),
	);
	expect(canonicalizeForAutoCapture("https://example.com")).not.toBe(
		canonicalizeForAutoCapture("http://example.com"),
	);
});

// ── canonicalizeForManualSave: origin + pathname ────────────────────────

const MANUAL_CASES: Array<[input: string, expected: string | null]> = [
	["https://example.com", "https://example.com"],
	["https://example.com/", "https://example.com"],
	["https://example.com/article/1", "https://example.com/article/1"],
	["https://example.com/article/1/", "https://example.com/article/1"],
	["https://example.com/article/1?ref=home", "https://example.com/article/1"],
	["https://example.com/article/1#comments", "https://example.com/article/1"],
	["https://example.com/a?x=1#y", "https://example.com/a"],
	["HTTPS://EXAMPLE.COM/Path/", "https://example.com/Path"],
	["https://example.com:443/path", "https://example.com/path"],
	["http://example.com:80/", "http://example.com"],
	["http://example.com:8080/p/", "http://example.com:8080/p"],
	["https://www.example.com/page/", "https://www.example.com/page"],
	["  https://example.com/pad/  ", "https://example.com/pad"],
	["example.com/some/path/", "https://example.com/some/path"],
	["https://example.com/a//b", "https://example.com/a//b"],
	["not-a-url", "https://not-a-url"],
	["chrome://settings", null],
	["about:blank", null],
	["moz-extension://abc/newtab.html", null],
	["data:text/html,hello", null],
	["file:///tmp/example.html", null],
	["", null],
];

test("canonicalizeForManualSave keeps origin + pathname", () => {
	expect(MANUAL_CASES.length).toBeGreaterThanOrEqual(15);
	for (const [input, expected] of MANUAL_CASES) {
		expect(canonicalizeForManualSave(input)).toBe(expected);
	}
});

test("canonicalizeForManualSave keeps paths distinct", () => {
	expect(canonicalizeForManualSave("https://example.com/article/1")).not.toBe(
		canonicalizeForManualSave("https://example.com/article/2"),
	);
});

// ── Manual save identity is unchanged (exact, query-sensitive) ──────────

test("manual save still treats query/hash variants as different cards", () => {
	const saved = card("saved", "https://example.com/article/1");
	const cards = [saved];
	expect(
		findBookmarkInFolder(cards, "folder-1", "https://example.com/article/2"),
	).toBeUndefined();
	expect(
		findBookmarkInFolder(
			cards,
			"folder-1",
			"https://example.com/article/1?ref=home",
		),
	).toBeUndefined();
	expect(
		findBookmarkInFolder(
			cards,
			"folder-1",
			"https://example.com/article/1#comments",
		),
	).toBeUndefined();
	expect(
		findBookmarkInFolder(cards, "folder-1", "https://example.com/article/1/")
			?.id,
	).toBe("saved");
});

// ── Domain finder for auto-capture ──────────────────────────────────────

test("findBookmarksByDomain matches any path on the same origin", () => {
	const same1 = card("same-1", "https://notebooklm.google.com/notebook/abc");
	const same2 = card(
		"same-2",
		"https://notebooklm.google.com/other",
		"folder-2",
	);
	const other = card("other", "https://example.com/");
	const done = card(
		"done",
		"https://notebooklm.google.com/notebook/old",
		"folder-1",
		"thumb-1",
	);
	const found = findBookmarksByDomain(
		[same1, same2, other, done],
		["https://notebooklm.google.com/notebook/xyz"],
	).map((c) => c.id);
	expect(found).toEqual(["same-1", "same-2"]);
});

test("findBookmarksByDomain keeps subdomains and schemes distinct", () => {
	const www = card("www", "https://www.example.com/");
	const bare = card("bare", "https://example.com/");
	const http = card("http", "http://example.com/");
	const cards = [www, bare, http];
	expect(
		findBookmarksByDomain(cards, ["https://www.example.com/page"]).map(
			(c) => c.id,
		),
	).toEqual(["www"]);
	expect(
		findBookmarksByDomain(cards, ["https://example.com/other"]).map(
			(c) => c.id,
		),
	).toEqual(["bare"]);
	expect(
		findBookmarksByDomain(cards, ["http://example.com/other"]).map((c) => c.id),
	).toEqual(["http"]);
});

// ── Queue throttle ──────────────────────────────────────────────────────

test("refresh throttle respects the captureVisibleTab rate limit", () => {
	// Platform quota: 2 calls/second → ≥500ms apart. The queue uses 1500ms.
	expect(REFRESH_THROTTLE_MS).toBeGreaterThanOrEqual(1500);
});

test("captureDelayMs spaces captures at least the throttle apart", () => {
	const now = 10_000;
	expect(captureDelayMs(now - 1500, now)).toBe(0);
	expect(captureDelayMs(now - 1499, now)).toBe(1);
	expect(captureDelayMs(now - 200, now)).toBe(REFRESH_THROTTLE_MS - 200);
	expect(captureDelayMs(null, now)).toBe(0);
});

// ── Persisted batch state (SW sleep resume) ─────────────────────────────

test("isResumableRefreshState only resumes fresh running batches", () => {
	const base = {
		status: "running" as const,
		cardIds: ["a", "b"],
		doneIds: ["a"],
		failedIds: [],
		sites: {},
		startedAt: Date.now(),
	};
	expect(isResumableRefreshState(base)).toBe(true);
	expect(isResumableRefreshState({ ...base, status: "idle" as const })).toBe(
		false,
	);
	expect(
		isResumableRefreshState({
			...base,
			startedAt: Date.now() - REFRESH_BATCH_STALE_MS - 1,
		}),
	).toBe(false);
	expect(isResumableRefreshState(null)).toBe(false);
	expect(isResumableRefreshState({ status: "running" })).toBe(false);
});
