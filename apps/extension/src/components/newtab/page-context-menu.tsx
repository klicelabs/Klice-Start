import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@klice-start/ui/components/context-menu";
import { glassVariantStyles } from "@klice-start/ui/lib/glass-variants";
import {
	Download,
	Link,
	Lock,
	PlusCircle,
	RefreshCw,
	Sliders,
	Unlock,
} from "lucide-react";
import {
	type MouseEvent,
	type ReactNode,
	useCallback,
	useRef,
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
}

const LOCAL_CONTEXT_SELECTOR = "[data-local-context-menu]";

export function PageContextMenu({
	children,
	onOpenBackgroundSettings,
	onOpenShortcutSettings,
	onAddQuickLink,
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
	const suppressNextOpen = useRef(false);

	const isPexels = bgType === "pexels";

	const handleDownloadBackground = useCallback(async () => {
		if (pexelsImageId) {
			const dataUrl = await getBackgroundImage(pexelsImageId);
			if (dataUrl) {
				const a = document.createElement("a");
				a.href = dataUrl;
				a.download = `klice-start-wallpaper-${Date.now()}.jpg`;
				a.click();
			}
		}
	}, [pexelsImageId, getBackgroundImage]);

	const handleToggleLock = useCallback(() => {
		if (isPexels) {
			const isLocked = pexelsFrequency === "locked";
			updateBackground({
				pexelsFrequency: isLocked
					? useSetupStore.getState().settings.background
							.pexelsPreviousFrequency || "daily"
					: "locked",
				pexelsPreviousFrequency: isLocked ? null : pexelsFrequency,
			});
		} else {
			updateBackground({ type: "pexels", pexelsFrequency: "per-tab" });
		}
	}, [isPexels, pexelsFrequency, updateBackground]);

	const handleNextBackground = useCallback(async () => {
		if (!isPexels) {
			updateBackground({ type: "pexels", pexelsFrequency: "per-tab" });
		}
		await refreshWallpaper(true);
	}, [isPexels, updateBackground]);

	function handleContextMenu(event: MouseEvent) {
		const target = event.target as Element | null;
		if (target?.closest(LOCAL_CONTEXT_SELECTOR)) {
			suppressNextOpen.current = true;
			setOpen(false);
			return;
		}
		suppressNextOpen.current = false;
	}

	function handleOpenChange(nextOpen: boolean) {
		if (nextOpen && suppressNextOpen.current) {
			setOpen(false);
			suppressNextOpen.current = false;
			return;
		}
		setOpen(nextOpen);
	}

	const itemClassName = cn(
		"cursor-pointer gap-3 rounded-xl px-3 py-2.5 text-[13px]",
		glassDropdownItem(isLiquid),
	);
	const iconClassName = cn(
		"size-4",
		isLiquid ? "text-white/70" : "text-muted-foreground",
	);

	return (
		<ContextMenu open={open} onOpenChange={handleOpenChange}>
			{/* w-full, never a viewport-width unit: viewport units ignore the
			    scrollbar gutter reserved by `scrollbar-gutter: stable` and overflow
			    horizontally on Firefox/Zen (classic, non-overlay scrollbars). */}
			<ContextMenuTrigger
				className="block min-h-screen w-full"
				onContextMenu={handleContextMenu}
				render={<div />}
			>
				{children}
			</ContextMenuTrigger>

			<ContextMenuContent
				className={cn(
					"min-w-80 rounded-2xl p-1.5",
					isLiquid
						? cn(
								glassVariantStyles.liquid,
								"border-white/[0.16] bg-white/[0.11] text-white shadow-2xl shadow-black/25 backdrop-blur-md",
								"[--liquid-glass-rim-dark:rgba(0,0,0,0.24)] [--liquid-glass-rim-light:rgba(255,255,255,0.45)] [--liquid-glass-rim-width:0.75px]",
							)
						: "border border-border bg-popover text-popover-foreground shadow-lg before:hidden",
				)}
			>
				<ContextMenuItem
					className={itemClassName}
					onClick={onOpenBackgroundSettings}
				>
					<Sliders className={iconClassName} />
					Edit background settings
				</ContextMenuItem>
				<ContextMenuItem
					className={itemClassName}
					onClick={onOpenShortcutSettings}
				>
					<Link className={iconClassName} />
					Edit shortcut settings
				</ContextMenuItem>
				<ContextMenuItem className={itemClassName} onClick={onAddQuickLink}>
					<PlusCircle className={iconClassName} />
					Add new quick link
				</ContextMenuItem>
				<ContextMenuSeparator
					className={isLiquid ? "bg-white/10" : undefined}
				/>
				{isPexels && (
					<>
						<ContextMenuItem
							className={itemClassName}
							onClick={handleDownloadBackground}
						>
							<Download className={iconClassName} />
							Download background
						</ContextMenuItem>
						<ContextMenuItem
							className={itemClassName}
							onClick={handleToggleLock}
						>
							{pexelsFrequency === "locked" ? (
								<Unlock className={iconClassName} />
							) : (
								<Lock className={iconClassName} />
							)}
							{pexelsFrequency === "locked"
								? "Unlock current background"
								: "Lock current background"}
						</ContextMenuItem>
						<ContextMenuItem
							className={itemClassName}
							onClick={handleNextBackground}
						>
							<RefreshCw className={iconClassName} />
							Next background
						</ContextMenuItem>
					</>
				)}
			</ContextMenuContent>
		</ContextMenu>
	);
}
