import { normalizeSearchText } from "../../../lib/search-index";
import { SITE_URL_TO_SVGL } from "../../../lib/svgl-mapping";

export interface SiteDestination {
	title: string;
	url: string;
}

export function searchDestination(query: string): string | null {
	const value = query.trim();
	if (!value || /\s/.test(value)) return null;
	// A typed address is explicit intent. Never reinterpret another scheme.
	if (
		!/^https?:\/\//i.test(value) &&
		!/^[\w-]+(?:\.[\w-]+)+(?::\d{1,5})?(?:[/?#]|$)/.test(value)
	)
		return null;
	try {
		const url = new URL(
			/^https?:\/\//i.test(value) ? value : `https://${value}`,
		);
		return url.hostname && !url.username && !url.password ? url.href : null;
	} catch {
		return null;
	}
}

/** Compare destinations without duplicating www/bare versions of a page. */
export function destinationKey(url: string): string {
	const parsed = new URL(url);
	parsed.hostname = parsed.hostname.replace(/^www\./, "");
	return parsed.href;
}

const BUILTIN_DESTINATIONS: SiteDestination[] = [
	{ title: "Wikipedia", url: "https://www.wikipedia.org/" },
	{ title: "Gmail", url: "https://mail.google.com/" },
	...Object.entries(SITE_URL_TO_SVGL).map(([host, title]) => ({
		title,
		url: `https://${host}/`,
	})),
];

function nameKey(value: string): string {
	return normalizeSearchText(value).replace(/[^\p{L}\p{N}]/gu, "");
}

/** Damerau-Levenshtein: omissions, substitutions and adjacent swapped letters. */
function editDistance(a: string, b: string): number {
	const rows = Array.from({ length: a.length + 1 }, (_, i) => [i]);
	rows[0] = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		for (let j = 1; j <= b.length; j++) {
			rows[i][j] = Math.min(
				rows[i - 1][j] + 1,
				rows[i][j - 1] + 1,
				rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
			);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
				rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
		}
	}
	return rows[a.length][b.length];
}

/** Prepare names once per catalogue, rather than rebuilding on every keystroke. */
export function createDestinationIndex(catalogue: readonly SiteDestination[]) {
	const seen = new Set<string>();
	const entries = [...BUILTIN_DESTINATIONS, ...catalogue].flatMap((site) => {
		if (typeof site?.title !== "string" || typeof site?.url !== "string")
			return [];
		const url = searchDestination(site.url);
		const name = nameKey(site.title);
		if (!url || !name || name.length > 64) return [];
		const key = `${name}:${destinationKey(url)}`;
		if (seen.has(key)) return [];
		seen.add(key);
		return [{ name, site: { title: site.title, url } }];
	});
	const unique = (sites: SiteDestination[]) => {
		const byUrl = new Map(
			sites.map((site) => [destinationKey(site.url), site]),
		);
		return byUrl.size === 1 ? [...byUrl.values()][0] : null;
	};
	return (query: string): SiteDestination | null => {
		// Domains are handled as typed addresses; punctuation must not turn a
		// search expression or unsafe scheme into a brand name.
		const normalized = normalizeSearchText(query);
		if (!/^[\p{L}\p{N}\s-]+$/u.test(normalized)) return null;
		const q = nameKey(normalized);
		if (!q || q.length > 64) return null;
		const exact = entries.filter(({ name }) => name === q);
		if (exact.length) return unique(exact.map(({ site }) => site));
		if (q.length >= 3) {
			const prefixes = entries.filter(({ name }) => name.startsWith(q));
			if (prefixes.length) return unique(prefixes.map(({ site }) => site));
		}
		if (q.length < 5) return null;
		const limit = q.length >= 7 ? 2 : 1;
		let best = limit + 1;
		let matches: SiteDestination[] = [];
		for (const { name, site } of entries) {
			if (Math.abs(name.length - q.length) > limit) continue;
			const distance = editDistance(q, name);
			if (distance > limit || distance / Math.max(q.length, name.length) > 0.25)
				continue;
			if (distance < best) {
				best = distance;
				matches = [site];
			} else if (distance === best) matches.push(site);
		}
		return unique(matches);
	};
}

export const findBuiltinDestination = createDestinationIndex([]);
