import { Button } from "@perch/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@perch/ui/components/dialog";
import { Input } from "@perch/ui/components/input";
import { Label } from "@perch/ui/components/label";
import { Icon } from "@perch/ui/icons/icon";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { RECOMMENDED_SITES } from "../../../lib/recommended-sites";
import {
	canonicalUrl,
	deriveTitleFromUrl,
	faviconUrl,
	isValidUrl,
	normalizeUrl,
} from "../../../lib/url";
import { useSetupStore } from "../../../stores/setup-store";
import { FolderTreePicker } from "../../shared/folder-tree-picker";

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
	onClose: () => void;
}

type UrlStatus = "empty" | "invalid" | "duplicate" | "valid";

/**
 * Viewport-safe add/edit site dialog. Fixed header + footer with scrollable
 * content area. Never exceeds viewport height.
 */
export function AddSiteDialog({
	open,
	editingCardId,
	folderId,
	onSave,
	onClose,
}: AddSiteDialogProps) {
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

	const errorMessage =
		urlStatus === "invalid"
			? "Enter a valid web address."
			: urlStatus === "duplicate"
				? "This link is already in the selected folder."
				: "";

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent
				className="flex flex-col sm:max-w-[460px]"
				style={{ maxHeight: "calc(100vh - 2rem)" }}
			>
				{/* Fixed header */}
				<DialogHeader className="shrink-0">
					<DialogTitle>{editingCardId ? "Edit link" : "Add link"}</DialogTitle>
					<DialogDescription>
						{editingCardId
							? "Update this shortcut."
							: "Save a website to your new tab."}
					</DialogDescription>
				</DialogHeader>

				{/* Scrollable content */}
				<form
					onSubmit={handleSubmit}
					className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
				>
					<div className="space-y-4 px-0.5">
						<div className="space-y-2">
							<Label htmlFor="card-url">Link</Label>
							<div className="relative">
								<Input
									id="card-url"
									ref={urlInputRef}
									value={url}
									inputMode="url"
									autoComplete="off"
									spellCheck={false}
									aria-invalid={
										urlStatus === "invalid" || urlStatus === "duplicate"
									}
									aria-describedby={errorMessage ? "card-url-error" : undefined}
									onChange={(e) => {
										setUrl(e.target.value);
										if (!titleTouched) setTitle("");
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

						<div className="space-y-2">
							<Label htmlFor="card-title">Title</Label>
							<Input
								id="card-title"
								value={title}
								onChange={(e) => {
									setTitle(e.target.value);
									setTitleTouched(true);
								}}
								placeholder={suggestedTitle || "Site name"}
							/>
						</div>

						<div className="space-y-2">
							<Label>Folder</Label>
							<FolderTreePicker
								folders={folders}
								value={destination}
								onChange={setDestination}
								allowRoot={false}
							/>
						</div>

						{!editingCardId && (
							<div className="space-y-2">
								<Label className="text-muted-foreground">Recommended</Label>
								<div className="grid grid-cols-4 gap-1.5">
									{RECOMMENDED_SITES.map((site) => (
										<button
											key={site.url}
											type="button"
											onClick={() => handleRecommended(site)}
											title={`Add ${site.name}`}
											aria-label={`Add ${site.name}`}
											className="flex flex-col items-center gap-1 rounded-xl border border-white/8 bg-white/[0.03] px-1 py-2 transition-colors hover:bg-white/[0.08]"
										>
											<img
												src={faviconUrl(site.url, 32)}
												alt=""
												className="h-5 w-5 rounded"
											/>
											<span className="w-full truncate text-center text-[10px] text-white/60">
												{site.name}
											</span>
										</button>
									))}
								</div>
							</div>
						)}
					</div>

					{/* Fixed footer */}
					<DialogFooter className="shrink-0 border-border/30 border-t pt-3">
						<Button type="button" variant="ghost" onClick={onClose}>
							Cancel
						</Button>
						<Button type="submit" disabled={!canSubmit}>
							{editingCardId ? "Save" : "Add link"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
