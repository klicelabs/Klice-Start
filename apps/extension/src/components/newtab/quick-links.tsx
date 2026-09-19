import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@klice-start/ui/components/motion/context-menu";
import { Icon } from "@klice-start/ui/icons/icon";
import { useState } from "react";
import { glassDropdownItem, glassFocusRing, glassMenu } from "../../lib/glass";
import { faviconUrl } from "../../lib/url";
import { cn } from "../../lib/utils";
import { useSetupStore } from "../../stores/setup-store";
import type { QuickLink } from "../../types";
import { useAppearance } from "./appearance-provider";
import { ICON_MODE_SURFACE_CLASS, IconModeTile } from "./icon-mode-tile";
import { QuickLinkEditorDialog } from "./quick-link-editor-dialog";

/**
 * Small launch rail between the hero and bookmark grid. Every item uses the
 * Icon mode tile primitive and the same local context-menu contract as cards.
 */
export function QuickLinks() {
	const { isLiquid, resolvedDark } = useAppearance();
	const quickLinks = useSetupStore((state) => state.settings.quickLinks);
	const openInNewTab = useSetupStore((state) => state.settings.openInNewTab);
	const updateQuickLink = useSetupStore((state) => state.updateQuickLink);
	const removeQuickLink = useSetupStore((state) => state.removeQuickLink);
	const [editingLink, setEditingLink] = useState<QuickLink | null>(null);

	if (!quickLinks.enabled || quickLinks.items.length === 0) return null;

	function openLink(link: QuickLink) {
		if (openInNewTab) {
			window.open(link.url, "_blank", "noopener,noreferrer");
			return;
		}
		window.location.assign(link.url);
	}

	return (
		<>
			<nav
				aria-label="Quick links"
				className="speed-dial-quick-links"
				data-quick-links="true"
			>
				<div className="scrollbar-hidden flex max-w-full gap-2 overflow-x-auto px-1 py-1.5 sm:gap-2.5">
					{quickLinks.items.map((link) => (
						<ContextMenu key={link.id}>
							<ContextMenuTrigger>
								<a
									data-local-context-menu
									href={link.url}
									target={openInNewTab ? "_blank" : "_self"}
									rel={openInNewTab ? "noopener noreferrer" : undefined}
									aria-label={link.label}
									data-quick-link-id={link.id}
									className={cn(
										"quick-link-icon",
										ICON_MODE_SURFACE_CLASS,
										glassFocusRing(isLiquid),
									)}
								>
									<IconModeTile url={link.url} favicon={faviconUrl(link.url)} />
								</a>
							</ContextMenuTrigger>

							<ContextMenuContent className={glassMenu(isLiquid, resolvedDark)}>
								<ContextMenuItem
									className={glassDropdownItem(isLiquid, resolvedDark, {
										pillOwned: true,
									})}
									onSelect={() => openLink(link)}
								>
									<Icon name="globe" size={14} />
									Open link
								</ContextMenuItem>
								<ContextMenuItem
									className={glassDropdownItem(isLiquid, resolvedDark, {
										pillOwned: true,
									})}
									onSelect={() => setEditingLink(link)}
								>
									<Icon name="pencil" size={14} />
									Edit link
								</ContextMenuItem>
								<ContextMenuSeparator />
								<ContextMenuItem
									className={glassDropdownItem(isLiquid, resolvedDark, {
										pillOwned: true,
									})}
									tone="destructive"
									onSelect={() => removeQuickLink(link.id)}
								>
									<Icon name="trash" size={14} />
									Remove from Quick Links
								</ContextMenuItem>
							</ContextMenuContent>
						</ContextMenu>
					))}
				</div>
			</nav>

			<QuickLinkEditorDialog
				open={editingLink !== null}
				link={editingLink}
				isLiquid={isLiquid}
				onOpenChange={(open) => {
					if (!open) setEditingLink(null);
				}}
				onSave={(changes) => {
					if (editingLink) updateQuickLink(editingLink.id, changes);
				}}
			/>
		</>
	);
}
