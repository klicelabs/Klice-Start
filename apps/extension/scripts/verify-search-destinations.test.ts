import { expect, spyOn, test } from "bun:test";
import {
	createDestinationIndex,
	findBuiltinDestination,
} from "../src/components/newtab/search/search-destinations";
import {
	activeSearchIndex,
	buildSearchGroups,
	type SearchScope,
} from "../src/components/newtab/search/search-results";
import {
	getSearchSuggestions,
	parseGoogleSuggestions,
} from "../src/components/newtab/search/search-suggestions";
import { SEARCH_ENGINES } from "../src/lib/constants";
import type { Card } from "../src/types";

const google = SEARCH_ENGINES.find((engine) => engine.id === "google");
if (!google) throw new Error("Google engine missing");

const groupsFor = (query: string, scope: SearchScope = "all") =>
	buildSearchGroups({
		query,
		scope,
		local: { sites: [], folders: [] },
		cards: [],
		folders: [],
		quickLinks: [],
		suggestions: [],
	});

test("Wikipedia is the first destination without any saved sites, including the reported typos", () => {
	for (const query of [
		"wikipedia",
		"wekpedia",
		"wikepedia",
		"wikdpedia",
		"Wikipédia",
		"wikipédia",
		"wikipdeia",
	]) {
		const items = groupsFor(query).flatMap((group) => group.items);
		expect(items[0]).toMatchObject({
			type: "url",
			title: "Wikipedia",
			url: "https://www.wikipedia.org/",
		});
		expect(items[1]?.type).toBe("web");
	}
});

test("known names use their real TLDs and paths instead of appending .com", () => {
	for (const [query, url] of [
		["linear", "https://linear.app/"],
		["spotify", "https://open.spotify.com/"],
		["gmail", "https://mail.google.com/"],
		["x", "https://x.com/"],
	])
		expect(findBuiltinDestination(query)?.url).toBe(url);
});

test("the shared brand catalogue resolves additional unsaved apps and unique prefixes", () => {
	const find = createDestinationIndex([
		{ title: "Acme Notes", url: "https://notes.acme.test/app" },
		{ title: "GitLab", url: "https://gitlab.com/" },
	]);
	for (const query of ["acme notes", "acme", "acme n"]) {
		expect(find(query)?.url).toBe("https://notes.acme.test/app");
	}
	// GitHub is bundled, GitLab arrives from the catalogue: "git" is ambiguous.
	expect(find("git")).toBeNull();
	expect(find("gitlab")?.url).toBe("https://gitlab.com/");
});

test("ambiguous exact names and equally close typos do not invent a preferred site", () => {
	const find = createDestinationIndex([
		{ title: "Acme", url: "https://acme.test/" },
		{ title: "Acme", url: "https://acme.example/" },
		{ title: "Caliber", url: "https://caliber.test/" },
		{ title: "Caliper", url: "https://caliper.test/" },
	]);
	expect(find("acme")).toBeNull();
	expect(find("calimer")).toBeNull();
});

test("ordinary searches, unknown brands and unsafe expressions remain searches", () => {
	for (const query of [
		"",
		"a",
		"unknownbrandxyz",
		"wikipedia brasil",
		"figma templates",
		"javascript:google",
		"google.com",
		"what is wikipedia?",
	]) {
		expect(findBuiltinDestination(query)).toBeNull();
	}
	expect(groupsFor("unknownbrandxyz")[0]?.items[0]?.type).toBe("web");
});

test("unsafe catalogue URLs cannot become destinations", () => {
	const find = createDestinationIndex([
		{ title: "Danger App", url: "javascript:alert(1)" },
		{ title: "Password App", url: "https://user:secret@example.com/" },
	]);
	expect(find("danger app")).toBeNull();
	expect(find("password app")).toBeNull();
});

test("an explicitly typed URL wins over a recognized name", () => {
	expect(groupsFor("wikipedia.com/path?q=test")[0]?.items[0]).toMatchObject({
		type: "url",
		url: "https://wikipedia.com/path?q=test",
	});
});

test("web destinations respect Saved and Folders scopes", () => {
	expect(groupsFor("wikipedia", "saved")).toEqual([]);
	expect(groupsFor("wikipedia", "folders")).toEqual([]);
	expect(groupsFor("wikipedia", "web")[0]?.id).toBe("destination");
});

test("a saved homepage is promoted once while deeper pages remain available", () => {
	const card: Card = {
		id: "wiki",
		title: "Wikipedia",
		url: "https://wikipedia.org/",
		folderId: "root",
		order: 0,
		favicon: null,
		thumbId: null,
	};
	const deeper = {
		...card,
		id: "article",
		url: "https://wikipedia.org/wiki/Apple",
	};
	const items = buildSearchGroups({
		query: "wikipedia",
		scope: "all",
		local: { sites: [deeper, card], folders: [] },
		cards: [card, deeper],
		folders: [],
		quickLinks: [
			{ id: "quick", label: "Wikipedia", url: "https://www.wikipedia.org/" },
		],
		suggestions: [],
	}).flatMap((group) => group.items);
	expect(items[0]?.id).toBe("bookmark:wiki");
	expect(items.filter((item) => item.id === "bookmark:wiki")).toHaveLength(1);
	expect(items.some((item) => item.id === "bookmark:article")).toBe(true);
	expect(items.some((item) => item.type === "quick-link")).toBe(false);
});

test("Google navigation metadata becomes a website, not a textual search suggestion", () => {
	const parsed = parseGoogleSuggestions([
		"canva",
		["canvas", "http://canva.com", "canva pro"],
		["", "Canva", ""],
		[],
		{ "google:suggesttype": ["QUERY", "NAVIGATION", "QUERY"] },
	]);
	expect(parsed.queries).toEqual(["canvas", "canva pro"]);
	expect(parsed.navigation).toEqual([
		{ title: "Canva", url: "http://canva.com/" },
	]);
});

