import { Popover } from "@base-ui/react/popover";
import { Button } from "@klice-start/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@klice-start/ui/components/dialog";
import { GlassButton } from "@klice-start/ui/components/glass-button";
import { Input } from "@klice-start/ui/components/input";
import { Label } from "@klice-start/ui/components/label";
import { Icon } from "@klice-start/ui/icons/icon";
import { glassVariantStyles } from "@klice-start/ui/lib/glass-variants";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { glassDropdown, glassText } from "../../../lib/glass";
import { RECOMMENDED_SITES } from "../../../lib/recommended-sites";
import {
	canonicalUrl,
	deriveTitleFromUrl,
	faviconUrl,
	isValidUrl,
	normalizeUrl,
} from "../../../lib/url";
import { cn } from "../../../lib/utils";
import { useSetupStore } from "../../../stores/setup-store";
import { FolderTreePicker } from "../../shared/folder-tree-picker";
import { useAppearance } from "../appearance-provider";

interface AddSiteDialogProps {
	open: boolean;
	editingCardId: string | null;
	/** Folder pre-selected when adding a new card. */
	folderId: string;
	onSave: (data: {
		title: string;
		url: string;
		folderId: string;
		cardId: string | null;
	}) => void;
	onAddFolder: (name: string, parentId: string | null) => string;
	onClose: () => void;
}

type UrlStatus = "empty" | "invalid" | "duplicate" | "valid";

