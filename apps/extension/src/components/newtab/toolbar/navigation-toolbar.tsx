import { Button } from "@klice-start/ui/components/button";
import { ButtonGroup } from "@klice-start/ui/components/button-group";
import { GlassButtonGroup } from "@klice-start/ui/components/glass-button-group";
import { Icon } from "@klice-start/ui/icons/icon";
import { kliceShape } from "@klice-start/ui/lib/shapes";
import { flatSeparator, flatSurface } from "@klice-start/ui/lib/surface";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { glassText } from "../../../lib/glass";
import type { NavigationDirection } from "../../../lib/navigation";
import {
	TOOLBAR,
	TOOLBAR_HEIGHT,
	TOOLBAR_ICON,
	toolbarIconClass,
	toolbarIconSize,
} from "../../../lib/toolbar-tokens";
import { cn } from "../../../lib/utils";
import type { InsertPosition } from "../../../stores/setup-store";
import type { Folder } from "../../../types";
import { useAppearance } from "../appearance-provider";
import { FolderTabs } from "./folder-tabs";
import { ToolbarIconButton } from "./toolbar-icon-button";

interface NavigationToolbarProps {
	rootFolders: Folder[];
	activeRootId: string;
	navigationDirection: NavigationDirection;
	/** Full breadcrumb to the active folder (length > 1 inside a subfolder). */
	breadcrumb: Folder[];
	canGoBack: boolean;
	canGoForward: boolean;
	onBack: () => void;
	onForward: () => void;
	searchEnabled: boolean;
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
 * The only navigation unit in the new-tab shell. It is mounted in the
 * application toolbar, never in the scrolling content region.
 *
 * The left and right grid lanes are equal and non-owning: they reserve room
 * for controls while the center lane measures only the Tabbar's real budget.
 * That keeps the Tabbar's center anchor fixed when history or Settings changes.
 */
export function NavigationToolbar({
	rootFolders,
	activeRootId,
	navigationDirection,
	breadcrumb,
	canGoBack,
	canGoForward,
	onBack,
	onForward,
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
}: NavigationToolbarProps) {
	const { isLiquid } = useAppearance();

	const sorted = useMemo(
		() => [...rootFolders].sort((a, b) => a.order - b.order),
		[rootFolders],
	);

	// Measure the center lane, not the natural width of the Tabbar. Controls in
	// the side lanes therefore never consume the Tabbar's overflow budget.
	const containerRef = useRef<HTMLDivElement>(null);
	const measureRef = useRef<HTMLDivElement>(null);
	const [visibleCount, setVisibleCount] = useState<number>(sorted.length);

	const updateOverflow = useCallback(() => {
		const container = containerRef.current;
		const measure = measureRef.current;
		if (!container || !measure) return;

		const available = container.clientWidth;
		const tabNodes = Array.from(measure.children).filter(
			(node): node is HTMLElement => node instanceof HTMLElement,
		);
		if (tabNodes.length === 0) {
			setVisibleCount(0);
			return;
		}

		const tabGap = 2;
		// Derived from the height system rather than duplicated as literals:
		// the Tabbar shell pads by the group inset on both sides, and the
		// overflow pill and the "+" affordance are both one control wide.
		const surfacePadding = TOOLBAR_HEIGHT.inset * 2;
		const overflowPillWidth = TOOLBAR_HEIGHT.control;
		const addButtonWidth = TOOLBAR_HEIGHT.control;
		const widths = tabNodes.map((node) => node.offsetWidth);
		const totalNatural = widths.reduce(
			(total, width, index) => total + width + (index > 0 ? tabGap : 0),
			surfacePadding,
		);

		if (totalNatural + tabGap + addButtonWidth <= available) {
			setVisibleCount(sorted.length);
			return;
		}

		const budget = available - overflowPillWidth - tabGap;
		let fit = 0;
		let used = surfacePadding;
		for (const [index, width] of widths.entries()) {
			const next = used + width + (index > 0 ? tabGap : 0);
			if (next > budget) break;
			used = next;
			fit += 1;
		}

		setVisibleCount(Math.max(1, fit));
	}, [sorted]);

	useEffect(() => {
		updateOverflow();
		const container = containerRef.current;
		if (!container) return;
		const resizeObserver = new ResizeObserver(updateOverflow);
		resizeObserver.observe(container);
		return () => resizeObserver.disconnect();
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
	const activeRootVisible = visibleFolders.some(
		(folder) => folder.id === activeRootId,
	);
	const currentFolder = breadcrumb[breadcrumb.length - 1];
	const activeRoot = sorted.find((folder) => folder.id === activeRootId);
	const contextualFolder = breadcrumb.length > 1 ? currentFolder : activeRoot;
	const showContextualTitle = Boolean(
		contextualFolder && (breadcrumb.length > 1 || !activeRootVisible),
	);

	return (
		<nav
			aria-label="Folder navigation"
			className="pointer-events-none absolute inset-0 flex items-center px-[var(--speed-dial-toolbar-gutter)]"
			data-speed-dial-navigation="true"
		>
			<div className="grid w-full grid-cols-[minmax(5rem,1fr)_minmax(0,2fr)_minmax(5rem,1fr)] items-center">
				<div className="pointer-events-auto flex min-w-0 items-center gap-2 overflow-hidden">
					<HistoryControls
						isLiquid={isLiquid}
						canGoBack={canGoBack}
						canGoForward={canGoForward}
						onBack={onBack}
						onForward={onForward}
					/>
					{showContextualTitle && contextualFolder && (
						<span
							className={cn(
								"min-w-0 truncate font-medium text-[13px]",
								glassText(isLiquid, "primary"),
							)}
							title={contextualFolder.name}
						>
							{contextualFolder.name}
						</span>
					)}
				</div>

				<div
					ref={containerRef}
					className="pointer-events-auto relative col-start-2 mx-auto flex w-full min-w-0 max-w-[880px] items-center justify-center"
				>
					<div className="relative flex min-w-0 max-w-full items-center">
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
					</div>

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
									"inline-flex max-w-[160px] items-center truncate px-3 text-[13px] font-normal",
								)}
							>
								{folder.name}
							</span>
						))}
					</div>
				</div>

				<div aria-hidden="true" className="min-w-0" />
			</div>
		</nav>
	);
}

