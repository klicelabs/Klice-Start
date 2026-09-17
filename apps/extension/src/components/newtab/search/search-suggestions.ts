import type { SearchEngineDef } from "../../../lib/constants";

/**
 * Optional web suggestion adapter. Suggestions are deliberately best-effort:
 * the local Klice index and the normal web-search action never depend on a
 * third-party endpoint being reachable.
 */
export interface SearchSuggestionProvider {
	suggest: (query: string, signal: AbortSignal) => Promise<string[]>;
}

function jsonProvider(
	url: (query: string) => string,
	parse: (payload: unknown) => unknown,
): SearchSuggestionProvider {
	return {
		async suggest(query, signal) {
			const response = await fetch(url(query), {
				signal,
				credentials: "omit",
				headers: { Accept: "application/json" },
			});
			if (!response.ok) return [];
			const payload: unknown = await response.json();
			const values = parse(payload);
			if (!Array.isArray(values)) return [];
			const seen = new Set<string>();
			const suggestions: string[] = [];
			for (const value of values) {
				if (typeof value !== "string") continue;
				const suggestion = value.trim();
				if (!suggestion || seen.has(suggestion)) continue;
				seen.add(suggestion);
				suggestions.push(suggestion);
				if (suggestions.length === 4) break;
			}
			return suggestions;
		},
	};
}

const PROVIDERS: Record<string, SearchSuggestionProvider | undefined> = {
	// Firefox's JSON response is a stable, CORS-friendly endpoint and does not
	// require a search-engine-specific API key. Host access already exists for
	// normal web navigation in the extension manifest.
	google: jsonProvider(
		(query) =>
			`https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`,
		(payload) => (Array.isArray(payload) ? payload[1] : []),
	),
	duckduckgo: jsonProvider(
		(query) =>
			`https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}&kl=wt-wt`,
		(payload) =>
			Array.isArray(payload)
				? payload.flatMap((entry) =>
						entry && typeof entry === "object" && "phrase" in entry
							? [entry.phrase]
							: [],
					)
				: [],
	),
};

export async function getSearchSuggestions(
	engine: SearchEngineDef,
	query: string,
	signal: AbortSignal,
	options?: { allowEmpty?: boolean },
): Promise<string[]> {
	const provider = PROVIDERS[engine.id];
	const normalized = query.trim();
	if (!provider || (!options?.allowEmpty && normalized.length < 2)) return [];
	try {
		return await provider.suggest(normalized, signal);
	} catch {
		// Network/CSP/engine failures are intentionally silent. Search remains
		// useful through the local index and the explicit web-search row.
		return [];
	}
}
