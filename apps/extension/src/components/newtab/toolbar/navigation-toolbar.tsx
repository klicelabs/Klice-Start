import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBreadcrumb } from "../../../lib/folder-tree";
import { TOOLBAR } from "../../../lib/toolbar-tokens";
import { cn } from "../../../lib/utils";
import type { Folder } from "../../../types";
import { useAppearance } from "../appearance-provider";
import { FolderTabs } from "./folder-tabs";
import { FolderTabsOverflow } from "./folder-tabs-overflow";
import { ToolbarActions } from "./toolbar-actions";
import { ToolbarBack } from "./toolbar-back";
import { ToolbarBreadcrumb } from "./toolbar-breadcrumb";

interface NavigationToolbarProps {
	folders: Folder[];
	rootFolders: Folder[];
	activeFolderId: string;
	activeRootId: string;
	onSelectFolder: (id: string) => void;
	onAddFolder: (name: string) => string;
	onAddSubfolder?: (parentId: string | null) => void;
	onOpenSettings: () => void;
	onOpenSearch: () => void;
	onEditFolder?: (id: string) => void;
	onDeleteFolder?: (id: string) => void;
	onReorderFolders?: (draggedId: string, targetId: string) => void;
	onDropCard?: (cardId: string, folderId: string) => void;
	onMoveFolder?: (folderId: string, targetFolderId: string) => void;
	canNestFolder?: (folderId: string, targetFolderId: string) => boolean;
}

/**
 * Floating toolbar with three independent zones:
 *
 *   Left    [‹] Home / AI / OpenAI (subfolders only)
 *   Center  [ Home | AI | Design | ⋯ ] (root tabs + overflow)
 *   Right   [ 🔍 ⚙ ] (Search + Settings)
 */
export function NavigationToolbar({
	folders,
	rootFolders,
	activeFolderId,
	activeRootId,
	onSelectFolder,
	onAddFolder,
	onAddSubfolder,
	onOpenSettings,
	onOpenSearch,
	onEditFolder,
	onDeleteFolder,
	onReorderFolders,
	onDropCard,
	onMoveFolder,
	canNestFolder,
}: NavigationToolbarProps) {
	const { isLiquid } = useAppearance();

	// Breadcrumb.
	const breadcrumb = useMemo(
		() => getBreadcrumb(folders, activeFolderId),
		[folders, activeFolderId],
	);
	const isSubfolder = breadcrumb.length > 1;

	// Back button navigates to parent folder.
	const handleBack = useCallback(() => {
		if (breadcrumb.length >= 2) {
			const parent = breadcrumb[breadcrumb.length - 2];
			if (parent) onSelectFolder(parent.id);
		}
	}, [breadcrumb, onSelectFolder]);

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

		let totalNatural = surfacePadding;
		const widths: number[] = [];
		for (let i = 0; i < tabNodes.length; i++) {
			const node = tabNodes[i];
			if (!node) continue;
			const w = node.offsetWidth;
			widths.push(w);
			totalNatural += w + (i > 0 ? tabGap : 0);
		}

		// If everything fits at natural width, no overflow needed.
		if (totalNatural <= available) {
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

	// Floating header: detect scroll to fade in a subtle gradient mask
	const [scrolled, setScrolled] = useState(false);
	useEffect(() => {
		const handleScroll = () => {
			setScrolled(window.scrollY > 20);
		};
		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	return (
		<>
			{/* Top edge gradient mask — only visible when page is scrolled */}
			<div
				className={cn(
					"pointer-events-none fixed top-0 right-0 left-0 z-40 transition-opacity duration-300",
					"h-[calc(2.5rem+max(env(safe-area-inset-top),0.75rem))]",
					isLiquid
						? "bg-gradient-to-b from-black/75 via-black/40 to-transparent"
						: "bg-gradient-to-b from-background/80 via-background/45 to-transparent",
					scrolled ? "opacity-100" : "opacity-0",
				)}
				aria-hidden="true"
			/>

			{/* Toolbar — three areas on one centerline */}
			<header className="fixed top-0 right-0 left-0 z-50 mt-[max(env(safe-area-inset-top),0.75rem)] flex h-14 items-center px-5">
				{/* Left: back + breadcrumb */}
				<div
					className={cn(
						"flex w-44 shrink-0 items-center gap-2 overflow-hidden",
						isSubfolder ? "toolbar-leading-enter" : "toolbar-leading-exit",
					)}
				>
					{isSubfolder && <ToolbarBack onBack={handleBack} />}
					{isSubfolder && (
						<ToolbarBreadcrumb
							crumbs={breadcrumb}
							onNavigate={onSelectFolder}
						/>
					)}
				</div>

				{/* Center: capped tab-bar lane */}
				<div
					ref={containerRef}
					className="pointer-events-auto relative mx-auto flex min-w-0 max-w-[720px] flex-1 items-center justify-center px-2"
				>
					<div className="flex items-center gap-0.5">
						<FolderTabs
							folders={visibleFolders}
							activeRootId={activeRootId}
							onSelectFolder={onSelectFolder}
							onAddFolder={onAddSubfolder}
							onEditFolder={onEditFolder}
							onDeleteFolder={onDeleteFolder}
							onReorderFolders={onReorderFolders}
							onDropCard={onDropCard}
							onMoveFolder={onMoveFolder}
							canNestFolder={canNestFolder}
						/>
						{hasOverflow && (
							<FolderTabsOverflow
								hiddenFolders={hiddenFolders}
								activeRootId={activeRootId}
								onSelectFolder={onSelectFolder}
								onAddFolder={onAddFolder}
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
					/>
				</div>
			</header>

			{/* Spacer */}
			<div
				aria-hidden="true"
				className="h-[calc(3.5rem+max(env(safe-area-inset-top),0.75rem))] shrink-0"
			/>
		</>
	);
}
