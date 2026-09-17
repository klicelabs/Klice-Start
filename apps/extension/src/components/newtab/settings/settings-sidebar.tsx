import { LiquidGlass } from "@klice-start/ui/components/liquid-glass";
import {
	Sidebar,
	SidebarContent,
	SidebarHeader,
} from "@klice-start/ui/components/sidebar";
import type { IconName } from "@klice-start/ui/icons/icon";
import { Icon } from "@klice-start/ui/icons/icon";
import { DURATION, EASE } from "@klice-start/ui/lib/motion";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	glassForeground,
	glassLensVeil,
	glassLiquidProps,
	glassShape,
} from "../../../lib/glass";
import { cn } from "../../../lib/utils";
import { useAppearance, useGlassAppearance } from "../appearance-provider";
import { AdvancedPane } from "./panes/advanced-pane";
import { AppearancePane } from "./panes/appearance-pane";
import { BookmarksPane } from "./panes/bookmarks-pane";
import { GeneralPane } from "./panes/general-pane";
import { SettingsRootPane } from "./panes/root-settings-pane";
import { SearchPane } from "./panes/search-pane";
import { WallpaperPane } from "./panes/wallpaper-pane";
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
	SETTINGS_SIDEBAR_SHELL,
} from "./shared/settings-tokens";

/**
 * Settings lives in the app's shared layout, not in a portal. The layout slot
 * reserves space atomically while the already-mounted panel enters on its
 * compositor-friendly transform path.
 */

/**
 * Settings header chrome (Back / Close). The Settings BODY stays Flat, but
 * the chrome follows the material mode at the shared 34px toolbar geometry:
 * a Glass hero control in Glass mode, the quiet Flat control otherwise.
 * One focus language (accent ring) in both — never a stacked ring + wash.
 */
