import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@perch/ui/components/context-menu";
import { glassVariantStyles } from "@perch/ui/lib/glass-variants";
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
import { unsplashDownloadUrl, unsplashImageUrl } from "../../lib/unsplash";
import { cn } from "../../lib/utils";
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
	const bgUnsplashSig = useSetupStore(
		(s) => s.settings.background.unsplashSig,
	);
	const bgUnsplashUrl = useSetupStore(
		(s) => s.settings.background.unsplashUrl,
	);
	const bgUnsplashDownloadUrl = useSetupStore(
		(s) => s.settings.background.unsplashDownloadUrl,
	);
	const bgUnsplashLocked = useSetupStore(
		(s) => s.settings.background.unsplashLocked,
	);
	const updateBackground = useSetupStore((s) => s.updateBackground);
	const [open, setOpen] = useState(false);
	const suppressNextOpen = useRef(false);

	const ensureUnsplashBackground = useCallback(() => {
		const sig = bgUnsplashSig || Date.now();
		const url = bgUnsplashUrl || unsplashImageUrl(sig);
		const downloadUrl = bgUnsplashDownloadUrl || unsplashDownloadUrl(sig);
		if (bgType !== "unsplash" || !bgUnsplashUrl) {
			updateBackground({
				type: "unsplash",
				unsplashSig: sig,
				unsplashUrl: url,
				unsplashDownloadUrl: downloadUrl,
			});
		}
		return { url, downloadUrl };
	}, [bgType, bgUnsplashSig, bgUnsplashUrl, bgUnsplashDownloadUrl, updateBackground]);

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

	function handleDownloadBackground() {
		const { downloadUrl } = ensureUnsplashBackground();
		window.open(downloadUrl, "_blank", "noopener,noreferrer");
	}

	function handleToggleLock() {
		const { url, downloadUrl } = ensureUnsplashBackground();
		updateBackground({
			type: "unsplash",
			unsplashLocked: !bgUnsplashLocked,
			unsplashUrl: url,
			unsplashDownloadUrl: downloadUrl,
		});
	}

	function handleNextBackground() {
		const sig = Date.now();
		updateBackground({
			type: "unsplash",
			unsplashSig: sig,
			unsplashUrl: unsplashImageUrl(sig),
			unsplashDownloadUrl: unsplashDownloadUrl(sig),
		});
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
			<ContextMenuTrigger
				className="block h-screen w-screen"
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
				<ContextMenuItem
					className={itemClassName}
					onClick={handleDownloadBackground}
				>
					<Download className={iconClassName} />
					Download background
				</ContextMenuItem>
				<ContextMenuItem className={itemClassName} onClick={handleToggleLock}>
					{bgUnsplashLocked ? (
						<Unlock className={iconClassName} />
					) : (
						<Lock className={iconClassName} />
					)}
					{bgUnsplashLocked
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
			</ContextMenuContent>
		</ContextMenu>
	);
}
