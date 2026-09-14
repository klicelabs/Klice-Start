"use client";

import { Icon } from "@klice-start/ui/icons/icon";
import { useReducedMotion } from "motion/react";
import {
	type FormEvent,
	forwardRef,
	type KeyboardEvent as ReactKeyboardEvent,
	useCallback,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useSvgIcon } from "../../../hooks/use-svg-icon";
import { SEARCH_ENGINES } from "../../../lib/constants";
import { getBreadcrumb } from "../../../lib/folder-tree";
import { glassText } from "../../../lib/glass";
import { searchIndex } from "../../../lib/search-index";
import { SEARCH_ENGINE_TO_SVGL } from "../../../lib/svgl-mapping";
import { faviconUrl } from "../../../lib/url";
import { cn } from "../../../lib/utils";
import { useSetupStore } from "../../../stores/setup-store";
import type { Card, Folder } from "../../../types";
import { SvgIcon } from "../../shared/svg-icon";
import { useAppearance } from "../appearance-provider";
import { GlassSurface } from "../toolbar/glass-surface";
import { getSearchSuggestions } from "./search-suggestions";

const SEARCH_MOTION_DURATION = 160;
const SEARCH_MOTION_EASING = "var(--ease-out)";
const SEARCH_GEOMETRY_CSS = `height ${SEARCH_MOTION_DURATION}ms ${SEARCH_MOTION_EASING}, border-radius ${SEARCH_MOTION_DURATION}ms ${SEARCH_MOTION_EASING}`;
const SEARCH_CONTENT_CSS = `opacity ${SEARCH_MOTION_DURATION}ms ${SEARCH_MOTION_EASING}, transform ${SEARCH_MOTION_DURATION}ms ${SEARCH_MOTION_EASING}`;

export interface UnifiedSearchHandle {
	focus: () => void;
}

interface UnifiedSearchProps {
	onNavigateFolder: (id: string) => void;
}

type SearchItem =
	| {
			type: "suggestion";
			id: string;
			query: string;
			source: "web" | "local";
	  }
	| { type: "folder"; id: string; data: Folder }
	| { type: "bookmark"; id: string; data: Card }
	| { type: "frequent"; id: string; data: Card }
	| { type: "web"; id: string; query: string };

function displayPath(folders: Folder[], folderId: string): string {
	return getBreadcrumb(folders, folderId)
		.map((folder) => folder.name)
		.join(" / ");
}

export const UnifiedSearch = forwardRef<
	UnifiedSearchHandle,
	UnifiedSearchProps
