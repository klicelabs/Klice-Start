import { Button } from "@klice-start/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@klice-start/ui/components/dialog";
import { Icon } from "@klice-start/ui/icons/icon";
import { settingsContentStyles } from "@klice-start/ui/lib/glass-variants";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../../lib/utils";
import { AdvancedPane } from "./panes/advanced-pane";
import { AppearancePane } from "./panes/appearance-pane";
import { BookmarksPane } from "./panes/bookmarks-pane";
import { GeneralPane } from "./panes/general-pane";
import { SearchPane } from "./panes/search-pane";
import { SettingsSidebar } from "./settings-sidebar";
import {
	createSettingsNavigation,
	pushSettingsNavigation,
	SETTINGS_PANE_LABELS,
	type SettingsDialogProps,
	type SettingsNavigationState,
	type SettingsPaneId,
	stepSettingsNavigation,
} from "./settings-types";

// Compact, native-feeling history controls: no pill, no heavy border — just a
// quiet grouped surface with the theme's own hover/focus treatment.
const NAV_BUTTON_CLASSES =
	"size-6 rounded-md text-muted-foreground transition-[background-color,color,opacity] duration-150 hover:bg-foreground/[0.08] hover:text-foreground focus-visible:ring-1 disabled:opacity-30 motion-reduce:transition-none";

export function SettingsDialog({
	open,
	onClose,
	initialPane = "general",
	initialAction,
}: SettingsDialogProps) {
	// The navigation state is the single source of truth for the selected page.
	// Keeping the entries local avoids touching the browser's global history.
	const [navigation, setNavigation] = useState<SettingsNavigationState>(() =>
		createSettingsNavigation(initialPane),
	);
	const contentRef = useRef<HTMLElement>(null);

	useEffect(() => {
		if (open) setNavigation(createSettingsNavigation(initialPane));
	}, [open, initialPane]);

	const activePane: SettingsPaneId =
		navigation.entries[navigation.index] ?? initialPane;
	const activePaneLabel = SETTINGS_PANE_LABELS[activePane];
	const canGoBack = navigation.index > 0;
	const canGoForward = navigation.index < navigation.entries.length - 1;

	const navigateTo = useCallback((pane: SettingsPaneId) => {
		setNavigation((state) => pushSettingsNavigation(state, pane));
	}, []);

	const goBack = useCallback(() => {
		setNavigation((state) => stepSettingsNavigation(state, "back"));
	}, []);

	const goForward = useCallback(() => {
		setNavigation((state) => stepSettingsNavigation(state, "forward"));
	}, []);

	// A new Settings page starts at the top while the header stays pinned.
	useEffect(() => {
		if (!activePane) return;
		contentRef.current?.scrollTo({ top: 0, behavior: "auto" });
	}, [activePane]);

	return (
		<Dialog
			open={open}
			onOpenChange={(isOpen) => {
				if (!isOpen) onClose();
			}}
		>
			<DialogContent
				showCloseButton={false}
				className={cn(
					"flex h-[min(640px,88vh)] w-[min(900px,calc(100vw-2rem))] max-w-[900px] flex-col gap-0 overflow-hidden rounded-3xl p-0",
					"border border-border/50 bg-transparent shadow-[0_32px_80px_-24px_rgba(0,0,0,0.6)] backdrop-blur-0",
					"motion-reduce:animate-none motion-reduce:transition-none sm:max-w-[900px]",
				)}
			>
				<DialogHeader className="sr-only">
					<DialogTitle>Klice Start Settings</DialogTitle>
				</DialogHeader>

				<div className="flex min-h-0 flex-1 overflow-hidden">
					<SettingsSidebar
						activePane={activePane}
						onSelectPane={navigateTo}
						onClose={onClose}
					/>

					<section
						className={cn(
							"flex min-w-0 flex-1 flex-col",
							settingsContentStyles,
						)}
					>
						<header className="flex h-14 shrink-0 items-center gap-3 border-border/40 border-b px-6 max-[640px]:px-4">
							<nav
								className="flex shrink-0 items-center gap-0.5 rounded-md bg-foreground/[0.06] p-0.5"
								aria-label="Settings page navigation"
							>
								<Button
									variant="ghost"
									size="icon-xs"
									type="button"
									disabled={!canGoBack}
									onClick={goBack}
									aria-label="Back"
									title="Back"
									className={NAV_BUTTON_CLASSES}
								>
									<Icon
										name="chevron-left"
										size={15}
										strokeWidth={1.9}
										aria-hidden="true"
									/>
								</Button>
								<Button
									variant="ghost"
									size="icon-xs"
									type="button"
									disabled={!canGoForward}
									onClick={goForward}
									aria-label="Forward"
									title="Forward"
									className={NAV_BUTTON_CLASSES}
								>
									<Icon
										name="chevron-right"
										size={15}
										strokeWidth={1.9}
										aria-hidden="true"
									/>
								</Button>
							</nav>

							<h2
								id="settings-current-page"
								className="min-w-0 truncate font-semibold text-[15px] text-foreground leading-none tracking-[-0.01em]"
							>
								{activePaneLabel}
							</h2>
							<span className="sr-only" aria-live="polite" aria-atomic="true">
								{activePaneLabel} settings page
							</span>
						</header>

						<main
							id="settings-page-content"
							ref={contentRef}
							className="settings-content-scroll min-h-0 flex-1 overflow-y-auto px-6 py-6 max-[640px]:px-4 max-[640px]:py-5"
							aria-labelledby="settings-current-page"
						>
							<div
								key={activePane}
								className="settings-pane-enter mx-auto w-full max-w-[680px] pb-6 motion-reduce:animate-none"
							>
								{activePane === "general" && <GeneralPane />}
								{activePane === "appearance" && <AppearancePane />}
								{activePane === "search" && <SearchPane />}
								{activePane === "bookmarks" && (
									<BookmarksPane initialAction={initialAction} />
								)}
								{activePane === "advanced" && (
									<AdvancedPane onCloseParent={onClose} />
								)}
							</div>
						</main>
					</section>
				</div>
			</DialogContent>
		</Dialog>
	);
}
