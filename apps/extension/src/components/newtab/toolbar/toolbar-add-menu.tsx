import { Icon } from "@klice-start/ui/icons/icon";
import { useCallback, useEffect, useRef } from "react";
import { glassDropdown, glassDropdownItem } from "../../../lib/glass";
import { cn } from "../../../lib/utils";
import { useAppearance } from "../appearance-provider";

interface ToolbarAddMenuProps {
	/** Whether the menu is open (controlled by parent). */
	open: boolean;
	/** Close the menu. */
	onClose: () => void;
	/** Open the add-favorite dialog. */
	onAddFavorite: () => void;
	/** Open the add-folder dialog. */
	onAddFolder: () => void;
}

/**
 * Dropdown menu for the "+" button. Positioned absolutely relative to
 * the trailing actions group. Two items: New Favorite, New Folder.
 */
export function ToolbarAddMenu({
	open,
	onClose,
	onAddFavorite,
	onAddFolder,
}: ToolbarAddMenuProps) {
	const { isLiquid } = useAppearance();
	const menuRef = useRef<HTMLDivElement>(null);

	const handleSelect = useCallback(
		(action: "favorite" | "folder") => {
			onClose();
			if (action === "favorite") onAddFavorite();
			else onAddFolder();
		},
		[onClose, onAddFavorite, onAddFolder],
	);

	useEffect(() => {
		if (!open) return;
		function handleClick(e: MouseEvent) {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onClose();
			}
		}
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [open, onClose]);

	useEffect(() => {
		if (!open) return;
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div
			ref={menuRef}
			className={cn(
				"absolute top-full right-0 z-50 mt-2 min-w-[170px]",
				glassDropdown(isLiquid),
			)}
		>
			<button
				type="button"
				onClick={() => handleSelect("favorite")}
				className={cn(
					"flex w-full items-center gap-2.5",
					glassDropdownItem(isLiquid),
				)}
			>
				<Icon name="bookmark" size={15} className="shrink-0 opacity-70" />
				<span>New Favorite</span>
			</button>
			<button
				type="button"
				onClick={() => handleSelect("folder")}
				className={cn(
					"flex w-full items-center gap-2.5",
					glassDropdownItem(isLiquid),
				)}
			>
				<Icon name="folder-plus" size={15} className="shrink-0 opacity-70" />
				<span>New Folder</span>
			</button>
		</div>
	);
}
