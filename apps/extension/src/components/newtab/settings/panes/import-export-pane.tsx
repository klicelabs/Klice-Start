import { Button } from "@klice-start/ui/components/button";
import { Icon } from "@klice-start/ui/icons/icon";
import { type ChangeEvent, useRef, useState } from "react";
import { exportBackup, importBackup } from "../../../../services/backup";
import {
	exportBookmarksHtml,
	importBookmarksFromBrowser,
	importBookmarksHtml,
} from "../../../../services/bookmarks-html";
import { useSetupStore } from "../../../../stores/setup-store";
import { SectionCard } from "../shared/section-card";

export function ImportExportPane() {
	const htmlFileRef = useRef<HTMLInputElement>(null);
	const jsonFileRef = useRef<HTMLInputElement>(null);

	const [statusMessage, setStatusMessage] = useState("");
	const [statusType, setStatusType] = useState<"info" | "success" | "error">(
		"info",
	);
	const [isProcessing, setIsProcessing] = useState(false);

	async function handleImportFromBrowser() {
		setIsProcessing(true);
		setStatusType("info");
		setStatusMessage("Reading browser bookmarks…");
		try {
			const { foldersCreated, cardsCreated } =
				await importBookmarksFromBrowser();
			setStatusType("success");
			setStatusMessage(
				`Successfully imported ${cardsCreated} link${cardsCreated === 1 ? "" : "s"} across ${foldersCreated} folder${foldersCreated === 1 ? "" : "s"}.`,
			);
		} catch (err) {
			setStatusType("error");
			setStatusMessage(
				err instanceof Error
					? err.message
					: "Could not import bookmarks from browser.",
			);
		} finally {
			setIsProcessing(false);
		}
	}

	async function handleImportHtmlFile(e: ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;

		setIsProcessing(true);
		setStatusType("info");
		setStatusMessage("Parsing HTML bookmark file…");
		try {
			const text = await file.text();
			const { foldersCreated, cardsCreated } = await importBookmarksHtml(text);
			setStatusType("success");
			setStatusMessage(
				`Successfully imported ${cardsCreated} link${cardsCreated === 1 ? "" : "s"} across ${foldersCreated} folder${foldersCreated === 1 ? "" : "s"}.`,
			);
		} catch (err) {
			setStatusType("error");
			setStatusMessage(
				err instanceof Error
					? err.message
					: "Could not parse HTML bookmark file.",
			);
		} finally {
			setIsProcessing(false);
			e.target.value = "";
		}
	}

	async function handleExportHtml() {
		setIsProcessing(true);
		setStatusType("info");
		setStatusMessage("Generating Netscape HTML file…");
		try {
			await exportBookmarksHtml();
			setStatusType("success");
			setStatusMessage("Exported bookmarks HTML file.");
		} catch (err) {
			setStatusType("error");
			setStatusMessage(
				err instanceof Error ? err.message : "Failed to export bookmarks HTML.",
			);
		} finally {
			setIsProcessing(false);
		}
	}

	async function handleExportBackupJson() {
		setIsProcessing(true);
		setStatusType("info");
		setStatusMessage("Packaging full backup with images…");
		try {
			await exportBackup();
			setStatusType("success");
			setStatusMessage(
				"Exported complete backup JSON with all settings and images.",
			);
		} catch (err) {
			setStatusType("error");
			setStatusMessage(
				err instanceof Error ? err.message : "Failed to export backup JSON.",
			);
		} finally {
			setIsProcessing(false);
		}
	}

	async function handleRestoreBackupJson(e: ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;

		setIsProcessing(true);
		setStatusType("info");
		setStatusMessage("Restoring backup archive…");
		try {
			const text = await file.text();
			await importBackup(text);
			setStatusType("success");
			setStatusMessage("Backup restored successfully!");
		} catch (err) {
			setStatusType("error");
			setStatusMessage(
				err instanceof Error
					? err.message
					: "Failed to restore backup archive.",
			);
		} finally {
			setIsProcessing(false);
			e.target.value = "";
		}
	}

	return (
		<div className="space-y-2">
			{/* Browser Bookmarks */}
			<SectionCard
				title="Browser Bookmarks"
				description="Import bookmarks directly from your browser's native library"
			>
				<div className="flex items-center justify-between py-2">
					<div className="flex flex-col">
						<span className="font-medium text-foreground text-sm">
							Import from Browser
						</span>
						<span className="text-muted-foreground text-xs">
							Reads bookmarks from Chrome or Firefox and merges them safely into
							folders
						</span>
					</div>
					<Button
						type="button"
						size="sm"
						variant="secondary"
						onClick={handleImportFromBrowser}
						disabled={isProcessing}
						className="h-8 gap-1.5 rounded-lg text-xs"
					>
						<Icon name="globe" size={13} />
						Import
					</Button>
				</div>
			</SectionCard>

			{/* HTML Bookmark Files (Netscape standard) */}
			<SectionCard
				title="HTML Bookmark Files"
				description="Standard Netscape format compatible with all major web browsers"
			>
				<input
					ref={htmlFileRef}
					type="file"
					accept="text/html,.htm,.html"
					className="hidden"
					onChange={handleImportHtmlFile}
				/>

				<div className="flex items-center justify-between border-border/30 border-b py-2.5">
					<div className="flex flex-col">
						<span className="font-medium text-foreground text-sm">
							Import from HTML file
						</span>
						<span className="text-muted-foreground text-xs">
							Import bookmarks exported from Safari, Chrome, Firefox, Arc, or
							Edge
						</span>
					</div>
					<Button
						type="button"
						size="sm"
						variant="secondary"
						onClick={() => htmlFileRef.current?.click()}
						disabled={isProcessing}
						className="h-8 gap-1.5 rounded-lg text-xs"
					>
						<Icon name="upload" size={13} />
						Choose file
					</Button>
				</div>

				<div className="flex items-center justify-between py-2.5">
					<div className="flex flex-col">
						<span className="font-medium text-foreground text-sm">
							Export to HTML file
						</span>
						<span className="text-muted-foreground text-xs">
							Download a standard bookmarks.html file you can import into any
							browser
						</span>
					</div>
					<Button
						type="button"
						size="sm"
						variant="secondary"
						onClick={handleExportHtml}
						disabled={isProcessing}
						className="h-8 gap-1.5 rounded-lg text-xs"
					>
						<svg
							aria-hidden="true"
							width="13"
							height="13"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.5"
						>
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
						</svg>
						Export HTML
					</Button>
				</div>
			</SectionCard>

			{/* Complete Full Backup & Restore */}
			<SectionCard
				title="Complete JSON Backup"
				description="Full snapshot containing all folders, links, custom wallpapers, and thumbnails"
			>
				<input
					ref={jsonFileRef}
					type="file"
					accept=".json,application/json"
					className="hidden"
					onChange={handleRestoreBackupJson}
				/>

				<div className="flex items-center justify-between border-border/30 border-b py-2.5">
					<div className="flex flex-col">
						<span className="font-medium text-foreground text-sm">
							Create Full Backup
						</span>
						<span className="text-muted-foreground text-xs">
							Downloads an all-in-one .json archive of your complete dashboard
							setup
						</span>
					</div>
					<Button
						type="button"
						size="sm"
						variant="secondary"
						onClick={handleExportBackupJson}
						disabled={isProcessing}
						className="h-8 gap-1.5 rounded-lg text-xs"
					>
						<svg
							aria-hidden="true"
							width="13"
							height="13"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.5"
						>
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
						</svg>
						Export Backup
					</Button>
				</div>

				<div className="flex items-center justify-between py-2.5">
					<div className="flex flex-col">
						<span className="font-medium text-foreground text-sm">
							Restore from Backup
						</span>
						<span className="text-muted-foreground text-xs">
							Restore dashboard folders, settings, and custom images from a
							backup file
						</span>
					</div>
					<Button
						type="button"
						size="sm"
						variant="secondary"
						onClick={() => jsonFileRef.current?.click()}
						disabled={isProcessing}
						className="h-8 gap-1.5 rounded-lg text-xs"
					>
						<Icon name="upload" size={13} />
						Restore
					</Button>
				</div>
			</SectionCard>

			{/* Status Feedback */}
			{statusMessage && (
				<div
					className={`rounded-xl border px-3.5 py-2.5 font-medium text-xs ${
						statusType === "success"
							? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
							: statusType === "error"
								? "border-destructive/30 bg-destructive/10 text-destructive"
								: "border-border/60 bg-secondary/50 text-foreground"
					}`}
					role="status"
					aria-live="polite"
				>
					{statusMessage}
				</div>
			)}
		</div>
	);
}
