import { useCallback, useMemo, useState } from "react";
import { AddShortcutButton } from "../../src/components/newtab/add-shortcut-button";
import { BackgroundLayer } from "../../src/components/newtab/background-layer";
import { ClockWidget } from "../../src/components/newtab/clock-widget";
import { DialGrid } from "../../src/components/newtab/dial-grid";
import { SearchBar } from "../../src/components/newtab/search-bar";
import { SettingsPanel } from "../../src/components/newtab/settings-panel";
import { Topbar } from "../../src/components/newtab/topbar";
import { CardDialog } from "../../src/components/shared/card-dialog";
import { FolderDialog } from "../../src/components/shared/folder-dialog";
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

	// Cycle-safe check used by folder drop targets before nesting.
	const canNestFolder = useCallback(
		(folderId: string, targetFolderId: string) =>
			folderId !== targetFolderId &&
			!wouldCreateCycle(folders, folderId, targetFolderId),
		[folders],
	);

	// ⚠️ IMPORTANTE: Nunca criar novos objetos dentro do selector do Zustand!
	// Isso causa loop infinito com useSyncExternalStore + React 19 + Zustand v5 (error #185).
	// A filtragem é feita AQUI no corpo do componente, não no selector.
	const allCards = useSetupStore((s) => s.cards as Card[]);
	const cards = useMemo(
		() =>
			allCards
				.filter((c) => c.folderId === activeFolderId)
				.sort((a, b) => a.order - b.order),
		[allCards, activeFolderId],
	);

	// Hierarchy-derived view state.
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
	// Item count per folder (cards only) for the folder-tile badge.
	const cardCounts = useMemo(() => {
		const counts: Record<string, number> = {};
		for (const c of allCards)
			counts[c.folderId] = (counts[c.folderId] ?? 0) + 1;
		return counts;
	}, [allCards]);

	const [showSettings, setShowSettings] = useState(false);
	const [showCardDialog, setShowCardDialog] = useState(false);
	const [editingCardId, setEditingCardId] = useState<string | null>(null);
	const [showFolderDialog, setShowFolderDialog] = useState(false);
	const [editingFolderId, setEditingFolderId] = useState<string | null>(null);

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
		<div className="relative flex min-h-screen flex-col text-white">
			<BackgroundLayer />

			<Topbar
				rootFolders={rootFolders}
				activeRootId={activeRootId}
				onSelectFolder={setActiveFolder}
				onAddFolder={() => {
					setEditingFolderId(null);
					setShowFolderDialog(true);
				}}
				onOpenSettings={() => setShowSettings(true)}
				onEditFolder={(id) => {
					setEditingFolderId(id);
					setShowFolderDialog(true);
				}}
				onReorderFolders={(fromId, toId) =>
					useSetupStore.getState().reorderFolders(fromId, toId)
				}
				onDropCard={(cardId, folderId) => moveCard(cardId, folderId)}
				onMoveFolder={(folderId, targetId) => moveFolder(folderId, targetId)}
				canNestFolder={canNestFolder}
			/>

			<main className="hero flex flex-col items-center gap-8 pt-12 pb-8">
				<ClockWidget />
				<SearchBar />
			</main>

			<DialGrid
				cards={cards}
				subfolders={subfolders}
				folders={folders}
				activeFolderId={activeFolderId}
				cardCounts={cardCounts}
				onEdit={(id) => handleOpenCardDialog(id)}
				onDelete={handleCardDelete}
				onReorder={(fromId, toId) =>
					useSetupStore.getState().reorderCardsInActiveFolder(fromId, toId)
				}
				onAdd={() => handleOpenCardDialog(null)}
				onOpenFolder={setActiveFolder}
				onEditFolder={(id) => {
					setEditingFolderId(id);
					setShowFolderDialog(true);
				}}
				onNavigate={setActiveFolder}
				onMoveCard={(cardId, folderId) => moveCard(cardId, folderId)}
				onReorderFolders={(fromId, toId) => reorderFolders(fromId, toId)}
				onMoveFolder={(folderId, targetFolderId) =>
					moveFolder(folderId, targetFolderId)
				}
				canNestFolder={canNestFolder}
			/>

			<AddShortcutButton onClick={() => handleOpenCardDialog(null)} />

			<CardDialog
				open={showCardDialog}
				editingCardId={editingCardId}
				folderId={activeFolderId}
				onSave={handleCardSave}
				onClose={() => {
					setShowCardDialog(false);
					setEditingCardId(null);
				}}
			/>

			<FolderDialog
				open={showFolderDialog}
				editingFolder={folders.find((f) => f.id === editingFolderId) ?? null}
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

			<SettingsPanel
				open={showSettings}
				onClose={() => setShowSettings(false)}
			/>
		</div>
	);
}
