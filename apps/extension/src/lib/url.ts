/**
 * URL helpers shared across the newtab UI and the background service worker.
 * This is the single source of truth — do not re-implement canonicalization elsewhere.
 */

/** Add a protocol if the user typed a bare domain, and trim whitespace. */
export function normalizeUrl(rawUrl: string): string {
	const trimmed = rawUrl.trim();
	if (!trimmed) return "";
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	return `https://${trimmed}`;
}

/** True only for an already-absolute http(s) URL (does not add a scheme). */
export function isAbsoluteHttpUrl(rawUrl: string): boolean {
	const trimmed = rawUrl.trim();
	if (!/^https?:\/\//i.test(trimmed)) return false;
	try {
		const url = new URL(trimmed);
		return (
			(url.protocol === "http:" || url.protocol === "https:") &&
			url.hostname.length > 0
		);
	} catch {
		return false;
	}
}

/** True when the (normalized) value is a syntactically valid http/https URL. */
export function isValidUrl(rawUrl: string): boolean {
	try {
		const url = new URL(normalizeUrl(rawUrl));
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}

/**
 * Canonical form used for bookmark identity: browser URL parsing, lowercased
 * host, default ports stripped, and a trailing path slash removed. Query
 * parameters and hashes remain part of the identity because both can change
 * the page a bookmark represents. Returns null for non-http(s) URLs.
 */
export function canonicalUrl(rawUrl: string): string | null {
	try {
		const url = new URL(normalizeUrl(rawUrl));
		if (url.protocol !== "http:" && url.protocol !== "https:") return null;
		url.hostname = url.hostname.toLowerCase();
		if (
			(url.protocol === "http:" && url.port === "80") ||
			(url.protocol === "https:" && url.port === "443")
		) {
			url.port = "";
		}
		const text = url.toString();
		const suffixLength = url.search.length + url.hash.length;
		const base = text.slice(0, text.length - suffixLength);
		return `${base.endsWith("/") ? base.slice(0, -1) : base}${text.slice(
			text.length - suffixLength,
		)}`;
	} catch {
		return null;
	}
}

/** Hostname without the leading "www.", or "" when the URL is invalid. */
export function getDomain(rawUrl: string): string {
	try {
		return new URL(normalizeUrl(rawUrl)).hostname.replace(/^www\./, "");
	} catch {
		return "";
	}
}

/**
 * A human title guessed from a URL when the user hasn't typed one:
 * the registrable-ish domain label, capitalized (e.g. "github.com" → "Github").
 */
export function deriveTitleFromUrl(rawUrl: string): string {
	const domain = getDomain(rawUrl);
	if (!domain) return "";
	const label = domain.split(".")[0] ?? domain;
	return label.charAt(0).toUpperCase() + label.slice(1);
}

const ICON_BRAND_NAMES: Record<string, string> = {
	figma: "Figma",
	github: "GitHub",
	linear: "Linear",
	stackoverflow: "Stack Overflow",
	vercel: "Vercel",
	youtube: "YouTube",
};

/** Short, app-like label for Icon mode; Card mode keeps its saved title. */
export function deriveIconLabel(rawUrl: string): string {
	const domain = getDomain(rawUrl);
	if (!domain) return "";
	const identity = domain.split(".")[0] ?? domain;
	return (
		ICON_BRAND_NAMES[identity.toLowerCase()] ??
		identity
			.split(/[-_]+/)
			.filter(Boolean)
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(" ")
	);
}

/** Google favicon service URL for a given site. Empty string when invalid. */
export function faviconUrl(rawUrl: string, size = 64): string {
	const domain = getDomain(rawUrl);
	if (!domain) return "";
	return `https://www.google.com/s2/favicons?sz=${size}&domain=${domain}`;
}
