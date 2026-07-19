import { Button } from "@perch/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@perch/ui/components/dialog";
import { GlassButton } from "@perch/ui/components/glass-button";
import { Input } from "@perch/ui/components/input";
import { Label } from "@perch/ui/components/label";
import { Icon } from "@perch/ui/icons/icon";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { glassText } from "../../../lib/glass";
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
	onAddFolder: (name: string, parentId: string | null) => void;
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

	const [showNewFolder, setShowNewFolder] = useState(false);
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
		setShowNewFolder(false);
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
		onAddFolder(name, newFolderParent);
		setNewFolderName("");
		setShowNewFolder(false);
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
					className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
				>
					<div className="space-y-4 px-0.5">
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
											if (e.key === "Tab" && suggestedTitle && !titleTouched) {
												setTitle(suggestedTitle);
												setTitleTouched(true);
											}
										}}
										placeholder="example.com"
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
								className="flex-1"
							/>
						</div>

						<div className="flex items-center gap-3">
							<Label className={labelClass}>Folder</Label>
							<FolderTreePicker
								folders={folders}
								value={destination}
								onChange={setDestination}
								allowRoot={false}
								className="flex-1"
								isLiquid={isLiquid}
							/>
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
											<Button type="submit">
												Add link
											</Button>
										)}
									</div>
								)}

								<div
									className={cn(
										"rounded-xl border",
										isLiquid ? "border-white/[0.10]" : "border-border/20",
									)}
								>
									<button
										type="button"
										onClick={() => setShowNewFolder(!showNewFolder)}
										className={cn(
											"flex w-full items-center gap-2 px-3 py-2.5 text-left font-medium text-[13px] transition-colors",
											glassText(isLiquid, "muted"),
											"hover:text-white/90",
										)}
									>
										<Icon
											name="chevron-right"
											size={14}
											className={`shrink-0 transition-transform duration-200 ${
												showNewFolder ? "rotate-90" : ""
											}`}
										/>
										<Icon name="folder" size={15} className="shrink-0" />
										New folder
									</button>
									{showNewFolder && (
										<div
											className={cn(
												"space-y-3 border-t px-3 py-3",
												isLiquid ? "border-white/[0.10]" : "border-border/20",
											)}
										>
											<div className="flex items-center gap-3">
												<Label
													htmlFor="new-folder-name"
													className={cn(
														"w-24 shrink-0 font-medium text-[13px]",
														glassText(isLiquid, "secondary"),
													)}
												>
													Folder name
												</Label>
												<Input
													id="new-folder-name"
													value={newFolderName}
													glassVariant={glassV}
													onChange={(e) => setNewFolderName(e.target.value)}
													placeholder="e.g. Work"
													className="flex-1"
													autoFocus
												/>
											</div>
											<div className="flex items-center gap-3">
												<Label
													className={cn(
														"w-24 shrink-0 font-medium text-[13px]",
														glassText(isLiquid, "secondary"),
													)}
												>
													Parent
												</Label>
												<FolderTreePicker
													folders={folders}
													value={newFolderParent}
													onChange={setNewFolderParent}
													allowRoot
													rootLabel="No parent (top level)"
													className="flex-1"
													isLiquid={isLiquid}
												/>
											</div>
										{newFolderName.trim() && (
											<div className="flex justify-end">
												{isLiquid ? (
													<GlassButton
														type="button"
														size="sm"
														glassVariant="liquid"
														onClick={handleCreateFolder}
													>
														Create
													</GlassButton>
												) : (
													<Button
														type="button"
														size="sm"
														onClick={handleCreateFolder}
													>
														Create
													</Button>
												)}
											</div>
										)}
										</div>
									)}
								</div>

								<div className="space-y-2">
									<Label
										className={cn("text-[13px]", glassText(isLiquid, "muted"))}
									>
										Recommended
									</Label>
									<div className="grid grid-cols-5 gap-1.5">
										{RECOMMENDED_SITES.map((site) => (
											<button
												key={site.url}
												type="button"
												onClick={() => handleRecommended(site)}
												title={`Add ${site.name}`}
												aria-label={`Add ${site.name}`}
												className={cn(
													"squircle flex flex-col items-center justify-center gap-1 rounded-3xl border transition-colors",
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

					<DialogFooter className="shrink-0 pt-1" />
				</form>
			</DialogContent>
		</Dialog>
	);
}