interface HistoryControlsProps {
	isLiquid: boolean;
	canGoBack: boolean;
	canGoForward: boolean;
	onBack: () => void;
	onForward: () => void;
}

function HistoryControls({
	isLiquid,
	canGoBack,
	canGoForward,
	onBack,
	onForward,
}: HistoryControlsProps) {
	// Raw library primitives only.
	//
	// There is exactly ONE surface in each mode, and it owns the group's
	// geometry: in Glass mode that is the GlassButtonGroup's refractive
	// surface, in Flat mode the ButtonGroup itself. Neither mode wraps the
	// group in a second visual container, because a wrapper can only ever
	// approximate the segments inside it — which is how the control ended up
	// with a rounded shell around a square-er inner end.
	//
	// The segments are full-bleed: the group carries no inner padding, so the
	// hover/pressed wash reaches the capsule edge instead of floating as an
	// inset block with a square cut in the middle. The segments are h-full and
	// follow the group's surface height directly.
	//
	// Klice customizes only what it is allowed to: the group height, segment
	// width, the glyph token, the liquid wash tint, and the group's corner
	// role. Segment geometry, the seam and disabled state stay owned by the
	// group implementation.
	const groupClassName = cn(TOOLBAR.groupHeight, "shrink-0");
	const groupButtons = (
		<>
			<HistoryButton
				icon="chevron-left"
				label="Back"
				disabled={!canGoBack}
				isLiquid={isLiquid}
				onClick={onBack}
			/>
			<HistoryDivider isLiquid={isLiquid} />
			<HistoryButton
				icon="chevron-right"
				label="Forward"
				disabled={!canGoForward}
				isLiquid={isLiquid}
				onClick={onForward}
			/>
		</>
	);

	if (isLiquid) {
		return (
			<GlassButtonGroup
				glassVariant="liquid-refract"
				aria-label="Navigation history"
				aria-orientation="horizontal"
				className={groupClassName}
			>
				{groupButtons}
			</GlassButtonGroup>
		);
	}

	return (
		<ButtonGroup
			aria-label="Navigation history"
			aria-orientation="horizontal"
			className={cn(
				kliceShape("toolbarGroup"),
				flatSurface("floating"),
				// Toolbar controls carry no elevation: face wash only, so the
				// group never reads as floating above the wallpaper.
				"shadow-none",
				groupClassName,
			)}
		>
			{groupButtons}
		</ButtonGroup>
	);
}

interface HistoryButtonProps {
	icon: "chevron-left" | "chevron-right";
	label: string;
	disabled: boolean;
	isLiquid: boolean;
	onClick: () => void;
}

/**
 * The native-style divider between the Back and Forward segments.
 *
 * Spotlight/Finder-like: a 1px hairline at roughly half the group height,
 * vertically centered, never edge-to-edge. It carries no data-slot so the
 * group's first/last-segment geometry selectors keep resolving exactly as
 * before — the divider sits *between* segments without becoming one.
 *
 * Glass gets a faint white hairline; Flat gets the engraved tonal groove
 * from the shared surface system (never a hard border color).
 */
function HistoryDivider({ isLiquid }: { isLiquid: boolean }) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"h-[18px] w-px shrink-0 self-center",
				isLiquid ? "bg-white/15" : flatSeparator("vertical"),
			)}
		/>
	);
}

function HistoryButton({
	icon,
	label,
	disabled,
	isLiquid,
	onClick,
}: HistoryButtonProps) {
	return (
		<Button
			variant="ghost"
			size="icon"
			aria-label={label}
			disabled={disabled}
			onClick={onClick}
			className={cn(
				"h-full",
				TOOLBAR.controlWidth,
				// Same wash tint as the tabbar items. The seam and the outer
				// capsule ends stay native to the group.
				// Flat mode states its ink explicitly: enabled segments use the
				// strong flat ink (never muted, so they never read as
				// disabled); the library's disabled treatment stays intact and
				// the muted color marks it intentionally.
				isLiquid
					? "text-white/70 hover:bg-white/[0.12] hover:text-white active:bg-white/20"
					: "text-flat-ink disabled:text-flat-ink-muted",
			)}
			data-slot="button"
		>
			<Icon
				name={icon}
				size={toolbarIconSize(icon)}
				strokeWidth={TOOLBAR_ICON.strokeWidth}
				className={toolbarIconClass(icon)}
				aria-hidden="true"
			/>
		</Button>
	);
}
