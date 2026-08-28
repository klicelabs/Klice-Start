import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@klice-start/ui/components/dialog";
import { useEffect, useState } from "react";
import { cn } from "../../../lib/utils";
import { AdvancedPane } from "./panes/advanced-pane";
import { AppearancePane } from "./panes/appearance-pane";
import { BackgroundPane } from "./panes/background-pane";
import { BookmarksPane } from "./panes/bookmarks-pane";
import { GeneralPane } from "./panes/general-pane";
import { ImportExportPane } from "./panes/import-export-pane";
import { SearchPane } from "./panes/search-pane";
import { SettingsSidebar } from "./settings-sidebar";
import type { SettingsDialogProps, SettingsPaneId } from "./settings-types";

export function SettingsDialog({
	open,
	onClose,
	initialPane = "general",
	initialAction,
}: SettingsDialogProps) {
	const [activePane, setActivePane] = useState<SettingsPaneId>(initialPane);

	useEffect(() => {
		if (open && initialPane) {
			setActivePane(initialPane);
		}
	}, [open, initialPane]);

	return (
		<Dialog
			open={open}
			onOpenChange={(isOpen) => {
				if (!isOpen) onClose();
			}}
		>
			<DialogContent
				showCloseButton={true}
				className={cn(
					"flex h-[min(620px,88vh)] w-[min(880px,94vw)] sm:max-w-[880px] max-w-[880px] flex-col overflow-hidden p-0 gap-0",
					"border border-border/60 bg-background/95 shadow-2xl backdrop-blur-xl",
					"rounded-2xl",
				)}
			>
				<DialogHeader className="sr-only">
					<DialogTitle>Klice Start Settings</DialogTitle>
				</DialogHeader>

				<div className="flex h-full min-h-0 flex-1 overflow-hidden">
					{/* Sidebar */}
					<SettingsSidebar
						activePane={activePane}
						onSelectPane={setActivePane}
					/>

					{/* Content Pane */}
					<main className="settings-content-scroll flex-1 overflow-y-auto p-5 pr-12">
						{activePane === "general" && <GeneralPane />}
						{activePane === "appearance" && <AppearancePane />}
						{activePane === "background" && <BackgroundPane />}
						{activePane === "search" && <SearchPane />}
						{activePane === "bookmarks" && (
							<BookmarksPane initialAction={initialAction} />
						)}
						{activePane === "import-export" && <ImportExportPane />}
						{activePane === "advanced" && (
							<AdvancedPane onCloseParent={onClose} />
						)}
					</main>
				</div>
			</DialogContent>
		</Dialog>
	);
}
