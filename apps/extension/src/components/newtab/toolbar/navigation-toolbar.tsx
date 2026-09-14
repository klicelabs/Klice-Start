import { SPRING_LAYOUT } from "@klice-start/ui/lib/ease";
import { motion, useReducedMotion } from "motion/react";
import {
	type RefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { glassText } from "../../../lib/glass";
import type { NavigationDirection } from "../../../lib/navigation";
import { TOOLBAR } from "../../../lib/toolbar-tokens";
import { cn } from "../../../lib/utils";
import type { InsertPosition } from "../../../stores/setup-store";
import type { Folder } from "../../../types";
import { useAppearance } from "../appearance-provider";
import { FolderTabs } from "./folder-tabs";
import { ToolbarBack } from "./toolbar-back";
import { ToolbarIconButton } from "./toolbar-icon-button";

interface NavigationToolbarProps {
	rootFolders: Folder[];
	activeRootId: string;
	navigationDirection: NavigationDirection;
	/** Full breadcrumb to the active folder (length > 1 inside a subfolder). */
	breadcrumb: Folder[];
	/** Navigate to the parent folder. */
	onBack: () => void;
	/**
	 * Keep the single back + current folder identity mounted for the whole
	 * subfolder state, including the initial render.
	 */
	showBackNav: boolean;
	/** Whether the sticky toolbar threshold has been crossed. */
	navigationSticky: boolean;
	searchEnabled: boolean;
	navigationRef?: RefObject<HTMLElement | null>;
	onOpenSearch: () => void;
	onSelectFolder: (id: string) => void;
	onAddFolder: (name: string) => string;
	/** Direct root-folder creation ("New Folder" + inline rename). */
	onNewRootFolder: () => void;
	/** Direct subfolder creation ("New Folder" + inline rename). */
	onNewSubfolder: (parentId: string | null) => void;
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
 *   Left    [‹] Current folder once the navigation becomes sticky
 *   Center  [ Search ] [ Home | AI | Design | + | ⋯ ]
 *   Right   [ reserved inset ] (the fixed app Settings action lives above it)
 */
export function NavigationToolbar({
	rootFolders,
	activeRootId,
	navigationDirection,
	breadcrumb,
	onBack,
	showBackNav,
	navigationSticky,
	searchEnabled,
	onOpenSearch,
	onSelectFolder,
	onAddFolder,
	onNewRootFolder,
	onNewSubfolder,
	onDeleteFolder,
	onReorderFolders,
	onDropCards,
	onMoveFolders,
	onMoveFolderToRoot,
	isRootFolder,
	canNestFolder,
	navigationRef,
}: NavigationToolbarProps) {
	const { isLiquid } = useAppearance();
	const reduceMotion = useReducedMotion() ?? false;
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
		const overflowPillWidth = 34; // "…" control width inside the surface
		const addButtonWidth = 34;

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

	return (
		<>
			{/* Sticky toolbar — centered Tabbar with balanced side insets */}
			<header
				ref={navigationRef}
				className="speed-dial-navigation-toolbar relative sticky top-0 right-0 left-0 isolate z-[var(--speed-dial-layer-navigation)] mt-[max(env(safe-area-inset-top),0.75rem)] flex h-14 items-center"
				data-navigation-sticky={navigationSticky ? "true" : "false"}
				data-speed-dial-navigation="true"
			>
				{/* Balanced responsive rails keep the Tabbar centered while leaving
				    enough room for the in-flow Back identity at narrow widths. */}
				<div
					className="w-[var(--speed-dial-navigation-rail)] shrink-0"
					aria-hidden="true"
				/>

				{/* Center: one compact navigation group. The Tabbar anchor owns the
				    fixed-width center; Back is positioned outside it until sticky. */}
				<div className="pointer-events-auto mx-auto flex min-w-0 max-w-[880px] flex-1 items-center justify-center px-2">
					{/* The measured lane is the stable Tabbar coordinate system. Its
					    center track remains unchanged when Back appears or disappears. */}
					<div
						ref={containerRef}
						className="speed-dial-navigation-group grid min-w-0 max-w-full flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center"
					>
						<div
							className={cn(
								"speed-dial-navigation-anchor col-start-2 flex min-w-0 items-center",
								!navigationSticky && "relative",
							)}
						>
							{showBackNav && currentFolder && (
								<motion.div
									layout={reduceMotion ? false : "position"}
									transition={
										reduceMotion ? { duration: 0 } : { layout: SPRING_LAYOUT }
									}
									className="toolbar-back-identity flex min-w-0 max-w-full shrink items-center gap-2"
									data-navigation-back="true"
									data-navigation-sticky={navigationSticky ? "true" : "false"}
								>
									<ToolbarBack onBack={onBack} />
									<span
										className={cn(
											"min-w-0 truncate font-medium text-[13px]",
											glassText(isLiquid, "primary"),
										)}
										title={currentFolder.name}
									>
										{currentFolder.name}
									</span>
								</motion.div>
							)}

							<div className="speed-dial-tabbar-cluster relative flex min-w-0 items-center">
								<div className="flex min-w-0 items-center gap-[var(--speed-dial-toolbar-compact-gap)]">
									{searchEnabled && (
										<div
											className="toolbar-compact-search"
											data-compact-search-control="true"
										>
											<ToolbarIconButton
												icon="search"
												label="Search"
												onClick={onOpenSearch}
											/>
										</div>
									)}
									<div className="min-w-0 shrink-0">
										<FolderTabs
											folders={visibleFolders}
											hiddenFolders={hiddenFolders}
											activeRootId={activeRootId}
											navigationDirection={navigationDirection}
											showAddButton={!hasOverflow}
											onAddRoot={onNewRootFolder}
											onAddFolder={onAddFolder}
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
									</div>
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
						</div>
					</div>
				</div>

				{/* Right: balanced inset for the stationary app Settings control.
				    Keeping this lane symmetrical lets the one Tabbar travel into
				    the sticky toolbar without colliding with that control. */}
				<div
					className="w-[var(--speed-dial-navigation-rail)] shrink-0"
					aria-hidden="true"
				/>
			</header>
		</>
	);
}