function SettingsChromeButton({
	icon,
	label,
	onClick,
	buttonRef,
}: {
	icon: IconName;
	label: string;
	onClick: () => void;
	buttonRef?: React.Ref<HTMLButtonElement>;
}) {
	const { isLiquid, resolvedDark } = useAppearance();
	const { glassParams } = useGlassAppearance();
	const glyph = (
		<Icon name={icon} size={17} strokeWidth={1.5} aria-hidden="true" />
	);

	if (isLiquid) {
		const optics = glassLiquidProps(glassParams, "clear");
		return (
			<LiquidGlass
				blur={optics.blur}
				refract
				refraction={optics.refraction}
				saturation={optics.saturation}
				brightness={optics.brightness}
				bezel={optics.bezel}
				shape="toolbarIcon"
				className={cn(
					"size-[34px] shrink-0",
					glassLensVeil("hero", resolvedDark),
				)}
			>
				<button
					ref={buttonRef}
					type="button"
					onClick={onClick}
					aria-label={label}
					title={label}
					data-settings-ui="true"
					className={cn(
						"flex size-full items-center justify-center bg-transparent transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96]",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--klice-accent)]",
						glassForeground(),
						"hover:bg-foreground/[0.10] hover:text-[var(--klice-glass-foreground-primary)] active:bg-foreground/15",
					)}
				>
					{glyph}
				</button>
			</LiquidGlass>
		);
	}

	return (
		<button
			ref={buttonRef}
			type="button"
			className={cn(
				"size-[34px]",
				SETTINGS_HEADER_CONTROL,
				SETTINGS_FOCUS_RING,
			)}
			onClick={onClick}
			aria-label={label}
			title={label}
			data-settings-ui="true"
		>
			{glyph}
		</button>
	);
}
export function SettingsSidebar({
	open,
	layoutOpen = open,
	onClose,
	onLayoutTransitionEnd,
	initialPane,
	initialAction,
}: SettingsSidebarProps) {
	const [navigation, setNavigation] = useState<SettingsNavigationState>(() =>
		createSettingsNavigation(initialPane),
	);
	const [paneDirection, setPaneDirection] = useState<1 | -1>(1);
	const reduceMotion = useReducedMotion() ?? false;
	const contentRef = useRef<HTMLElement>(null);
	const rootScrollTopRef = useRef(0);
	const closeControlRef = useRef<HTMLButtonElement>(null);
	const wasOpenRef = useRef(open);
	const restoreFocusRef = useRef(false);

	useEffect(() => {
		if (!open) return;
		rootScrollTopRef.current = 0;
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

	const navigateTo = useCallback(
		(pane: SettingsPaneId) => {
			if (showRoot) {
				rootScrollTopRef.current = contentRef.current?.scrollTop ?? 0;
			}
			setPaneDirection(1);
			setNavigation((state) => pushSettingsNavigation(state, pane));
		},
		[showRoot],
	);

	const goRoot = useCallback(() => {
		setPaneDirection(-1);
		setNavigation((state) => stepSettingsNavigation(state, "back"));
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
			// A focused unified Search owns Escape first. Let it collapse its
			// floating result surface without dismissing the sibling sidebar.
			if (event.defaultPrevented) return;
			event.preventDefault();
			handleClose();
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleClose, open]);

	useEffect(() => {
		const frame = requestAnimationFrame(() => {
			if (showRoot) {
				contentRef.current?.scrollTo({
					top: rootScrollTopRef.current,
					behavior: "auto",
				});
				return;
			}
			if (activePane) {
				contentRef.current?.scrollTo({ top: 0, behavior: "auto" });
			}
		});
		return () => cancelAnimationFrame(frame);
	}, [activePane, showRoot]);

	const handleLayoutTransitionEnd = useCallback(
		(event: React.TransitionEvent<HTMLElement>) => {
			if (
				event.target === event.currentTarget &&
				event.propertyName === "transform"
			) {
				onLayoutTransitionEnd?.();
			}
		},
		[onLayoutTransitionEnd],
	);

	useEffect(() => {
		if (!open && reduceMotion) onLayoutTransitionEnd?.();
	}, [onLayoutTransitionEnd, open, reduceMotion]);

	return (
		<div
			className="flex h-full min-h-0 min-w-0 shrink-0 justify-end overflow-hidden"
			data-settings-open={open ? "true" : "false"}
			data-settings-layout-open={layoutOpen ? "true" : "false"}
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
				onTransitionEnd={handleLayoutTransitionEnd}
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
							<SettingsChromeButton
								icon="chevron-left"
								label="Back to Preferences"
								onClick={goRoot}
							/>
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
							<SettingsChromeButton
								icon="x"
								label="Close preferences"
								buttonRef={closeControlRef}
								onClick={handleClose}
							/>
						)}
					</header>
				</SidebarHeader>

				<SidebarContent className="min-h-0 overflow-hidden px-[var(--workspace-gutter)] pt-1 pb-0">
					<div
						className={cn(
							"flex min-h-0 flex-1 flex-col overflow-hidden",
							glassShape("panel"),
							SETTINGS_CONTENT_FRAME,
						)}
						data-settings-ui="true"
					>
						<main
							id="settings-page-content"
							ref={contentRef}
							className={cn(
								"settings-content-scroll scrollbar-hidden min-h-0 flex-1 overflow-y-auto",
								SETTINGS_CONTENT_PADDING,
							)}
							aria-labelledby="settings-panel-title"
						>
							<div className="grid min-h-0 w-full">
								<AnimatePresence
									initial={false}
									mode="popLayout"
									custom={paneDirection}
								>
									{showRoot ? (
										<motion.div
											key="settings-root"
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
											className="w-full [grid-area:1/1]"
											data-settings-root="true"
										>
											<SettingsRootPane onNavigate={navigateTo} />
										</motion.div>
									) : (
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
											className="w-full [grid-area:1/1]"
										>
											{activePane === "general" && <GeneralPane />}
											{activePane === "appearance" && (
												<AppearancePane
													onOpenWallpaper={() => navigateTo("wallpaper")}
												/>
											)}
											{activePane === "wallpaper" && <WallpaperPane />}
											{activePane === "search" && <SearchPane />}
											{activePane === "bookmarks" && (
												<BookmarksPane initialAction={initialAction} />
											)}
											{activePane === "advanced" && (
												<AdvancedPane onCloseParent={onClose} />
											)}
										</motion.div>
									)}
								</AnimatePresence>
							</div>
						</main>
					</div>
				</SidebarContent>
			</Sidebar>
		</div>
	);
}
