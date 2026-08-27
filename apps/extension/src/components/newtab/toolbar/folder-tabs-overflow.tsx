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
	onAddFolder: (name: string) => string;
}

/**
 * "⋯" overflow button — same height and radius as all toolbar controls.
 */
export function FolderTabsOverflow({
	hiddenFolders,
	activeRootId,
	onSelectFolder,
	onAddFolder,
}: FolderTabsOverflowProps) {
	const { isLiquid } = useAppearance();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [creating, setCreating] = useState(false);
	const [newName, setNewName] = useState("");
	const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
		null,
	);
	const menuRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const createInputRef = useRef<HTMLInputElement>(null);

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

	const handleCreate = useCallback(() => {
		const name = newName.trim();
		if (!name) return;
		const id = onAddFolder(name);
		setCreating(false);
		setNewName("");
		setQuery("");
		onSelectFolder(id);
		setOpen(false);
	}, [newName, onAddFolder, onSelectFolder]);

	useEffect(() => {
		if (!creating) return;
		const id = setTimeout(() => createInputRef.current?.focus(), 30);
		return () => clearTimeout(id);
	}, [creating]);

	const closeMenu = useCallback(() => {
		setOpen(false);
		setQuery("");
		setCreating(false);
		setNewName("");
	}, []);

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
				closeMenu();
			}
		}
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [open, closeMenu]);

	useEffect(() => {
		if (!open) return;
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				closeMenu();
			}
		}
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [open, closeMenu]);

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
						"fixed z-50 flex min-w-[200px] max-w-[280px] -translate-x-full flex-col",
						glassDropdown(isLiquid),
					)}
					style={{
						top: menuPos.top,
						left: menuPos.left,
						maxHeight: "320px",
					}}
				>
					<div className="flex flex-col gap-1.5 p-1.5">
						<div className="flex items-center gap-1.5">
							<input
								ref={inputRef}
								type="text"
								placeholder="Search folders..."
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								className={cn(
									"h-8 min-w-0 flex-1",
									glassInput(isLiquid),
									"rounded-lg px-2.5 py-0 text-[13px]",
								)}
							/>
							<button
								type="button"
								aria-label="New folder"
								aria-expanded={creating}
								onClick={() => {
									setQuery("");
									setNewName("");
									setCreating(true);
								}}
								className={cn(
									"flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
									isLiquid
										? "text-white/70 hover:bg-white/[0.12] hover:text-white active:bg-white/20"
										: "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-accent",
								)}
							>
								<Icon name="plus" size={15} />
							</button>
						</div>

						{creating && (
							<input
								ref={createInputRef}
								type="text"
								placeholder="Folder name"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										handleCreate();
									} else if (e.key === "Escape") {
										e.stopPropagation();
										setCreating(false);
										setNewName("");
									}
								}}
								onBlur={() => {
									setCreating(false);
									setNewName("");
								}}
								className={cn(
									"h-8 w-full min-w-0",
									glassInput(isLiquid),
									"rounded-lg px-2.5 py-0 text-[13px]",
								)}
							/>
						)}
					</div>

					<div className="max-h-[260px] min-h-0 flex-1 overflow-y-auto">
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
