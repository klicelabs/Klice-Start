import {
	matchesSearchTerms,
	type SearchResult,
} from "../../../lib/search-index";
import type { Card, Folder, QuickLink } from "../../../types";

export type SearchScope = "all" | "saved" | "folders" | "web";
export type SearchItem =
	| { type: "bookmark"; id: string; data: Card }
	| { type: "folder"; id: string; data: Folder }
	| { type: "quick-link"; id: string; data: QuickLink }
	| { type: "web" | "suggestion"; id: string; query: string }
	| { type: "url"; id: string; url: string };
export interface SearchGroup {
	id: string;
	label: string;
	items: SearchItem[];
}

export function searchDestination(query: string): string | null {
	const value = query.trim();
	if (!value || /\s/.test(value)) return null;
	// Ordinary sites only. Text containing a scheme is never reinterpreted as
	// a hostname (javascript:, data:, file: and extension URLs stay inert).
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

export function buildSearchGroups({
	query,
	scope,
	local,
	cards,
	folders,
	quickLinks,
	suggestions,
}: {
	query: string;
	scope: SearchScope;
	local: SearchResult;
	cards: Card[];
	folders: Folder[];
	quickLinks: QuickLink[];
	suggestions: string[];
}): SearchGroup[] {
	const q = query.trim();
	const groups: SearchGroup[] = [];
	const add = (id: string, label: string, items: SearchItem[]) => {
		if (items.length) groups.push({ id, label, items });
	};
	if (!q) {
		if (scope === "all")
			add(
				"quick-links",
				"Quick links",
				quickLinks.slice(0, 4).map((data) => ({
					type: "quick-link",
					id: `quick:${data.id}`,
					data,
				})),
			);
		if (scope === "all" || scope === "saved") {
			if (scope === "saved" || !quickLinks.length)
				add(
					"saved",
					"Saved pages",
					[...cards]
						.sort((a, b) => a.order - b.order)
						.slice(0, 5)
						.map((data) => ({
							type: "bookmark",
							id: `bookmark:${data.id}`,
							data,
						})),
				);
		}
		if (scope === "all" || scope === "folders")
			add(
				"folders",
				"Your folders",
				[...folders]
					.sort((a, b) => a.order - b.order)
					.slice(0, scope === "all" ? 3 : 8)
					.map((data) => ({ type: "folder", id: `folder:${data.id}`, data })),
			);
		return groups;
	}
	if (scope === "all" || scope === "saved")
		add(
			"saved",
			"Saved pages",
			local.sites
				.slice(0, scope === "all" ? 6 : 16)
				.map((data) => ({ type: "bookmark", id: `bookmark:${data.id}`, data })),
		);
	if (scope === "all" || scope === "folders")
		add(
			"folders",
			"Folders",
			local.folders
				.slice(0, scope === "all" ? 3 : 8)
				.map((data) => ({ type: "folder", id: `folder:${data.id}`, data })),
		);
	if (scope === "all") {
		const savedUrls = new Set(
			local.sites.map((card) => card.url.replace(/\/$/, "")),
		);
		add(
			"quick-links",
			"Quick links",
			quickLinks
				.filter(
					(link) =>
						matchesSearchTerms(`${link.label} ${link.url}`, q) &&
						!savedUrls.has(link.url.replace(/\/$/, "")),
				)
				.slice(0, 3)
				.map((data) => ({ type: "quick-link", id: `quick:${data.id}`, data })),
		);
	}
	if (scope === "all" || scope === "web") {
		const url = searchDestination(q);
		const web: SearchItem[] = url ? [{ type: "url", id: "open-url", url }] : [];
		web.push({ type: "web", id: "web-search", query: q });
		const seen = new Set([q.toLowerCase()]);
		for (const suggestion of suggestions) {
			const value = suggestion.trim();
			if (!value || seen.has(value.toLowerCase())) continue;
			seen.add(value.toLowerCase());
			web.push({ type: "suggestion", id: `suggestion:${value}`, query: value });
			if (web.length >= (url ? 5 : 4)) break;
		}
		add("web", "On the web", web);
	}
	return groups;
}

export function activeSearchIndex(
	items: SearchItem[],
	activeId: string | null,
	hasQuery: boolean,
): number {
	const index = items.findIndex((item) => item.id === activeId);
	return index >= 0 ? index : hasQuery && items.length ? 0 : -1;
}
