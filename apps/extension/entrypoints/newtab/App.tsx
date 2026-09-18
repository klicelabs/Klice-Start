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
import { GoToTopButton } from "../../src/components/newtab/go-to-top";
import { HistoryDialog } from "../../src/components/newtab/history-dialog";
import { HistoryManager } from "../../src/components/newtab/history-manager";
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
import { resolveFrozenDragGroup } from "../../src/lib/drag-group";
import {
	getBreadcrumb,
	getChildren,
	wouldCreateCycle,
} from "../../src/lib/folder-tree";
import {
	type HistorySummary,
	historyContainerName,
	isHistoryEditableTarget,
} from "../../src/lib/history";
import {
	buildHistoryEntry,
	clearGestureCapture,
	type GestureCapture,
	snapshotSetup,
	takeGestureCapture,
} from "../../src/lib/history-capture";
import { SPEED_DIAL_INTERACTIVE_SELECTOR } from "../../src/lib/interaction-scope";
import {
	getOrderedRefs,
	type ItemRef,
	ROOT_CONTAINER,
} from "../../src/lib/item-order";
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
import { useHistoryStore } from "../../src/stores/history-store";
import { useImageStore } from "../../src/stores/image-store";
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
	const insertCardsAt = useSetupStore((s) => s.insertCardsAt);
	const moveFolders = useSetupStore((s) => s.moveFolders);
	const moveItemsToContainer = useSetupStore((s) => s.moveItemsToContainer);
	const reorderGroup = useSetupStore((s) => s.reorderGroup);
	const reorderItems = useSetupStore((s) => s.reorderItems);
	const reorderFolders = useSetupStore((s) => s.reorderFolders);
	const previewReorderItems = useSetupStore((s) => s.previewReorderItems);
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
	// P3 hygiene: once hydrated, sweep thumbnail bytes nothing references
	// (reset/import/crash orphans) — best-effort, once per session.
	const sweepOrphans = useCallback(() => {
		const setup = useSetupStore.getState();
		void useImageStore.getState().sweepOrphanThumbnails(
			setup.cards.map((c) => c.thumbId),
			[
				...useHistoryStore.getState().past.flatMap((e) => e.thumbnails ?? []),
				...useHistoryStore.getState().future.flatMap((e) => e.thumbnails ?? []),
			],
		);
	}, []);

	useEffect(() => {
		const initializeNavigation = () => {
			navigationLocationRef.current = useSetupStore.getState().activeFolderId;
			navigationReadyRef.current = true;
		};

		if (useSetupStore.persist.hasHydrated()) {
			initializeNavigation();
			sweepOrphans();
			return;
		}

		return useSetupStore.persist.onFinishHydration(() => {
			initializeNavigation();
			sweepOrphans();
		});
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
		// Union, not replace: items selected on other pages stay selected.
		useSelectionStore.getState().addAll(selectableItems);
	}, [selectableItems]);
	// Stable id list of the current page scope for the tray's contextual
	// Select all (local scope membership, never global).
	const pageIds = useMemo(
		() => selectableItems.map((item) => item.id),
		[selectableItems],
	);
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
	// M18: external location changes PRUNE the branches instead of resetting
	// them — a valid Back stack survived this repair before; it was being
	// wiped on every external repair. The (repaired) current location is
	// dropped from both branches so Back/Forward never land on it, but every
	// other valid entry is preserved.
	useEffect(() => {
		if (!navigationReadyRef.current) return;
		const validFolderIds = new Set(folders.map((folder) => folder.id));
		if (
			navigationLocationRef.current !== null &&
			navigationLocationRef.current !== activeFolderId
		) {
			// Store-side repairs (for example deleting the active subtree or
			// a cross-tab location change) are not a user traversal.
			navigationLocationRef.current = activeFolderId;
		}
		validFolderIds.delete(activeFolderId);
		commitNavigationHistory(
			pruneNavigationHistory(navigationHistoryRef.current, validFolderIds),
		);
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
	const [historyOpen, setHistoryOpen] = useState(false);
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
	// immediately offer it for naming. Atomic — nothing is lost on failure —
	// and reversible: the created folder plus both cards form one entry.
	const handleCombineCards = useCallback(
		(draggedCardId: string, targetCardId: string) => {
			const capture = takeGestureCapture();
			const id = createSubfolderFromCards(
				activeFolderId,
				draggedCardId,
				targetCardId,
				"New Folder",
			);
			if (!id) {
				clearGestureCapture();
				return;
			}
			if (capture) {
				const live = useSetupStore.getState();
				const entry = buildHistoryEntry(
					capture,
					live.cards,
					live.folders,
					live.itemOrder,
					{ kind: "combine", total: 2, cardCount: 2, folderCount: 0 },
				);
				if (entry) useHistoryStore.getState().commit(entry);
			}
			useSelectionStore.getState().clear();
			beginRename({ kind: "folder", id });
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

	const handleReorderGroup = useCallback(
		(
			container: string,
			groupIds: string[],
			target: ItemRef,
			position: "before" | "after",
		) => {
			reorderGroup(container, groupIds, target, position);
		},
		[reorderGroup],
	);

	const handleInsertCardsAt = useCallback(
		(
			targetFolderId: string,
			cardIds: string[],
			targetCardId: string,
			position: "before" | "after",
		) => {
			insertCardsAt(targetFolderId, cardIds, targetCardId, position);
		},
		[insertCardsAt],
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
	// spring-loaded navigation is just a view change. A committed drop ends
	// the gesture: the selection closes so the tray never reopens over items
	// the user just finished moving. The gesture diff commits one history
	// entry announced with Undo.
	const handleTabDrop = useCallback(
		(draggedId: string, targetId: string) => {
			const state = useSetupStore.getState();
			const selection = useSelectionStore.getState().items;
			// L8: the frozen group survives a mid-drag selection clear.
			const group = resolveFrozenDragGroup(
				{ kind: "card", id: draggedId },
				selection,
				state.cards,
				state.folders,
				state.itemOrder,
			);
			const cardIds = group
				.filter(
					(member) =>
						member.kind === "card" &&
						state.cards.find((c) => c.id === member.id)?.folderId !== targetId,
				)
				.map((member) => member.id);
			const folderIds = group
				.filter(
					(member) =>
						member.kind === "folder" &&
						member.id !== targetId &&
						!wouldCreateCycle(state.folders, member.id, targetId),
				)
				.map((member) => member.id);
			if (cardIds.length === 0 && folderIds.length === 0) {
				clearGestureCapture();
				return;
			}
			const capture = takeGestureCapture();
			moveItemsToContainer(targetId, cardIds, folderIds);
			if (capture) {
				const total = cardIds.length + folderIds.length;
				const live = useSetupStore.getState();
				const dest = live.folders.find((f) => f.id === targetId)?.name;
				const entry = buildHistoryEntry(
					capture,
					live.cards,
					live.folders,
					live.itemOrder,
					{
						kind: "move",
						total,
						cardCount: cardIds.length,
						folderCount: folderIds.length,
						dest,
						label:
							total === 1
								? cardIds.length === 1
									? live.cards
											.find((c) => c.id === cardIds[0])
											?.title?.trim() || undefined
									: live.folders.find((f) => f.id === folderIds[0])?.name
								: undefined,
					},
				);
				if (entry) useHistoryStore.getState().commit(entry);
			}
			useSelectionStore.getState().clear();
		},
		[moveItemsToContainer],
	);

	/** Freeze live setup for a manual (non-gesture) history diff. */
	const snapshotLiveSetup = useCallback((): GestureCapture => {
		const state = useSetupStore.getState();
		return snapshotSetup(state.cards, state.folders, state.itemOrder);
	}, []);

	/**
	 * Diff a manual snapshot against live state and commit one atomic entry
	 * (announced with Undo). Returns whether anything was committed.
	 */
	const commitManualHistory = useCallback(
		(before: GestureCapture, summary: HistorySummary): boolean => {
			const live = useSetupStore.getState();
			const entry = buildHistoryEntry(
				before,
				live.cards,
				live.folders,
				live.itemOrder,
				summary,
			);
			if (!entry) return false;
			useHistoryStore.getState().commit(entry);
			return true;
		},
		[],
	);

	// Direct folder creation (no Settings modal): create "New Folder",
	// navigate so the new item is visible, then immediately enter inline
	// rename, Vivaldi-style. The creation itself commits one history entry
	// (the follow-up rename commits its own when confirmed).
	const handleNewSubfolder = useCallback(
		(parentId: string | null) => {
			const before = snapshotLiveSetup();
			const id = addFolder("New Folder", parentId);
			commitManualHistory(before, {
				kind: "create",
				total: 1,
				cardCount: 0,
				folderCount: 0,
				label: "New Folder",
			});
			handleSelectFolder(parentId ?? id);
			beginRename({ kind: "folder", id });
		},
		[
			addFolder,
			beginRename,
			handleSelectFolder,
			snapshotLiveSetup,
			commitManualHistory,
		],
	);

	// Drag a nested folder onto a tab edge: hoist it to root at that position.
	// One entry covering both the reparent and the tab-bar reorder.
	const handleMoveFolderToRoot = useCallback(
		(folderId: string, targetId: string, position: "before" | "after") => {
			const before = takeGestureCapture() ?? snapshotLiveSetup();
			const name = useSetupStore
				.getState()
				.folders.find((f) => f.id === folderId)?.name;
			moveFolders([folderId], null);
			reorderFolders(folderId, targetId, position);
			commitManualHistory(before, {
				kind: "move",
				total: 1,
				cardCount: 0,
				folderCount: 1,
				dest: "Top level",
				label: name,
			});
		},
		[moveFolders, reorderFolders, commitManualHistory, snapshotLiveSetup],
	);

	// Tab-bar root reorder during a tab drag. H4: hovers are visual-only
	// previews (order-array write; legacy fields and history untouched); the
	// DROP commits once via reorderItems + the capture diff. Undo now always
	// restores the final position, and every intermediate hover is covered.
	const handleReorderTabFolders = useCallback(
		(fromId: string, toId: string, position: "before" | "after" = "before") => {
			previewReorderItems(
				ROOT_CONTAINER,
				{ kind: "folder", id: fromId },
				{ kind: "folder", id: toId },
				position,
			);
		},
		[previewReorderItems],
	);

	// Folder deletion captures its atomic restore INSIDE the store action
	// (H2), so every path — grid, settings pane, future callers — gets the
	// same one-entry history and P3 tombstoned thumbnails. This handler only
	// routes the id.
	const handleDeleteFolder = useCallback(
		(id: string) => {
			deleteFolder(id);
		},
		[deleteFolder],
	);

	// Overflow "add folder" row: same reversible create as any other entry.
	const handleAddRootFolder = useCallback(
		(name: string): string => {
			const before = snapshotLiveSetup();
			const id = addFolder(name, null);
			commitManualHistory(before, {
				kind: "create",
				total: 1,
				cardCount: 0,
				folderCount: 0,
				label: name,
			});
			return id;
		},
		[addFolder, commitManualHistory, snapshotLiveSetup],
	);

	const isRootFolder = useCallback(
		(id: string) => rootFolders.some((f) => f.id === id),
		[rootFolders],
	);

	// Keyboard shortcut: Ctrl+K / Cmd+K opens local search.
	// M15: skipped while typing in an editable field (rename, search input,
	// contenteditable) — the shortcut used to steal focus mid-typing.
	useEffect(() => {
		function handleKey(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				if (isHistoryEditableTarget(e.target)) return;
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
			useSelectionStore.getState().addAll(selectableItems);
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
				onOpenHistory={() => setHistoryOpen(true)}
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
											onAddFolder={handleAddRootFolder}
											onNewRootFolder={() => handleNewSubfolder(null)}
											onNewSubfolder={handleNewSubfolder}
											onDeleteFolder={handleDeleteFolder}
											onReorderFolders={handleReorderTabFolders}
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
												onDeleteFolder={handleDeleteFolder}
												onOpenFolder={handleSelectFolder}
												onNewSubfolder={handleNewSubfolder}
												onMoveItems={(cardIds, folderIds, targetId) =>
													moveItemsToContainer(targetId, cardIds, folderIds)
												}
												onLiveReorder={handleLiveReorder}
												onReorderGroup={handleReorderGroup}
												onInsertCardsAt={handleInsertCardsAt}
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
										<SelectionTray
											onNavigateFolder={handleSelectFolder}
											pageIds={pageIds}
											onSelectAll={handleSelectAll}
										/>
										{/* Command history: toasts, confirmation, shortcuts */}
										<HistoryManager />
										<HistoryDialog
											open={historyOpen}
											onOpenChange={setHistoryOpen}
										/>
									</div>
								</div>
								{!restMode && (
									<GoToTopButton
										scrollRef={speedDialScrollRef}
										folderId={activeFolderId}
									/>
								)}
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
