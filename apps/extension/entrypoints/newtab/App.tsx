import { useCallback, useEffect, useMemo, useState } from "react";
import { AppearanceProvider } from "../../src/components/newtab/appearance-provider";
import { BackgroundLayer } from "../../src/components/newtab/background-layer";
import { ClockWidget } from "../../src/components/newtab/clock-widget";
import { DialGrid } from "../../src/components/newtab/dial-grid";
import { AddFolderDialog } from "../../src/components/newtab/dialogs/add-folder-dialog";
import { AddSiteDialog } from "../../src/components/newtab/dialogs/add-site-dialog";
import { EmptyLanding } from "../../src/components/newtab/empty-landing";
import type { FolderPreviewItem } from "../../src/components/newtab/folders/folder-preview-card";
import { PageContextMenu } from "../../src/components/newtab/page-context-menu";
import { GlobalSearch } from "../../src/components/newtab/search/global-search";
import { SearchBar } from "../../src/components/newtab/search/search-bar";
import { SettingsPanel } from "../../src/components/newtab/settings-panel";
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
	const addCard = useSetupStore((s) => s.addCard);
	const updateCard = useSetupStore((s) => s.updateCard);
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
		for (const c of allCards)
			counts[c.folderId] = (counts[c.folderId] ?? 0) + 1;
		return counts;
	}, [allCards]);

	// Preview cards per subfolder (first ≤4 cards) for the mini Speed-Dial
	// mosaic. We pass card refs (thumbId + favicon) so each tile can show the
	// real thumbnail with a favicon fallback.
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
	const [showCardDialog, setShowCardDialog] = useState(false);
	const [editingCardId, setEditingCardId] = useState<string | null>(null);
	const [showFolderDialog, setShowFolderDialog] = useState(false);
	const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
	const [showSearch, setShowSearch] = useState(false);

	// Keyboard shortcut: Ctrl+K / Cmd+K opens search.
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

	const handleOpenCardDialog = useCallback((cardId: string | null = null) => {
		setEditingCardId(cardId);
		setShowCardDialog(true);
	}, []);

	const handleCardSave = useCallback(
		({
			title,
			url,
			folderId,
			cardId,
		}: {
			title: string;
			url: string;
			folderId: string;
			cardId: string | null;
		}) => {
			if (cardId) {
				updateCard(cardId, { title, url, favicon: faviconUrl(url) });
				const store = useSetupStore.getState();
				const current = store.cards.find((c) => c.id === cardId);
				if (current && current.folderId !== folderId)
					store.moveCard(cardId, folderId);
			} else {
				addCard({
					folderId,
					title,
					url,
					favicon: faviconUrl(url),
					thumbId: null,
				});
			}
			setShowCardDialog(false);
			setEditingCardId(null);
		},
		[addCard, updateCard],
	);

	const handleCardDelete = useCallback(
		(id: string) => deleteCard(id),
		[deleteCard],
	);

	const handleFolderSave = useCallback(
		({
			name,
			folderId,
			parentId,
		}: {
			name: string;
			folderId: string | null;
			parentId: string | null;
		}) => {
			if (folderId) {
				const store = useSetupStore.getState();
				store.updateFolder(folderId, name);
				const current = store.folders.find((f) => f.id === folderId);
				if (current && (current.parentId ?? null) !== (parentId ?? null)) {
					store.moveFolder(folderId, parentId);
				}
			} else {
				addFolder(name, parentId);
			}
			setShowFolderDialog(false);
			setEditingFolderId(null);
		},
		[addFolder],
	);

	const handleFolderDelete = useCallback(
		(folderId: string) => {
			deleteFolder(folderId);
			setShowFolderDialog(false);
			setEditingFolderId(null);
		},
		[deleteFolder],
	);

	return (
		<AppearanceProvider>
			<PageContextMenu
				onOpenBackgroundSettings={() => setShowSettings(true)}
				onOpenShortcutSettings={() => setShowSettings(true)}
				onAddQuickLink={() => handleOpenCardDialog(null)}
			>
				<div className="relative flex min-h-screen flex-col text-white">
					<BackgroundLayer />

					<NavigationToolbar
						folders={folders}
						rootFolders={rootFolders}
						activeFolderId={activeFolderId}
						activeRootId={activeRootId}
						onSelectFolder={setActiveFolder}
						onAddFolder={() => {
							setEditingFolderId(null);
							setShowFolderDialog(true);
						}}
						onOpenSettings={() => setShowSettings(true)}
						onOpenSearch={() => setShowSearch(true)}
						onAddFavorite={() => handleOpenCardDialog(null)}
						onEditFolder={(id) => {
							setEditingFolderId(id);
							setShowFolderDialog(true);
						}}
						onDeleteFolder={handleFolderDelete}
						onReorderFolders={(fromId, toId) =>
							useSetupStore.getState().reorderFolders(fromId, toId)
						}
						onDropCard={(cardId, folderId) => moveCard(cardId, folderId)}
						onMoveFolder={(folderId, targetId) =>
							moveFolder(folderId, targetId)
						}
						canNestFolder={canNestFolder}
					/>

					{/* Hero is a single, unified global wrapper rendered in EVERY state
				    (empty folders included) so the clock + date always mount once and
				    read size/format straight from the central store — no per-page
				    clock instance that could reset when a subfolder is empty. */}
					<div className="pb-20">
						<main className="hero flex w-full flex-col items-center gap-6 px-6 pt-12 pb-16">
							<ClockWidget />
							<SearchBar />
						</main>

						{isEmpty ? (
							<EmptyLanding
								folderName={currentFolderName}
								onAdd={() => handleOpenCardDialog(null)}
							/>
						) : (
							<DialGrid
								cards={cards}
								subfolders={subfolders}
								cardCounts={cardCounts}
								previewCards={previewCards}
								onEdit={(id) => handleOpenCardDialog(id)}
								onDelete={handleCardDelete}
								onDeleteFolder={handleFolderDelete}
								onReorder={(fromId, toId) =>
									useSetupStore
										.getState()
										.reorderCardsInActiveFolder(fromId, toId)
								}
								onAdd={() => handleOpenCardDialog(null)}
								onAddFolder={() => {
									setEditingFolderId(null);
									setShowFolderDialog(true);
								}}
								onOpenFolder={setActiveFolder}
								onEditFolder={(id) => {
									setEditingFolderId(id);
									setShowFolderDialog(true);
								}}
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

					{/* Global Search overlay (Spotlight-style) */}
					<GlobalSearch
						open={showSearch}
						onClose={() => setShowSearch(false)}
						onNavigateFolder={(id) => {
							setActiveFolder(id);
							setShowSearch(false);
						}}
					/>

					{/* Add/Edit Site dialog */}
					<AddSiteDialog
						open={showCardDialog}
						editingCardId={editingCardId}
						folderId={activeFolderId}
						onSave={handleCardSave}
						onAddFolder={(name, parentId) => addFolder(name, parentId)}
						onClose={() => {
							setShowCardDialog(false);
							setEditingCardId(null);
						}}
					/>

					{/* Add/Edit Folder dialog */}
					<AddFolderDialog
						open={showFolderDialog}
						editingFolder={
							folders.find((f) => f.id === editingFolderId) ?? null
						}
						folders={folders}
						defaultParentId={activeFolderId}
						canDelete={
							folders.filter((f) => (f.parentId ?? null) === null).length > 1
						}
						onSave={handleFolderSave}
						onDelete={handleFolderDelete}
						onClose={() => {
							setShowFolderDialog(false);
							setEditingFolderId(null);
						}}
					/>

					{/* Settings panel (no glass — stays shadcn) */}
					<SettingsPanel
						open={showSettings}
						onClose={() => setShowSettings(false)}
					/>
				</div>
			</PageContextMenu>
		</AppearanceProvider>
	);
}
