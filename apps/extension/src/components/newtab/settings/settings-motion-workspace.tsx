import { SidebarProvider } from "@klice-start/ui/components/sidebar";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import {
	settingsMotionStore,
	useSettingsMotionStore,
} from "../../../stores/settings-motion-store";
import { SettingsSidebar } from "./settings-sidebar";

type SettingsMotionWorkspaceProps = {
	children: ReactNode;
};

/** Owns the shell phase so Home's App tree does not rerender for motion. */
export function SettingsMotionWorkspace({
	children,
}: SettingsMotionWorkspaceProps) {
	const phase = useSettingsMotionStore((state) => state.phase);
	const layoutOpen = phase !== "closed";

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
			className={`settings-workspace h-screen min-h-screen w-screen min-w-0 overflow-hidden bg-neutral-100 dark:bg-[#252525] ${layoutOpen ? "p-[var(--workspace-gutter)]" : "p-0"}`}
			data-settings-layout-open={layoutOpen ? "true" : "false"}
		>
			{children}
		</SidebarProvider>
	);
}

export function SettingsMotionFrame({
	children,
	...props
}: ComponentProps<"div">) {
	const open = useSettingsMotionStore((state) => state.phase !== "closed");

	return (
		<div {...props} data-settings-open={open ? "true" : "false"}>
			{children}
		</div>
	);
}

export function SettingsMotionSidebar() {
	const phase = useSettingsMotionStore((state) => state.phase);
	const pane = useSettingsMotionStore((state) => state.pane);
	const action = useSettingsMotionStore((state) => state.action);

	return (
		<SettingsSidebar
			open={phase === "open"}
			layoutOpen={phase !== "closed"}
			onClose={() => settingsMotionStore.getState().close()}
			onCloseComplete={() => settingsMotionStore.getState().finishClose()}
			initialPane={pane}
			initialAction={action}
		/>
	);
}
