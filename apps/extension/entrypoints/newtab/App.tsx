import { useCallback, useEffect, useMemo, useState } from "react";
import { AppearanceProvider } from "../../src/components/newtab/appearance-provider";
import { BackgroundLayer } from "../../src/components/newtab/background-layer";
import { ClockWidget } from "../../src/components/newtab/clock-widget";
import { DialGrid } from "../../src/components/newtab/dial-grid";
import { EmptyLanding } from "../../src/components/newtab/empty-landing";
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
import { useCrossTabSync } from "../../src/hooks/use-cross-tab-sync";
import {
	getBreadcrumb,
	getChildren,
	wouldCreateCycle,
} from "../../src/lib/folder-tree";
import { faviconUrl } from "../../src/lib/url";
import { useSetupStore } from "../../src/stores/setup-store";
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
	const moveCard = useSetupStore((s) => s.moveCard);
	const moveFolder = useSetupStore((s) => s.moveFolder);
	const reorderFolders = useSetupStore((s) => s.reorderFolders);

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
	const activeRootId = breadcrumb[0]?.id ?? activeFolderId;
	const rootFolders = useMemo(() => getChildren(folders, null), [folders]);

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

	return (
		<AppearanceProvider>
			<PageContextMenu
				onOpenBackgroundSettings={() => handleOpenSettings("background")}
				onOpenShortcutSettings={() => handleOpenSettings("bookmarks")}
				onAddQuickLink={() =>
					handleOpenSettings("bookmarks", { type: "add-link" })
				}
			>
				<div className="relative flex min-h-screen flex-col text-white">
					<BackgroundLayer />

					<NavigationToolbar
						folders={folders}
						rootFolders={rootFolders}
						activeFolderId={activeFolderId}
						activeRootId={activeRootId}
						onSelectFolder={setActiveFolder}
						onAddFolder={(name) => addFolder(name, null)}
						onOpenSettings={() => handleOpenSettings("general")}
						onOpenSearch={() => setShowSearch(true)}
						onEditFolder={(id) =>
							handleOpenSettings("bookmarks", {
								type: "edit-folder",
								folderId: id,
							})
						}
						onDeleteFolder={deleteFolder}
						onReorderFolders={(fromId, toId) =>
							useSetupStore.getState().reorderFolders(fromId, toId)
						}
						onDropCard={(cardId, folderId) => moveCard(cardId, folderId)}
						onMoveFolder={(folderId, targetId) =>
							moveFolder(folderId, targetId)
						}
						canNestFolder={canNestFolder}
					/>

					{/* Hero: Clock + Web Search */}
					<div className="pb-20">
						<main className="hero flex w-full flex-col items-center gap-6 px-6 pt-12 pb-16">
							<ClockWidget />
							<SearchBar />
						</main>

						{isEmpty ? (
							<EmptyLanding
								folderName={currentFolderName}
								onAdd={() =>
									handleOpenSettings("bookmarks", { type: "add-link" })
								}
							/>
						) : (
							<DialGrid
								cards={cards}
								subfolders={subfolders}
								cardCounts={cardCounts}
								previewCards={previewCards}
								onEdit={(id) =>
									handleOpenSettings("bookmarks", {
										type: "edit-link",
										cardId: id,
									})
								}
								onDelete={deleteCard}
								onDeleteFolder={deleteFolder}
								onReorder={(fromId, toId) =>
									useSetupStore
										.getState()
										.reorderCardsInActiveFolder(fromId, toId)
								}
								onAdd={() =>
									handleOpenSettings("bookmarks", { type: "add-link" })
								}
								onAddFolder={() =>
									handleOpenSettings("bookmarks", {
										type: "add-folder",
										folderId: activeFolderId,
									})
								}
								onOpenFolder={setActiveFolder}
								onEditFolder={(id) =>
									handleOpenSettings("bookmarks", {
										type: "edit-folder",
										folderId: id,
									})
								}
								onMoveCard={(cardId, folderId) => moveCard(cardId, folderId)}
								onReorderFolders={(fromId, toId) =>
									reorderFolders(fromId, toId)
								}
								onMoveFolder={(folderId, targetFolderId) =>
									moveFolder(folderId, targetFolderId)
								}
								canNestFolder={canNestFolder}
							/>
						)}
					</div>

					{/* Global Search overlay (Spotlight-style favorites/folders search) */}
					<GlobalSearch
						open={showSearch}
						onClose={() => setShowSearch(false)}
						onNavigateFolder={(id) => {
							setActiveFolder(id);
							setShowSearch(false);
						}}
					/>

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
