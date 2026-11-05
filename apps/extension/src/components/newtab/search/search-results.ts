import {
	matchesSearchTerms,
	type SearchResult,
} from "../../../lib/search-index";
import type { Card, Folder, QuickLink } from "../../../types";
import {
	destinationKey,
	findBuiltinDestination,
	type SiteDestination,
	searchDestination,
} from "./search-destinations";

export { searchDestination } from "./search-destinations";

export type SearchScope = "all" | "saved" | "folders" | "web";
export type SearchItem =
	| { type: "bookmark"; id: string; data: Card }
	| { type: "folder"; id: string; data: Folder }
	| { type: "quick-link"; id: string; data: QuickLink }
	| { type: "web" | "suggestion"; id: string; query: string }
	| { type: "url"; id: string; url: string; title?: string };
export interface SearchGroup {
	id: string;
	label: string;
	items: SearchItem[];
}

export function buildSearchGroups({
	query,
	scope,
	local,
	cards,
	folders,
	quickLinks,
	suggestions,
	destination = findBuiltinDestination(query),
	navigation = [],
}: {
	query: string;
	scope: SearchScope;
	local: SearchResult;
	cards: Card[];
	folders: Folder[];
	quickLinks: QuickLink[];
	suggestions: string[];
	destination?: SiteDestination | null;
	navigation?: SiteDestination[];
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
	const urlKey = (url: string) => {
		const parsed = searchDestination(url);
		return parsed ? destinationKey(parsed) : url;
	};
	let promotedKey: string | null = null;
	if (scope === "all" || scope === "web") {
		const typed = searchDestination(q);
		const site = typed
			? { url: typed, title: undefined }
			: (destination ?? navigation[0]);
		const topUrl = site ? searchDestination(site.url) : null;
		if (site && topUrl) {
			const key = destinationKey(topUrl);
			promotedKey = key;
			const samePage = (url: string) => urlKey(url) === key;
			const saved =
				scope === "all" ? cards.find((card) => samePage(card.url)) : null;
			const shortcut =
				scope === "all" ? quickLinks.find((link) => samePage(link.url)) : null;
			add("destination", "Website", [
				saved
					? { type: "bookmark", id: `bookmark:${saved.id}`, data: saved }
					: shortcut
						? { type: "quick-link", id: `quick:${shortcut.id}`, data: shortcut }
						: { type: "url", id: `url:${key}`, url: topUrl, title: site.title },
			]);
		}
	}
	if (scope === "all" || scope === "saved")
		add(
			"saved",
			"Saved pages",
			local.sites
				.filter((card) => urlKey(card.url) !== promotedKey)
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
		const savedUrls = new Set(local.sites.map((card) => urlKey(card.url)));
		add(
			"quick-links",
			"Quick links",
			quickLinks
				.filter(
					(link) =>
						urlKey(link.url) !== promotedKey &&
						matchesSearchTerms(`${link.label} ${link.url}`, q) &&
						!savedUrls.has(urlKey(link.url)),
				)
				.slice(0, 3)
				.map((data) => ({ type: "quick-link", id: `quick:${data.id}`, data })),
		);
	}
	if (scope === "all" || scope === "web") {
		const web: SearchItem[] = [];
		web.push({ type: "web", id: "web-search", query: q });
		const seen = new Set([q.toLowerCase()]);
		for (const suggestion of suggestions) {
			const value = suggestion.trim();
			if (!value || seen.has(value.toLowerCase())) continue;
			seen.add(value.toLowerCase());
			web.push({ type: "suggestion", id: `suggestion:${value}`, query: value });
			if (web.length >= 4) break;
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
