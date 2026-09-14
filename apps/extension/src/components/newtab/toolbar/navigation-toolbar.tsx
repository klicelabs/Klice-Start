import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { glassText } from "../../../lib/glass";
import type { NavigationDirection } from "../../../lib/navigation";
import { TOOLBAR } from "../../../lib/toolbar-tokens";
import { cn } from "../../../lib/utils";
import type { InsertPosition } from "../../../stores/setup-store";
import type { Folder } from "../../../types";
import { useAppearance } from "../appearance-provider";
import { FolderTabs } from "./folder-tabs";
import { FolderTabsOverflow } from "./folder-tabs-overflow";
import { ToolbarActions } from "./toolbar-actions";
import { ToolbarBack } from "./toolbar-back";

interface NavigationToolbarProps {
	rootFolders: Folder[];
	activeRootId: string;
	navigationDirection: NavigationDirection;
	/** Full breadcrumb to the active folder (length > 1 inside a subfolder). */
	breadcrumb: Folder[];
	/** Navigate to the parent folder. */
	onBack: () => void;
	/**
	 * Show back + breadcrumb in the toolbar's left zone. True only once the
	 * in-flow control scrolls out of view — never alongside it.
	 */
	showBackNav: boolean;
	onSelectFolder: (id: string) => void;
	onAddFolder: (name: string) => string;
	/** Direct root-folder creation ("New Folder" + inline rename). */
	onNewRootFolder: () => void;
	/** Direct subfolder creation ("New Folder" + inline rename). */
	onNewSubfolder: (parentId: string | null) => void;
	onOpenSettings: () => void;
	settingsOpen?: boolean;
	onOpenSearch: () => void;
	onDeleteFolder?: (id: string) => void;
	onReorderFolders?: (
		draggedId: string,
		targetId: string,
		position?: InsertPosition,
	) => void;
	onDropCards?: (cardId: string, folderId: string) => void;
	onMoveFolders?: (folderId: string, targetFolderId: string) => void;
	onMoveFolderToRoot?: (
		folderId: string,
		targetId: string,
		position: InsertPosition,
	) => void;
	isRootFolder?: (id: string) => boolean;
	canNestFolder?: (folderId: string, targetFolderId: string) => boolean;
}

/**
 * Floating toolbar with three independent zones on one centerline:
 *
 *   Left    [‹] Current folder (back button + page title, subfolders only)
 *   Center  [ Home | AI | Design | + | ⋯ ] (root tabs + inline add + overflow)
 *   Right   [ 🔍 ⚙ ] (Search + Settings)
 */
