import { Button } from "@klice-start/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@klice-start/ui/components/dialog";
import { Input } from "@klice-start/ui/components/input";
import { Switch } from "@klice-start/ui/components/switch";
import { Icon } from "@klice-start/ui/icons/icon";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
	getBreadcrumb,
	getDescendantIds,
	getSubtreeIds,
	wouldCreateCycle,
} from "../../../../lib/folder-tree";
import { canonicalUrl, deriveTitleFromUrl, faviconUrl, isValidUrl, normalizeUrl } from "../../../../lib/url";
import { exportBackup, importBackup } from "../../../../services/backup";
import {
	exportBookmarksHtml,
	importBookmarksFromBrowser,
	importBookmarksHtml,
} from "../../../../services/bookmarks-html";
import { useSetupStore } from "../../../../stores/setup-store";
import type { Card } from "../../../../types";
import { FolderTreePicker } from "../../../shared/folder-tree-picker";
import { SectionCard } from "../shared/section-card";
import { SettingRow } from "../shared/setting-row";
import { SliderRow } from "../shared/slider-row";

interface BookmarksPaneProps {
	initialAction?: {
		type: "add-link" | "edit-link" | "add-folder" | "edit-folder";
		cardId?: string;
		folderId?: string;
	};
}

export function BookmarksPane({ initialAction }: BookmarksPaneProps) {
	const folders = useSetupStore((s) => s.folders);
	const cards = useSetupStore((s) => s.cards as Card[]);
	const activeFolderId = useSetupStore((s) => s.activeFolderId);
	const thumbnailCapture = useSetupStore((s) => s.settings.thumbnailCapture);

	const addCard = useSetupStore((s) => s.addCard);
	const updateCard = useSetupStore((s) => s.updateCard);
	const moveCard = useSetupStore((s) => s.moveCard);
	const deleteCard = useSetupStore((s) => s.deleteCard);
	const addFolder = useSetupStore((s) => s.addFolder);
	const updateFolder = useSetupStore((s) => s.updateFolder);
	const moveFolder = useSetupStore((s) => s.moveFolder);
	const deleteFolder = useSetupStore((s) => s.deleteFolder);
	const updateThumbnailCapture = useSetupStore((s) => s.updateThumbnailCapture);

	// Currently inspected folder in the settings pane
	const [selectedFolderId, setSelectedFolderId] = useState<string>(activeFolderId);

	// Ensure selected folder is valid
	useEffect(() => {
		if (!folders.some((f) => f.id === selectedFolderId)) {
			setSelectedFolderId(folders[0]?.id || "default");
		}
	}, [folders, selectedFolderId]);

	// Link editing / adding state
	const [isAddingLink, setIsAddingLink] = useState(false);
	const [editingCardId, setEditingCardId] = useState<string | null>(null);
	const [linkUrl, setLinkUrl] = useState("");
	const [linkTitle, setLinkTitle] = useState("");
	const [linkFolderId, setLinkFolderId] = useState(selectedFolderId);
	const [titleTouched, setTitleTouched] = useState(false);

	// Folder editing / adding modal
	const [folderModalOpen, setFolderModalOpen] = useState(false);
	const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
	const [folderNameInput, setFolderNameInput] = useState("");
	const [folderParentInput, setFolderParentInput] = useState<string | null>(null);
	const [folderError, setFolderError] = useState("");

	// Delete folder confirmation
	const [deleteConfirmFolderId, setDeleteConfirmFolderId] = useState<string | null>(null);

	// Import / Export states
	const htmlFileRef = useRef<HTMLInputElement>(null);
	const jsonFileRef = useRef<HTMLInputElement>(null);
	const [ioStatus, setIoStatus] = useState("");
	const [ioType, setIoType] = useState<"info" | "success" | "error">("info");
	const [isProcessingIo, setIsProcessingIo] = useState(false);

	// Handle initial action if provided from outside
	useEffect(() => {
		if (!initialAction) return;
		if (initialAction.type === "add-link") {
			setLinkFolderId(initialAction.folderId || selectedFolderId);
			setLinkUrl("");
			setLinkTitle("");
			setTitleTouched(false);
			setEditingCardId(null);
			setIsAddingLink(true);
		} else if (initialAction.type === "edit-link" && initialAction.cardId) {
			const card = cards.find((c) => c.id === initialAction.cardId);
			if (card) {
				setEditingCardId(card.id);
				setLinkUrl(card.url);
				setLinkTitle(card.title);
				setLinkFolderId(card.folderId);
				setSelectedFolderId(card.folderId);
				setTitleTouched(true);
				setIsAddingLink(true);
			}
		} else if (initialAction.type === "add-folder") {
			setEditingFolderId(null);
			setFolderNameInput("");
			setFolderParentInput(initialAction.folderId || null);
			setFolderError("");
			setFolderModalOpen(true);
		} else if (initialAction.type === "edit-folder" && initialAction.folderId) {
			const folder = folders.find((f) => f.id === initialAction.folderId);
			if (folder) {
				setEditingFolderId(folder.id);
				setFolderNameInput(folder.name);
				setFolderParentInput(folder.parentId ?? null);
				setFolderError("");
				setFolderModalOpen(true);
			}
		}
	}, [initialAction, cards, folders, selectedFolderId]);

	// Filtered cards for the active selected folder
	const folderCards = useMemo(
		() =>
			cards
				.filter((c) => c.folderId === selectedFolderId)
				.sort((a, b) => a.order - b.order),
		[cards, selectedFolderId],
	);

	const selectedFolder = folders.find((f) => f.id === selectedFolderId);
	const breadcrumbs = useMemo(
		() => getBreadcrumb(folders, selectedFolderId),
		[folders, selectedFolderId],
	);

	// URL validation and duplicate detection
	const urlValidation = useMemo(() => {
		const trimmed = linkUrl.trim();
		if (!trimmed) return { status: "empty" as const, message: "" };
		if (!isValidUrl(trimmed)) {
			return { status: "invalid" as const, message: "Enter a valid web address." };
		}
		const canon = canonicalUrl(trimmed);
		const duplicate = cards.find(
			(c) =>
				c.folderId === linkFolderId &&
				c.id !== editingCardId &&
				canonicalUrl(c.url) === canon,
		);
		if (duplicate) {
			return {
				status: "duplicate" as const,
				message: "This link already exists in the selected folder.",
			};
		}
		return { status: "valid" as const, message: "" };
	}, [linkUrl, linkFolderId, editingCardId, cards]);

	const derivedTitle = useMemo(() => {
		if (titleTouched && linkTitle.length > 0) return linkTitle;
		return deriveTitleFromUrl(linkUrl);
	}, [linkUrl, linkTitle, titleTouched]);

	function handleUrlChange(val: string) {
		setLinkUrl(val);
		if (!titleTouched) {
			setLinkTitle(deriveTitleFromUrl(val));
		}
	}

	function handleSaveLink(e: React.FormEvent) {
		e.preventDefault();
		if (urlValidation.status !== "valid") return;

		const normalized = normalizeUrl(linkUrl.trim());
		const finalTitle = (linkTitle.trim() || derivedTitle || normalized).trim();
		const finalFavicon = faviconUrl(normalized);

		if (editingCardId) {
			updateCard(editingCardId, {
				title: finalTitle,
				url: normalized,
				favicon: finalFavicon,
			});
			const current = cards.find((c) => c.id === editingCardId);
			if (current && current.folderId !== linkFolderId) {
				moveCard(editingCardId, linkFolderId);
			}
		} else {
			addCard({
				folderId: linkFolderId,
				title: finalTitle,
				url: normalized,
				favicon: finalFavicon,
				thumbId: null,
			});
		}

		setIsAddingLink(false);
		setEditingCardId(null);
		setLinkUrl("");
		setLinkTitle("");
		setTitleTouched(false);
	}

	function handleStartEditLink(card: Card) {
		setEditingCardId(card.id);
		setLinkUrl(card.url);
		setLinkTitle(card.title);
		setLinkFolderId(card.folderId);
		setTitleTouched(true);
		setIsAddingLink(true);
	}

	function handleCancelLinkEdit() {
		setIsAddingLink(false);
		setEditingCardId(null);
		setLinkUrl("");
		setLinkTitle("");
		setTitleTouched(false);
	}

	function handleSaveFolder(e: React.FormEvent) {
		e.preventDefault();
		const name = folderNameInput.trim();
		if (!name) {
			setFolderError("Enter a folder name.");
			return;
		}

		if (editingFolderId) {
			updateFolder(editingFolderId, name);
			const current = folders.find((f) => f.id === editingFolderId);
			if (current && (current.parentId ?? null) !== (folderParentInput ?? null)) {
				if (!wouldCreateCycle(folders, editingFolderId, folderParentInput)) {
					moveFolder(editingFolderId, folderParentInput);
				}
			}
		} else {
			const newId = addFolder(name, folderParentInput);
			setSelectedFolderId(newId);
		}

		setFolderModalOpen(false);
		setEditingFolderId(null);
		setFolderNameInput("");
		setFolderParentInput(null);
		setFolderError("");
	}

	const rootFoldersCount = folders.filter((f) => (f.parentId ?? null) === null).length;
	const canDeleteCurrentFolder = rootFoldersCount > 1 || (selectedFolder?.parentId ?? null) !== null;

	const folderDeleteInfo = useMemo(() => {
		if (!deleteConfirmFolderId) return null;
		const target = folders.find((f) => f.id === deleteConfirmFolderId);
		if (!target) return null;
		const descendantIds = getDescendantIds(folders, deleteConfirmFolderId);
		const affectedFolderIds = new Set([deleteConfirmFolderId, ...descendantIds]);
		const cardCount = cards.filter((c) => affectedFolderIds.has(c.folderId)).length;
		return {
			name: target.name,
			subfolderCount: descendantIds.length,
			cardCount,
		};
	}, [deleteConfirmFolderId, folders, cards]);

	// Import / Export Handlers
	async function handleImportFromBrowser() {
		setIsProcessingIo(true);
		setIoType("info");
		setIoStatus("Reading browser bookmarks…");
		try {
			const { foldersCreated, cardsCreated } = await importBookmarksFromBrowser();
			setIoType("success");
			setIoStatus(`Imported ${cardsCreated} link${cardsCreated === 1 ? "" : "s"} across ${foldersCreated} folder${foldersCreated === 1 ? "" : "s"}.`);
		} catch (err) {
			setIoType("error");
			setIoStatus(err instanceof Error ? err.message : "Could not import bookmarks.");
		} finally {
			setIsProcessingIo(false);
		}
	}

	async function handleImportHtml(e: ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		setIsProcessingIo(true);
		setIoType("info");
		setIoStatus("Parsing HTML file…");
		try {
			const text = await file.text();
			const { foldersCreated, cardsCreated } = await importBookmarksHtml(text);
			setIoType("success");
			setIoStatus(`Imported ${cardsCreated} link${cardsCreated === 1 ? "" : "s"} across ${foldersCreated} folder${foldersCreated === 1 ? "" : "s"}.`);
		} catch (err) {
			setIoType("error");
			setIoStatus(err instanceof Error ? err.message : "Failed to parse HTML file.");
		} finally {
			setIsProcessingIo(false);
			e.target.value = "";
		}
	}

	async function handleExportHtml() {
		setIsProcessingIo(true);
		try {
			await exportBookmarksHtml();
			setIoType("success");
			setIoStatus("Exported bookmarks.html file.");
		} catch (err) {
			setIoType("error");
			setIoStatus(err instanceof Error ? err.message : "Export failed.");
		} finally {
			setIsProcessingIo(false);
		}
	}

	async function handleExportBackup() {
		setIsProcessingIo(true);
		try {
			await exportBackup();
			setIoType("success");
			setIoStatus("Exported full backup archive with images.");
		} catch (err) {
			setIoType("error");
			setIoStatus(err instanceof Error ? err.message : "Backup failed.");
		} finally {
			setIsProcessingIo(false);
		}
	}

	async function handleRestoreBackup(e: ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		setIsProcessingIo(true);
		setIoType("info");
		setIoStatus("Restoring backup archive…");
		try {
			const text = await file.text();
			await importBackup(text);
			setIoType("success");
			setIoStatus("Backup restored successfully!");
		} catch (err) {
			setIoType("error");
			setIoStatus(err instanceof Error ? err.message : "Failed to restore backup.");
		} finally {
			setIsProcessingIo(false);
			e.target.value = "";
		}
	}

	return (
		<div className="space-y-3">
			{/* Folder Header & Navigation */}
			<SectionCard
				title="Folder organization"
				action={
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() => {
							setEditingFolderId(null);
							setFolderNameInput("");
							setFolderParentInput(selectedFolderId);
							setFolderError("");
							setFolderModalOpen(true);
						}}
						className="h-7 gap-1.5 rounded-lg text-xs"
					>
						<Icon name="folder-plus" size={13} />
						New folder
					</Button>
				}
			>
				<div className="flex flex-wrap items-center justify-between gap-3 py-2">
					<div className="flex items-center gap-2">
						<span className="font-medium text-muted-foreground text-xs">Current folder:</span>
						<FolderTreePicker
							folders={folders}
							value={selectedFolderId}
							onChange={(id) => id && setSelectedFolderId(id)}
							allowRoot={false}
							className="h-8 min-w-[180px] text-xs"
						/>
					</div>

					<div className="flex items-center gap-1">
						{selectedFolder && (
							<>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									onClick={() => {
										setEditingFolderId(selectedFolder.id);
										setFolderNameInput(selectedFolder.name);
										setFolderParentInput(selectedFolder.parentId ?? null);
										setFolderError("");
										setFolderModalOpen(true);
									}}
									className="h-7 gap-1 rounded-lg px-2 text-xs"
									title="Rename or move folder"
								>
									<Icon name="pencil" size={12} />
									Rename
								</Button>

								{canDeleteCurrentFolder && (
									<Button
										type="button"
										size="sm"
										variant="ghost"
										onClick={() => setDeleteConfirmFolderId(selectedFolder.id)}
										className="h-7 gap-1 rounded-lg px-2 text-destructive text-xs hover:bg-destructive/10 hover:text-destructive"
										title="Delete folder"
									>
										<Icon name="trash" size={12} />
										Delete
									</Button>
								)}
							</>
						)}
					</div>
				</div>

				{breadcrumbs.length > 1 && (
					<div className="flex items-center gap-1 border-border/30 border-t pt-2 pb-1 text-muted-foreground text-xs">
						<span>Path:</span>
						{breadcrumbs.map((crumb, idx) => (
							<span key={crumb.id} className="flex items-center gap-1">
								{idx > 0 && <span className="opacity-40">/</span>}
								<button
									type="button"
									onClick={() => setSelectedFolderId(crumb.id)}
									className="hover:text-foreground hover:underline"
								>
									{crumb.name}
								</button>
							</span>
						))}
					</div>
				)}
			</SectionCard>

			{/* Add / Edit Link Form */}
			{isAddingLink && (
				<SectionCard
					title={editingCardId ? "Edit bookmark" : "Add bookmark"}
				>
					<form onSubmit={handleSaveLink} className="space-y-3 py-2">
						<div>
							<div className="mb-1 flex items-center justify-between">
								<label htmlFor="bookmark-url-input" className="font-medium text-muted-foreground text-xs">
									Website address (URL)
								</label>
								{urlValidation.status === "valid" && (
									<span className="flex items-center gap-1 font-medium text-emerald-400 text-xs">
										<img
											src={faviconUrl(normalizeUrl(linkUrl))}
											alt=""
											className="size-3.5 rounded-xs"
											onError={(e) => {
												e.currentTarget.style.display = "none";
											}}
										/>
										Valid URL
									</span>
								)}
							</div>
							<Input
								id="bookmark-url-input"
								type="text"
								inputMode="url"
								placeholder="https://example.com"
								value={linkUrl}
								onChange={(e) => handleUrlChange(e.target.value)}
								autoFocus
								className="h-9 rounded-lg border-border/60 bg-secondary/50 px-3 text-foreground text-sm"
								aria-invalid={urlValidation.status === "invalid" || urlValidation.status === "duplicate"}
							/>
							{urlValidation.message && (
								<p className="mt-1 text-destructive text-xs" role="alert">
									{urlValidation.message}
								</p>
							)}
						</div>

						<div>
							<label htmlFor="bookmark-title-input" className="mb-1 block font-medium text-muted-foreground text-xs">
								Title (optional)
							</label>
							<Input
								id="bookmark-title-input"
								type="text"
								placeholder={derivedTitle || "Site name"}
								value={linkTitle}
								onChange={(e) => {
									setTitleTouched(true);
									setLinkTitle(e.target.value);
								}}
								className="h-9 rounded-lg border-border/60 bg-secondary/50 px-3 text-foreground text-sm"
							/>
						</div>

						<div>
							<span className="mb-1 block font-medium text-muted-foreground text-xs">
								Destination folder
							</span>
							<FolderTreePicker
								folders={folders}
								value={linkFolderId}
								onChange={(id) => id && setLinkFolderId(id)}
								allowRoot={false}
								className="h-9 w-full text-xs"
							/>
						</div>

						<div className="flex items-center justify-end gap-2 pt-1">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={handleCancelLinkEdit}
								className="h-8 rounded-lg text-xs"
							>
								Cancel
							</Button>
							<Button
								type="submit"
								size="sm"
								disabled={urlValidation.status !== "valid"}
								className="h-8 rounded-lg text-xs"
							>
								{editingCardId ? "Save changes" : "Add bookmark"}
							</Button>
						</div>
					</form>
				</SectionCard>
			)}

			{/* Bookmarks List */}
			<SectionCard
				title={`Links in ${selectedFolder?.name || "Folder"}`}
				description={`${folderCards.length} bookmark${folderCards.length === 1 ? "" : "s"}`}
				action={
					!isAddingLink && (
						<Button
							type="button"
							size="sm"
							onClick={() => {
								setEditingCardId(null);
								setLinkUrl("");
								setLinkTitle("");
								setTitleTouched(false);
								setLinkFolderId(selectedFolderId);
								setIsAddingLink(true);
							}}
							className="h-7 gap-1.5 rounded-lg text-xs"
						>
							<Icon name="plus" size={13} />
							Add link
						</Button>
					)
				}
			>
				{folderCards.length > 0 ? (
					<div className="divide-y divide-border/30">
						{folderCards.map((card) => (
							<div
								key={card.id}
								className="group flex items-center justify-between gap-3 py-2 transition-colors hover:bg-muted/20"
							>
								<div className="flex min-w-0 flex-1 items-center gap-2.5">
									<img
										src={card.favicon || faviconUrl(card.url)}
										alt=""
										className="size-4 shrink-0 rounded-xs"
										onError={(e) => {
											e.currentTarget.style.display = "none";
										}}
									/>
									<div className="flex min-w-0 flex-1 flex-col">
										<span className="truncate font-medium text-foreground text-xs">
											{card.title || card.url}
										</span>
										<span className="truncate font-mono text-[11px] text-muted-foreground">
											{card.url}
										</span>
									</div>
								</div>

								<div className="flex shrink-0 items-center gap-1 opacity-80 group-hover:opacity-100">
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										onClick={() => handleStartEditLink(card)}
										title="Edit bookmark"
										className="size-7 rounded-lg"
									>
										<Icon name="pencil" size={13} />
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										onClick={() => deleteCard(card.id)}
										title="Delete bookmark"
										className="size-7 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
									>
										<Icon name="trash" size={13} />
									</Button>
								</div>
							</div>
						))}
					</div>
				) : (
					<div className="py-6 text-center text-muted-foreground text-xs">
						No bookmarks in this folder yet.
					</div>
				)}
			</SectionCard>

			{/* Thumbnail Capture */}
			<SectionCard title="Thumbnail capture">
				<SettingRow label="Automatic screenshot capture">
					<Switch
						checked={thumbnailCapture.enabled}
						onCheckedChange={(enabled: boolean) =>
							updateThumbnailCapture({ enabled })
						}
					/>
				</SettingRow>

				<SliderRow
					label="Capture delay"
					value={thumbnailCapture.delayMs || 1200}
					suffix="ms"
					min={400}
					max={4000}
					step={200}
					onChange={(v) => updateThumbnailCapture({ delayMs: v })}
				/>
			</SectionCard>

			{/* Import & Export */}
			<SectionCard title="Import & export">
				<input
					ref={htmlFileRef}
					type="file"
					accept="text/html,.htm,.html"
					className="hidden"
					onChange={handleImportHtml}
				/>
				<input
					ref={jsonFileRef}
					type="file"
					accept=".json,application/json"
					className="hidden"
					onChange={handleRestoreBackup}
				/>

				<div className="flex items-center justify-between border-border/30 border-b py-2">
					<div className="flex flex-col">
						<span className="font-medium text-foreground text-xs">Browser bookmarks</span>
						<span className="text-muted-foreground text-[11px]">Import native Chrome / Firefox bookmarks</span>
					</div>
					<Button
						type="button"
						size="sm"
						variant="secondary"
						onClick={handleImportFromBrowser}
						disabled={isProcessingIo}
						className="h-7 gap-1 rounded-lg text-xs"
					>
						<Icon name="globe" size={12} />
						Import
					</Button>
				</div>

				<div className="flex items-center justify-between border-border/30 border-b py-2">
					<div className="flex flex-col">
						<span className="font-medium text-foreground text-xs">HTML file</span>
						<span className="text-muted-foreground text-[11px]">Netscape bookmarks.html file</span>
					</div>
					<div className="flex items-center gap-1.5">
						<Button
							type="button"
							size="sm"
							variant="secondary"
							onClick={() => htmlFileRef.current?.click()}
							disabled={isProcessingIo}
							className="h-7 gap-1 rounded-lg text-xs"
						>
							<Icon name="upload" size={12} />
							Import
						</Button>
						<Button
							type="button"
							size="sm"
							variant="secondary"
							onClick={handleExportHtml}
							disabled={isProcessingIo}
							className="h-7 gap-1 rounded-lg text-xs"
						>
							<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
							</svg>
							Export
						</Button>
					</div>
				</div>

				<div className="flex items-center justify-between py-2">
					<div className="flex flex-col">
						<span className="font-medium text-foreground text-xs">Full backup archive</span>
						<span className="text-muted-foreground text-[11px]">All folders, links, settings, and wallpaper images</span>
					</div>
					<div className="flex items-center gap-1.5">
						<Button
							type="button"
							size="sm"
							variant="secondary"
							onClick={() => jsonFileRef.current?.click()}
							disabled={isProcessingIo}
							className="h-7 gap-1 rounded-lg text-xs"
						>
							<Icon name="upload" size={12} />
							Restore
						</Button>
						<Button
							type="button"
							size="sm"
							variant="secondary"
							onClick={handleExportBackup}
							disabled={isProcessingIo}
							className="h-7 gap-1 rounded-lg text-xs"
						>
							<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
							</svg>
							Export JSON
						</Button>
					</div>
				</div>

				{ioStatus && (
					<p
						className={`mt-1 font-medium text-xs ${
							ioType === "success"
								? "text-emerald-400"
								: ioType === "error"
									? "text-destructive"
									: "text-muted-foreground"
						}`}
						role="status"
					>
						{ioStatus}
					</p>
				)}
			</SectionCard>

			{/* Folder Edit Modal */}
			<Dialog open={folderModalOpen} onOpenChange={setFolderModalOpen}>
				<DialogContent className="sm:max-w-[420px]">
					<DialogHeader>
						<DialogTitle>
							{editingFolderId ? "Edit Folder" : "New Folder"}
						</DialogTitle>
						<DialogDescription>
							Organize your bookmarks into hierarchical folders.
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleSaveFolder} className="space-y-4 py-2">
						<div>
							<label htmlFor="folder-name-modal-input" className="mb-1 block font-medium text-muted-foreground text-xs">
								Folder Name
							</label>
							<Input
								id="folder-name-modal-input"
								placeholder="e.g. Work, Reading, Tools"
								value={folderNameInput}
								onChange={(e) => {
									setFolderNameInput(e.target.value);
									if (folderError) setFolderError("");
								}}
								autoFocus
								className="h-9 rounded-lg text-sm"
							/>
							{folderError && (
								<p className="mt-1 text-destructive text-xs" role="alert">
									{folderError}
								</p>
							)}
						</div>

						<div>
							<span className="mb-1 block font-medium text-muted-foreground text-xs">
								Parent Folder (optional)
							</span>
							<FolderTreePicker
								folders={folders}
								value={folderParentInput ?? "__root__"}
								onChange={setFolderParentInput}
								allowRoot={true}
								excludeIds={editingFolderId ? getSubtreeIds(folders, editingFolderId) : undefined}
								className="h-9 w-full text-xs"
							/>
						</div>

						<DialogFooter className="pt-2">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setFolderModalOpen(false)}
							>
								Cancel
							</Button>
							<Button type="submit">
								{editingFolderId ? "Save folder" : "Create folder"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Delete Folder Confirm Dialog */}
			<Dialog
				open={Boolean(deleteConfirmFolderId)}
				onOpenChange={(open) => {
					if (!open) setDeleteConfirmFolderId(null);
				}}
			>
				<DialogContent className="sm:max-w-[420px]">
					<DialogHeader>
						<DialogTitle>Delete folder?</DialogTitle>
						<DialogDescription>
							{folderDeleteInfo && (
								<span>
									Are you sure you want to delete &ldquo;{folderDeleteInfo.name}&rdquo;?
									{folderDeleteInfo.cardCount > 0 && (
										<span className="mt-1 block text-destructive">
											This will permanently remove {folderDeleteInfo.cardCount} bookmark
											{folderDeleteInfo.cardCount === 1 ? "" : "s"}
											{folderDeleteInfo.subfolderCount > 0
												? ` and ${folderDeleteInfo.subfolderCount} subfolder${folderDeleteInfo.subfolderCount === 1 ? "" : "s"}`
												: ""}
											.
										</span>
									)}
								</span>
							)}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							type="button"
							variant="ghost"
							onClick={() => setDeleteConfirmFolderId(null)}
						>
							Cancel
						</Button>
						<Button
							type="button"
							variant="destructive"
							onClick={() => {
								if (deleteConfirmFolderId) {
									deleteFolder(deleteConfirmFolderId);
									setDeleteConfirmFolderId(null);
								}
							}}
						>
							Delete folder
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
