import { Icon } from "@klice-start/ui/icons/icon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
	/** Navigate to a folder. */
	onNavigateFolder: (id: string) => void;
}

/**
 * Spotlight-style global search overlay. Triggered by toolbar search button
 * or Ctrl+K / Cmd+K. Searches cards (title + URL) and folders (name).
 * Results grouped by type with keyboard navigation.
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

	const [query, setQuery] = useState("");
	const [selectedIdx, setSelectedIdx] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	// Reset on open/close.
	useEffect(() => {
		if (open) {
			setQuery("");
			setSelectedIdx(0);
			const id = setTimeout(() => inputRef.current?.focus(), 60);
			return () => clearTimeout(id);
		}
	}, [open]);

	// Search results.
	const results = useMemo(
		() => searchIndex(query, cards, folders),
		[query, cards, folders],
	);

	// Flat list for keyboard navigation: sites first, then folders.
	const flatResults = useMemo(() => {
		const items: { type: "site" | "folder"; data: Card | Folder }[] = [];
		for (const s of results.sites) items.push({ type: "site", data: s });
		for (const f of results.folders) items.push({ type: "folder", data: f });
		return items;
	}, [results]);

	// Clamp selected index.
	useEffect(() => {
		setSelectedIdx((prev) =>
			Math.min(prev, Math.max(0, flatResults.length - 1)),
		);
	}, [flatResults.length]);

	const handleSelect = useCallback(
		(idx: number) => {
			const item = flatResults[idx];
			if (!item) return;
			if (item.type === "site") {
				const card = item.data as Card;
				window.open(card.url, openInNewTab ? "_blank" : "_self");
			} else {
				const folder = item.data as Folder;
				onNavigateFolder(folder.id);
			}
			onClose();
		},
		[flatResults, openInNewTab, onNavigateFolder, onClose],
	);

	// Keyboard navigation.
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			switch (e.key) {
				case "ArrowDown":
					e.preventDefault();
					setSelectedIdx((prev) => Math.min(prev + 1, flatResults.length - 1));
					break;
				case "ArrowUp":
					e.preventDefault();
					setSelectedIdx((prev) => Math.max(prev - 1, 0));
					break;
				case "Enter":
					e.preventDefault();
					handleSelect(selectedIdx);
					break;
				case "Escape":
					e.preventDefault();
					onClose();
					break;
			}
		},
		[flatResults.length, selectedIdx, handleSelect, onClose],
	);

	// Scroll selected item into view.
	useEffect(() => {
		const list = listRef.current;
		if (!list) return;
		const selected = list.querySelector(`[data-idx="${selectedIdx}"]`);
		if (selected) {
			selected.scrollIntoView({ block: "nearest" });
		}
	}, [selectedIdx]);

	if (!open) return null;

	const hasResults = flatResults.length > 0;
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
			<div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

			{/* Search container */}
			<search
				className={`relative mx-4 w-full max-w-[600px] ${glassDropdown(isLiquid)} overflow-hidden`}
				onClick={(e) => e.stopPropagation()}
				onKeyDown={handleKeyDown}
			>
				{/* Search input */}
				<div className="flex items-center gap-3 px-4 py-3">
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
						placeholder="Search favorites and folders..."
						className={`flex-1 bg-transparent text-[15px] outline-none placeholder:${isLiquid ? "white/40" : "muted-foreground"} ${glassText(isLiquid, "primary")}`}
						autoComplete="off"
						spellCheck={false}
					/>
					<kbd
						className={`hidden items-center gap-0.5 rounded px-1.5 py-0.5 font-medium text-[10px] sm:inline-flex ${
							isLiquid
								? "bg-white/[0.08] text-white/40"
								: "bg-muted text-muted-foreground"
						}`}
					>
						ESC
					</kbd>
				</div>

				{/* Separator */}
				<div className={`h-px ${isLiquid ? "bg-white/[0.06]" : "bg-border"}`} />

				{/* Results */}
				<div ref={listRef} className="max-h-[400px] overflow-y-auto py-1">
					{!hasQuery ? (
						<div
							className={`px-4 py-8 text-center text-[13px] ${glassText(isLiquid, "muted")}`}
						>
							Search your favorites and folders
						</div>
					) : !hasResults ? (
						<div
							className={`px-4 py-8 text-center text-[13px] ${glassText(isLiquid, "muted")}`}
						>
							No results found
						</div>
					) : (
						<>
							{/* Sites group */}
							{results.sites.length > 0 && (
								<div>
									<div
										className={`px-4 py-1.5 font-medium text-[11px] uppercase tracking-wider ${glassText(isLiquid, "muted")}`}
									>
										Sites
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
												className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-75 ${
													flatIdx === selectedIdx
														? isLiquid
															? "bg-white/[0.1]"
															: "bg-muted"
														: ""
												} ${
													isLiquid
														? "hover:bg-white/[0.06]"
														: "hover:bg-muted/50"
												}`}
											>
												<img
													src={faviconUrl(card.url)}
													alt=""
													className="h-4 w-4 shrink-0 rounded-sm"
													onError={(e) => {
														(e.target as HTMLImageElement).src = faviconUrl(
															card.url,
														);
													}}
												/>
												<div className="min-w-0 flex-1">
													<div
														className={`truncate font-medium text-[13px] ${glassText(isLiquid, "primary")}`}
													>
														{card.title}
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
								<div>
									<div
										className={`px-4 py-1.5 font-medium text-[11px] uppercase tracking-wider ${glassText(isLiquid, "muted")}`}
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
												className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-75 ${
													flatIdx === selectedIdx
														? isLiquid
															? "bg-white/[0.1]"
															: "bg-muted"
														: ""
												} ${
													isLiquid
														? "hover:bg-white/[0.06]"
														: "hover:bg-muted/50"
												}`}
											>
												<Icon
													name="folder"
													size={16}
													className="shrink-0 opacity-60"
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
						</>
					)}
				</div>
			</search>
		</div>
	);
}
