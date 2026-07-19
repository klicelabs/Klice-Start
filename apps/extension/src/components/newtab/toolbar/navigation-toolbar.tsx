import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBreadcrumb } from "../../../lib/folder-tree";
import { TOOLBAR } from "../../../lib/toolbar-tokens";
import { cn } from "../../../lib/utils";
import type { Folder } from "../../../types";
import { useAppearance } from "../appearance-provider";
import { FolderTabs } from "./folder-tabs";
import { FolderTabsOverflow } from "./folder-tabs-overflow";
import { ToolbarActions } from "./toolbar-actions";
import { ToolbarAddMenu } from "./toolbar-add-menu";
import { ToolbarBack } from "./toolbar-back";
import { ToolbarBreadcrumb } from "./toolbar-breadcrumb";

interface NavigationToolbarProps {
	folders: Folder[];
	rootFolders: Folder[];
	activeFolderId: string;
	activeRootId: string;
	onSelectFolder: (id: string) => void;
	onAddFolder: () => void;
	onOpenSettings: () => void;
	onOpenSearch: () => void;
	onAddFavorite: () => void;
	onEditFolder?: (id: string) => void;
	onDeleteFolder?: (id: string) => void;
	onReorderFolders?: (draggedId: string, targetId: string) => void;
	onDropCard?: (cardId: string, folderId: string) => void;
	onMoveFolder?: (folderId: string, targetFolderId: string) => void;
	canNestFolder?: (folderId: string, targetFolderId: string) => boolean;
}

/**
 * Floating toolbar with three independent layers:
 *
 *   <header>  relative, flex justify-center
 *
 *     Left    absolute left-4    [‹] Home / AI / OpenAI
 *     Center  (flow)             [ Home | AI | Design | ⋯ ]
 *     Right   absolute right-4   [ 🔍 + ]   ⚙
 *
 * Center fills available space between left and right layers.
 * Overflow detection measures actual content vs container width.
 * Tabs only hide when they truly don't fit.
 */
