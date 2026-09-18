"use client";

import { SharedLayoutBg } from "@klice-start/ui/components/motion/shared-layout-bg";
import { Icon } from "@klice-start/ui/icons/icon";
import { useReducedMotion } from "motion/react";
import {
	type FormEvent,
	forwardRef,
	type KeyboardEvent as ReactKeyboardEvent,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import { useSvgIcon } from "../../../hooks/use-svg-icon";
import { SEARCH_ENGINES } from "../../../lib/constants";
import { getBreadcrumb } from "../../../lib/folder-tree";
import { glassForeground, glassText } from "../../../lib/glass";
import { createSearchIndex } from "../../../lib/search-index";
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
const SEARCH_GEOMETRY_CSS = `max-height ${SEARCH_MOTION_DURATION}ms ${SEARCH_MOTION_EASING}, border-radius ${SEARCH_MOTION_DURATION}ms ${SEARCH_MOTION_EASING}`;
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
	const { isLiquid, resolvedDark } = useAppearance();
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
	const [logoFailedFor, setLogoFailedFor] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const shellRef = useRef<HTMLDivElement>(null);
	const resultsRef = useRef<HTMLDivElement>(null);
	const closeCleanupRef = useRef<number | null>(null);
	const compactTriggerRef = useRef<HTMLElement | null>(null);
	const reduceMotion = useReducedMotion() ?? false;

	const engine =
		SEARCH_ENGINES.find((item) => item.id === engineId) ?? SEARCH_ENGINES[0];
	const placeholder =
		customPlaceholder.trim() || `Search with "${engine.label}"`;
	const svglTitle =
		iconMode === "engine" ? SEARCH_ENGINE_TO_SVGL[engineId] : null;
	const { svgXml, isLoading } = useSvgIcon(svglTitle);
	const showEngineLogo = iconMode === "engine" && logoFailedFor !== engineId;
	const folderPathById = useMemo(() => {
		const paths = new Map<string, string>();
		for (const folder of folders) {
			paths.set(folder.id, displayPath(folders, folder.id));
		}
		return paths;
	}, [folders]);

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

	const localSearchIndex = useMemo(
		() => createSearchIndex(cards, folders),
		[cards, folders],
	);
	const localResults = useMemo(
		() => localSearchIndex(query),
		[localSearchIndex, query],
	);

	useEffect(() => {
		if (!open) return;
		setSuggestions([]);
		const controller = new AbortController();
		const timer = window.setTimeout(() => {
			getSearchSuggestions(engine, query, controller.signal, {
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
		compactTriggerRef.current = null;

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
				const activeElement = document.activeElement;
				compactTriggerRef.current =
					activeElement instanceof Element
						? activeElement.closest<HTMLElement>(
								"[data-compact-search-control]",
							)
						: null;
				openSearch();
				// The compact toolbar trigger opens the mounted main Search. Wait one
				// frame for the open state before focusing its input so the handoff
				// remains reliable without moving the scroll position.
				requestAnimationFrame(() => {
					inputRef.current?.focus({ preventScroll: true });
				});
			},
		}),
		[openSearch],
	);

	useEffect(() => {
		function closeOnOutsidePointer(event: PointerEvent) {
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (
				shellRef.current?.contains(target) ||
				resultsRef.current?.contains(target) ||
				(target instanceof Element &&
					target.closest("[data-compact-search-control]"))
			) {
				return;
			}
			close();
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
			// M17: this Esc belongs to the search — without stopPropagation()
			// it reaches the dial-grid window listener and clears the
			// selection as a side effect (repo convention: Esc consumers
			// stop their own event, see inline-rename-input.tsx).
			event.stopPropagation();
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
				className={cn("shrink-0", glassForeground())}
			/>
		);

	const groupLabel = (label: string, key: string) => (
		<div
			key={key}
			data-shared-bg-skip
			className={cn(
				"px-3 pt-2.5 pb-1 font-normal text-[12px]",
				glassText(isLiquid, "muted", resolvedDark),
			)}
		>
			{label}
		</div>
	);

	let flatIndex = 0;
	// The SharedLayoutBg pill owns the ONLY background: rows paint
	// foreground (and keep selection semantics) but never a competing bg.
	const option = (item: SearchItem, content: React.ReactNode) => {
		const index = flatIndex++;
		const selected = index === selectedIndex;
		return (
			<button
				key={item.id}
				type="button"
				role="option"
				aria-selected={selected}
				tabIndex={-1}
				id={`klice-search-option-${index}`}
				data-search-index={index}
				onMouseEnter={() => setSelectedIndex(index)}
				onFocus={() => setSelectedIndex(index)}
				onClick={() => selectItem(item)}
				className={cn(
					"relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition-colors duration-100",
					selected
						? "text-[var(--klice-accent-foreground)]"
						: isLiquid
							? glassForeground()
							: "text-flat-ink-muted",
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
				<span className="block truncate font-normal text-[14px]">
					{card.title || card.url}
				</span>
				<span
					className={cn(
						"block truncate text-[11px]",
						glassForeground("secondary"),
					)}
				>
					{folderPathById.get(card.folderId) ?? ""}
				</span>
			</span>
		</>
	);

	const resultNodes: React.ReactNode[] = [];
	const trimmedQuery = query.trim();
	if (!trimmedQuery) {
		const emptySuggestionValues =
			suggestions.length > 0
				? suggestions.slice(0, 4)
				: fallbackSuggestionQueries;
		if (emptySuggestionValues.length > 0) {
			resultNodes.push(groupLabel("Suggestions", "suggestions-label"));
			for (const value of emptySuggestionValues) {
				resultNodes.push(
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
								className={cn("shrink-0", glassForeground())}
							/>
							<span className="truncate text-[14px]">{value}</span>
						</>,
					),
				);
			}
		}

		if (frequentCards.length > 0) {
			resultNodes.push(groupLabel("Suggested", "frequent-label"));
			for (const card of frequentCards) {
				resultNodes.push(
					option(
						{ type: "frequent", id: `frequent:${card.id}`, data: card },
						bookmarkContent(card),
					),
				);
			}
		}

		if (emptySuggestionValues.length === 0 && frequentCards.length === 0) {
			resultNodes.push(
				<p
					key="empty-results"
					data-shared-bg-skip
					className={cn(
						"px-3 py-8 text-center text-[13px]",
						glassText(isLiquid, "muted", resolvedDark),
					)}
				>
					Type to search Klice or the web
				</p>,
			);
		}
	} else {
		if (suggestions.length > 0) {
			resultNodes.push(groupLabel("Search suggestions", "suggestions-label"));
			for (const value of suggestions.slice(0, 4)) {
				resultNodes.push(
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
								className={cn("shrink-0", glassForeground())}
							/>
							<span className="truncate text-[14px]">{value}</span>
						</>,
					),
				);
			}
		}

		if (localResults.folders.length > 0 || localResults.sites.length > 0) {
			resultNodes.push(groupLabel("Klice", "klice-label"));
			for (const folder of localResults.folders) {
				resultNodes.push(
					option(
						{ type: "folder", id: `folder:${folder.id}`, data: folder },
						<>
							<Icon
								name="folder"
								size={17}
								className={cn("shrink-0", glassForeground())}
							/>
							<span className="min-w-0 truncate">
								<span className="block truncate font-normal text-[14px]">
									{folder.name}
								</span>
								<span
									className={cn(
										"block truncate text-[11px]",
										glassForeground("secondary"),
									)}
								>
									{folderPathById.get(folder.id) ?? ""}
								</span>
							</span>
						</>,
					),
				);
			}
			for (const card of localResults.sites) {
				resultNodes.push(
					option(
						{ type: "bookmark", id: `bookmark:${card.id}`, data: card },
						bookmarkContent(card),
					),
				);
			}
		}

		resultNodes.push(groupLabel("Web", "web-label"));
		resultNodes.push(
			option(
				{ type: "web", id: "web-search", query: trimmedQuery },
				<>
					<Icon
						name="globe"
						size={16}
						className={cn("shrink-0", glassForeground())}
					/>
					<span className="min-w-0 truncate">
						<span className="block truncate font-normal text-[14px]">
							Search {engine.label} for “{trimmedQuery}”
						</span>
						<span
							className={cn(
								"block truncate text-[11px]",
								glassForeground("secondary"),
							)}
						>
							Open web search
						</span>
					</span>
				</>,
			),
		);
	}

	return (
		<div
			ref={shellRef}
			className="relative w-full max-w-2xl"
			data-unified-search
			data-search-open={open ? "true" : "false"}
		>
			<GlassSurface
				variant={open ? "search" : "hero"}
				shape={open ? "searchExpanded" : "searchCollapsed"}
				className={cn(
					"relative w-full flex-col items-stretch overflow-hidden",
					!open && "hover:brightness-[1.04]",
				)}
				style={{
					// Keep input and results in one mounted material surface. The
					// max-height transition clips the natural result list without a
					// ResizeObserver/state feedback loop. Corner geometry comes
					// from the shape role (concentric with the toolbar system),
					// never an inline radius.
					height: open ? "auto" : 56,
					maxHeight: open ? "min(504px, calc(100vh - 10rem))" : 56,
					transition: reduceMotion ? "none" : SEARCH_GEOMETRY_CSS,
				}}
			>
				<form
					onSubmit={handleSubmit}
					onKeyDown={handleKeyDown}
					onPointerDown={(event) => {
						if (event.button !== 0) return;
						compactTriggerRef.current = null;
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
								? // Expanded search is a dense frosted surface and the
									// collapsed hero floats on the wallpaper: both pair
									// dark ink with Light, white ink with Dark.
									cn(
										glassForeground(),
										"placeholder:text-[var(--klice-glass-foreground-secondary)]",
									)
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
									? `${glassForeground()} hover:bg-foreground/10 hover:text-[var(--klice-glass-foreground-primary)]`
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
									? "border border-foreground/10 bg-foreground/[0.06] text-[var(--klice-glass-foreground-secondary)]"
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
						"max-h-[min(28rem,calc(100vh-10rem-3.5rem))] min-h-0 overflow-y-auto border-t px-2 pt-1 pb-2",
						isLiquid ? "border-foreground/10" : "border-separator-groove",
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
					<SharedLayoutBg
						inset={8}
						// The pill IS the selection surface (accent, both modes):
						// rows own foreground only, so keyboard selection and
						// pointer hover resolve to the same single highlight.
						activeKey={items[selectedIndex]?.id ?? null}
						pillClassName="rounded-xl bg-[var(--klice-accent)]"
						className="gap-0.5"
					>
						{resultNodes}
					</SharedLayoutBg>
				</div>
			</GlassSurface>
		</div>
	);
});
