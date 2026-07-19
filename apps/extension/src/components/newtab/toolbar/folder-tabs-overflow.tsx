import { Icon } from "@perch/ui/icons/icon";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	glassDropdown,
	glassDropdownItem,
	glassInput,
	glassText,
} from "../../../lib/glass";
import { cn } from "../../../lib/utils";
import type { Folder } from "../../../types";
import { useAppearance } from "../appearance-provider";
import { ToolbarIconButton } from "./toolbar-icon-button";

interface FolderTabsOverflowProps {
	hiddenFolders: Folder[];
	activeRootId: string;
	onSelectFolder: (id: string) => void;
}

/**
 * "⋯" overflow button — same height and radius as all toolbar controls.
 */
export function FolderTabsOverflow({
	hiddenFolders,
	activeRootId,
	onSelectFolder,
}: FolderTabsOverflowProps) {
	const { isLiquid } = useAppearance();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
		null,
	);
	const menuRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const filtered = query.trim()
		? hiddenFolders.filter((f) =>
				f.name.toLowerCase().includes(query.toLowerCase()),
			)
		: hiddenFolders;

	const handleSelect = useCallback(
		(id: string) => {
			onSelectFolder(id);
			setOpen(false);
			setQuery("");
		},
		[onSelectFolder],
	);

	// Anchor the dropdown with fixed positioning off the button's viewport rect,
	// so it escapes the toolbar's overflow-hidden clip (which was breaking the
	// layout). Right-aligned to the button, since the button lives near the
	// right edge of the tab area.
	const positionMenu = useCallback(() => {
		const btn = buttonRef.current;
		if (!btn) return;
		const rect = btn.getBoundingClientRect();
		setMenuPos({ top: rect.bottom + 8, left: rect.right });
	}, []);

	useEffect(() => {
		if (!open) return;
		positionMenu();
		const id = setTimeout(() => inputRef.current?.focus(), 60);
		window.addEventListener("resize", positionMenu);
		window.addEventListener("scroll", positionMenu, true);
		return () => {
			clearTimeout(id);
			window.removeEventListener("resize", positionMenu);
			window.removeEventListener("scroll", positionMenu, true);
		};
	}, [open, positionMenu]);

	useEffect(() => {
		if (!open) return;
		function handleClick(e: MouseEvent) {
			if (
				menuRef.current &&
				!menuRef.current.contains(e.target as Node) &&
				buttonRef.current &&
				!buttonRef.current.contains(e.target as Node)
			) {
				setOpen(false);
				setQuery("");
			}
		}
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [open]);

	useEffect(() => {
		if (!open) return;
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				setOpen(false);
				setQuery("");
			}
		}
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [open]);

	return (
		<div className="shrink-0" ref={buttonRef}>
			<ToolbarIconButton
				icon="ellipsis"
				label="More folders"
				active={open}
				onClick={() => setOpen(!open)}
			/>

			{open && menuPos && (
				<div
					ref={menuRef}
					className={cn(
						"fixed z-50 min-w-[200px] max-w-[280px] -translate-x-full",
						glassDropdown(isLiquid),
					)}
					style={{
						top: menuPos.top,
						left: menuPos.left,
						maxHeight: "320px",
					}}
				>
					<div className="px-2 pb-1.5">
						<input
							ref={inputRef}
							type="text"
							placeholder="Search folders..."
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							className={cn(
								"w-full",
								glassInput(isLiquid),
								"py-1.5 text-[12px]",
							)}
						/>
					</div>

					<div className="max-h-[260px] overflow-y-auto">
						{filtered.length === 0 ? (
							<div
								className={cn(
									"px-3 py-4 text-center text-[12px]",
									glassText(isLiquid, "muted"),
								)}
							>
								No folders found
							</div>
						) : (
							filtered.map((folder) => (
								<button
									key={folder.id}
									type="button"
									onClick={() => handleSelect(folder.id)}
									className={cn(
										"flex w-full items-center gap-2",
										glassDropdownItem(isLiquid),
										folder.id === activeRootId
											? isLiquid
												? "bg-white/[0.12]"
												: "bg-muted"
											: "",
									)}
								>
									<Icon
										name="folder"
										size={14}
										className="shrink-0 opacity-60"
									/>
									<span className="truncate">{folder.name}</span>
									{folder.id === activeRootId && (
										<Icon
											name="check"
											size={13}
											className="ml-auto shrink-0 opacity-60"
										/>
									)}
								</button>
							))
						)}
					</div>
				</div>
			)}
		</div>
	);
}
