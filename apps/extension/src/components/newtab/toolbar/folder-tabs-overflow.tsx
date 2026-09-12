import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@klice-start/ui/components/input-group";
import { Icon } from "@klice-start/ui/icons/icon";
import { useCallback, useEffect, useRef, useState } from "react";
import { resolveDragRef, setActiveDrag } from "../../../lib/dnd";
import {
	glassDropdown,
	glassDropdownItem,
	glassField,
	glassText,
} from "../../../lib/glass";
import { cn } from "../../../lib/utils";
import { useRenameStore } from "../../../stores/rename-store";
import { useSetupStore } from "../../../stores/setup-store";
import type { Folder } from "../../../types";
import { InlineRenameInput } from "../../shared/inline-rename-input";
import { useAppearance } from "../appearance-provider";
import { ToolbarIconButton } from "./toolbar-icon-button";

interface FolderTabsOverflowProps {
	hiddenFolders: Folder[];
	activeRootId: string;
	onSelectFolder: (id: string) => void;
	onAddFolder: (name: string) => string;
	onDropCards?: (cardId: string, folderId: string) => void;
	onMoveFolders?: (folderId: string, targetFolderId: string) => void;
	canNestFolder?: (folderId: string, targetFolderId: string) => boolean;
}

/**
 * "⋯" overflow button — same height and radius as all toolbar controls.
 *
 * The top input is reused for folder creation: pressing "+" switches the
 * SAME field into create mode (placeholder + behavior change) instead of
 * stacking a second input underneath. The "+" morphs into a confirm check
 * once a non-empty name is typed.
 */