>(function UnifiedSearch({ onNavigateFolder }, ref) {
	const { isLiquid } = useAppearance();
	const enabled = useSetupStore((s) => s.settings.search.enabled);
	const engineId = useSetupStore((s) => s.settings.search.engine);
	const customPlaceholder = useSetupStore((s) => s.settings.search.placeholder);
	const iconMode = useSetupStore((s) => s.settings.search.iconMode);
	const openInNewTab = useSetupStore((s) => s.settings.openInNewTab);
	const cards = useSetupStore((s) => s.cards);
	const folders = useSetupStore((s) => s.folders);
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [suggestions, setSuggestions] = useState<string[]>([]);
	const [resultsHeight, setResultsHeight] = useState(0);
	const [logoFailedFor, setLogoFailedFor] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const shellRef = useRef<HTMLDivElement>(null);
	const resultsRef = useRef<HTMLDivElement>(null);
	const closeCleanupRef = useRef<number | null>(null);
	const reduceMotion = useReducedMotion() ?? false;

	const engine =
		SEARCH_ENGINES.find((item) => item.id === engineId) ?? SEARCH_ENGINES[0];
	const placeholder =
		customPlaceholder.trim() || `Search with "${engine.label}"`;
	const svglTitle =
		iconMode === "engine" ? SEARCH_ENGINE_TO_SVGL[engineId] : null;
	const { svgXml, isLoading } = useSvgIcon(svglTitle);
	const showEngineLogo = iconMode === "engine" && logoFailedFor !== engineId;

	// Klice does not persist visit telemetry in the Card model yet. Keep the
	// empty state useful with a deterministic relevance fallback: authored
	// folder names become local query suggestions and authored cards become the
	// compact Frequently visited list. No fake links or recommendations are
	// invented.
	const fallbackSuggestionQueries = useMemo(() => {
		const seen = new Set<string>();
		const values: string[] = [];
		const candidates = [
			...folders
				.slice()
				.sort((a, b) => a.order - b.order)
				.map((folder) => folder.name),
			...cards
				.slice()
				.sort((a, b) => a.order - b.order)
				.map((card) => card.title || card.url),
		];
		for (const candidate of candidates) {
			const value = candidate.trim();
			if (!value || seen.has(value.toLowerCase())) continue;
			seen.add(value.toLowerCase());
			values.push(value);
			if (values.length === 4) break;
		}
		return values;
	}, [cards, folders]);

	const frequentCards = useMemo(
		() =>
			cards
				.slice()
				.sort((a, b) => a.order - b.order)
				.slice(0, 4),
		[cards],
	);

	const localResults = useMemo(
		() => searchIndex(query, cards, folders),
		[query, cards, folders],
	);

	useEffect(() => {
		if (!open) return;
		setSuggestions([]);
		const controller = new AbortController();
		const timer = window.setTimeout(() => {
			void getSearchSuggestions(engine, query, controller.signal, {
				allowEmpty: query.trim().length === 0,
			}).then((values) => {
				if (!controller.signal.aborted) setSuggestions(values);
			});
		}, 180);
		return () => {
			controller.abort();
			window.clearTimeout(timer);
		};
	}, [engine, open, query]);

	// Keep the open surface's target height measurable while it is visually
	// collapsed. This lets the shell animate one explicit height/radius timeline
	// without Motion's layout projection inventing a transform for an absolute
	// search anchor. ResizeObserver also keeps the target correct as provider
	// suggestions or the viewport change.
	useLayoutEffect(() => {
		const results = resultsRef.current;
		if (!results) return;
		const updateHeight = () => {
			const nextHeight = Math.ceil(results.getBoundingClientRect().height);
			if (nextHeight > 0) setResultsHeight(nextHeight);
		};
		updateHeight();
		const observer = new ResizeObserver(updateHeight);
		observer.observe(results);
		return () => observer.disconnect();
	}, []);

	const items = useMemo<SearchItem[]>(() => {
		const externalSuggestions = suggestions.slice(0, 4);
		const emptySuggestions = externalSuggestions.length
			? externalSuggestions
			: fallbackSuggestionQueries;
		const next: SearchItem[] = (
			query.trim() ? externalSuggestions : emptySuggestions
		).map((value) => ({
			type: "suggestion",
			id: `suggestion:${value}`,
			query: value,
			source: query.trim() || externalSuggestions.length > 0 ? "web" : "local",
		}));
		if (!query.trim()) {
			for (const card of frequentCards) {
				next.push({ type: "frequent", id: `frequent:${card.id}`, data: card });
			}
			return next;
		}
		for (const folder of localResults.folders) {
			next.push({ type: "folder", id: `folder:${folder.id}`, data: folder });
		}
		for (const card of localResults.sites) {
			next.push({ type: "bookmark", id: `bookmark:${card.id}`, data: card });
		}
		if (query.trim()) {
			next.push({ type: "web", id: "web-search", query: query.trim() });
		}
		return next;
	}, [
		fallbackSuggestionQueries,
		frequentCards,
		localResults.folders,
		localResults.sites,
		query,
		suggestions,
	]);

	// Reset the active option whenever the result identity changes so keyboard
	// navigation always starts at the first visible result.
	// biome-ignore lint/correctness/useExhaustiveDependencies: items identity is the intentional reset signal.
	useEffect(() => {
		setSelectedIndex(0);
	}, [items]);

	const clearCloseCleanup = useCallback(() => {
		if (closeCleanupRef.current === null) return;
		window.clearTimeout(closeCleanupRef.current);
		closeCleanupRef.current = null;
	}, []);

	useEffect(() => clearCloseCleanup, [clearCloseCleanup]);

	const openSearch = useCallback(() => {
		// Reopening during the closing frame cancels only the deferred cleanup;
		// the existing geometry can retarget in place without remounting the
		// search or flashing a second result surface.
		clearCloseCleanup();
		setOpen(true);
	}, [clearCloseCleanup]);

	const close = useCallback(() => {
		clearCloseCleanup();
		setOpen(false);
		setSelectedIndex(0);

		if (reduceMotion) {
			setQuery("");
			setSuggestions([]);
			return;
		}

		// Keep the current result content mounted until the same geometry
		// timeline finishes. Clearing it synchronously changes the measured
		// height mid-close and produces the old radius/height hitch.
		closeCleanupRef.current = window.setTimeout(() => {
			closeCleanupRef.current = null;
			setQuery("");
			setSuggestions([]);
		}, SEARCH_MOTION_DURATION);
	}, [clearCloseCleanup, reduceMotion]);

	useImperativeHandle(
		ref,
		() => ({
			focus: () => {
				openSearch();
				inputRef.current?.focus({ preventScroll: true });
			},
		}),
		[openSearch],
	);

	useEffect(() => {
		function closeOnOutsidePointer(event: PointerEvent) {
			if (!shellRef.current?.contains(event.target as Node)) close();
		}
		document.addEventListener("pointerdown", closeOnOutsidePointer);
		return () =>
			document.removeEventListener("pointerdown", closeOnOutsidePointer);
	}, [close]);

	const executeWebSearch = useCallback(
		(searchQuery: string) => {
			const url = engine.queryUrl.replace(
				"%s",
				encodeURIComponent(searchQuery),
			);
			window.open(url, openInNewTab ? "_blank" : "_self");
			close();
		},
		[close, engine, openInNewTab],
	);

	const selectItem = useCallback(
		(item: SearchItem) => {
			switch (item.type) {
				case "suggestion":
					if (item.source === "local") {
						setQuery(item.query);
						setSelectedIndex(0);
						inputRef.current?.focus({ preventScroll: true });
						return;
					}
					executeWebSearch(item.query);
					return;
				case "web":
					executeWebSearch(item.query);
					return;
				case "folder":
					onNavigateFolder(item.data.id);
					close();
					return;
				case "bookmark":
				case "frequent":
					window.open(item.data.url, openInNewTab ? "_blank" : "_self");
					close();
			}
		},
		[close, executeWebSearch, onNavigateFolder, openInNewTab],
	);

	function handleSubmit(event: FormEvent) {
		event.preventDefault();
		const selected = items[selectedIndex];
		if (selected) selectItem(selected);
		else if (query.trim()) executeWebSearch(query.trim());
	}

	function handleKeyDown(event: ReactKeyboardEvent<HTMLFormElement>) {
		if (event.key === "Escape") {
			event.preventDefault();
			close();
			return;
		}
		if (event.key === "ArrowDown" && items.length > 0) {
			event.preventDefault();
			setSelectedIndex((index) => Math.min(index + 1, items.length - 1));
		} else if (event.key === "ArrowUp" && items.length > 0) {
			event.preventDefault();
			setSelectedIndex((index) => Math.max(index - 1, 0));
		} else if (event.key === "Enter") {
			event.preventDefault();
			handleSubmit(event);
		}
	}

	useEffect(() => {
		if (!open) return;

		const results = resultsRef.current;
		const active = results?.querySelector<HTMLElement>(
			`[data-search-index="${selectedIndex}"]`,
		);
		if (!results || !active) return;

		// Results are an absolute layer now. `scrollIntoView()` would walk up
		// through the Glass shell and scroll the search field itself out of view.
		// Keep keyboard navigation scoped to the results viewport instead.
		const activeTop = active.offsetTop;
		const activeBottom = activeTop + active.offsetHeight;
		const viewTop = results.scrollTop;
		const viewBottom = viewTop + results.clientHeight;

		if (activeTop < viewTop) {
			results.scrollTop = activeTop;
		} else if (activeBottom > viewBottom) {
			results.scrollTop = activeBottom - results.clientHeight;
		}
	}, [open, selectedIndex]);

	if (!enabled) return null;

	const inputIcon =
		showEngineLogo && svgXml && !isLoading ? (
			<SvgIcon svgXml={svgXml} className="size-5 shrink-0" alt={engine.label} />
		) : showEngineLogo ? (
			<img
				src={faviconUrl(engine.homepage)}
				alt=""
				className="size-5 shrink-0 rounded-[5px]"
				onError={() => setLogoFailedFor(engineId)}
			/>
		) : (
			<Icon
				name="search"
				size={19}
				className={cn("shrink-0", glassText(isLiquid, "muted"))}
			/>
		);

	const groupLabel = (label: string) => (
		<div
			className={cn(
				"px-3 pt-2 pb-1 font-semibold text-[10px] uppercase tracking-[0.12em]",
				glassText(isLiquid, "muted"),
			)}
		>
			{label}
		</div>
	);

	let flatIndex = 0;
	const option = (item: SearchItem, content: React.ReactNode) => {
		const index = flatIndex++;
		const selected = index === selectedIndex;
		return (
			<button
				key={item.id}
				type="button"
				role="option"
				aria-selected={selected}
				id={`klice-search-option-${index}`}
				data-search-index={index}
				onMouseEnter={() => setSelectedIndex(index)}
				onFocus={() => setSelectedIndex(index)}
				onClick={() => selectItem(item)}
				className={cn(
					"relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition-[background-color,color] duration-100",
					selected
						? isLiquid
							? "bg-white/[0.13] text-white"
							: "bg-flat-sunken-raised text-flat-ink"
						: isLiquid
							? "text-white/85 hover:bg-white/[0.08] hover:text-white"
							: "text-flat-ink-muted hover:bg-flat-sunken-raised hover:text-flat-ink",
					"focus-visible:ring-2 focus-visible:ring-[var(--klice-accent)] focus-visible:ring-inset",
				)}
			>
				{content}
			</button>
		);
	};

	const bookmarkContent = (card: Card) => (
		<>
			<img
				src={card.favicon || faviconUrl(card.url)}
				alt=""
				className="size-4 shrink-0 rounded-[4px]"
				onError={(event) => {
					event.currentTarget.style.visibility = "hidden";
				}}
			/>
			<span className="min-w-0 truncate">
				<span className="block truncate font-medium text-[14px]">
					{card.title || card.url}
				</span>
				<span className="block truncate text-[11px] opacity-60">
					{displayPath(folders, card.folderId)}
				</span>
			</span>
		</>
	);

	return (
		<div
			ref={shellRef}
			className="relative w-full max-w-2xl"
			data-unified-search
		>
			<GlassSurface
				className={cn(
					"relative w-full flex-col items-stretch overflow-hidden will-change-[height,border-radius]",
					!open && "hover:brightness-[1.04]",
				)}
				style={{
					height: open ? 56 + resultsHeight : 56,
					borderRadius: open ? 22 : 28,
					transition: reduceMotion ? "none" : SEARCH_GEOMETRY_CSS,
				}}
			>
				<form
					onSubmit={handleSubmit}
					onKeyDown={handleKeyDown}
					onPointerDown={(event) => {
						if (event.button !== 0) return;
						openSearch();
						inputRef.current?.focus({ preventScroll: true });
					}}
					className="flex h-14 w-full shrink-0 items-center gap-3 px-5"
				>
					{inputIcon}
					<input
						ref={inputRef}
						data-unified-search-input
						type="text"
						role="combobox"
						value={query}
						onFocus={openSearch}
						onChange={(event) => {
							setQuery(event.target.value);
							openSearch();
						}}
						placeholder={placeholder}
						aria-label={placeholder}
						aria-expanded={open}
						aria-controls="klice-search-results"
						aria-activedescendant={
							open && items[selectedIndex]
								? `klice-search-option-${selectedIndex}`
								: undefined
						}
						aria-autocomplete="list"
						className={cn(
							"min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:font-normal",
							isLiquid
								? "text-white placeholder:text-white/55"
								: "text-foreground placeholder:text-muted-foreground",
						)}
						autoComplete="off"
						spellCheck={false}
					/>
					{open && query && (
						<button
							type="button"
							aria-label="Clear search"
							onClick={() => {
								setQuery("");
								inputRef.current?.focus({ preventScroll: true });
							}}
							className={cn(
								"flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
								isLiquid
									? "text-white/55 hover:bg-white/10 hover:text-white"
									: "text-muted-foreground hover:bg-flat-sunken-raised hover:text-foreground",
							)}
						>
							<Icon name="x" size={15} />
						</button>
					)}
					{!open && (
						<kbd
							className={cn(
								"hidden rounded-md px-2 py-1 font-medium text-[10px] sm:block",
								isLiquid
									? "border border-white/10 bg-white/[0.08] text-white/65"
									: "border border-flat-edge bg-flat-sunken text-flat-ink-muted",
							)}
						>
							Ctrl K
						</kbd>
					)}
				</form>

				<div
					ref={resultsRef}
					id="klice-search-results"
					role="listbox"
					aria-label="Search results"
					aria-hidden={!open}
					inert={!open}
					className={cn(
						"absolute top-14 right-0 left-0 max-h-[min(28rem,calc(100vh-10rem))] overflow-y-auto px-2 pb-2 will-change-[transform,opacity]",
						isLiquid ? "border-white/10" : "border-separator-groove",
					)}
					style={{
						pointerEvents: open ? "auto" : "none",
						opacity: open ? 1 : 0,
						transform: open
							? "translate3d(0, 0, 0)"
							: "translate3d(0, -4px, 0)",
						transition: reduceMotion ? "none" : SEARCH_CONTENT_CSS,
					}}
				>
					{!query.trim() ? (
						<>
							{(suggestions.length > 0 ||
								fallbackSuggestionQueries.length > 0) && (
								<>
									{groupLabel("Suggestions")}
									{(suggestions.length > 0
										? suggestions.slice(0, 4)
										: fallbackSuggestionQueries
									).map((value) =>
										option(
											{
												type: "suggestion",
												id: `suggestion:${value}`,
												query: value,
												source: suggestions.length > 0 ? "web" : "local",
											},
											<>
												<Icon
													name="search"
													size={16}
													className="shrink-0 opacity-65"
												/>
												<span className="truncate text-[14px]">{value}</span>
											</>,
										),
									)}
								</>
							)}

							{frequentCards.length > 0 && (
								<>
									{groupLabel("Frequently visited")}
									{frequentCards.map((card) =>
										option(
											{
												type: "frequent",
												id: `frequent:${card.id}`,
												data: card,
											},
											bookmarkContent(card),
										),
									)}
								</>
							)}

							{suggestions.length === 0 &&
								fallbackSuggestionQueries.length === 0 &&
								frequentCards.length === 0 && (
									<p
										className={cn(
											"px-3 py-8 text-center text-[13px]",
											glassText(isLiquid, "muted"),
										)}
									>
										Type to search Klice or the web
									</p>
								)}
						</>
					) : (
						<>
							{suggestions.length > 0 && (
								<>
									{groupLabel("Search suggestions")}
									{suggestions.slice(0, 4).map((value) =>
										option(
											{
												type: "suggestion",
												id: `suggestion:${value}`,
												query: value,
												source: "web",
											},
											<>
												<Icon
													name="search"
													size={16}
													className="shrink-0 opacity-65"
												/>
												<span className="truncate text-[14px]">{value}</span>
											</>,
										),
									)}
								</>
							)}

							{(localResults.folders.length > 0 ||
								localResults.sites.length > 0) && (
								<>
									{groupLabel("Klice")}
									{localResults.folders.map((folder) =>
										option(
											{
												type: "folder",
												id: `folder:${folder.id}`,
												data: folder,
											},
											<>
												<Icon
													name="folder"
													size={17}
													className="shrink-0 opacity-70"
												/>
												<span className="min-w-0 truncate">
													<span className="block truncate font-medium text-[14px]">
														{folder.name}
													</span>
													<span className="block truncate text-[11px] opacity-60">
														{displayPath(folders, folder.id)}
													</span>
												</span>
											</>,
										),
									)}
								</>
							)}

							{localResults.sites.length > 0 &&
								localResults.sites.map((card) =>
									option(
										{
											type: "bookmark",
											id: `bookmark:${card.id}`,
											data: card,
										},
										bookmarkContent(card),
									),
								)}

							{groupLabel("Web")}
							{option(
								{ type: "web", id: "web-search", query: query.trim() },
								<>
									<Icon
										name="globe"
										size={16}
										className="shrink-0 opacity-70"
									/>
									<span className="min-w-0 truncate">
										<span className="block truncate font-medium text-[14px]">
											Search {engine.label} for “{query.trim()}”
										</span>
										<span className="block truncate text-[11px] opacity-60">
											Open web search
										</span>
									</span>
								</>,
							)}
						</>
					)}
				</div>
			</GlassSurface>
		</div>
	);
});
