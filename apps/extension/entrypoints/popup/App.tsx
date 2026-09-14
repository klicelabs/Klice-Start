import { Button } from "@klice-start/ui/components/button";
import { useEffect, useMemo, useRef, useState } from "react";
import { findBookmarkInFolder } from "../../src/lib/bookmark-match";
import { flattenForPicker } from "../../src/lib/folder-tree";
import {
	PENDING_SAVE_KEY,
	PENDING_SAVE_QUERY_PARAM,
	type PendingSave,
	parsePendingSave,
	pendingSaveId,
	pendingSaveThumbId,
} from "../../src/lib/pending-save";
import { flushPersist } from "../../src/lib/storage";
import { faviconUrl } from "../../src/lib/url";
import { useImageStore } from "../../src/stores/image-store";
import { useSetupStore } from "../../src/stores/setup-store";

type SaveState = "idle" | "saving" | "saved" | "updated" | "error";
type PendingState =
	| "loading"
	| "ready"
	| "saving"
	| "saved"
	| "cancelled"
	| "stale"
	| "error";

const pendingSaveQuery =
	typeof window === "undefined"
		? null
		: new URLSearchParams(window.location.search).get(PENDING_SAVE_QUERY_PARAM);

async function clearPendingOperation(
	expectedId: string,
	deleteThumb: boolean,
	deleteThumbnail: (id: string) => Promise<void>,
): Promise<void> {
	if (!expectedId) return;
	const data = await chrome.storage.local.get(PENDING_SAVE_KEY);
	const raw = data[PENDING_SAVE_KEY];
	if (pendingSaveId(raw) !== expectedId) return;
	const thumbId = deleteThumb ? pendingSaveThumbId(raw) : null;
	await chrome.storage.local.remove(PENDING_SAVE_KEY);
	if (thumbId) await deleteThumbnail(thumbId);
}