test("Google navigation is found even after the text suggestion limit", () => {
	const parsed = parseGoogleSuggestions([
		"app",
		["one", "two", "three", "four", "five", "https://acme.test/"],
		[],
		[],
		{
			"google:suggesttype": [
				"QUERY",
				"QUERY",
				"QUERY",
				"QUERY",
				"QUERY",
				"NAVIGATION",
			],
		},
	]);
	expect(parsed.queries).toHaveLength(4);
	expect(parsed.navigation[0]?.url).toBe("https://acme.test/");
});

test("navigation parser rejects unsafe URLs, deduplicates www and never promotes QUERY URLs", () => {
	const parsed = parseGoogleSuggestions([
		"app",
		[
			"javascript:alert(1)",
			"https://a.test",
			"https://www.a.test",
			"https://b.test",
			"https://user:secret@c.test",
		],
		[],
		[],
		{
			"google:suggesttype": [
				"NAVIGATION",
				"NAVIGATION",
				"NAVIGATION",
				"QUERY",
				"NAVIGATION",
			],
		},
	]);
	expect(parsed.navigation.map((site) => site.url)).toEqual([
		"https://a.test/",
	]);
	expect(parsed.queries).toEqual(["https://b.test"]);
	for (const payload of [null, {}, [], ["q", null], ["q", [null, 4, {}, ""]]])
		expect(parseGoogleSuggestions(payload)).toEqual({
			queries: [],
			navigation: [],
		});
});

test("a live destination leads without displacing an explicit keyboard selection", () => {
	const input = {
		query: "acme",
		scope: "all" as const,
		local: { sites: [], folders: [] },
		cards: [],
		folders: [],
		quickLinks: [],
		suggestions: ["acme notes"],
	};
	const before = buildSearchGroups(input).flatMap((group) => group.items);
	const after = buildSearchGroups({
		...input,
		navigation: [{ title: "Acme", url: "https://acme.test/" }],
	}).flatMap((group) => group.items);
	expect(after[0]).toMatchObject({ type: "url", url: "https://acme.test/" });
	const selected = before[1];
	expect(after[activeSearchIndex(after, selected?.id ?? null, true)]?.id).toBe(
		selected?.id,
	);
});

test("provider requests navigation metadata without cookies and preserves Unicode", async () => {
	const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
		new Response(
			JSON.stringify([
				"wiki",
				["wikipédia", "https://www.wikipedia.org/"],
				["", "Wikipedia"],
				[],
				{ "google:suggesttype": ["QUERY", "NAVIGATION"] },
			]),
			{ headers: { "Content-Type": "application/json; charset=UTF-8" } },
		),
	);
	try {
		const values = await getSearchSuggestions(
			google,
			"wiki",
			new AbortController().signal,
		);
		expect(values.queries).toEqual(["wikipédia"]);
		expect(values.navigation[0]?.url).toBe("https://www.wikipedia.org/");
		const [url, options] = fetchMock.mock.calls[0] ?? [];
		expect(String(url)).toContain("client=chrome");
		expect(options?.credentials).toBe("omit");
	} finally {
		fetchMock.mockRestore();
	}
});

test("DuckDuckGo retains text suggestions and never contacts Google", async () => {
	const engine = SEARCH_ENGINES.find((entry) => entry.id === "duckduckgo");
	if (!engine) throw new Error("DuckDuckGo engine missing");
	const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
		new Response(
			JSON.stringify([
				{ phrase: " wikipedia " },
				{ phrase: "wikipedia" },
				null,
				{ phrase: 42 },
				{ phrase: "wikipedia brasil" },
			]),
		),
	);
	try {
		expect(
			await getSearchSuggestions(engine, "wiki", new AbortController().signal),
		).toEqual({
			queries: ["wikipedia", "wikipedia brasil"],
			navigation: [],
		});
		expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
			"https://duckduckgo.com/ac/",
		);
	} finally {
		fetchMock.mockRestore();
	}
});

test("failed, aborted and unsupported providers leave local destinations usable", async () => {
	const fetchMock = spyOn(globalThis, "fetch").mockRejectedValue(
		new Error("offline"),
	);
	try {
		expect(
			await getSearchSuggestions(google, "wiki", new AbortController().signal),
		).toEqual({ queries: [], navigation: [] });
		expect(groupsFor("wekpedia")[0]?.items[0]?.type).toBe("url");
		fetchMock.mockClear();
		const controller = new AbortController();
		controller.abort();
		await getSearchSuggestions(google, "wiki", controller.signal);
		await getSearchSuggestions(
			{ ...google, id: "unsupported" },
			"wiki",
			new AbortController().signal,
		);
		expect(fetchMock).not.toHaveBeenCalled();
	} finally {
		fetchMock.mockRestore();
	}
});

test("late responses from cancelled requests are discarded even if fetch ignores abort", async () => {
	let respond!: (value: Response) => void;
	const fetchMock = spyOn(globalThis, "fetch").mockImplementation(
		() =>
			new Promise<Response>((resolve) => {
				respond = resolve;
			}),
	);
	try {
		const controller = new AbortController();
		const pending = getSearchSuggestions(google, "wiki", controller.signal);
		controller.abort();
		respond(new Response(JSON.stringify(["wiki", ["wikipedia"]])));
		expect(await pending).toEqual({ queries: [], navigation: [] });
	} finally {
		fetchMock.mockRestore();
	}
});
