import {
	Sidebar,
	SidebarContent,
	SidebarHeader,
} from "@klice-start/ui/components/sidebar";
import { Icon, type IconName } from "@klice-start/ui/icons/icon";
import { DURATION, EASE } from "@klice-start/ui/lib/motion";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../../lib/utils";
import { AdvancedPane } from "./panes/advanced-pane";
import { AppearancePane } from "./panes/appearance-pane";
import { BookmarksPane } from "./panes/bookmarks-pane";
import { GeneralPane } from "./panes/general-pane";
import { SearchPane } from "./panes/search-pane";
import {
	createSettingsNavigation,
	pushSettingsNavigation,
	SETTINGS_PANE_LABELS,
	type SettingsNavigationState,
	type SettingsPaneId,
	type SettingsSidebarProps,
	stepSettingsNavigation,
} from "./settings-types";
import {
	SETTINGS_CONTENT_FRAME,
	SETTINGS_CONTENT_PADDING,
	SETTINGS_FOCUS_RING,
	SETTINGS_HEADER_CONTROL,
	SETTINGS_HEADER_INSET,
	SETTINGS_HEADER_TRANSPORT_CONTROL,
	SETTINGS_HOVER_WASH,
	SETTINGS_RADIUS,
	SETTINGS_SIDEBAR_SHELL,
} from "./shared/settings-tokens";
import { SettingsTransportControl } from "./shared/settings-transport-control";

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

/**
 * Settings lives in the app's shared layout, not in a portal. The motion slot
 * changes the actual flex width, so the Speed Dial sibling contracts in the
 * same transition instead of being covered by a fixed panel.
 */
export function SettingsSidebar({
	open,
	onClose,
	initialPane,
	initialAction,
}: SettingsSidebarProps) {
	const [navigation, setNavigation] = useState<SettingsNavigationState>(() =>
		createSettingsNavigation(initialPane),
	);
	const [paneDirection, setPaneDirection] = useState<1 | -1>(1);
	const reduceMotion = useReducedMotion() ?? false;
	const contentRef = useRef<HTMLElement>(null);
	const closeControlRef = useRef<HTMLButtonElement>(null);
	const wasOpenRef = useRef(open);
	const restoreFocusRef = useRef(false);

	useEffect(() => {
		if (!open) return;
		setNavigation(createSettingsNavigation(initialPane));
	}, [initialPane, open]);

	useEffect(() => {
		if (open && !wasOpenRef.current) {
			closeControlRef.current?.focus({ preventScroll: true });
		}
		wasOpenRef.current = open;
	}, [open]);

	useEffect(() => {
		if (open) return;
		const activeElement = document.activeElement;
		const focusReturnedFromSidebar =
			restoreFocusRef.current ||
			(activeElement instanceof HTMLElement &&
				Boolean(activeElement.closest("[data-settings-sidebar-slot]")));
		restoreFocusRef.current = false;
		if (!focusReturnedFromSidebar) return;
		document.getElementById("settings-trigger")?.focus();
	}, [open]);

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
		const activeElement = document.activeElement;
		restoreFocusRef.current =
			activeElement instanceof HTMLElement &&
			Boolean(activeElement.closest("[data-settings-sidebar-slot]"));
		onClose();
	}, [onClose]);

	// A non-modal sidebar still owns Escape while it is open. It does not lock
	// body scroll or trap focus: the Speed Dial remains a live sibling surface.
	useEffect(() => {
		if (!open) return;
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key !== "Escape") return;
			event.preventDefault();
			handleClose();
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleClose, open]);

	useEffect(() => {
		if (!showRoot && activePane) {
			contentRef.current?.scrollTo({ top: 0, behavior: "auto" });
		}
	}, [activePane, showRoot]);

	return (
		<div
			className="flex h-full min-h-0 min-w-0 shrink-0 justify-end overflow-hidden"
			data-settings-open={open ? "true" : "false"}
			data-settings-sidebar-slot="true"
			aria-hidden={!open}
			inert={!open}
		>
			<Sidebar
				side="right"
				variant="inset"
				collapsible="none"
				id="settings-sidebar"
				aria-label="Settings"
				data-settings-panel="true"
				className={cn("h-full min-w-0 shrink-0", SETTINGS_SIDEBAR_SHELL)}
			>
				<SidebarHeader className="p-0">
					<header
						className={cn(
							"flex h-12 shrink-0 items-center gap-3",
							SETTINGS_HEADER_INSET,
						)}
					>
						{!showRoot && (
							<button
								type="button"
								className={cn(
									"size-9",
									SETTINGS_HEADER_CONTROL,
									SETTINGS_FOCUS_RING,
								)}
								onClick={goRoot}
								aria-label="Back to Preferences"
								title="Back to Preferences"
								data-settings-ui="true"
							>
								<Icon name="chevron-left" size={17} aria-hidden="true" />
							</button>
						)}
						<div className="min-w-0 flex-1">
							<h2
								id="settings-panel-title"
								className="truncate font-semibold text-[16px] tracking-[-0.01em]"
								aria-live="polite"
							>
								{showRoot ? "Preferences" : activePaneLabel}
							</h2>
							<p className="sr-only">Klice Start preferences</p>
						</div>
						{open && (
							<SettingsTransportControl
								ref={closeControlRef}
								open
								onClick={handleClose}
								className={cn(
									SETTINGS_HEADER_TRANSPORT_CONTROL,
									SETTINGS_FOCUS_RING,
								)}
								aria-controls="settings-sidebar"
								data-settings-ui="true"
							/>
						)}
					</header>
				</SidebarHeader>

				<SidebarContent className="min-h-0 overflow-hidden px-[var(--workspace-gutter)] pt-1 pb-0">
					<div
						className={cn(
							"squircle flex min-h-0 flex-1 flex-col overflow-hidden",
							SETTINGS_CONTENT_FRAME,
							SETTINGS_RADIUS.panel,
						)}
						data-settings-ui="true"
					>
						{showRoot ? (
							<main
								className={cn(
									"settings-content-scroll scrollbar-hidden min-h-0 flex-1 overflow-y-auto",
									SETTINGS_CONTENT_PADDING,
								)}
							>
								<nav aria-label="Preference sections">
									<div className="flex flex-col gap-0.5">
										{CATEGORIES.map((category) => (
											<button
												key={category.id}
												type="button"
												onClick={() => navigateTo(category.id)}
												className={cn(
													"group flex min-h-14 w-full items-center gap-3 bg-transparent px-2 py-2 text-left transition-colors duration-150 motion-reduce:transition-none",
													SETTINGS_HOVER_WASH,
													SETTINGS_RADIUS.surface,
													SETTINGS_FOCUS_RING,
												)}
												data-settings-ui="true"
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
											</button>
										))}
									</div>
								</nav>
							</main>
						) : (
							<main
								id="settings-page-content"
								ref={contentRef}
								className={cn(
									"settings-content-scroll scrollbar-hidden min-h-0 flex-1 overflow-y-auto",
									SETTINGS_CONTENT_PADDING,
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
				</SidebarContent>
			</Sidebar>
		</div>
	);
}