export default function App() {
	const isPendingFlow = pendingSaveQuery !== null;
	const pendingId = pendingSaveQuery ?? "";
	const [saveState, setSaveState] = useState<SaveState>("idle");
	const [blocked, setBlocked] = useState(false);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [tabInfo, setTabInfo] = useState<{
		title: string;
		url: string;
		favicon: string;
	} | null>(null);
	const [pendingState, setPendingState] = useState<PendingState>(
		isPendingFlow ? "loading" : "ready",
	);
	const [pendingRecord, setPendingRecord] = useState<PendingSave | null>(null);
	const [pendingThumbId, setPendingThumbId] = useState<string | null>(null);
	const [newFolderName, setNewFolderName] = useState("");
	const [pendingNameError, setPendingNameError] = useState(false);
	const [parentFolderId, setParentFolderId] = useState<string | null>(null);
	const titleRef = useRef<HTMLInputElement>(null);
	const pendingNameRef = useRef<HTMLInputElement>(null);

	const folders = useSetupStore((s) => s.folders);
	const activeFolderId = useSetupStore((s) => s.activeFolderId);
	const saveThumbnail = useImageStore((s) => s.saveThumbnail);
	const getThumbnail = useImageStore((s) => s.getThumbnail);
	const deleteThumbnail = useImageStore((s) => s.deleteThumbnail);

	const [folderId, setFolderId] = useState(activeFolderId);
	const folderOptions = useMemo(() => flattenForPicker(folders), [folders]);

	useEffect(() => {
		if (isPendingFlow) {
			let cancelled = false;
			(async () => {
				if (!pendingId) {
					setPendingState("stale");
					return;
				}
				try {
					const data = await chrome.storage.local.get(PENDING_SAVE_KEY);
					const record = parsePendingSave(data[PENDING_SAVE_KEY], pendingId);
					if (!record) {
						await clearPendingOperation(pendingId, true, deleteThumbnail).catch(
							() => undefined,
						);
						if (!cancelled) setPendingState("stale");
						return;
					}
					let resolvedThumbId = record.thumbId;
					if (record.thumbId) {
						try {
							const image = await getThumbnail(record.thumbId);
							if (image) setPreviewUrl(image);
							else resolvedThumbId = null;
						} catch {
							resolvedThumbId = null;
						}
					}
					if (cancelled) return;
					setPendingRecord(record);
					setPendingThumbId(resolvedThumbId);
					setPendingState("ready");
				} catch {
					await clearPendingOperation(pendingId, true, deleteThumbnail).catch(
						() => undefined,
					);
					if (!cancelled) setPendingState("error");
				}
			})();
			return () => {
				cancelled = true;
			};
		}

		let cancelled = false;
		(async () => {
			const [tab] = await chrome.tabs.query({
				active: true,
				currentWindow: true,
			});
			if (cancelled) return;
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
				if (!cancelled) setPreviewUrl(dataUrl);
			} catch {
				// Preview is optional.
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [deleteThumbnail, getThumbnail, isPendingFlow, pendingId]);
	useEffect(() => {
		if (!isPendingFlow || pendingState !== "ready") return;
		requestAnimationFrame(() => pendingNameRef.current?.focus());
	}, [isPendingFlow, pendingState]);

	async function handlePendingCancel() {
		if (!pendingId || pendingState === "saving") return;
		await clearPendingOperation(pendingId, true, deleteThumbnail).catch(
			() => undefined,
		);
		setPendingState("cancelled");
		setTimeout(() => window.close(), 250);
	}

	async function handlePendingCreate() {
		if (!pendingRecord || pendingState !== "ready") return;
		const name = newFolderName.trim();
		if (!name) {
			setPendingNameError(true);
			return;
		}
		setPendingNameError(false);

		setPendingState("saving");
		let cardAdded = false;
		let createdFolderId: string | null = null;
		try {
			const data = await chrome.storage.local.get(PENDING_SAVE_KEY);
			const current = parsePendingSave(data[PENDING_SAVE_KEY], pendingId);
			if (!current) throw new Error("Pending save expired");

			const setup = useSetupStore.getState();
			const parentId =
				parentFolderId &&
				setup.folders.some((folder) => folder.id === parentFolderId)
					? parentFolderId
					: null;
			createdFolderId = setup.addFolder(name, parentId);
			setup.addCard({
				folderId: createdFolderId,
				title: current.title,
				url: current.url,
				favicon: current.favicon || faviconUrl(current.url),
				thumbId: pendingThumbId,
			});
			cardAdded = true;
			await flushPersist();
			await clearPendingOperation(pendingId, false, deleteThumbnail);
			setPendingState("saved");
			setTimeout(() => window.close(), 600);
		} catch {
			if (!cardAdded && createdFolderId) {
				useSetupStore.getState().deleteFolder(createdFolderId);
			}
			await clearPendingOperation(pendingId, !cardAdded, deleteThumbnail).catch(
				() => undefined,
			);
			setPendingState("error");
		}
	}

	async function handleSave() {
		if (!tabInfo || saveState === "saving") return;

		setSaveState("saving");
		let thumbId: string | null = null;
		let persisted = false;
		try {
			if (previewUrl) {
				thumbId = await saveThumbnail(previewUrl);
			}

			// Re-read after the screenshot finishes: a context-menu save or a
			// second popup may have written the same URL while this popup was open.
			const store = useSetupStore.getState();
			const existing = findBookmarkInFolder(store.cards, folderId, tabInfo.url);
			const title = titleRef.current?.value.trim() || tabInfo.title;
			if (existing) {
				const previousThumbId = existing.thumbId;
				const changes = {
					title,
					...(tabInfo.favicon ? { favicon: tabInfo.favicon } : {}),
					...(thumbId ? { thumbId } : {}),
				};
				store.updateCard(existing.id, changes);
				await flushPersist();
				persisted = true;
				if (thumbId && previousThumbId && previousThumbId !== thumbId) {
					const stillReferenced = useSetupStore
						.getState()
						.cards.some((card) => card.thumbId === previousThumbId);
					if (!stillReferenced) {
						await deleteThumbnail(previousThumbId).catch(() => undefined);
					}
				}
				setSaveState("updated");
			} else {
				store.addCard({
					folderId,
					title,
					url: tabInfo.url,
					favicon: tabInfo.favicon || faviconUrl(tabInfo.url),
					thumbId,
				});
				await flushPersist();
				persisted = true;
				setSaveState("saved");
			}
			setTimeout(() => window.close(), 600);
		} catch {
			if (!persisted && thumbId) {
				await deleteThumbnail(thumbId).catch(() => undefined);
			}
			setSaveState("error");
		}
	}

	if (isPendingFlow) {
		const pendingFormVisible =
			pendingRecord && (pendingState === "ready" || pendingState === "saving");
		return (
			<div
				className="w-[340px] select-none p-3 font-sans text-white text-xs"
				style={{ background: "#1c1c1e" }}
			>
				<div className="mb-2.5 flex items-center justify-between gap-2">
					<span className="font-semibold text-[13px] text-white/90">
						New folder & save
					</span>
					<button
						type="button"
						onClick={handlePendingCancel}
						className="text-white/45 hover:text-white/80"
					>
						Cancel
					</button>
				</div>

				{pendingState === "loading" && (
					<p className="py-8 text-center text-white/50">Loading page…</p>
				)}
				{(pendingState === "stale" || pendingState === "cancelled") && (
					<p className="py-8 text-center text-white/50">
						{pendingState === "cancelled"
							? "Save cancelled."
							: "This save request has expired."}
					</p>
				)}
				{pendingState === "error" && (
					<p className="py-8 text-center text-red-300">
						Could not complete the save.
					</p>
				)}
				{pendingState === "saved" && (
					<p className="py-8 text-center text-emerald-300">
						Folder created and page saved ✓
					</p>
				)}
				{pendingFormVisible && pendingRecord && (
					<div className="space-y-2.5">
						{previewUrl && (
							<div className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10">
								<img
									src={previewUrl}
									alt="Page preview"
									className="h-full w-full object-cover"
								/>
							</div>
						)}
						<div className="flex items-center gap-2 rounded-md bg-white/5 px-2.5 py-2">
							{pendingRecord.favicon && (
								<img
									src={pendingRecord.favicon}
									alt=""
									className="h-4 w-4 rounded-sm"
								/>
							)}
							<div className="min-w-0">
								<p className="truncate font-medium text-white/85">
									{pendingRecord.title}
								</p>
								<p className="truncate text-[10px] text-white/40">
									{pendingRecord.url}
								</p>
							</div>
						</div>
						<div>
							<label
								htmlFor="new-folder-name"
								className="mb-1 block font-medium text-[11px] text-white/50"
							>
								Folder name
							</label>
							<input
								id="new-folder-name"
								ref={pendingNameRef}
								value={newFolderName}
								onChange={(event) => {
									setNewFolderName(event.target.value);
									setPendingNameError(false);
								}}
								placeholder="Folder name"
								className="w-full rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 font-medium text-white text-xs placeholder-white/30 outline-none focus:border-white/30"
							/>
							{pendingNameError && (
								<p className="mt-1 text-[10px] text-red-300">
									Folder name is required.
								</p>
							)}
						</div>
						<div>
							<label
								htmlFor="parent-folder-select"
								className="mb-1 block font-medium text-[11px] text-white/50"
							>
								Parent folder <span className="text-white/30">(optional)</span>
							</label>
							<select
								id="parent-folder-select"
								value={parentFolderId ?? ""}
								onChange={(event) =>
									setParentFolderId(event.target.value || null)
								}
								className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 font-medium text-white text-xs outline-none focus:border-white/30"
							>
								<option value="" className="bg-neutral-900 text-white">
									Top level
								</option>
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
						<div className="flex gap-2 pt-0.5">
							<button
								type="button"
								onClick={handlePendingCancel}
								className="h-8 flex-1 rounded-md border border-white/10 font-medium text-white/65 text-xs hover:bg-white/5"
							>
								Cancel
							</button>
							<Button
								type="button"
								onClick={handlePendingCreate}
								disabled={pendingState === "saving"}
								className="h-8 flex-[2] rounded-md font-medium text-xs shadow-xs"
							>
								{pendingState === "saving" ? "Saving…" : "Create folder & save"}
							</Button>
						</div>
					</div>
				)}
			</div>
		);
	}

	const statusText =
		saveState === "saving"
			? "Saving…"
			: saveState === "saved"
				? "Added ✓"
				: saveState === "updated"
					? "Bookmark updated ✓"
					: saveState === "error"
						? "Error saving."
						: "";

	return (
		<div
			className="w-[280px] select-none p-3 font-sans text-white text-xs"
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
					{previewUrl && (
						<div className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10">
							<img
								src={previewUrl}
								alt="Page preview"
								className="h-full w-full object-cover"
							/>
						</div>
					)}

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
							className="w-full rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 font-medium text-white text-xs placeholder-white/30 outline-none focus:border-white/30"
						/>
					</div>

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
								if (saveState !== "idle") setSaveState("idle");
							}}
							className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 font-medium text-white text-xs outline-none focus:border-white/30"
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

					{statusText && (
						<p
							className={`text-center font-medium text-[11px] ${
								saveState === "saved" || saveState === "updated"
									? "text-emerald-400"
									: saveState === "error"
										? "text-red-400"
										: "text-white/50"
							}`}
						>
							{statusText}
						</p>
					)}

					<Button
						type="button"
						size="sm"
						onClick={handleSave}
						disabled={
							saveState === "saving" ||
							saveState === "saved" ||
							saveState === "updated"
						}
						className="h-8 w-full rounded-md font-medium text-xs shadow-xs"
					>
						{saveState === "saved"
							? "Saved ✓"
							: saveState === "updated"
								? "Updated ✓"
								: "Save Page"}
					</Button>
				</div>
			)}
		</div>
	);
}
