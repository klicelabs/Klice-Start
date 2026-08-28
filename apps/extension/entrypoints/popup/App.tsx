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
				const dataUrl = await chrome.tabs.captureVisibleTab({
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

		const canon = canonicalUrl(tabInfo.url);
		const duplicate = useSetupStore
			.getState()
			.cards.some(
				(c) => c.folderId === folderId && canonicalUrl(c.url) === canon,
			);
		if (duplicate) {
			setSaveState("duplicate");
			return;
		}

		setSaveState("saving");
		try {
			const thumbId = previewUrl ? await saveThumbnail(previewUrl) : null;
			useSetupStore.getState().addCard({
				folderId,
				title: titleRef.current?.value.trim() || tabInfo.title,
				url: tabInfo.url,
				favicon: tabInfo.favicon || faviconUrl(tabInfo.url),
				thumbId,
			});
			setSaveState("saved");
			setTimeout(() => window.close(), 500);
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
			className="p-4 text-white"
			style={{
				width: 300,
			}}
		>
			{blocked ? (
				<p className="py-6 text-center text-[13px] text-white/60">
					This page can’t be saved.
				</p>
			) : (
				<>
					{previewUrl && (
						<div
							className="mb-3 h-[120px] w-full rounded-xl border border-white/10 bg-[#1c1c1e] bg-cover bg-top"
							style={{ backgroundImage: `url("${previewUrl}")` }}
						/>
					)}

					<label
						htmlFor="popup-title"
						className="mt-2 mb-1 block text-white/50 text-xs"
					>
						Title
					</label>
					<input
						id="popup-title"
						ref={titleRef}
						defaultValue={tabInfo?.title || ""}
						onKeyDown={(e) => e.key === "Enter" && handleSave()}
						className="w-full rounded-lg border border-white/10 bg-white/10 px-2.5 py-2 text-[13px] text-white outline-none focus:border-blue-500"
					/>

					<label
						htmlFor="popup-folder"
						className="mt-2.5 mb-1 block text-white/50 text-xs"
					>
						Folder
					</label>
					<select
						id="popup-folder"
						value={folderId}
						onChange={(e) => {
							setFolderId(e.target.value);
							if (saveState === "duplicate") setSaveState("idle");
						}}
						className="w-full rounded-lg border border-white/10 bg-white/10 px-2.5 py-2 text-[13px] text-white outline-none focus:border-blue-500"
					>
						{folderOptions.map(({ folder, depth }) => (
							<option
								key={folder.id}
								value={folder.id}
								className="bg-[#1c1c1e]"
							>
								{`${"  ".repeat(depth)}${folder.name}`}
							</option>
						))}
					</select>

					<Button
						className="mt-3.5 w-full"
						disabled={saveState === "saving" || saveState === "saved"}
						onClick={handleSave}
					>
						Save to Klice Start
					</Button>

					<p
						className="mt-2 h-3.5 text-center text-white/50 text-xs"
						role="status"
						aria-live="polite"
					>
						{statusText}
					</p>
				</>
			)}
		</div>
	);
}
