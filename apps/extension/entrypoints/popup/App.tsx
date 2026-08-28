import { Button } from "@klice-start/ui/components/button";
import { useEffect, useMemo, useRef, useState } from "react";
import { flattenForPicker } from "../../src/lib/folder-tree";
import { canonicalUrl, faviconUrl } from "../../src/lib/url";
import { useImageStore } from "../../src/stores/image-store";
import { useSetupStore } from "../../src/stores/setup-store";

type SaveState = "idle" | "saving" | "saved" | "duplicate" | "error";

export default function App() {
	const [saveState, setSaveState] = useState<SaveState>("idle");
	const [blocked, setBlocked] = useState(false);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [tabInfo, setTabInfo] = useState<{
		title: string;
		url: string;
		favicon: string;
	} | null>(null);
	const titleRef = useRef<HTMLInputElement>(null);

	const folders = useSetupStore((s) => s.folders);
	const activeFolderId = useSetupStore((s) => s.activeFolderId);
	const saveThumbnail = useImageStore((s) => s.saveThumbnail);

	const [folderId, setFolderId] = useState(activeFolderId);
	const folderOptions = useMemo(() => flattenForPicker(folders), [folders]);

	useEffect(() => {
		(async () => {
			const [tab] = await chrome.tabs.query({
				active: true,
				currentWindow: true,
			});
			if (!tab?.url || !/^https?:/.test(tab.url)) {
				setBlocked(true);
				return;
			}
			setTabInfo({
				title: tab.title || tab.url,
				url: tab.url,
				favicon: tab.favIconUrl || "",
			});
			try {
				const dataUrl =
					tab.windowId !== undefined
						? await chrome.tabs.captureVisibleTab(tab.windowId, {
								format: "jpeg",
								quality: 80,
							})
						: await chrome.tabs.captureVisibleTab({
								format: "jpeg",
								quality: 80,
							});
				setPreviewUrl(dataUrl);
			} catch {
				// Preview is optional.
			}
		})();
	}, []);

	async function handleSave() {
		if (!tabInfo || saveState === "saving") return;

		const currentCards = useSetupStore.getState().cards;
		const canon = canonicalUrl(tabInfo.url);
		const isDuplicate = currentCards.some(
			(c) => c.folderId === folderId && canonicalUrl(c.url) === canon,
		);
		if (isDuplicate) {
			setSaveState("duplicate");
			return;
		}

		setSaveState("saving");
		try {
			let thumbId: string | null = null;
			if (previewUrl) {
				thumbId = await saveThumbnail(previewUrl);
			}
			useSetupStore.getState().addCard({
				folderId,
				title: titleRef.current?.value.trim() || tabInfo.title,
				url: tabInfo.url,
				favicon: tabInfo.favicon || faviconUrl(tabInfo.url),
				thumbId,
			});
			setSaveState("saved");
			setTimeout(() => window.close(), 600);
		} catch {
			setSaveState("error");
		}
	}

	const statusText =
		saveState === "saving"
			? "Saving…"
			: saveState === "saved"
				? "Added ✓"
				: saveState === "duplicate"
					? "Already saved in this folder."
					: saveState === "error"
						? "Error saving."
						: "";

	return (
		<div
			className="w-[280px] select-none p-3 font-sans text-xs text-white"
			style={{ background: "#1c1c1e" }}
		>
			<div className="mb-2.5 flex items-center gap-1.5">
				<span className="font-semibold text-[13px] text-white/90">
					Save to Klice Start
				</span>
			</div>

			{blocked ? (
				<p className="py-4 text-center text-white/50">
					Cannot save this page. Open a regular web page to bookmark it.
				</p>
			) : (
				<div className="space-y-2.5">
					{/* Thumbnail preview */}
					{previewUrl && (
						<div className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10">
							<img
								src={previewUrl}
								alt="Page preview"
								className="h-full w-full object-cover"
							/>
						</div>
					)}

					{/* Title input */}
					<div>
						<label
							htmlFor="tab-title-input"
							className="mb-1 block font-medium text-[11px] text-white/50"
						>
							Title
						</label>
						<input
							id="tab-title-input"
							ref={titleRef}
							type="text"
							defaultValue={tabInfo?.title ?? ""}
							placeholder="Page title"
							className="w-full rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 font-medium text-xs text-white placeholder-white/30 outline-none focus:border-white/30"
						/>
					</div>

					{/* Folder select */}
					<div>
						<label
							htmlFor="folder-select-input"
							className="mb-1 block font-medium text-[11px] text-white/50"
						>
							Folder
						</label>
						<select
							id="folder-select-input"
							value={folderId}
							onChange={(e) => {
								setFolderId(e.target.value);
								if (saveState === "duplicate") setSaveState("idle");
							}}
							className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 font-medium text-xs text-white outline-none focus:border-white/30"
						>
							{folderOptions.map((opt) => (
								<option
									key={opt.folder.id}
									value={opt.folder.id}
									className="bg-neutral-900 text-white"
								>
									{opt.depth > 0
										? "· ".repeat(opt.depth) + opt.folder.name
										: opt.folder.name}
								</option>
							))}
						</select>
					</div>

					{/* Status message */}
					{statusText && (
						<p
							className={`text-center font-medium text-[11px] ${
								saveState === "saved"
									? "text-emerald-400"
									: saveState === "duplicate" || saveState === "error"
										? "text-red-400"
										: "text-white/50"
							}`}
						>
							{statusText}
						</p>
					)}

					{/* Action button */}
					<Button
						type="button"
						size="sm"
						onClick={handleSave}
						disabled={saveState === "saving" || saveState === "saved"}
						className="h-8 w-full rounded-md font-medium text-xs shadow-xs"
					>
						{saveState === "saved" ? "Saved ✓" : "Save Page"}
					</Button>
				</div>
			)}
		</div>
	);
}
