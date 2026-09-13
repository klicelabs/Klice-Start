import { Icon } from "@klice-start/ui/icons/icon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SEARCH_ENGINES } from "../../../lib/constants";
import { getBreadcrumb } from "../../../lib/folder-tree";
import { glassDropdown, glassText } from "../../../lib/glass";
import { searchIndex } from "../../../lib/search-index";
import { faviconUrl } from "../../../lib/url";
import { useSetupStore } from "../../../stores/setup-store";
import type { Card, Folder } from "../../../types";
import { useAppearance } from "../appearance-provider";

interface GlobalSearchProps {
	open: boolean;
	onClose: () => void;
	onNavigateFolder: (id: string) => void;
}

type SearchItem =
	| { type: "site"; data: Card }
	| { type: "folder"; data: Folder }
	| { type: "web"; query: string };

/**
 * Spotlight-style global search overlay. Triggered by toolbar search button
 * or Ctrl+K / Cmd+K. Searches cards (title + URL) and folders (name), with
 * instant web search fallback.
 */
export function GlobalSearch({
	open,
	onClose,
	onNavigateFolder,
}: GlobalSearchProps) {
	const { isLiquid } = useAppearance();
	const cards = useSetupStore((s) => s.cards);
	const folders = useSetupStore((s) => s.folders);
	const openInNewTab = useSetupStore((s) => s.settings.openInNewTab);
	const searchSettings = useSetupStore((s) => s.settings.search);

	const [query, setQuery] = useState("");
	const [selectedIdx, setSelectedIdx] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	const activeEngine =
		SEARCH_ENGINES.find((e) => e.id === searchSettings.engine) ??
		SEARCH_ENGINES[0];

	// Reset on open/close.
	useEffect(() => {
		if (open) {
			setQuery("");
			setSelectedIdx(0);
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [open]);

	// Search results.
	const results = useMemo(
		() => searchIndex(query, cards, folders),
		[query, cards, folders],
	);

	// Flat list for keyboard navigation: sites first, then folders, then web fallback.
	const flatResults = useMemo((): SearchItem[] => {
		const items: SearchItem[] = [
			...results.sites.map((c) => ({ type: "site" as const, data: c })),
			...results.folders.map((f) => ({ type: "folder" as const, data: f })),
		];
		if (query.trim().length > 0) {
			items.push({ type: "web", query: query.trim() });
		}
		return items;
	}, [results, query]);

	// Clamp selected index.
	useEffect(() => {
		setSelectedIdx((prev) =>
			Math.max(0, Math.min(prev, flatResults.length - 1)),
		);
	}, [flatResults.length]);

	const handleExecuteWebSearch = useCallback(
		(q: string) => {
			const url = activeEngine.queryUrl.replace("%s", encodeURIComponent(q));
			window.open(url, openInNewTab ? "_blank" : "_self");
			onClose();
		},
		[activeEngine, openInNewTab, onClose],
	);

	const handleSelect = useCallback(
		(idx: number) => {
			const item = flatResults[idx];
			if (!item) return;
			if (item.type === "site") {
				window.open(item.data.url, openInNewTab ? "_blank" : "_self");
				onClose();
			} else if (item.type === "folder") {
				onNavigateFolder(item.data.id);
			} else if (item.type === "web") {
				handleExecuteWebSearch(item.query);
			}
		},
		[
			flatResults,
			openInNewTab,
			onNavigateFolder,
			handleExecuteWebSearch,
			onClose,
		],
	);

	// Keyboard navigation with wrap-around.
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
				return;
			}
			if (flatResults.length === 0) return;

			if (e.key === "ArrowDown") {
				e.preventDefault();
				setSelectedIdx((prev) => (prev + 1) % flatResults.length);
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setSelectedIdx((prev) =>
					prev <= 0 ? flatResults.length - 1 : prev - 1,
				);
			} else if (e.key === "Enter") {
				e.preventDefault();
				handleSelect(selectedIdx);
			}
		},
		[flatResults.length, selectedIdx, handleSelect, onClose],
	);

	// Scroll selected item into view.
	useEffect(() => {
		const list = listRef.current;
		if (!list) return;
		const el = list.querySelector(`[data-idx="${selectedIdx}"]`);
		if (el && typeof el.scrollIntoView === "function") {
			el.scrollIntoView({ block: "nearest" });
		}
	}, [selectedIdx]);

	if (!open) return null;

	const hasQuery = query.trim().length > 0;

	return (
		<div
			className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
			role="dialog"
			aria-modal="true"
			aria-label="Search"
			onClick={onClose}
			onKeyDown={(e) => e.key === "Escape" && onClose()}
		>
			{/* Scrim */}
			<div
				className={`absolute inset-0 bg-black/60 transition-opacity duration-150 ${
					isLiquid ? "backdrop-blur-sm" : ""
				}`}
			/>

			{/* Search container */}
			<search
				className={`relative mx-4 w-full max-w-[580px] ${glassDropdown(isLiquid)} overflow-hidden rounded-2xl shadow-2xl`}
				onClick={(e) => e.stopPropagation()}
				onKeyDown={handleKeyDown}
			>
				{/* Search input */}
				<div className="flex items-center gap-3 px-4 py-3.5">
					<Icon
						name="search"
						size={18}
						className={`shrink-0 ${glassText(isLiquid, "muted")}`}
					/>
					<input
						ref={inputRef}
						type="text"
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setSelectedIdx(0);
						}}
						placeholder="Search bookmarks and folders..."
						aria-label="Search bookmarks and folders"
						className={`flex-1 bg-transparent text-[15px] outline-none ${
							isLiquid
								? "text-white/90 placeholder:text-white/75"
								: "text-foreground placeholder:text-muted-foreground"
						}`}
						autoComplete="off"
						spellCheck={false}
					/>
					<kbd
						className={`hidden items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium text-[10px] sm:inline-flex ${
							isLiquid
								? "border border-white/10 bg-white/[0.08] text-white/75"
								: "border border-flat-edge bg-flat-sunken text-flat-ink-muted"
						}`}
					>
						ESC
					</kbd>
				</div>

				{/* Separator */}
				<div className={`h-px ${isLiquid ? "bg-white/[0.08]" : "bg-separator-groove"}`} />

				{/* Results */}
				<div ref={listRef} className="max-h-[380px] overflow-y-auto py-1">
					{!hasQuery ? (
						<div
							className={`px-4 py-8 text-center text-[13px] ${glassText(isLiquid, "muted")}`}
						>
							Type to search bookmarks, folders, or the web
						</div>
					) : (
						<>
							{/* Sites group */}
							{results.sites.length > 0 && (
								<div className="py-1">
									<div
										className={`px-4 py-1 font-semibold text-[10px] uppercase tracking-wider ${glassText(isLiquid, "muted")}`}
									>
										Bookmarks
									</div>
									{results.sites.map((card) => {
										const flatIdx = flatResults.findIndex(
											(r) => r.type === "site" && r.data.id === card.id,
										);
										return (
											<button
												key={card.id}
												type="button"
												data-idx={flatIdx}
												onClick={() => handleSelect(flatIdx)}
												title={`${card.title || card.url} (${card.url})`}
												className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-75 ${
													flatIdx === selectedIdx
														? isLiquid
															? "bg-white/[0.12]"
															: "bg-flat-sunken-raised"
														: ""
												} ${
													isLiquid
														? "hover:bg-white/[0.06]"
									: "hover:bg-flat-sunken-raised"
												}`}
											>
												<img
													src={card.favicon || faviconUrl(card.url)}
													alt=""
													className="size-4 shrink-0 rounded-xs"
													onError={(e) => {
														(e.target as HTMLImageElement).onerror = null;
														(e.target as HTMLImageElement).style.display =
															"none";
													}}
												/>
												<div className="min-w-0 flex-1">
													<div
														className={`truncate font-medium text-[13px] ${glassText(isLiquid, "primary")}`}
													>
														{card.title || card.url}
													</div>
													<div
														className={`truncate text-[11px] ${glassText(isLiquid, "muted")}`}
													>
														{card.url}
													</div>
												</div>
											</button>
										);
									})}
								</div>
							)}

							{/* Folders group */}
							{results.folders.length > 0 && (
								<div className="py-1">
									<div
										className={`px-4 py-1 font-semibold text-[10px] uppercase tracking-wider ${glassText(isLiquid, "muted")}`}
									>
										Folders
									</div>
									{results.folders.map((folder) => {
										const flatIdx = flatResults.findIndex(
											(r) => r.type === "folder" && r.data.id === folder.id,
										);
										const crumbs = getBreadcrumb(folders, folder.id);
										const path = crumbs.map((c) => c.name).join(" / ");
										return (
											<button
												key={folder.id}
												type="button"
												data-idx={flatIdx}
												onClick={() => handleSelect(flatIdx)}
												title={path}
												className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-75 ${
													flatIdx === selectedIdx
														? isLiquid
															? "bg-white/[0.12]"
															: "bg-flat-sunken-raised"
														: ""
												} ${
													isLiquid
														? "hover:bg-white/[0.06]"
									: "hover:bg-flat-sunken-raised"
												}`}
											>
												<Icon
													name="folder"
													size={16}
													className="shrink-0 opacity-70"
												/>
												<div className="min-w-0 flex-1">
													<div
														className={`truncate font-medium text-[13px] ${glassText(isLiquid, "primary")}`}
													>
														{folder.name}
													</div>
													{crumbs.length > 1 && (
														<div
															className={`truncate text-[11px] ${glassText(isLiquid, "muted")}`}
														>
															{path}
														</div>
													)}
												</div>
											</button>
										);
									})}
								</div>
							)}

							{/* Web Search fallback row */}
							{hasQuery && (
								<div className="border-border/30 border-t py-1">
									{(() => {
										const webIdx = flatResults.findIndex(
											(r) => r.type === "web",
										);
										return (
											<button
												type="button"
												data-idx={webIdx}
												onClick={() => handleSelect(webIdx)}
												className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-75 ${
													webIdx === selectedIdx
														? isLiquid
															? "bg-white/[0.12]"
															: "bg-flat-sunken-raised"
														: ""
												} ${
													isLiquid
														? "hover:bg-white/[0.06]"
									: "hover:bg-flat-sunken-raised"
												}`}
											>
												<div className="flex size-4 shrink-0 items-center justify-center rounded-xs bg-primary/20 text-primary">
													<Icon name="search" size={12} />
												</div>
												<div className="min-w-0 flex-1">
													<div
														className={`truncate font-medium text-[13px] ${glassText(isLiquid, "primary")}`}
													>
														Search {activeEngine.label} for &ldquo;
														{query.trim()}&rdquo;
													</div>
													<div
														className={`truncate text-[11px] ${glassText(isLiquid, "muted")}`}
													>
														Open web search in new tab
													</div>
												</div>
											</button>
										);
									})()}
								</div>
							)}
						</>
					)}
				</div>
			</search>
		</div>
	);
}
