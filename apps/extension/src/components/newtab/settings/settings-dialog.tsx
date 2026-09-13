import { Button } from "@klice-start/ui/components/button";
import {
	PopoverClose,
	PopoverDescription,
	PopoverPopup,
	PopoverPortal,
	PopoverPositioner,
	PopoverTitle,
} from "@klice-start/ui/components/popover";
import { Icon, type IconName } from "@klice-start/ui/icons/icon";
import { DURATION, EASE } from "@klice-start/ui/lib/motion";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../../lib/utils";
import { useSetupStore } from "../../../stores/setup-store";
import { AdvancedPane } from "./panes/advanced-pane";
import { AppearancePane } from "./panes/appearance-pane";
import { BookmarksPane } from "./panes/bookmarks-pane";
import { GeneralPane } from "./panes/general-pane";
import { SearchPane } from "./panes/search-pane";
import {
	createSettingsNavigation,
	pushSettingsNavigation,
	SETTINGS_PANE_LABELS,
	type SettingsDialogProps,
	type SettingsNavigationState,
	type SettingsPaneId,
	stepSettingsNavigation,
} from "./settings-types";
import {
	SETTINGS_FOCUS_RING,
	SETTINGS_HEADER_CONTROL,
	SETTINGS_HEADER_INSET,
	SETTINGS_HEADER_SAVE,
	SETTINGS_HOVER_WASH,
	SETTINGS_PAGE_INSET,
	SETTINGS_PANEL_SURFACE,
	SETTINGS_RADIUS,
} from "./shared/settings-tokens";

interface PreferenceCategory {
	id: SettingsPaneId;
	label: string;
	/** One line of orientation — what the page is for, not a section title. */
	description: string;
	icon: IconName;
}

const CATEGORIES: readonly PreferenceCategory[] = [
	{
		id: "general",
		label: "General",
		description: "Layout, clock and greeting",
		icon: "settings",
	},
	{
		id: "appearance",
		label: "Appearance",
		description: "Theme, background and effects",
		icon: "palette",
	},
	{
		id: "search",
		label: "Search",
		description: "Search bar, engine and placeholder",
		icon: "search",
	},
	{
		id: "bookmarks",
		label: "Bookmarks",
		description: "Folders, links and backups",
		icon: "bookmark",
	},
	{
		id: "advanced",
		label: "Advanced",
		description: "Storage footprint and reset",
		icon: "wrench",
	},
];

const PANEL_COLLISION = {
	side: "flip" as const,
	align: "shift" as const,
	fallbackAxisSide: "none" as const,
};

/**
 * The toolbar's Settings button.
 *
 * The panel can be opened two ways: by pressing that button, or programmatically
 * (the dashboard's empty-folder "Add link", toolbar shortcuts). In the second
 * case Base UI has no trigger interaction to derive an anchor from, and the
 * popup falls back to the viewport corner — mounted, but positioned nowhere the
 * user is looking. Naming the anchor explicitly makes both paths identical.
 */
function anchorToSettingsTrigger() {
	return typeof document === "undefined"
		? null
		: document.getElementById("settings-trigger");
}

