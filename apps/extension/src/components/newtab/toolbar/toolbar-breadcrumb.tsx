import { glassText } from "../../../lib/glass";
import { cn } from "../../../lib/utils";
import type { Folder } from "../../../types";
import { useAppearance } from "../appearance-provider";

interface ToolbarBreadcrumbProps {
	crumbs: Folder[];
	onNavigate: (id: string) => void;
}

/**
 * Smart, anti-overflow breadcrumb (Apple toolbar leading pattern).
 *
 * Renders AT MOST two folder names: the immediately-previous folder and the
 * current folder. If deeper history exists, a leading "…" indicates hidden
 * levels and navigates one step above the previous folder.
 *
 *   … ›  Previous  ›  Current
 *
 * Every label truncates so the leading area can never push the center off.
 */
export function ToolbarBreadcrumb({
	crumbs,
	onNavigate,
}: ToolbarBreadcrumbProps) {
	const { isLiquid } = useAppearance();

	// Need at least a parent + current to show anything.
	if (crumbs.length <= 1) return null;

	const current = crumbs[crumbs.length - 1];
	const previous = crumbs[crumbs.length - 2];
	// Anything above "previous" is collapsed behind the ellipsis.
	const hidden = crumbs.length > 2;
	const hiddenTarget = crumbs[crumbs.length - 3];

	return (
		<nav
			aria-label="Breadcrumb"
			className="flex min-w-0 items-center gap-1 text-[13px] leading-none"
		>
			{hidden && (
				<>
					<button
						type="button"
						onClick={() => hiddenTarget && onNavigate(hiddenTarget.id)}
						className={cn(
							"shrink-0 cursor-pointer px-0.5 tracking-wide transition-colors",
							glassText(isLiquid, "muted"),
							isLiquid ? "hover:text-white/80" : "hover:text-foreground",
						)}
						aria-label="Show parent folders"
					>
						…
					</button>
					<Separator isLiquid={isLiquid} />
				</>
			)}

			<button
				type="button"
				onClick={() => onNavigate(previous.id)}
				className={cn(
					"min-w-0 max-w-[72px] shrink cursor-pointer truncate transition-colors",
					glassText(isLiquid, "muted"),
					isLiquid ? "hover:text-white/80" : "hover:text-foreground",
				)}
				title={previous.name}
			>
				{previous.name}
			</button>

			<Separator isLiquid={isLiquid} />

			<span
				className={cn(
					"min-w-0 max-w-[96px] shrink-0 truncate font-medium",
					glassText(isLiquid, "primary"),
				)}
				title={current.name}
			>
				{current.name}
			</span>
		</nav>
	);
}

function Separator({ isLiquid }: { isLiquid: boolean }) {
	return (
		<span
			aria-hidden="true"
			className={cn("shrink-0 select-none", glassText(isLiquid, "muted"))}
		>
			›
		</span>
	);
}
