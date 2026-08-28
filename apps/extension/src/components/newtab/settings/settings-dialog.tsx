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
import { BookmarksPane } from "./panes/bookmarks-pane";
import { GeneralPane } from "./panes/general-pane";
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
					"flex h-[min(600px,86vh)] w-[min(880px,94vw)] max-w-[880px] flex-col gap-0 overflow-hidden rounded-[24px] p-3.5 sm:max-w-[880px]",
					"border border-border/60 bg-background/[0.64] shadow-2xl backdrop-blur-[6px]",
				)}
			>
				<DialogHeader className="sr-only">
					<DialogTitle>Klice Start Settings</DialogTitle>
				</DialogHeader>

				<div className="flex h-full min-h-0 flex-1 overflow-hidden">
					{/* Floating Inset Sidebar */}
					<SettingsSidebar
						activePane={activePane}
						onSelectPane={setActivePane}
					/>

					{/* Floating Inset Content Area */}
					<main className="settings-content-scroll ml-3 flex-1 overflow-y-auto p-5 pr-10 max-[640px]:ml-2 max-[640px]:p-3 max-[640px]:pr-4">
						{activePane === "general" && <GeneralPane />}
						{activePane === "appearance" && <AppearancePane />}
						{activePane === "search" && <SearchPane />}
						{activePane === "bookmarks" && (
							<BookmarksPane initialAction={initialAction} />
						)}
						{activePane === "advanced" && (
							<AdvancedPane onCloseParent={onClose} />
						)}
					</main>
				</div>
			</DialogContent>
		</Dialog>
	);
}