export function SettingsDialog({
	open,
	onClose,
	initialPane,
	initialAction,
}: SettingsDialogProps) {
	const [navigation, setNavigation] = useState<SettingsNavigationState>(() =>
		createSettingsNavigation(initialPane),
	);
	const [paneDirection, setPaneDirection] = useState<1 | -1>(1);
	const reduceMotion = useReducedMotion() ?? false;
	const contentRef = useRef<HTMLElement>(null);
	const isSettingsDirty = useSetupStore((state) => state.isSettingsDirty);
	const beginSettingsDraft = useSetupStore((state) => state.beginSettingsDraft);
	const saveSettingsDraft = useSetupStore((state) => state.saveSettingsDraft);
	const discardSettingsDraft = useSetupStore(
		(state) => state.discardSettingsDraft,
	);
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		if (!open) {
			discardSettingsDraft();
			return;
		}
		beginSettingsDraft();
		setNavigation(createSettingsNavigation(initialPane));
	}, [beginSettingsDraft, discardSettingsDraft, initialPane, open]);

	const activePane: SettingsPaneId =
		navigation.entries[navigation.index] ?? initialPane ?? "general";
	const activePaneLabel = SETTINGS_PANE_LABELS[activePane];
	const showRoot = navigation.root;

	const navigateTo = useCallback((pane: SettingsPaneId) => {
		setPaneDirection(1);
		setNavigation((state) => pushSettingsNavigation(state, pane));
	}, []);

	const goRoot = useCallback(() => {
		setPaneDirection(-1);
		setNavigation((state) => stepSettingsNavigation(state, "back"));
		contentRef.current?.scrollTo({ top: 0, behavior: "auto" });
	}, []);

	const handleClose = useCallback(() => {
		discardSettingsDraft();
		onClose();
	}, [discardSettingsDraft, onClose]);

	const handleSave = useCallback(async () => {
		setIsSaving(true);
		try {
			await saveSettingsDraft();
		} finally {
			setIsSaving(false);
		}
	}, [saveSettingsDraft]);

	useEffect(() => {
		if (!showRoot && activePane) {
			contentRef.current?.scrollTo({ top: 0, behavior: "auto" });
		}
	}, [activePane, showRoot]);

	const listVariants = {
		hidden: {},
		show: { transition: { staggerChildren: reduceMotion ? 0 : 0.028 } },
	};
	const itemVariants = {
		hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 },
		show: {
			opacity: 1,
			y: 0,
			transition: { duration: DURATION.control, ease: EASE.out },
		},
	};

	return (
		<PopoverPortal>
			<PopoverPositioner
				side="bottom"
				align="end"
				sideOffset={10}
				collisionPadding={12}
				collisionAvoidance={PANEL_COLLISION}
				anchor={anchorToSettingsTrigger}
			>
				<PopoverPopup
					className={cn(
						"min-w-0 overflow-visible bg-transparent p-0 text-neutral-900 shadow-none dark:text-neutral-100",
						"origin-(--transform-origin)",
					)}
					aria-labelledby="settings-panel-title"
					data-settings-panel="true"
				>
					<div
						className={cn(
							"squircle relative overflow-visible",
							SETTINGS_PANEL_SURFACE,
							SETTINGS_RADIUS.panel,
						)}
					>
						<div
							className={cn(
								"squircle flex max-h-[min(680px,calc(100dvh-5.5rem))] w-[min(384px,calc(100vw-24px))] min-w-0 flex-col overflow-hidden",
								SETTINGS_PANEL_SURFACE,
								SETTINGS_RADIUS.panel,
							)}
						>
							<header
								className={cn(
									"grid h-14 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3",
									SETTINGS_HEADER_INSET,
								)}
							>
								{showRoot ? (
									<PopoverClose
										render={
											<Button
												variant="ghost"
												size="icon"
												className={cn(
													SETTINGS_HEADER_CONTROL,
													SETTINGS_FOCUS_RING,
												)}
												aria-label="Close preferences"
												onClick={handleClose}
											/>
										}
									>
										<Icon name="chevron-left" size={17} aria-hidden="true" />
									</PopoverClose>
								) : (
									<button
										type="button"
										className={cn(
											"size-9",
											SETTINGS_HEADER_CONTROL,
											SETTINGS_FOCUS_RING,
										)}
										onClick={goRoot}
										aria-label="Back to Preferences"
									>
										<Icon name="chevron-left" size={17} aria-hidden="true" />
									</button>
								)}
								<div className="min-w-0 flex-1">
									<PopoverTitle
										id="settings-panel-title"
										className="truncate font-semibold text-[16px] tracking-[-0.01em]"
										aria-live="polite"
									>
										{showRoot ? "Preferences" : activePaneLabel}
									</PopoverTitle>
									<PopoverDescription className="sr-only">
										Klice Start preferences
									</PopoverDescription>
								</div>
								<div className="flex h-9 shrink-0 items-center">
									<AnimatePresence initial={false} mode="wait">
										{isSettingsDirty && (
											<motion.div
												initial={
													reduceMotion ? { opacity: 0 } : { opacity: 0, x: 6 }
												}
												animate={{ opacity: 1, x: 0 }}
												exit={
													reduceMotion ? { opacity: 0 } : { opacity: 0, x: 6 }
												}
												transition={{
													duration: reduceMotion ? DURATION.instant : 0.15,
													ease: EASE.out,
												}}
											>
												<Button
													type="button"
													variant="ghost"
													disabled={isSaving}
													onClick={handleSave}
													className={cn(
														SETTINGS_HEADER_SAVE,
														SETTINGS_FOCUS_RING,
													)}
												>
													{isSaving ? "Saving…" : "Save"}
												</Button>
											</motion.div>
										)}
									</AnimatePresence>
								</div>
							</header>

							{showRoot ? (
								<main
									className={cn(
										"settings-content-scroll scrollbar-hidden min-h-0 shrink overflow-y-auto",
										SETTINGS_PAGE_INSET,
									)}
								>
									<nav aria-label="Preference sections">
										<motion.div
											className="flex flex-col gap-0.5"
											variants={listVariants}
											initial={reduceMotion ? false : "hidden"}
											animate="show"
										>
											{CATEGORIES.map((category) => (
												<motion.button
													key={category.id}
													type="button"
													variants={itemVariants}
													onClick={() => navigateTo(category.id)}
													className={cn(
														cn(
															"group flex min-h-14 w-full items-center gap-3 bg-transparent px-2 py-2 text-left transition-colors duration-150 motion-reduce:transition-none",
															SETTINGS_HOVER_WASH,
															SETTINGS_RADIUS.surface,
														),
														SETTINGS_FOCUS_RING,
													)}
												>
													<Icon
														name={category.icon}
														size={18}
														strokeWidth={1.75}
														className="shrink-0 text-neutral-500 transition-colors group-hover:text-neutral-900 dark:text-neutral-400 dark:group-hover:text-neutral-100"
														aria-hidden="true"
													/>
													<span className="min-w-0 flex-1">
														<span className="block font-medium text-[13px] text-neutral-900 leading-[1.35] dark:text-neutral-100">
															{category.label}
														</span>
														<span className="mt-0.5 block truncate text-[12px] text-neutral-500 leading-[1.35] dark:text-neutral-400">
															{category.description}
														</span>
													</span>
													<Icon
														name="chevron-right"
														size={15}
														className="shrink-0 text-neutral-400 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none dark:text-neutral-500"
														aria-hidden="true"
													/>
												</motion.button>
											))}
										</motion.div>
									</nav>
								</main>
							) : (
								<main
									id="settings-page-content"
									ref={contentRef}
									className={cn(
										"settings-content-scroll scrollbar-hidden min-h-0 shrink overflow-y-auto",
										SETTINGS_PAGE_INSET,
									)}
									aria-labelledby="settings-panel-title"
								>
									<AnimatePresence
										initial={false}
										mode="wait"
										custom={paneDirection}
									>
										<motion.div
											key={activePane}
											initial={
												reduceMotion
													? { opacity: 0 }
													: { opacity: 0, x: paneDirection * 16 }
											}
											animate={{ opacity: 1, x: 0 }}
											exit={
												reduceMotion
													? { opacity: 0 }
													: { opacity: 0, x: paneDirection * -12 }
											}
											transition={
												reduceMotion
													? { duration: DURATION.instant }
													: { duration: DURATION.navigation, ease: EASE.out }
											}
											className="w-full"
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
										</motion.div>
									</AnimatePresence>
								</main>
							)}
						</div>
					</div>
				</PopoverPopup>
			</PopoverPositioner>
		</PopoverPortal>
	);
}
