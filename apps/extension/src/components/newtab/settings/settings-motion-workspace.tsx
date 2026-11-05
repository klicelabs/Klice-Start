import { SidebarProvider } from "@klice-start/ui/components/sidebar";
import {
	type ComponentProps,
	type CSSProperties,
	type ReactNode,
	useCallback,
	useEffect,
} from "react";
import {
	isSettingsLayoutOpen,
	isSettingsMotionActive,
	settingsMotionStore,
	useSettingsMotionStore,
} from "../../../stores/settings-motion-store";
import { BackgroundLayer } from "../background-layer";
import { SettingsSidebar } from "./settings-sidebar";

type SettingsMotionWorkspaceProps = {
	children: ReactNode;
};

/** Owns the shell phase so Home's App tree does not rerender for motion. */
export function SettingsMotionWorkspace({
	children,
}: SettingsMotionWorkspaceProps) {
	const phase = useSettingsMotionStore((state) => state.phase);
	const layoutOpen = isSettingsLayoutOpen(phase);

	return (
		// SidebarProvider is intentionally uncontrolled here. Its generic open
		// context wraps Home; changing it would propagate through the full grid.
		// The Settings shell owns its phase through data attributes instead.
		<SidebarProvider
			style={
				{
					"--sidebar-width": "var(--settings-sidebar-width)",
				} as CSSProperties
			}
			className="settings-workspace relative h-screen min-h-screen w-screen min-w-0 overflow-hidden bg-neutral-100 dark:bg-[#252525]"
			data-settings-layout-open={layoutOpen ? "true" : "false"}
			data-settings-motion-active={
				isSettingsMotionActive(phase) ? "true" : "false"
			}
		>
			{children}
		</SidebarProvider>
	);
}

export function SettingsMotionFrame({
	children,
	...props
}: ComponentProps<"div">) {
	const phase = useSettingsMotionStore((state) => state.phase);
	const open = isSettingsLayoutOpen(phase);

	return (
		<div {...props} data-settings-open={open ? "true" : "false"}>
			<BackgroundLayer contained />
			{children}
		</div>
	);
}

export function SettingsMotionSidebar() {
	const phase = useSettingsMotionStore((state) => state.phase);
	const pane = useSettingsMotionStore((state) => state.pane);
	const action = useSettingsMotionStore((state) => state.action);
	const finishOpen = useCallback(
		() => settingsMotionStore.getState().finishOpen(),
		[],
	);
	useEffect(() => {
		if (phase !== "opening") return;
		const timeout = window.setTimeout(finishOpen, 400);
		return () => window.clearTimeout(timeout);
	}, [finishOpen, phase]);

	// P2 (perf/p2-unmount-overlays): unmount the whole settings subtree
	// while closed. Re-mounts (chunk already cached) on every open —
	// measured: 1st open −30% window, no warm-reopen regression (§6.6).
	// (Computed before the early return so narrowing can't desync it.)
	const layoutOpen = isSettingsLayoutOpen(phase);
	if (phase === "closed") return null;

	return (
		<SettingsSidebar
			open={isSettingsLayoutOpen(phase)}
			layoutOpen={layoutOpen}
			onOpenComplete={finishOpen}
			onClose={() => settingsMotionStore.getState().close()}
			onCloseComplete={() => settingsMotionStore.getState().finishClose()}
			initialPane={pane}
			initialAction={action}
		/>
	);
}