export function AddSiteDialog({
	open,
	editingCardId,
	folderId,
	onSave,
	onAddFolder,
	onClose,
}: AddSiteDialogProps) {
	const { isLiquid } = useAppearance();
	const glassV = isLiquid ? "liquid" : "classic";
	const cards = useSetupStore((s) => s.cards);
	const folders = useSetupStore((s) => s.folders);

	const editingCard = useMemo(
		() =>
			editingCardId
				? (cards.find((c) => c.id === editingCardId) ?? null)
				: null,
		[editingCardId, cards],
	);

	const [title, setTitle] = useState("");
	const [url, setUrl] = useState("");
	const [destination, setDestination] = useState<string | null>(folderId);
	const [titleTouched, setTitleTouched] = useState(false);
	const urlInputRef = useRef<HTMLInputElement>(null);
	const newFolderTriggerRef = useRef<HTMLButtonElement>(null);
	const newFolderNameRef = useRef<HTMLInputElement>(null);

	const [newFolderOpen, setNewFolderOpen] = useState(false);
	const [newFolderName, setNewFolderName] = useState("");
	const [newFolderParent, setNewFolderParent] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		if (editingCard) {
			setTitle(editingCard.title);
			setUrl(editingCard.url);
			setDestination(editingCard.folderId);
			setTitleTouched(true);
		} else {
			setTitle("");
			setUrl("");
			setDestination(folderId);
			setTitleTouched(false);
		}
		setNewFolderOpen(false);
		setNewFolderName("");
		setNewFolderParent(null);
	}, [open, editingCard, folderId]);

	useEffect(() => {
		if (open) {
			const id = setTimeout(() => urlInputRef.current?.focus(), 60);
			return () => clearTimeout(id);
		}
	}, [open]);

	const targetFolder = destination ?? folderId;

	const duplicateExists = useMemo(() => {
		const canon = canonicalUrl(url);
		if (!canon) return false;
		return cards.some(
			(c) =>
				c.folderId === targetFolder &&
				c.id !== editingCardId &&
				canonicalUrl(c.url) === canon,
		);
	}, [url, cards, targetFolder, editingCardId]);

	const urlStatus: UrlStatus = useMemo(() => {
		if (!url.trim()) return "empty";
		if (!isValidUrl(url)) return "invalid";
		if (duplicateExists) return "duplicate";
		return "valid";
	}, [url, duplicateExists]);

	const suggestedTitle = useMemo(() => deriveTitleFromUrl(url), [url]);
	const canSubmit = urlStatus === "valid";

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (!canSubmit) return;
		const finalUrl = normalizeUrl(url);
		const finalTitle = title.trim() || suggestedTitle || finalUrl;
		onSave({
			title: finalTitle,
			url: finalUrl,
			folderId: targetFolder,
			cardId: editingCardId,
		});
	}

	function handleRecommended(site: { name: string; url: string }) {
		const canon = canonicalUrl(site.url);
		const already = cards.some(
			(c) => c.folderId === targetFolder && canonicalUrl(c.url) === canon,
		);
		if (already) return;
		onSave({
			title: site.name,
			url: normalizeUrl(site.url),
			folderId: targetFolder,
			cardId: null,
		});
	}

	function handleCreateFolder() {
		const name = newFolderName.trim();
		if (!name) return;
		const id = onAddFolder(name, newFolderParent);
		setDestination(id);
		setNewFolderOpen(false);
		setNewFolderName("");
		setNewFolderParent(null);
	}

	const errorMessage =
		urlStatus === "invalid"
			? "Enter a valid web address."
			: urlStatus === "duplicate"
				? "This link is already in the selected folder."
				: "";

	const labelClass = cn(
		"w-24 shrink-0 font-medium text-sm",
		glassText(isLiquid, "secondary"),
	);

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent
				glassVariant={glassV}
				className="flex flex-col sm:max-w-[540px]"
				style={{ maxHeight: "calc(100vh - 6rem)" }}
			>
				<DialogHeader className="shrink-0">
					<DialogTitle className={cn(isLiquid && "text-white")}>
						{editingCardId ? "Edit link" : "Add link"}
					</DialogTitle>
					<DialogDescription className={cn(isLiquid && "text-white/60")}>
						{editingCardId
							? "Update this shortcut."
							: "Save a website to your new tab."}
					</DialogDescription>
				</DialogHeader>

				<form
					onSubmit={handleSubmit}
					className="flex min-h-0 flex-1 flex-col gap-4"
				>
					<div className="-mr-6 min-h-0 flex-1 overflow-y-auto">
						<div className="space-y-4 px-0.5 py-2 pr-6">
							<div className="flex items-center gap-3">
								<Label htmlFor="card-url" className={labelClass}>
									Link
								</Label>
								<div className="flex flex-1 flex-col gap-1">
									<div className="relative">
										<Input
											id="card-url"
											ref={urlInputRef}
											value={url}
											inputMode="url"
											autoComplete="off"
											spellCheck={false}
											glassVariant={glassV}
											aria-invalid={
												urlStatus === "invalid" || urlStatus === "duplicate"
											}
											aria-describedby={
												errorMessage ? "card-url-error" : undefined
											}
											onChange={(e) => {
												setUrl(e.target.value);
												if (!titleTouched) setTitle("");
											}}
											onKeyDown={(e) => {
												if (
													e.key === "Tab" &&
													suggestedTitle &&
													!titleTouched
												) {
													setTitle(suggestedTitle);
													setTitleTouched(true);
												}
											}}
											placeholder="example.com"
											className="h-9 rounded-[10px] pr-10 text-sm"
										/>
										{urlStatus === "valid" && (
											<img
												src={faviconUrl(url)}
												alt=""
												className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 rounded-sm"
											/>
										)}
									</div>
									{errorMessage && (
										<p
											id="card-url-error"
											className="flex items-center gap-1.5 text-[12px] text-red-400"
										>
											<Icon name="alert" size={12} />
											{errorMessage}
										</p>
									)}
								</div>
							</div>

							<div className="flex items-center gap-3">
								<Label htmlFor="card-title" className={labelClass}>
									Title
								</Label>
								<Input
									id="card-title"
									value={title}
									glassVariant={glassV}
									onChange={(e) => {
										setTitle(e.target.value);
										setTitleTouched(true);
									}}
									placeholder={suggestedTitle || "Site name"}
									className="h-9 flex-1 rounded-[10px] text-sm"
								/>
							</div>
							<div className="flex items-center gap-3">
								<Label className={labelClass}>Folder</Label>
								<FolderTreePicker
									folders={folders}
									value={destination}
									onChange={setDestination}
									allowRoot={false}
									className="h-9 min-w-0 flex-1 rounded-[10px] text-sm"
									isLiquid={isLiquid}
								/>
								<Popover.Root
									open={newFolderOpen}
									onOpenChange={(nextOpen) => {
										setNewFolderOpen(nextOpen);
										if (!nextOpen) {
											setNewFolderName("");
											setNewFolderParent(null);
										}
									}}
								>
									<Popover.Trigger
										ref={newFolderTriggerRef}
										type="button"
										aria-label="New folder"
										className={cn(
											"flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition-colors",
											isLiquid
												? cn(
														glassVariantStyles.liquid,
														"border-white/[0.25] text-white hover:bg-white/[0.12] active:bg-white/20",
													)
												: "border border-transparent bg-input/50 text-muted-foreground hover:bg-muted hover:text-foreground active:bg-accent",
										)}
									>
										<Icon name="plus" size={15} />
									</Popover.Trigger>
									<Popover.Portal>
										<Popover.Positioner
											side="bottom"
											align="end"
											sideOffset={8}
											collisionPadding={8}
											positionMethod="fixed"
											className="z-[60]"
										>
											<Popover.Popup
												initialFocus={newFolderNameRef}
												finalFocus={newFolderTriggerRef}
												className={cn(
													"w-[272px]",
													glassDropdown(isLiquid),
													"rounded-xl p-3",
												)}
											>
												<div className="space-y-2.5">
													<div className="space-y-1">
														<Label
															htmlFor="new-folder-name"
															className={cn(
																"text-xs",
																glassText(isLiquid, "muted"),
															)}
														>
															Folder name
														</Label>
														<Input
															id="new-folder-name"
															ref={newFolderNameRef}
															value={newFolderName}
															glassVariant={glassV}
															onChange={(e) => setNewFolderName(e.target.value)}
															onKeyDown={(e) => {
																if (e.key === "Enter") {
																	e.preventDefault();
																	handleCreateFolder();
																}
															}}
															placeholder="e.g. Work"
															className="h-9 w-full rounded-[10px] text-sm"
														/>
													</div>
													<div className="space-y-1">
														<Label
															className={cn(
																"text-xs",
																glassText(isLiquid, "muted"),
															)}
														>
															Parent
														</Label>
														<FolderTreePicker
															folders={folders}
															value={newFolderParent}
															onChange={setNewFolderParent}
															allowRoot
															rootLabel="Top level"
															className="h-9 w-full rounded-[10px] text-sm"
															isLiquid={isLiquid}
														/>
													</div>
													<div className="flex justify-end pt-0.5">
														{isLiquid ? (
															<GlassButton
																type="button"
																size="sm"
																glassVariant="liquid"
																onClick={handleCreateFolder}
																disabled={!newFolderName.trim()}
															>
																Create
															</GlassButton>
														) : (
															<Button
																type="button"
																size="sm"
																onClick={handleCreateFolder}
																disabled={!newFolderName.trim()}
															>
																Create
															</Button>
														)}
													</div>
												</div>
											</Popover.Popup>
										</Popover.Positioner>
									</Popover.Portal>
								</Popover.Root>
							</div>

							{!editingCardId && (
								<>
									{canSubmit && (
										<div className="flex justify-end">
											{isLiquid ? (
												<GlassButton type="submit" glassVariant="liquid">
													Add link
												</GlassButton>
											) : (
												<Button type="submit">Add link</Button>
											)}
										</div>
									)}

									<span
										className={cn(
											"mb-3 block font-medium text-[11px]",
											glassText(isLiquid, "secondary"),
										)}
									>
										Recommended
									</span>
									<div className="space-y-2">
										<div className="grid grid-cols-5 gap-1.5">
											{RECOMMENDED_SITES.map((site) => (
												<button
													key={site.url}
													type="button"
													onClick={() => handleRecommended(site)}
													title={`Add ${site.name}`}
													aria-label={`Add ${site.name}`}
													className={cn(
														"squircle flex flex-col items-center justify-center gap-1 rounded-3xl border transition-colors [--squircle-r:15px]",
														isLiquid
															? "border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.10]"
															: "border-white/8 bg-white/[0.03] hover:bg-white/[0.08]",
													)}
													style={{ aspectRatio: 1 }}
												>
													<img
														src={faviconUrl(site.url, 32)}
														alt=""
														className="h-9 w-9 rounded-[10px]"
													/>
													<span className="w-full truncate text-center text-[10px] text-white/60">
														{site.name}
													</span>
												</button>
											))}
										</div>
									</div>
								</>
							)}
						</div>
					</div>

					<DialogFooter className="shrink-0 pt-1" />
				</form>
			</DialogContent>
		</Dialog>
	);
}
