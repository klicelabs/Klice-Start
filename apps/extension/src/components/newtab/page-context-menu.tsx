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
	const background = useSetupStore((s) => s.settings.background);
	const updateBackground = useSetupStore((s) => s.updateBackground);
	const [open, setOpen] = useState(false);
	const suppressNextOpen = useRef(false);

	const ensureUnsplashBackground = useCallback(() => {
		const sig = background.unsplashSig || Date.now();
		const url = background.unsplashUrl || unsplashImageUrl(sig);
		const downloadUrl =
			background.unsplashDownloadUrl || unsplashDownloadUrl(sig);
		if (background.type !== "unsplash" || !background.unsplashUrl) {
			updateBackground({
				type: "unsplash",
				unsplashSig: sig,
				unsplashUrl: url,
				unsplashDownloadUrl: downloadUrl,
			});
		}
		return { url, downloadUrl };
	}, [background, updateBackground]);

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
			unsplashLocked: !background.unsplashLocked,
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
					Editar configurações do plano de fundo
				</ContextMenuItem>
				<ContextMenuItem
					className={itemClassName}
					onClick={onOpenShortcutSettings}
				>
					<Link className={iconClassName} />
					Editar configurações de links rápidos
				</ContextMenuItem>
				<ContextMenuItem className={itemClassName} onClick={onAddQuickLink}>
					<PlusCircle className={iconClassName} />
					Adicionar novo link rápido
				</ContextMenuItem>
				<ContextMenuSeparator
					className={isLiquid ? "bg-white/10" : undefined}
				/>
				<ContextMenuItem
					className={itemClassName}
					onClick={handleDownloadBackground}
				>
					<Download className={iconClassName} />
					Baixar plano de fundo
				</ContextMenuItem>
				<ContextMenuItem className={itemClassName} onClick={handleToggleLock}>
					{background.unsplashLocked ? (
						<Unlock className={iconClassName} />
					) : (
						<Lock className={iconClassName} />
					)}
					{background.unsplashLocked
						? "Desbloquear plano de fundo atual"
						: "Bloquear plano de fundo atual"}
				</ContextMenuItem>
				<ContextMenuItem
					className={itemClassName}
					onClick={handleNextBackground}
				>
					<RefreshCw className={iconClassName} />
					Próximo plano de fundo
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