export function NavigationToolbar({
	rootFolders,
	activeRootId,
	navigationDirection,
	breadcrumb,
	onBack,
	showBackNav,
	onSelectFolder,
	onAddFolder,
	onNewRootFolder,
	onNewSubfolder,
	onOpenSettings,
	settingsOpen = false,
	onOpenSearch,
	onDeleteFolder,
	onReorderFolders,
	onDropCards,
	onMoveFolders,
	onMoveFolderToRoot,
	isRootFolder,
	canNestFolder,
}: NavigationToolbarProps) {
	const { isLiquid } = useAppearance();
	const currentFolder = breadcrumb[breadcrumb.length - 1];

	// Sorted root folders for tab display.
	const sorted = useMemo(
		() => [...rootFolders].sort((a, b) => a.order - b.order),
		[rootFolders],
	);

	// Overflow detection: measures actual tab widths via a hidden row and fits
	// as many full tabs as the container width allows.
	const containerRef = useRef<HTMLDivElement>(null);
	const measureRef = useRef<HTMLDivElement>(null);
	const [visibleCount, setVisibleCount] = useState<number>(sorted.length);

	const updateOverflow = useCallback(() => {
		const container = containerRef.current;
		const measure = measureRef.current;
		if (!container || !measure) return;

		const available = container.clientWidth;
		const tabNodes = Array.from(measure.children) as HTMLElement[];
		if (tabNodes.length === 0) {
			setVisibleCount(0);
			return;
		}

		// Gap between tabs: 2px (gap-0.5) inside GlassSurface (p-1 padding: 8px total).
		const tabGap = 2;
		const surfacePadding = 8;
		const overflowPillWidth = 42; // "…" button width
		// Inline "+" width (34px control + gap). Budgeted only while visible.
		const addButtonWidth = 36;

		let totalNatural = surfacePadding;
		const widths: number[] = [];
		for (let i = 0; i < tabNodes.length; i++) {
			const node = tabNodes[i];
			if (!node) continue;
			const w = node.offsetWidth;
			widths.push(w);
			totalNatural += w + (i > 0 ? tabGap : 0);
		}

		// The inline "+" only exists while everything (tabs + "+") fits at
		// natural width. Once folders overflow, creation lives in the
		// overflow dropdown instead — no viewport breakpoint, just layout.
		if (totalNatural + tabGap + addButtonWidth <= available) {
			setVisibleCount(sorted.length);
			return;
		}

		// Otherwise, fit as many as possible while reserving space for "…".
		const budget = available - overflowPillWidth - tabGap;
		let fit = 0;
		let used = surfacePadding;
		for (let i = 0; i < widths.length; i++) {
			const w = widths[i] ?? 0;
			const next = used + w + (i > 0 ? tabGap : 0);
			if (next <= budget) {
				used = next;
				fit++;
			} else {
				break;
			}
		}

		setVisibleCount(Math.max(1, fit));
	}, [sorted.length]);

	useEffect(() => {
		updateOverflow();
		const container = containerRef.current;
		if (!container) return;
		const ro = new ResizeObserver(updateOverflow);
		ro.observe(container);
		return () => ro.disconnect();
	}, [updateOverflow]);

	const visibleFolders = useMemo(
		() => sorted.slice(0, visibleCount),
		[sorted, visibleCount],
	);
	const hiddenFolders = useMemo(
		() => sorted.slice(visibleCount),
		[sorted, visibleCount],
	);
	const hasOverflow = hiddenFolders.length > 0;

	// Sticky header: detect scroll to fade in a subtle gradient mask
	const headerRef = useRef<HTMLElement>(null);
	const [scrolled, setScrolled] = useState(false);
	useEffect(() => {
		const scrollContainer = headerRef.current?.closest<HTMLElement>(
			"[data-speed-dial-scroll]",
		);
		if (scrollContainer) {
			const handleScroll = () => setScrolled(scrollContainer.scrollTop > 20);
			handleScroll();
			scrollContainer.addEventListener("scroll", handleScroll, {
				passive: true,
			});
			return () => scrollContainer.removeEventListener("scroll", handleScroll);
		}

		const handleWindowScroll = () => setScrolled(window.scrollY > 20);
		handleWindowScroll();
		window.addEventListener("scroll", handleWindowScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleWindowScroll);
	}, []);

	return (
		<>
			{/* Top edge gradient mask — only visible when page is scrolled */}
			<div
				className={cn(
					"pointer-events-none absolute top-0 right-0 left-0 z-40 transition-opacity duration-300",
					"h-[calc(2.5rem+max(env(safe-area-inset-top),0.75rem))]",
					isLiquid
						? "bg-gradient-to-b from-black/75 via-black/40 to-transparent"
						: "bg-gradient-to-b from-background/80 via-background/45 to-transparent",
					scrolled ? "opacity-100" : "opacity-0",
				)}
				aria-hidden="true"
			/>

			{/* Sticky toolbar — three areas on one centerline */}
			<header
				ref={headerRef}
				className="sticky top-0 right-0 left-0 z-50 mt-[max(env(safe-area-inset-top),0.75rem)] flex h-14 items-center px-5"
			>
				{/* Left: back button + current page title (no breadcrumb).
				    Appears only once the in-flow control scrolls out of view
				    (see App sentinel); empty spacer otherwise, keeping the
				    tab lane centered. The button itself stays unclipped so
				    its shadow renders naturally. */}
				<div className="flex w-44 shrink-0 items-center gap-2">
					{showBackNav && currentFolder && (
						<div
							key="toolbar-back-nav"
							className="toolbar-back-enter flex min-w-0 flex-1 items-center gap-2"
						>
							<ToolbarBack onBack={onBack} />
							<span
								className={cn(
									"min-w-0 max-w-[96px] shrink-0 truncate font-medium text-[13px]",
									glassText(isLiquid, "primary"),
								)}
								title={currentFolder.name}
							>
								{currentFolder.name}
							</span>
						</div>
					)}
				</div>

				{/* Center: capped tab-bar lane */}
				<div
					ref={containerRef}
					className="pointer-events-auto relative mx-auto flex min-w-0 max-w-[880px] flex-1 items-center justify-center px-2"
				>
					<div className="flex items-center gap-0.5">
						<FolderTabs
							folders={visibleFolders}
							activeRootId={activeRootId}
							navigationDirection={navigationDirection}
							showAddButton={!hasOverflow}
							onAddRoot={onNewRootFolder}
							onSelectFolder={onSelectFolder}
							onNewRootFolder={onNewRootFolder}
							onNewSubfolder={onNewSubfolder}
							onDeleteFolder={onDeleteFolder}
							onReorderFolders={onReorderFolders}
							onDropCards={onDropCards}
							onMoveFolders={onMoveFolders}
							onMoveFolderToRoot={onMoveFolderToRoot}
							isRootFolder={isRootFolder}
							canNestFolder={canNestFolder}
						/>
						{hasOverflow && (
							<FolderTabsOverflow
								hiddenFolders={hiddenFolders}
								activeRootId={activeRootId}
								onSelectFolder={onSelectFolder}
								onAddFolder={onAddFolder}
								onDropCards={onDropCards}
								onMoveFolders={onMoveFolders}
								canNestFolder={canNestFolder}
							/>
						)}
					</div>

					{/* Hidden measurer with max-w truncation */}
					<div
						ref={measureRef}
						aria-hidden="true"
						className="pointer-events-none invisible absolute top-0 left-0 flex items-center gap-0.5"
						style={{ visibility: "hidden" }}
					>
						{sorted.map((folder) => (
							<span
								key={folder.id}
								className={cn(
									TOOLBAR.controlHeight,
									TOOLBAR.radius,
									"inline-flex max-w-[160px] items-center truncate px-3 font-medium text-[13px]",
								)}
							>
								{folder.name}
							</span>
						))}
					</div>
				</div>

				{/* Right: Search + Settings */}
				<div className="flex w-44 shrink-0 items-center justify-end">
					<ToolbarActions
						onSearch={onOpenSearch}
						onSettings={onOpenSettings}
						settingsOpen={settingsOpen}
					/>
				</div>
			</header>
		</>
	);
}
