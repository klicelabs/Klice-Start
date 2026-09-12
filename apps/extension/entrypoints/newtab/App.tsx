import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppearanceProvider } from "../../src/components/newtab/appearance-provider";
import { BackgroundLayer } from "../../src/components/newtab/background-layer";
import { ClockWidget } from "../../src/components/newtab/clock-widget";
import { DialGrid } from "../../src/components/newtab/dial-grid";
import { EmptyLanding } from "../../src/components/newtab/empty-landing";
import { InlineFolderNav } from "../../src/components/newtab/folder-nav";
import type { FolderPreviewItem } from "../../src/components/newtab/folders/folder-preview-card";
import { PageContextMenu } from "../../src/components/newtab/page-context-menu";
import { GlobalSearch } from "../../src/components/newtab/search/global-search";
import { SearchBar } from "../../src/components/newtab/search/search-bar";
import {
	SettingsDialog,
	type SettingsDialogProps,
	type SettingsPaneId,
} from "../../src/components/newtab/settings";
import { NavigationToolbar } from "../../src/components/newtab/toolbar/navigation-toolbar";
import { MoveToDialog } from "../../src/components/shared/move-to-dialog";
import { useCrossTabSync } from "../../src/hooks/use-cross-tab-sync";
import {
	getBreadcrumb,
	getChildren,
	wouldCreateCycle,
} from "../../src/lib/folder-tree";
import type { ItemRef } from "../../src/lib/item-order";
import { faviconUrl } from "../../src/lib/url";
import { useRenameStore } from "../../src/stores/rename-store";
import { useSelectionStore } from "../../src/stores/selection-store";
import {
	computeGridMaxWidth,
	useSetupStore,
} from "../../src/stores/setup-store";
import type { Card } from "../../src/types";

import "../../src/styles/tokens.css";

export default function App() {
	useCrossTabSync();

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

	// Navigation always settles any stray rename session first (an input
	// unmounted by navigation never blurs, so without this a stale session
	// could linger and pop open unexpectedly later).
	const handleSelectFolder = useCallback(
		(id: string) => {
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
	const [settingsPane, setSettingsPane] = useState<SettingsPaneId>("general");
	const [settingsAction, setSettingsAction] =
		useState<SettingsDialogProps["initialAction"]>(undefined);
	const [showSearch, setShowSearch] = useState(false);

	// Open Settings window with optional pane & action deep-linking
	const handleOpenSettings = useCallback(
		(
			pane: SettingsPaneId = "general",
			action?: SettingsDialogProps["initialAction"],
		) => {
			setSettingsPane(pane);
			setSettingsAction(action);
			setShowSettings(true);
		},
		[],
	);

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
				setShowSearch((prev) => !prev);
			}
		}
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, []);

	// Clear multi-selection on clicking outside interactive elements
	useEffect(() => {
		function handlePointerDown(e: MouseEvent) {
			const target = e.target as HTMLElement | null;
			if (
				target?.closest(
					'.dial-cell, [data-local-context-menu], button, input, a, header, [role="dialog"], [role="menu"]',
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
				onOpenGeneralSettings={() => handleOpenSettings("general")}
			>
				<div className="relative flex min-h-screen flex-col text-white">
					<BackgroundLayer />

					<NavigationToolbar
						rootFolders={rootFolders}
						activeRootId={activeRootId}
						breadcrumb={breadcrumb}
						onBack={handleBack}
						showBackNav={isSubfolder && navScrolledPast}
						onSelectFolder={handleSelectFolder}
						onAddFolder={(name) => addFolder(name, null)}
						onNewRootFolder={() => handleNewSubfolder(null)}
						onNewSubfolder={handleNewSubfolder}
						onOpenSettings={() => handleOpenSettings("general")}
						onOpenSearch={() => setShowSearch(true)}
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

					{/* Hero: Clock + Web Search */}
					<div className="pb-20">
						<main className="hero flex w-full flex-col items-center gap-6 px-6 pt-12 pb-16">
							<ClockWidget />
							<SearchBar />
						</main>

						{/* In-flow subfolder navigation between Search and grid. */}
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

						{isEmpty ? (
							<EmptyLanding
								folderName={currentFolderName}
								onAdd={() =>
									handleOpenSettings("bookmarks", { type: "add-link" })
								}
							/>
						) : (
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
							/>
						)}
					</div>

					{/* Global Search overlay (Spotlight-style favorites/folders search) */}
					<GlobalSearch
						open={showSearch}
						onClose={() => setShowSearch(false)}
						onNavigateFolder={(id) => {
							handleSelectFolder(id);
							setShowSearch(false);
						}}
					/>

					{/* Lightweight Move-to destination picker */}
					<MoveToDialog />

					{/* macOS-style Settings Window */}
					<SettingsDialog
						open={showSettings}
						onClose={() => setShowSettings(false)}
						initialPane={settingsPane}
						initialAction={settingsAction}
					/>
				</div>
			</PageContextMenu>
		</AppearanceProvider>
	);
}
