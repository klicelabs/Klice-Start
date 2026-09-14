import {
	SidebarInset,
	SidebarProvider,
} from "@klice-start/ui/components/sidebar";
import { Toaster } from "@klice-start/ui/components/sonner";
import {
	type CSSProperties,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	AppearanceProvider,
	useAppearance,
} from "../../src/components/newtab/appearance-provider";
import { BackgroundLayer } from "../../src/components/newtab/background-layer";
import { ClockWidget } from "../../src/components/newtab/clock-widget";
import { DialGrid } from "../../src/components/newtab/dial-grid";
import { EmptyLanding } from "../../src/components/newtab/empty-landing";
import { InlineFolderNav } from "../../src/components/newtab/folder-nav";
import type { FolderPreviewItem } from "../../src/components/newtab/folders/folder-preview-card";
import { PageContextMenu } from "../../src/components/newtab/page-context-menu";
import { RestMode } from "../../src/components/newtab/rest-mode";
import {
	UnifiedSearch,
	type UnifiedSearchHandle,
} from "../../src/components/newtab/search/unified-search";
import { SelectionTray } from "../../src/components/newtab/selection-tray";
import {
	type SettingsPaneId,
	SettingsSidebar,
	type SettingsSidebarProps,
} from "../../src/components/newtab/settings";
import { NavigationToolbar } from "../../src/components/newtab/toolbar/navigation-toolbar";
import { ToolbarActions } from "../../src/components/newtab/toolbar/toolbar-actions";
import { MoveToDialog } from "../../src/components/shared/move-to-dialog";
import { useCrossTabSync } from "../../src/hooks/use-cross-tab-sync";
import { usePersistenceErrorToast } from "../../src/hooks/use-persistence-error-toast";
import {
	getBreadcrumb,
	getChildren,
	wouldCreateCycle,
} from "../../src/lib/folder-tree";
import { getOrderedRefs, type ItemRef } from "../../src/lib/item-order";
import type { NavigationState } from "../../src/lib/navigation";
import { faviconUrl } from "../../src/lib/url";
import { cn } from "../../src/lib/utils";
import { useRenameStore } from "../../src/stores/rename-store";
import { useSelectionStore } from "../../src/stores/selection-store";
import {
	computeGridMaxWidth,
	useSetupStore,
} from "../../src/stores/setup-store";
import type { Card } from "../../src/types";

import "../../src/styles/tokens.css";

/**
 * Sonner toasts follow the app theme explicitly — `theme="system"` would
 * read the OS instead of the user's Light/Dark/Auto setting.
 */
function ThemedToaster() {
	const { resolvedDark } = useAppearance();
	return (
		<Toaster
			theme={resolvedDark ? "dark" : "light"}
			position="bottom-center"
			gap={8}
		/>
	);
}

function SpeedDialTopFade() {
	return (
		<div
			className="speed-dial-top-fade pointer-events-none absolute inset-x-0 top-0 z-20"
			aria-hidden="true"
		/>
	);
}

const SPEED_DIAL_INTERACTIVE_SELECTOR = [
	"[data-unified-search]",
	"[data-speed-dial-navigation]",
	"[data-speed-dial-app-toolbar]",
	"[data-local-context-menu]",
	"[data-selection-tray]",
	"[data-context-menu-portal]",
	"[data-morph-popover-portal]",
	"[data-settings-sidebar-slot]",
	"[data-settings-ui]",
	".dial-cell",
	".settings-scope",
	".clock-widget",
	"button",
	"a",
	"input",
	"textarea",
	"select",
	'[contenteditable="true"]',
	'[role="button"]',
	'[role="tab"]',
	'[role="menu"]',
	'[role="menuitem"]',
	'[role="listbox"]',
	'[role="tree"]',
].join(",");