export function NavigationToolbar({
	folders,
	rootFolders,
	activeFolderId,
	activeRootId,
	onSelectFolder,
	onAddFolder,
	onOpenSettings,
	onOpenSearch,
	onAddFavorite,
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

	// Sorted root folders.
	const sorted = useMemo(
		() => [...rootFolders].sort((a, b) => a.order - b.order),
		[rootFolders],
	);

	// Smart overflow detection.
	// - containerRef: the center area available to the tab bar.
	// - measureRef: a hidden row rendering ALL tabs at full width, so we know
	//   each tab's REAL width (labels vary wildly, so an average is useless and
	//   was the cause of tabs spilling before the "…" appeared).
	// We accumulate real widths against the available space, reserving room for
	// the overflow button only when something actually has to hide.
	const containerRef = useRef<HTMLDivElement>(null);
	const measureRef = useRef<HTMLDivElement>(null);
	const [visibleCount, setVisibleCount] = useState(sorted.length);

	// Tab gap (gap-0.5 = 2px) and a safe reservation for the "…" pill + its gap.
	// LANE_PADDING matches the container's px-2 (8px each side) so the packing
	// budget uses the real inner width, not the padded clientWidth.
	const TAB_GAP = 2;
	const OVERFLOW_RESERVE = 44;
	const LANE_PADDING = 16;

	useEffect(() => {
		const container = containerRef.current;
		const measurer = measureRef.current;
		if (!container || !measurer) return;

		function measure() {
			if (!container || !measurer) return;
			const containerW = container.clientWidth - LANE_PADDING;
			const tabEls = Array.from(measurer.children) as HTMLElement[];
			if (containerW === 0 || tabEls.length === 0) return;

			const widths = tabEls.map((el) => el.offsetWidth);
			const totalW =
				widths.reduce((sum, w) => sum + w, 0) + TAB_GAP * (widths.length - 1);

			// Everything fits — no overflow button.
			if (totalW <= containerW) {
				setVisibleCount(sorted.length);
				return;
			}

			// Something must hide: reserve space for the "…" button, then pack
			// real tab widths until the next one would exceed the budget.
			const available = containerW - OVERFLOW_RESERVE;
			let used = 0;
			let count = 0;
			for (const w of widths) {
				const next = used + (count > 0 ? TAB_GAP : 0) + w;
				if (next > available) break;
				used = next;
				count += 1;
			}
			setVisibleCount(Math.max(1, count));
		}

		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(container);
		ro.observe(measurer);
		return () => ro.disconnect();
	}, [sorted.length]);

	const hasOverflow = visibleCount < sorted.length;
	const visibleFolders = sorted.slice(0, visibleCount);
	const hiddenFolders = sorted.slice(visibleCount);

	// Add menu state.
	const [addMenuOpen, setAddMenuOpen] = useState(false);

	// Top-fade intensity: soft at rest, a touch stronger once the page scrolls
	// so content passing under the toolbar stays gently masked.
	const [scrolled, setScrolled] = useState(false);
	useEffect(() => {
		function handleScroll() {
			setScrolled(window.scrollY > 8);
		}
		handleScroll();
		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	// Navigate to parent.
	const handleBack = useCallback(() => {
		if (breadcrumb.length > 1) {
			onSelectFolder(breadcrumb[breadcrumb.length - 2].id);
		}
	}, [breadcrumb, onSelectFolder]);

	return (
		<>
			{/* Always-on top fade, two stacked layers so the intensity change
			    animates smoothly (background-image can't transition; opacity can).
			    Both are height-capped to the toolbar's bottom edge so the gradient
			    never bleeds past the bar.
			      - base: soft, always visible
			      - boost: stronger, opacity-fades in on scroll — still gentle */}
			<div
				className={cn(
					"pointer-events-none fixed top-0 right-0 left-0 z-40",
					"h-[calc(2.5rem+max(env(safe-area-inset-top),0.75rem))]",
					isLiquid
						? "bg-gradient-to-b from-black/55 via-black/25 to-transparent"
						: "bg-gradient-to-b from-background/60 via-background/30 to-transparent",
				)}
				aria-hidden="true"
			/>
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

			{/* Toolbar — three areas on one centerline. Fixed to the viewport so
			    it stays put while the page scrolls; floated below the top
			    safe-area so the center pill never touches the viewport edge. */}
			<header className="fixed top-0 right-0 left-0 z-50 mt-[max(env(safe-area-inset-top),0.75rem)] flex h-14 items-center px-5">
				{/* Left: back + breadcrumb — fixed width, same vertical alignment */}
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

				{/* Center: capped tab-bar lane, centered. The cap keeps the row from
				    stretching edge-to-edge on wide screens and makes the "…" overflow
				    trigger earlier, so tabs never spill past the lane. */}
				<div
					ref={containerRef}
					className="pointer-events-auto relative mx-auto flex min-w-0 max-w-[720px] flex-1 items-center justify-center px-2"
				>
					<div className="flex items-center gap-0.5">
						<FolderTabs
							folders={visibleFolders}
							activeRootId={activeRootId}
							onSelectFolder={onSelectFolder}
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
							/>
						)}
					</div>

					{/* Hidden measurer: all tabs at natural width, off-screen. Drives
					    overflow detection with each tab's REAL width (see effect). */}
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
									"inline-flex items-center whitespace-nowrap px-3 font-medium text-[13px]",
								)}
							>
								{folder.name}
							</span>
						))}
					</div>
				</div>

				{/* Right: actions — matches leading width so center stays centered */}
				<div className="flex w-44 shrink-0 items-center justify-end">
					<div className="relative">
						<ToolbarActions
							onSearch={onOpenSearch}
							onSettings={onOpenSettings}
							onAdd={() => setAddMenuOpen(!addMenuOpen)}
							addOpen={addMenuOpen}
						/>
						<ToolbarAddMenu
							open={addMenuOpen}
							onClose={() => setAddMenuOpen(false)}
							onAddFavorite={onAddFavorite}
							onAddFolder={onAddFolder}
						/>
					</div>
				</div>
			</header>

			{/* Spacer — the header is fixed (out of flow), so reserve its footprint
			    (top offset + h-14) to keep page content from sliding underneath. */}
			<div
				aria-hidden="true"
				className="h-[calc(3.5rem+max(env(safe-area-inset-top),0.75rem))] shrink-0"
			/>
		</>
	);
}