export function FolderTabsOverflow({
	hiddenFolders,
	activeRootId,
	onSelectFolder,
	onAddFolder,
	onDropCards,
	onMoveFolders,
	canNestFolder,
}: FolderTabsOverflowProps) {
	const { isLiquid } = useAppearance();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [creating, setCreating] = useState(false);
	const [newName, setNewName] = useState("");
	const [dropId, setDropId] = useState<string | null>(null);
	// Briefly highlights a just-created folder so it is immediately visible
	// in the list.
	const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
	const listRef = useRef<HTMLDivElement>(null);
	// A rename session for a hidden tab surfaces here, so creating a root
	// folder never strands an invisible editing state.
	const editingFolderId = useRenameStore((s) =>
		s.editing?.kind === "folder" ? s.editing.id : null,
	);
	const cancelRename = useRenameStore((s) => s.cancel);
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

	const canConfirm = newName.trim().length > 0;

	const handleSelect = useCallback(
		(id: string) => {
			onSelectFolder(id);
			setOpen(false);
			setQuery("");
			setCreating(false);
			setNewName("");
			setJustCreatedId(null);
		},
		[onSelectFolder],
	);

	// Creation keeps the dropdown open with interaction continuity: reset
	// to the plain folder list, reveal the new folder with a highlight, and
	// only close on explicit select / outside click / Escape.
	const handleCreate = useCallback(() => {
		const name = newName.trim();
		if (!name) return;
		const id = onAddFolder(name);
		setCreating(false);
		setNewName("");
		setQuery("");
		setJustCreatedId(id);
		requestAnimationFrame(() => {
			listRef.current
				?.querySelector(`[data-folder-row="${id}"]`)
				?.scrollIntoView({ block: "nearest" });
		});
	}, [newName, onAddFolder]);

	function enterCreateMode() {
		setCreating(true);
		// Same element keeps focus; caret lands at the end of the cleared value.
		requestAnimationFrame(() => inputRef.current?.select());
	}

	function exitCreateMode() {
		setCreating(false);
		setNewName("");
		requestAnimationFrame(() => inputRef.current?.focus());
	}

	const closeMenu = useCallback(() => {
		setOpen(false);
		setQuery("");
		setCreating(false);
		setNewName("");
		setDropId(null);
		setJustCreatedId(null);
	}, []);

	function handleRowDragOver(folder: Folder) {
		return (e: React.DragEvent) => {
			const dragged = resolveDragRef(e);
			if (!dragged?.id) return;
			if (dragged.kind === "card") {
				e.preventDefault();
				e.dataTransfer.dropEffect = "move";
				setDropId(folder.id);
				return;
			}
			if (
				dragged.id !== folder.id &&
				(canNestFolder ? canNestFolder(dragged.id, folder.id) : true)
			) {
				e.preventDefault();
				e.dataTransfer.dropEffect = "move";
				setDropId(folder.id);
			}
		};
	}

	function handleRowDrop(folder: Folder) {
		return (e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setDropId(null);
			setActiveDrag(null);
			const dragged = resolveDragRef(e);
			if (!dragged?.id || dragged.id === folder.id) return;
			if (dragged.kind === "card") {
				onDropCards?.(dragged.id, folder.id);
			} else {
				if (canNestFolder && !canNestFolder(dragged.id, folder.id)) return;
				onMoveFolders?.(dragged.id, folder.id);
			}
			// The move persisted first; follow it so the item is visible.
			onSelectFolder(folder.id);
			setOpen(false);
			setQuery("");
			setCreating(false);
			setNewName("");
		};
	}

	// Anchor the dropdown with fixed positioning off the button's viewport rect,
	// so it escapes the toolbar's overflow-hidden clip (which was breaking the
	// layout). Right-aligned to the button, since the button lives near the
	// right edge of the tab area.
	const positionMenu = useCallback(() => {
		const btn = buttonRef.current;
		if (!btn) return;
		const rect = btn.getBoundingClientRect();
		setMenuPos({ top: rect.bottom + 6, left: rect.right });
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
						glassDropdown(isLiquid),
						"fixed z-50 flex w-52 min-w-0 max-w-[calc(100vw-1.5rem)] -translate-x-full flex-col",
					)}
					style={{
						top: menuPos.top,
						left: menuPos.left,
						maxHeight: "260px",
					}}
				>
					<div className="px-1.5 pt-1.5 pb-1">
						<InputGroup
							className={cn(
								"h-8 w-full min-w-0 rounded-lg",
								glassField(isLiquid),
							)}
						>
							{/* Leading glyph. The shared InputGroup addon owns the inset, so
							    the icon is never hand-positioned inside the field. The
							    explicit `size-*` class opts the glyph out of the addon's
							    `svg:not([class*=size-])` resize rule. */}
							<InputGroupAddon
								align="inline-start"
								className="py-0 pl-2.5 pr-0.5"
							>
								<Icon
									name="search"
									size={14}
									aria-hidden="true"
									className="size-3.5 shrink-0 opacity-60"
								/>
							</InputGroupAddon>
							<InputGroupInput
								ref={inputRef}
								type="text"
								placeholder={
									creating ? "Folder name..." : "Search folders..."
								}
								aria-label={creating ? "New folder name" : "Search folders"}
								value={creating ? newName : query}
								onChange={(e) =>
									creating
										? setNewName(e.target.value)
										: setQuery(e.target.value)
								}
								onKeyDown={(e) => {
									if (e.key === "Enter" && creating) {
										e.preventDefault();
										handleCreate();
									} else if (e.key === "Escape" && creating) {
										// Leave create mode first; a second Escape
										// closes the menu via the document handler.
										e.stopPropagation();
										exitCreateMode();
									}
								}}
								className={cn(
									// Horizontal padding is driven by the group's addon
									// rules (pl-1.5 / pr-1.5), so the icon-to-text gap
									// and the trailing button inset stay symmetric.
									"h-8 min-w-0 py-0 text-[13px]",
									isLiquid
										? "text-white/90 placeholder:text-white/60"
										: "text-foreground placeholder:text-muted-foreground",
								)}
							/>
							<InputGroupAddon align="inline-end" className="py-0 pr-1 pl-0">
								<button
									type="button"
									aria-label={
										creating
											? canConfirm
												? "Create folder"
												: "Folder name required"
											: "New folder"
									}
									aria-expanded={creating}
									onClick={() => {
										if (!creating) {
											enterCreateMode();
										} else if (canConfirm) {
											handleCreate();
										}
									}}
									className={cn(
										"flex size-6 shrink-0 items-center justify-center rounded-md transition-colors",
										creating && canConfirm
											? isLiquid
												? "bg-white/20 text-white hover:bg-white/30"
												: "bg-primary text-primary-foreground hover:bg-primary/90"
											: isLiquid
												? "text-white/70 hover:bg-white/15 hover:text-white active:bg-white/20"
												: "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-accent",
									)}
								>
									<Icon
										name={creating && canConfirm ? "check" : "plus"}
										size={13}
									/>
								</button>
							</InputGroupAddon>
						</InputGroup>
					</div>

					<div
						ref={listRef}
						className="scrollbar-hidden max-h-[196px] min-h-0 flex-1 overflow-y-auto overscroll-contain"
					>
						{filtered.length === 0 ? (
							<div
								className={cn(
									"px-3 py-4 text-center text-[12px]",
									glassText(isLiquid, "muted"),
								)}
							>
								{creating
									? "Type a name, then press Enter"
									: "No folders found"}
							</div>
						) : (
							filtered.map((folder) =>
								editingFolderId === folder.id ? (
									<div
										key={folder.id}
										className={cn(
											"flex w-full items-center gap-2",
											glassDropdownItem(isLiquid),
										)}
									>
										<Icon
											name="folder"
											size={14}
											className="shrink-0 opacity-60"
										/>
										<InlineRenameInput
											value={folder.name}
											ariaLabel={`Rename folder ${folder.name}`}
											onCommit={(name) => {
												useSetupStore.getState().updateFolder(folder.id, name);
												cancelRename();
											}}
											onCancel={cancelRename}
											className="text-[13px]"
										/>
									</div>
								) : (
									<button
										key={folder.id}
										type="button"
										data-folder-row={folder.id}
										onClick={() => handleSelect(folder.id)}
										onDragOver={handleRowDragOver(folder)}
										onDragLeave={() =>
											setDropId((prev) => (prev === folder.id ? null : prev))
										}
										onDrop={handleRowDrop(folder)}
										className={cn(
											"flex w-full items-center gap-2",
											glassDropdownItem(isLiquid),
											folder.id === activeRootId
												? isLiquid
													? "bg-white/[0.12]"
													: "bg-muted"
												: "",
											dropId === folder.id &&
												(isLiquid
													? "bg-white/[0.18] text-white ring-1 ring-white/40"
													: "bg-accent text-accent-foreground ring-1 ring-ring"),
											justCreatedId === folder.id &&
												(isLiquid
													? "bg-white/[0.14] text-white ring-1 ring-white/30"
													: "bg-accent/70 text-accent-foreground ring-1 ring-ring/40"),
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
								),
							)
						)}
					</div>
				</div>
			)}
		</div>
	);
}