export default function App() {
	useCrossTabSync();
	usePersistenceErrorToast();

	const folders = useSetupStore((s) => s.folders);
	const activeFolderId = useSetupStore((s) => s.activeFolderId);
	const setActiveFolder = useSetupStore((s) => s.setActiveFolder);
	const addFolder = useSetupStore((s) => s.addFolder);
	const deleteCard = useSetupStore((s) => s.deleteCard);
	const deleteFolder = useSetupStore((s) => s.deleteFolder);
	const moveFolders = useSetupStore((s) => s.moveFolders);
	const moveItemsToContainer = useSetupStore((s) => s.moveItemsToContainer);
	const reorderItems = useSetupStore((s) => s.reorderItems);
	const reorderFolders = useSetupStore((s) => s.reorderFolders);
	const createSubfolderFromCards = useSetupStore(
		(s) => s.createSubfolderFromCards,
	);
	const itemOrder = useSetupStore((s) => s.itemOrder ?? {});
	const tileSize = useSetupStore((s) => s.settings.tileSize);
	const maxColumns = useSetupStore((s) => s.settings.maxColumns);
	const gridMaxWidth = computeGridMaxWidth(tileSize, maxColumns);

	const beginRename = useRenameStore((s) => s.begin);
	const cancelRename = useRenameStore((s) => s.cancel);
	const [navigation, setNavigation] = useState<NavigationState>({
		direction: "forward",
		kind: "root",
	});

	// Navigation always settles any stray rename session first (an input
	// unmounted by navigation never blurs, so without this a stale session
	// could linger and pop open unexpectedly later).
	const handleSelectFolder = useCallback(
		(id: string) => {
			// Read the store at interaction time so rapid A → B → C and
			// spring-loaded changes never compare against a stale render. The
			// complete ordered root list is the canonical tab order, including
			// folders currently hidden behind overflow.
			const state = useSetupStore.getState();
			const currentPath = getBreadcrumb(state.folders, state.activeFolderId);
			const nextPath = getBreadcrumb(state.folders, id);
			const currentRootId = currentPath[0]?.id ?? state.activeFolderId;
			const nextRootId = nextPath[0]?.id ?? id;
			const orderedRoots = getChildren(state.folders, null);
			const previousIndex = orderedRoots.findIndex(
				(folder) => folder.id === currentRootId,
			);
			const nextIndex = orderedRoots.findIndex(
				(folder) => folder.id === nextRootId,
			);
			const rootChanged = currentRootId !== nextRootId;
			const direction = rootChanged
				? previousIndex >= 0 && nextIndex >= 0 && nextIndex < previousIndex
					? "back"
					: "forward"
				: nextPath.length < currentPath.length
					? "back"
					: "forward";

			setNavigation({
				direction,
				kind: rootChanged ? "root" : "depth",
			});
			cancelRename();
			setActiveFolder(id);
		},
		[cancelRename, setActiveFolder],
	);

	const canNestFolder = useCallback(
		(folderId: string, targetFolderId: string) =>
			folderId !== targetFolderId &&
			!wouldCreateCycle(folders, folderId, targetFolderId),
		[folders],
	);

	const allCards = useSetupStore((s) => s.cards as Card[]);
	const cards = useMemo(
		() =>
			allCards
				.filter((c) => c.folderId === activeFolderId)
				.sort((a, b) => a.order - b.order),
		[allCards, activeFolderId],
	);

	const subfolders = useMemo(
		() => getChildren(folders, activeFolderId),
		[folders, activeFolderId],
	);
	const orderedRefs = useMemo(
		() => getOrderedRefs(activeFolderId, subfolders, cards, itemOrder),
		[activeFolderId, subfolders, cards, itemOrder],
	);
	const selectableItems = useMemo(
		() =>
			orderedRefs.map((ref) => ({
				id: ref.id,
				kind: ref.kind,
				sourceId: activeFolderId,
			})),
		[orderedRefs, activeFolderId],
	);
	const handleSelectAll = useCallback(() => {
		if (selectableItems.length === 0) return;
		useSelectionStore.getState().selectAll(selectableItems);
	}, [selectableItems]);
	const breadcrumb = useMemo(
		() => getBreadcrumb(folders, activeFolderId),
		[folders, activeFolderId],
	);
	const isSubfolder = breadcrumb.length > 1;
	const currentFolder = breadcrumb[breadcrumb.length - 1];
	const parentFolder = breadcrumb[breadcrumb.length - 2];
	const activeRootId = breadcrumb[0]?.id ?? activeFolderId;
	const rootFolders = useMemo(() => getChildren(folders, null), [folders]);

	const handleBack = useCallback(() => {
		if (parentFolder) handleSelectFolder(parentFolder.id);
	}, [parentFolder, handleSelectFolder]);

	// Inline nav sentinel: the toolbar's left zone takes over with back +
	// breadcrumb only once the in-flow control actually scrolls out through
	// the top — never on an arbitrary pixel threshold, and never both at once.
	const sentinelRef = useRef<HTMLDivElement>(null);
	const [navScrolledPast, setNavScrolledPast] = useState(false);
	useEffect(() => {
		if (!isSubfolder) {
			setNavScrolledPast(false);
			return;
		}
		const el = sentinelRef.current;
		if (!el) return;
		const io = new IntersectionObserver(
			([entry]) => {
				setNavScrolledPast(
					!entry.isIntersecting && entry.boundingClientRect.top < 0,
				);
			},
			{ threshold: 0 },
		);
		io.observe(el);
		return () => io.disconnect();
		// Re-run only when the sentinel mounts/unmounts (root <-> subfolder).
	}, [isSubfolder]);

	// Item count per folder (cards only).
	const cardCounts = useMemo(() => {
		const counts: Record<string, number> = {};
		for (const c of allCards) {
			counts[c.folderId] = (counts[c.folderId] ?? 0) + 1;
		}
		return counts;
	}, [allCards]);

	// Preview cards per subfolder (first ≤4 cards) for the mini Speed-Dial mosaic.
	const previewCards = useMemo(() => {
		const map: Record<string, FolderPreviewItem[]> = {};
		for (const folder of subfolders) {
			map[folder.id] = allCards
				.filter((c) => c.folderId === folder.id)
				.sort((a, b) => a.order - b.order)
				.slice(0, 4)
				.map((c) => ({
					id: c.id,
					url: c.url,
					thumbId: c.thumbId,
					favicon: c.favicon || faviconUrl(c.url),
				}));
		}
		return map;
	}, [allCards, subfolders]);

	// Whether the current folder is empty (no cards and no subfolders).
	const isEmpty = cards.length === 0 && subfolders.length === 0;

	// Current folder name for the empty landing badge.
	const currentFolderName = useMemo(() => {
		const folder = folders.find((f) => f.id === activeFolderId);
		return folder?.name ?? "Home";
	}, [folders, activeFolderId]);

	// UI state.
	const [showSettings, setShowSettings] = useState(false);
	const [settingsPane, setSettingsPane] = useState<SettingsPaneId>();
	const [settingsAction, setSettingsAction] =
		useState<SettingsSidebarProps["initialAction"]>(undefined);
	const unifiedSearchRef = useRef<UnifiedSearchHandle>(null);
	const [restMode, setRestMode] = useState(false);
	const [wakeActive, setWakeActive] = useState(true);

	const triggerWake = useCallback(() => {
		setWakeActive(true);
		window.setTimeout(() => setWakeActive(false), 520);
	}, []);

	useEffect(() => {
		const timer = window.setTimeout(() => setWakeActive(false), 520);
		return () => window.clearTimeout(timer);
	}, []);

	const enterRestMode = useCallback(() => {
		setShowSettings(false);
		setRestMode(true);
	}, []);

	const exitRestMode = useCallback(() => {
		setRestMode(false);
		triggerWake();
	}, [triggerWake]);

	useEffect(() => {
		if (!restMode) return;
		function handleRestModeKey(event: KeyboardEvent) {
			if (
				event.key !== "Escape" &&
				event.key !== "Enter" &&
				event.key !== " "
			) {
				return;
			}
			event.preventDefault();
			exitRestMode();
		}
		document.addEventListener("keydown", handleRestModeKey);
		return () => document.removeEventListener("keydown", handleRestModeKey);
	}, [restMode, exitRestMode]);

	// Open Settings window with optional pane & action deep-linking
	const handleOpenSettings = useCallback(
		(pane?: SettingsPaneId, action?: SettingsSidebarProps["initialAction"]) => {
			setSettingsPane(pane);
			setSettingsAction(action);
			setShowSettings(true);
		},
		[],
	);

	const handleToggleSettings = useCallback(() => {
		if (showSettings) {
			setShowSettings(false);
			setSettingsAction(undefined);
			return;
		}
		handleOpenSettings();
	}, [handleOpenSettings, showSettings]);

	const handleSpeedDialBackgroundPointer = useCallback(
		(event: PointerEvent) => {
			if (!showSettings || event.pointerType !== "mouse") return;
			if (event.button !== 0 && event.button !== 2) return;

			const target = event.target;
			if (!(target instanceof Element)) return;
			if (target.closest(SPEED_DIAL_INTERACTIVE_SELECTOR)) return;

			// This handler is scoped to the real Speed Dial scroll surface. A
			// background click closes the sidebar, while the subsequent native
			// contextmenu event is intentionally left untouched for right-clicks.
			setShowSettings(false);
			setSettingsAction(undefined);
		},
		[showSettings],
	);

	// The toolbar is an alternate trigger for the one in-flow search object.
	// Bring that object back into view before focusing it instead of mounting a
	// second palette with a second query/result state.
	const handleOpenSearch = useCallback(() => {
		const input = document.querySelector<HTMLElement>(
			"[data-unified-search-input]",
		);
		input?.scrollIntoView({ behavior: "smooth", block: "center" });
		requestAnimationFrame(() => {
			unifiedSearchRef.current?.focus();
		});
	}, []);

	// Drop one bookmark onto another: fold both into a fresh subfolder and
	// immediately offer it for naming. Atomic — nothing is lost on failure.
	const handleCombineCards = useCallback(
		(draggedCardId: string, targetCardId: string) => {
			const id = createSubfolderFromCards(
				activeFolderId,
				draggedCardId,
				targetCardId,
				"New Folder",
			);
			useSelectionStore.getState().clear();
			if (id) beginRename({ kind: "folder", id });
		},
		[createSubfolderFromCards, activeFolderId, beginRename],
	);

	const handleLiveReorder = useCallback(
		(
			container: string,
			dragged: ItemRef,
			target: ItemRef,
			position: "before" | "after",
		) => {
			reorderItems(container, dragged, target, position);
		},
		[reorderItems],
	);

	// Tabbar/overflow drop: the move persists first (multi-aware, both kinds
	// in one store call so a mixed group can never be half-moved), then any
	// spring-loaded navigation is just a view change.
	const handleTabDrop = useCallback(
		(draggedId: string, targetId: string) => {
			const state = useSetupStore.getState();
			const selected = useSelectionStore.getState().selectedIds;
			const group = selected.includes(draggedId) ? selected : [draggedId];
			const cardIds = group.filter(
				(id) =>
					state.cards.some((c) => c.id === id) &&
					state.cards.find((c) => c.id === id)?.folderId !== targetId,
			);
			const folderIds = group.filter(
				(id) =>
					state.folders.some((f) => f.id === id) &&
					id !== targetId &&
					!wouldCreateCycle(state.folders, id, targetId),
			);
			if (cardIds.length === 0 && folderIds.length === 0) return;
			moveItemsToContainer(targetId, cardIds, folderIds);
			useSelectionStore.getState().clear();
		},
		[moveItemsToContainer],
	);

	// Direct folder creation (no Settings modal): create "New Folder",
	// navigate so the new item is visible, then immediately enter inline
	// rename, Vivaldi-style. Navigation first (it settles stray sessions),
	// rename second (it must survive).
	const handleNewSubfolder = useCallback(
		(parentId: string | null) => {
			const id = addFolder("New Folder", parentId);
			handleSelectFolder(parentId ?? id);
			beginRename({ kind: "folder", id });
		},
		[addFolder, beginRename, handleSelectFolder],
	);

	// Drag a nested folder onto a tab edge: hoist it to root at that position.
	const handleMoveFolderToRoot = useCallback(
		(folderId: string, targetId: string, position: "before" | "after") => {
			moveFolders([folderId], null);
			reorderFolders(folderId, targetId, position);
		},
		[moveFolders, reorderFolders],
	);

	const isRootFolder = useCallback(
		(id: string) => rootFolders.some((f) => f.id === id),
		[rootFolders],
	);

	// Keyboard shortcut: Ctrl+K / Cmd+K opens local search.
	useEffect(() => {
		function handleKey(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				handleOpenSearch();
			}
		}
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [handleOpenSearch]);

	// Scroll Craft-style ambient transition without per-frame React renders.
	// The scroll signal is written to CSS once per animation frame, where the
	// hero and fixed top fade can consume it with compositor-friendly transforms.
	const speedDialScrollRef = useRef<HTMLDivElement>(null);
	const speedDialFrameRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const scrollContainer = speedDialScrollRef.current;
		if (!scrollContainer) return;
		scrollContainer.addEventListener(
			"pointerdown",
			handleSpeedDialBackgroundPointer,
		);
		return () =>
			scrollContainer.removeEventListener(
				"pointerdown",
				handleSpeedDialBackgroundPointer,
			);
	}, [handleSpeedDialBackgroundPointer]);

	useEffect(() => {
		const scrollContainer = speedDialScrollRef.current;
		if (!scrollContainer) return;
		let frame = 0;
		const syncScrollProgress = () => {
			frame = 0;
			const progress = Math.min(1, scrollContainer.scrollTop / 240);
			scrollContainer.style.setProperty("--ambient-progress", String(progress));
			const scrolled = progress > 0.08 ? "true" : "false";
			scrollContainer.dataset.scrolled = scrolled;
			if (speedDialFrameRef.current) {
				speedDialFrameRef.current.dataset.scrolled = scrolled;
			}
		};
		const onScroll = () => {
			// Dataset state is cheap enough to update synchronously so the sticky
			// top fade responds on the same input event. The continuous
			// transform signal remains rAF-coalesced below.
			const progress = Math.min(1, scrollContainer.scrollTop / 240);
			const scrolled = progress > 0.08 ? "true" : "false";
			scrollContainer.dataset.scrolled = scrolled;
			if (speedDialFrameRef.current) {
				speedDialFrameRef.current.dataset.scrolled = scrolled;
			}
			if (frame !== 0) return;
			frame = requestAnimationFrame(syncScrollProgress);
		};
		syncScrollProgress();
		scrollContainer.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			scrollContainer.removeEventListener("scroll", onScroll);
			if (frame !== 0) cancelAnimationFrame(frame);
		};
	}, []);

	// Select every bookmark and subfolder in the current view. Keep native
	// select-all available inside editable and settings-owned surfaces.
	useEffect(() => {
		function handleSelectAllShortcut(e: KeyboardEvent) {
			if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "a") return;
			const target = e.target;
			if (
				target instanceof HTMLElement &&
				target.closest(
					'input, textarea, [contenteditable="true"], [role="dialog"], [data-settings-panel], [data-settings-ui]',
				)
			) {
				return;
			}
			if (selectableItems.length === 0) return;
			e.preventDefault();
			useSelectionStore.getState().selectAll(selectableItems);
		}
		document.addEventListener("keydown", handleSelectAllShortcut);
		return () =>
			document.removeEventListener("keydown", handleSelectAllShortcut);
	}, [selectableItems]);

	// Clear multi-selection on left-pressing truly blank surface. Everything
	// interactive is excluded: grid cells manage their own click semantics,
	// the tabbar header stays navigable, and floating layers (settings and
	// its portals, the tray, toasts, menus, dialogs) never cost the user
	// their carried selection. Non-primary buttons never clear either, so
	// right-clicking blank space keeps the selection for menu actions.
	useEffect(() => {
		function handlePointerDown(e: PointerEvent) {
			if (e.pointerType === "mouse" && e.button !== 0) return;
			const target = e.target as HTMLElement | null;
			if (
				target?.closest(
					'.dial-cell, [data-local-context-menu], [data-settings-panel], [data-settings-ui], [data-selection-tray], [data-sonner-toaster], button, input, a, header, [role="dialog"], [role="menu"], [role="listbox"], [role="tree"]',
				)
			) {
				return;
			}
			useSelectionStore.getState().clear();
		}
		window.addEventListener("pointerdown", handlePointerDown);
		return () => window.removeEventListener("pointerdown", handlePointerDown);
	}, []);

	return (
		<AppearanceProvider>
			<PageContextMenu
				onOpenBackgroundSettings={() => handleOpenSettings("appearance")}
				onOpenShortcutSettings={() => handleOpenSettings("bookmarks")}
				onAddQuickLink={() =>
					handleOpenSettings("bookmarks", { type: "add-link" })
				}
				onAddFolder={() => handleNewSubfolder(activeFolderId)}
				onSelectAll={selectableItems.length > 0 ? handleSelectAll : undefined}
				onOpenGeneralSettings={() => handleOpenSettings("general")}
				onEnterRestMode={enterRestMode}
				enabled={!restMode}
			>
				<SidebarProvider
					open={showSettings}
					onOpenChange={(isOpen) => {
						setShowSettings(isOpen);
						if (!isOpen) setSettingsAction(undefined);
					}}
					style={
						{
							"--sidebar-width": "var(--settings-sidebar-width)",
						} as CSSProperties
					}
					className={cn(
						"settings-workspace h-screen min-h-screen w-screen min-w-0 overflow-hidden bg-neutral-100 dark:bg-[#252525]",
						showSettings && "p-[var(--workspace-gutter)]",
					)}
				>
					<div
						className="flex h-full min-h-0 min-w-0 flex-1"
						data-settings-workspace-panels="true"
					>
						<SidebarInset
							className="h-full min-h-0 min-w-0 bg-transparent p-0"
							data-speed-dial-inset="true"
						>
							<div
								className={cn(
									"squircle relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
									wakeActive && "klice-wake",
								)}
								ref={speedDialFrameRef}
								data-rest-mode={restMode ? "true" : undefined}
								data-settings-open={showSettings ? "true" : "false"}
								data-speed-dial-frame="true"
							>
								<BackgroundLayer contained />
								<SpeedDialTopFade />
								{!restMode && (
									<div
										className="speed-dial-app-toolbar pointer-events-none absolute inset-x-0 top-0 z-[60] flex h-14 items-center justify-end"
										data-speed-dial-app-toolbar="true"
									>
										<div className="pointer-events-auto flex items-center">
											{!showSettings && (
												<ToolbarActions onSettings={handleToggleSettings} />
											)}
										</div>
									</div>
								)}
								{restMode && <RestMode onExit={exitRestMode} />}

								<div
									ref={speedDialScrollRef}
									className="scrollbar-hidden relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden"
									data-speed-dial-scroll="true"
								>
									<div className={cn(restMode && "rest-mode-hidden")}>
										{/* Ambient content comes first; only this layer recedes during
										    scroll so the Search anchor can remain above the Tabbar. */}
										<main className="speed-dial-hero hero">
											<div
												className="klice-ambient-hero"
												data-ambient-hero="true"
											>
												<ClockWidget />
											</div>
											<div className="speed-dial-search-anchor">
												<UnifiedSearch
													ref={unifiedSearchRef}
													onNavigateFolder={handleSelectFolder}
												/>
											</div>
										</main>

										<NavigationToolbar
											rootFolders={rootFolders}
											activeRootId={activeRootId}
											navigationDirection={navigation.direction}
											breadcrumb={breadcrumb}
											onBack={handleBack}
											showBackNav={isSubfolder && navScrolledPast}
											onSelectFolder={handleSelectFolder}
											onAddFolder={(name) => addFolder(name, null)}
											onNewRootFolder={() => handleNewSubfolder(null)}
											onNewSubfolder={handleNewSubfolder}
											onDeleteFolder={deleteFolder}
											onReorderFolders={(fromId, toId, position) =>
												reorderFolders(fromId, toId, position)
											}
											onDropCards={handleTabDrop}
											onMoveFolders={handleTabDrop}
											onMoveFolderToRoot={handleMoveFolderToRoot}
											isRootFolder={isRootFolder}
											canNestFolder={canNestFolder}
										/>

										<div className="speed-dial-grid-region">
											{/* In-flow subfolder navigation between the tabbar and grid. */}
											{isSubfolder && currentFolder && parentFolder && (
												<div
													ref={sentinelRef}
													className="mx-auto w-full px-6 pb-6"
													style={{ maxWidth: gridMaxWidth }}
												>
													<InlineFolderNav
														currentName={currentFolder.name}
														parentName={parentFolder.name}
														onBack={handleBack}
													/>
												</div>
											)}

											<DialGrid
												folderId={activeFolderId}
												cards={cards}
												subfolders={subfolders}
												allCards={allCards}
												allFolders={folders}
												itemOrder={itemOrder}
												cardCounts={cardCounts}
												previewCards={previewCards}
												onDelete={deleteCard}
												onDeleteFolder={deleteFolder}
												onOpenFolder={handleSelectFolder}
												onNewSubfolder={handleNewSubfolder}
												onMoveItems={(cardIds, folderIds, targetId) =>
													moveItemsToContainer(targetId, cardIds, folderIds)
												}
												onLiveReorder={handleLiveReorder}
												onCombineCards={handleCombineCards}
												canNestFolder={canNestFolder}
												navigation={navigation}
												emptyState={
													isEmpty ? (
														<EmptyLanding
															folderName={currentFolderName}
															onAdd={() =>
																handleOpenSettings("bookmarks", {
																	type: "add-link",
																})
															}
														/>
													) : null
												}
											/>
										</div>

										{/* Lightweight Move-to destination picker */}
										<MoveToDialog />

										{/* Floating multi-select transport tray */}
										<SelectionTray onNavigateFolder={handleSelectFolder} />
									</div>
								</div>
							</div>
						</SidebarInset>

						<SettingsSidebar
							open={showSettings}
							onClose={() => setShowSettings(false)}
							initialPane={settingsPane}
							initialAction={settingsAction}
						/>
					</div>

					<ThemedToaster />
				</SidebarProvider>
			</PageContextMenu>
		</AppearanceProvider>
	);
}
