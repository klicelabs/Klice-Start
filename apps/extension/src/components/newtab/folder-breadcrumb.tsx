import { Icon } from "@perch/ui/icons/icon";
import { Fragment } from "react";
import { getBreadcrumb } from "../../lib/folder-tree";
import type { Folder } from "../../types";

interface FolderBreadcrumbProps {
	folders: Folder[];
	activeFolderId: string;
	/** Root folder id of the active branch — the crumb stops being clickable here upward. */
	onNavigate: (id: string) => void;
}

/**
 * Shows the path from the active branch's root down to the current folder.
 * Rendered only when the user has navigated into a subfolder, so the top-level
 * view stays clean.
 */
export function FolderBreadcrumb({
	folders,
	activeFolderId,
	onNavigate,
}: FolderBreadcrumbProps) {
	const crumbs = getBreadcrumb(folders, activeFolderId);
	if (crumbs.length <= 1) return null;

	return (
		<nav
			aria-label="Folder path"
			className="scrollbar-none mx-auto mb-3 flex max-w-full items-center gap-1 overflow-x-auto px-6 text-[13px]"
		>
			{crumbs.map((folder, i) => {
				const isLast = i === crumbs.length - 1;
				return (
					<Fragment key={folder.id}>
						{i > 0 && (
							<Icon
								name="chevron-right"
								size={13}
								className="shrink-0 opacity-30"
							/>
						)}
						{isLast ? (
							<span className="whitespace-nowrap font-medium text-white/80">
								{folder.name}
							</span>
						) : (
							<button
								type="button"
								onClick={() => onNavigate(folder.id)}
								className="whitespace-nowrap rounded-md px-1 text-white/50 transition-colors hover:text-white/80"
							>
								{folder.name}
							</button>
						)}
					</Fragment>
				);
			})}
		</nav>
	);
}
