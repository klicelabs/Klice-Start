import { faviconUrl } from "../../lib/url";
import { useSetupStore } from "../../stores/setup-store";
import { IconAppTile } from "./icon-app-tile";

/**
 * Small, intentionally quiet launch rail between the hero and bookmark grid.
 * Items live in Settings.quickLinks so a future editor can reorder or replace
 * them without changing this renderer.
 */
export function QuickLinks() {
	const quickLinks = useSetupStore((state) => state.settings.quickLinks);
	const openInNewTab = useSetupStore((state) => state.settings.openInNewTab);

	if (!quickLinks.enabled || quickLinks.items.length === 0) return null;

	return (
		<nav
			aria-label="Quick links"
			className="speed-dial-quick-links"
			data-quick-links="true"
		>
			<div className="scrollbar-hidden flex max-w-full gap-2 overflow-x-auto px-1 py-1.5 sm:gap-2.5">
				{quickLinks.items.map((link) => (
					<a
						key={link.id}
						href={link.url}
						target={openInNewTab ? "_blank" : "_self"}
						rel={openInNewTab ? "noopener noreferrer" : undefined}
						aria-label={link.label}
						data-quick-link-id={link.id}
						className="group squircle flex size-11 shrink-0 items-center justify-center rounded-[14px] border border-foreground/[0.07] bg-foreground/[0.045] p-1 shadow-[0_2px_10px_rgb(0_0_0_/_0.06)] transition-[background-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:bg-foreground/[0.09] hover:shadow-[0_5px_16px_rgb(0_0_0_/_0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--klice-accent)] active:scale-[0.96] motion-reduce:transition-none"
					>
						<IconAppTile
							url={link.url}
							favicon={faviconUrl(link.url)}
							mini
							className="opacity-90 transition-opacity duration-150 [--icon-radius:10px] group-hover:opacity-100"
						/>
					</a>
				))}
			</div>
		</nav>
	);
}
