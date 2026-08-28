import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@klice-start/ui/components/context-menu";
import { Icon } from "@klice-start/ui/icons/icon";
import {
	type MouseEvent,
	type ReactNode,
	useCallback,
	useState,
} from "react";
import { glassDropdownItem } from "../../lib/glass";
import { cn } from "../../lib/utils";
import { refreshWallpaper } from "../../services/wallpaper";
import { useImageStore } from "../../stores/image-store";
import { useSetupStore } from "../../stores/setup-store";
import { useAppearance } from "./appearance-provider";

interface PageContextMenuProps {
	children: ReactNode;
	onOpenBackgroundSettings: () => void;
	onOpenShortcutSettings: () => void;
	onAddQuickLink: () => void;
	onAddFolder?: () => void;
	onOpenGeneralSettings?: () => void;
}

export function PageContextMenu({
	children,
	onOpenBackgroundSettings,
	onAddQuickLink,
	onAddFolder,
	onOpenGeneralSettings,
}: PageContextMenuProps) {
	const { isLiquid } = useAppearance();
	const bgType = useSetupStore((s) => s.settings.background.type);
	const pexelsImageId = useSetupStore(
		(s) => s.settings.background.pexelsImageId,
	);
	const pexelsFrequency = useSetupStore(
		(s) => s.settings.background.pexelsFrequency,
	);
	const updateBackground = useSetupStore((s) => s.updateBackground);
	const getBackgroundImage = useImageStore((s) => s.getBackgroundImage);
	const [open, setOpen] = useState(false);

	const isPexels = bgType === "pexels";

	const handleDownloadBackground = useCallback(async () => {
		if (!pexelsImageId) return;
		const dataUrl = await getBackgroundImage(pexelsImageId);
		if (!dataUrl) return;
		const a = document.createElement("a");
		a.href = dataUrl;
		a.download = `klice-start-wallpaper-${pexelsImageId}.jpg`;
		a.click();
	}, [pexelsImageId, getBackgroundImage]);

	const handleToggleLock = useCallback(() => {
		if (!isPexels) return;
		if (pexelsFrequency === "locked") {
			const fallback =
				useSetupStore.getState().settings.background.pexelsPreviousFrequency ||
				"daily";
			updateBackground({
				pexelsFrequency: fallback,
				pexelsPreviousFrequency: null,
			});
			void refreshWallpaper(true);
			return;
		}
		updateBackground({
			pexelsFrequency: "locked",
			pexelsPreviousFrequency: pexelsFrequency,
		});
	}, [isPexels, pexelsFrequency, updateBackground]);

	const handleNextBackground = useCallback(async () => {
		if (!isPexels) return;
		await refreshWallpaper(true);
	}, [isPexels]);

	function handleContextMenu(event: MouseEvent) {
		// If clicking an interactive card/tab with its own context menu, skip
		const target = event.target as HTMLElement | null;
		if (target?.closest("[data-local-context-menu]")) {
			return;
		}
		setOpen(true);
	}

	const itemClassName = cn(
		"cursor-pointer gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium",
		glassDropdownItem(isLiquid),
	);

	return (
		<ContextMenu open={open} onOpenChange={setOpen}>
			<ContextMenuTrigger
				className="block min-h-screen w-full"
				onContextMenu={handleContextMenu}
				render={<div />}
			>
				{children}
			</ContextMenuTrigger>

			<ContextMenuContent
				className={cn(
					"min-w-48 rounded-xl border border-border/60 bg-popover p-1 text-popover-foreground shadow-2xl",
					isLiquid && "bg-popover/90 backdrop-blur-xl",
				)}
			>
				{onAddFolder && (
					<ContextMenuItem className={itemClassName} onClick={onAddFolder}>
						<Icon name="folder-plus" size={14} />
						New folder
					</ContextMenuItem>
				)}
				<ContextMenuItem className={itemClassName} onClick={onAddQuickLink}>
					<Icon name="plus" size={14} />
					Add link
				</ContextMenuItem>

				<ContextMenuSeparator className={isLiquid ? "bg-white/10" : undefined} />

				<ContextMenuItem
					className={itemClassName}
					onClick={onOpenBackgroundSettings}
				>
					<Icon name="settings" size={14} />
					Edit background
				</ContextMenuItem>
				<ContextMenuItem
					className={itemClassName}
					onClick={onOpenGeneralSettings ?? onOpenBackgroundSettings}
				>
					<Icon name="settings" size={14} />
					Settings
				</ContextMenuItem>

				{isPexels && (
					<>
						<ContextMenuSeparator className={isLiquid ? "bg-white/10" : undefined} />
						<ContextMenuItem
							className={itemClassName}
							onClick={handleDownloadBackground}
						>
							<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
							</svg>
							Download wallpaper
						</ContextMenuItem>
						<ContextMenuItem
							className={itemClassName}
							onClick={handleToggleLock}
						>
							<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								{pexelsFrequency === "locked" ? (
									<path d="M7 11V7a5 5 0 0 1 10 0v4M12 15v2M5 11h14v10H5z" />
								) : (
									<path d="M7 11V7a5 5 0 0 1 9.9-1M12 15v2M5 11h14v10H5z" />
								)}
							</svg>
							{pexelsFrequency === "locked"
								? "Unlock wallpaper"
								: "Lock wallpaper"}
						</ContextMenuItem>
						<ContextMenuItem
							className={itemClassName}
							onClick={handleNextBackground}
						>
							<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
							</svg>
							Next wallpaper
						</ContextMenuItem>
					</>
				)}
			</ContextMenuContent>
		</ContextMenu>
	);
}
