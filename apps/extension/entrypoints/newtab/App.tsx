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
import type {
	NavigationHistory,
	NavigationState,
} from "../../src/lib/navigation";
import {
	createNavigationHistory,
	getNavigationState,
	pruneNavigationHistory,
	pushNavigation,
	traverseBack,
	traverseForward,
} from "../../src/lib/navigation";
import { faviconUrl } from "../../src/lib/url";
import { cn } from "../../src/lib/utils";
import { useRenameStore } from "../../src/stores/rename-store";
import { useSelectionStore } from "../../src/stores/selection-store";
import { useSetupStore } from "../../src/stores/setup-store";
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

function SpeedDialTopFade({ visible }: { visible: boolean }) {
	// Keep this frame-level readability layer above scrolling cards but below
	// the complete toolbar surface; controls inherit one shared layer boundary.
	// The gradient recipe itself lives in tokens.css and is untouched — only
	// the standard opacity gate moves here, so the fade rests invisible until
	// content actually scrolls underneath the toolbar.
	return (
		<div
			className={cn(
				"speed-dial-top-fade pointer-events-none absolute inset-x-0 top-0 z-[var(--speed-dial-layer-scroll-fade)] transition-opacity duration-200 motion-reduce:transition-none",
				visible ? "opacity-100" : "opacity-0",
			)}
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
	const insertCardAt = useSetupStore((s) => s.insertCardAt);
	const moveFolders = useSetupStore((s) => s.moveFolders);
	const moveItemsToContainer = useSetupStore((s) => s.moveItemsToContainer);
	const reorderItems = useSetupStore((s) => s.reorderItems);
	const reorderFolders = useSetupStore((s) => s.reorderFolders);
	const createSubfolderFromCards = useSetupStore(
		(s) => s.createSubfolderFromCards,
	);
	const itemOrder = useSetupStore((s) => s.itemOrder ?? {});
	const searchEnabled = useSetupStore((s) => s.settings.search.enabled);
	const appearanceMode = useSetupStore((s) => s.settings.appearanceMode);

	const beginRename = useRenameStore((s) => s.begin);
	const cancelRename = useRenameStore((s) => s.cancel);
	const [navigation, setNavigation] = useState<NavigationState>({
		direction: "forward",
		kind: "root",
	});
	const [navigationHistory, setNavigationHistory] = useState<NavigationHistory>(
		createNavigationHistory,
	);
	const navigationHistoryRef = useRef<NavigationHistory>(
		createNavigationHistory(),
	);
	const navigationReadyRef = useRef(false);
	const navigationLocationRef = useRef<string | null>(null);

	const commitNavigationHistory = useCallback((next: NavigationHistory) => {
		navigationHistoryRef.current = next;
		setNavigationHistory(next);
	}, []);

	// Persisted activeFolderId is the starting location only. Hydration marks
	// the session boundary so restoring it never creates a Back entry.
	useEffect(() => {
		const initializeNavigation = () => {
			navigationLocationRef.current = useSetupStore.getState().activeFolderId;
			navigationReadyRef.current = true;
		};

		if (useSetupStore.persist.hasHydrated()) {
			initializeNavigation();
			return;
		}

		return useSetupStore.persist.onFinishHydration(initializeNavigation);
	}, []);

	// Navigation always settles any stray rename session first (an input
	// unmounted by navigation never blurs, so without this a stale session
	// could linger and pop open unexpectedly later).
	const handleSelectFolder = useCallback(
		(id: string) => {
			const state = useSetupStore.getState();
			cancelRename();
			if (
				state.activeFolderId === id ||
				!state.folders.some((folder) => folder.id === id)
			)
				return;

			if (!navigationReadyRef.current) {
				navigationLocationRef.current = id;
				setActiveFolder(id);
				return;
			}

			const nextHistory = pushNavigation(
				navigationHistoryRef.current,
				state.activeFolderId,
				id,
			);
			commitNavigationHistory(nextHistory);
			setNavigation(
				getNavigationState(state.folders, state.activeFolderId, id),
			);
			navigationLocationRef.current = id;
			setActiveFolder(id);
		},
		[cancelRename, commitNavigationHistory, setActiveFolder],
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
	const activeRootId = breadcrumb[0]?.id ?? activeFolderId;
	const rootFolders = useMemo(() => getChildren(folders, null), [folders]);

	const handleBack = useCallback(() => {
		if (!navigationReadyRef.current) return;
		const state = useSetupStore.getState();
		const validFolderIds = new Set(state.folders.map((folder) => folder.id));
		const traversal = traverseBack(
			navigationHistoryRef.current,
			state.activeFolderId,
			validFolderIds,
		);
		commitNavigationHistory(traversal.history);
		if (!traversal.targetId) return;

		cancelRename();
		setNavigation(
			getNavigationState(
				state.folders,
				state.activeFolderId,
				traversal.targetId,
				"back",
			),
		);
		navigationLocationRef.current = traversal.targetId;
		setActiveFolder(traversal.targetId);
	}, [cancelRename, commitNavigationHistory, setActiveFolder]);

	const handleForward = useCallback(() => {
		if (!navigationReadyRef.current) return;
		const state = useSetupStore.getState();
		const validFolderIds = new Set(state.folders.map((folder) => folder.id));
		const traversal = traverseForward(
			navigationHistoryRef.current,
			state.activeFolderId,
			validFolderIds,
		);
		commitNavigationHistory(traversal.history);
		if (!traversal.targetId) return;

		cancelRename();
		setNavigation(
			getNavigationState(
				state.folders,
				state.activeFolderId,
				traversal.targetId,
				"forward",
			),
		);
		navigationLocationRef.current = traversal.targetId;
		setActiveFolder(traversal.targetId);
	}, [cancelRename, commitNavigationHistory, setActiveFolder]);

	// Folder deletion, reset, and cross-tab repair can change the store's
	// location without being navigation. Reconcile those changes without
	// recording them, and prune deleted IDs from both session branches.
	useEffect(() => {
		if (!navigationReadyRef.current) return;
		const validFolderIds = new Set(folders.map((folder) => folder.id));
		const repairedHistory = pruneNavigationHistory(
			navigationHistoryRef.current,
			validFolderIds,
		);
		if (
			navigationLocationRef.current !== null &&
			navigationLocationRef.current !== activeFolderId
		) {
			// Store-side repairs (for example deleting the active subtree or a
			// cross-tab location change) are not a user traversal. Reset the
			// session branches so they cannot point at the repaired location.
			navigationLocationRef.current = activeFolderId;
			commitNavigationHistory(createNavigationHistory());
			return;
		}
		commitNavigationHistory(repairedHistory);
	}, [activeFolderId, commitNavigationHistory, folders]);

	// Item count per folder (cards only).
	const cardCounts = useMemo(() => {
		const counts: Record<string, number> = {};
		for (const c of allCards) {
			counts[c.folderId] = (counts[c.folderId] ?? 0) + 1;
		}
		return counts;
	}, [allCards]);

	// Keep ten ordered cards available for Icon mode's stable 3×3 preview: the
	// ninth slot is the folder trigger and the tenth sits visibly underneath it.
	// Card mode still renders only its original four-card mosaic.
	const previewCards = useMemo(() => {
		const map: Record<string, FolderPreviewItem[]> = {};
		const cardsById = new Map(allCards.map((card) => [card.id, card]));
		for (const folder of subfolders) {
			map[folder.id] = getOrderedRefs(folder.id, folders, allCards, itemOrder)
				.filter((ref) => ref.kind === "card")
				.map((ref) => cardsById.get(ref.id))
				.filter((card): card is Card => card !== undefined)
				.slice(0, 10)
				.map((c) => ({
					id: c.id,
					url: c.url,
					thumbId: c.thumbId,
					favicon: c.favicon || faviconUrl(c.url),
				}));
		}
		return map;
	}, [allCards, folders, itemOrder, subfolders]);

	// Whether the current folder is empty (no cards and no subfolders).
	const isEmpty = cards.length === 0 && subfolders.length === 0;

	// Current folder name for the empty landing badge.
	const currentFolderName = useMemo(() => {
		const folder = folders.find((f) => f.id === activeFolderId);
		return folder?.name ?? "Home";
	}, [folders, activeFolderId]);

	// UI state.
	const [showSettings, setShowSettings] = useState(false);
	const [settingsLayoutOpen, setSettingsLayoutOpen] = useState(false);
	const [settingsPane, setSettingsPane] = useState<SettingsPaneId>();
	const [settingsAction, setSettingsAction] =
		useState<SettingsSidebarProps["initialAction"]>(undefined);
	const unifiedSearchRef = useRef<UnifiedSearchHandle>(null);
	const [restMode, setRestMode] = useState(false);
	const [wakeActive, setWakeActive] = useState(true);
	const [compactSearch, setCompactSearch] = useState(false);
	// The top fade only works while content sits underneath the toolbar: at
	// scroll-top (or when nothing overflows) it rests invisible.
	const [scrolled, setScrolled] = useState(false);

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
			setSettingsLayoutOpen(true);
			setSettingsPane(pane);
			setSettingsAction(action);
			setShowSettings(true);
		},
		[],
	);

	useEffect(() => {
		if (showSettings) setSettingsLayoutOpen(true);
	}, [showSettings]);

	const handleSettingsLayoutTransitionEnd = useCallback(() => {
		if (!showSettings) setSettingsLayoutOpen(false);
	}, [showSettings]);

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

	// The toolbar is an alternate trigger for the one mounted Search controller.
	// Focus it in place: the compact affordance must not move native scrolling
	// or create a second Search state/controller.
	const handleOpenSearch = useCallback(() => {
		unifiedSearchRef.current?.focus();
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

	const handlePreviewDrop = useCallback(
		(
			targetFolderId: string,
			draggedCardId: string,
			targetCardId: string,
			position: "before" | "after",
		) => {
			insertCardAt(targetFolderId, draggedCardId, targetCardId, position);
		},
		[insertCardAt],
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
	// rename, Vivaldi-style. Move-only operations are history-neutral; creation
	// records history only when this intentional reveal changes the destination.
	// The same-location guard keeps creating inside the current folder neutral.
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

	// Native scrolling owns all hero movement. React only observes the one
	// discrete boundary that changes the compact Search affordance.
	const speedDialScrollRef = useRef<HTMLDivElement>(null);
	const appToolbarRef = useRef<HTMLDivElement>(null);
	const searchAnchorRef = useRef<HTMLDivElement>(null);
	const compactSearchRef = useRef(false);
	const scrolledRef = useRef(false);
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
		if (restMode) {
			if (scrolledRef.current) {
				scrolledRef.current = false;
				setScrolled(false);
			}
			return;
		}
		const scrollContainer = speedDialScrollRef.current;
		const toolbarElement = appToolbarRef.current;
		if (!scrollContainer || !toolbarElement) return;

		let frame = 0;
		const syncScrollBoundaries = () => {
			frame = 0;
			const searchAnchor = searchAnchorRef.current;
			const searchRect = searchAnchor?.getBoundingClientRect();
			const toolbarBottom = toolbarElement.getBoundingClientRect().bottom;
			const nextCompactSearch = Boolean(
				searchRect && searchRect.bottom <= toolbarBottom,
			);

			if (compactSearchRef.current !== nextCompactSearch) {
				compactSearchRef.current = nextCompactSearch;
				setCompactSearch(nextCompactSearch);
			}

			const nextScrolled = scrollContainer.scrollTop > 4;
			if (scrolledRef.current !== nextScrolled) {
				scrolledRef.current = nextScrolled;
				setScrolled(nextScrolled);
			}
		};

		const onScroll = () => {
			if (frame !== 0) return;
			frame = requestAnimationFrame(syncScrollBoundaries);
		};

		syncScrollBoundaries();
		scrollContainer.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onScroll);
		return () => {
			scrollContainer.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onScroll);
			if (frame !== 0) cancelAnimationFrame(frame);
		};
	}, [restMode]);

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
						settingsLayoutOpen && "p-[var(--workspace-gutter)]",
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
								data-rest-mode={restMode ? "true" : undefined}
								data-settings-open={settingsLayoutOpen ? "true" : "false"}
								data-compact-search={compactSearch ? "true" : "false"}
								data-active-folder-id={activeFolderId}
								data-folder-depth={breadcrumb.length}
								data-speed-dial-frame="true"
							>
								<BackgroundLayer contained />
								<SpeedDialTopFade visible={scrolled} />
								{!restMode && (
									<div
										ref={appToolbarRef}
										className="speed-dial-app-toolbar pointer-events-none absolute inset-x-0 top-0 z-[var(--speed-dial-layer-app-toolbar)] flex h-14 items-center justify-end"
										data-speed-dial-app-toolbar="true"
										data-material={
											appearanceMode === "liquid" ? "liquid" : "flat"
										}
									>
										<NavigationToolbar
											rootFolders={rootFolders}
											activeRootId={activeRootId}
											navigationDirection={navigation.direction}
											breadcrumb={breadcrumb}
											canGoBack={navigationHistory.back.length > 0}
											canGoForward={navigationHistory.forward.length > 0}
											onBack={handleBack}
											onForward={handleForward}
											searchEnabled={searchEnabled}
											onOpenSearch={handleOpenSearch}
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
									className="scrollbar-hidden relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden"
									data-speed-dial-scroll="true"
								>
									<div className={cn(restMode && "rest-mode-hidden")}>
										{/* Ambient content remains in the normal page flow. */}
										<main className="speed-dial-hero hero">
											<div
												className="klice-ambient-hero"
												data-ambient-hero="true"
											>
												<ClockWidget />
											</div>
											<div
												ref={searchAnchorRef}
												className="speed-dial-search-anchor"
											>
												<UnifiedSearch
													ref={unifiedSearchRef}
													onNavigateFolder={handleSelectFolder}
												/>
											</div>
										</main>

										<div className="speed-dial-grid-region">
											<DialGrid
												folderId={activeFolderId}
												layoutOpen={settingsLayoutOpen}
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
												onPreviewDrop={handlePreviewDrop}
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
							layoutOpen={settingsLayoutOpen}
							onClose={() => setShowSettings(false)}
							onLayoutTransitionEnd={handleSettingsLayoutTransitionEnd}
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
