import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@perch/ui/components/context-menu";
import {
	Empty,
	EmptyDescription,
	EmptyTitle,
} from "@perch/ui/components/empty";
import { Icon } from "@perch/ui/icons/icon";
import { glassVariantStyles } from "@perch/ui/lib/glass-variants";
import { useDragAndDrop } from "../../hooks/use-drag-and-drop";
import { CARD_ASPECT_RATIO } from "../../lib/constants";
import { glassDropdownItem } from "../../lib/glass";
import { cn } from "../../lib/utils";
import { computeGridMaxWidth, useSetupStore } from "../../stores/setup-store";
import type { Card, Folder } from "../../types";
import { useAppearance } from "./appearance-provider";
import { DialCard } from "./dial-card";
import {
	FolderPreviewCard,
	type FolderPreviewItem,
} from "./folders/folder-preview-card";

interface DialGridProps {
	cards: Card[];
	subfolders: Folder[];
	cardCounts: Record<string, number>;
	previewCards: Record<string, FolderPreviewItem[]>;
	onEdit: (id: string) => void;
	onDelete: (id: string) => void;
	onDeleteFolder: (id: string) => void;
	onReorder: (fromId: string, toId: string) => void;
	onReorderFolders: (fromId: string, targetId: string) => void;
	onAdd: () => void;
	onAddFolder: () => void;
	onOpenFolder: (id: string) => void;
	onEditFolder: (id: string) => void;
	onMoveCard: (cardId: string, folderId: string) => void;
	onMoveFolder: (folderId: string, targetFolderId: string) => void;
	canNestFolder: (folderId: string, targetFolderId: string) => boolean;
}

export function DialGrid({
	cards,
	subfolders,
	cardCounts,
	previewCards,
	onEdit,
	onDelete,
	onDeleteFolder,
	onReorder,
	onReorderFolders,
	onAdd,
	onAddFolder,
	onOpenFolder,
	onEditFolder,
	onMoveCard,
	onMoveFolder,
	canNestFolder,
}: DialGridProps) {
	const { isLiquid } = useAppearance();
	const tileSize = useSetupStore((s) => s.settings.tileSize);
	const maxColumns = useSetupStore((s) => s.settings.maxColumns);
	const dialLayout = useSetupStore((s) => s.settings.dialLayout);
	const cardAspect = useSetupStore((s) => s.settings.cardAspect);
	const gridMaxWidth = computeGridMaxWidth(tileSize, maxColumns);

	// Card proportions follow the chosen aspect (height = width × ratio). We
	// express this as a CSS `aspect-ratio` (width / height) on the cell so the
	// height is derived STRICTLY from the fixed grid-track width — every tile
	// (site card, folder, empty "new folder" placeholder) shares one ratio and
	// none can stretch independently. Icon layout opts out (square + label).
	const heightMultiple =
		CARD_ASPECT_RATIO[cardAspect] ?? CARD_ASPECT_RATIO.vertical;
	const cellAspectStyle =
		dialLayout === "card"
			? { ["--cell-aspect" as string]: String(1 / heightMultiple) }
			: {};

	const dnd = useDragAndDrop({ onDrop: onReorder, kind: "card" });
	const folderDnd = useDragAndDrop({
		onDrop: onReorderFolders,
		kind: "folder",
	});

	const isEmpty = cards.length === 0 && subfolders.length === 0;

	return (
		<ContextMenu>
			<ContextMenuTrigger
				data-local-context-menu
				render={
					<section
						className="dial-grid-wrap mx-auto w-full px-6"
						style={{ maxWidth: gridMaxWidth }}
					/>
				}
			>
				{isEmpty ? (
					<Empty className="flex flex-col items-center gap-3 py-16">
						<EmptyTitle
							className={`font-semibold text-[17px] ${
								isLiquid ? "text-white/80" : "text-foreground"
							}`}
						>
							This folder is empty
						</EmptyTitle>
						<EmptyDescription
							className={`max-w-xs text-center text-[13px] ${
								isLiquid ? "text-white/40" : "text-muted-foreground"
							}`}
						>
							Add a link to get started, or use the extension shortcut on any
							page to save it here.
						</EmptyDescription>
						<button
							type="button"
							onClick={onAdd}
							className={`mt-1 rounded-xl border px-4 py-2 font-medium text-[13px] transition-colors ${
								isLiquid
									? "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
									: "border-border bg-muted text-foreground hover:bg-accent"
							}`}
						>
							Add your first link
						</button>
					</Empty>
				) : (
					<div
						className="dial-grid"
						data-tile={tileSize}
						data-layout={dialLayout}
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(auto-fill, var(--tile-w, 148px))",
							gap: "var(--grid-gap, 22px)",
							justifyContent: "center",
							...cellAspectStyle,
						}}
					>
						{subfolders.map((folder) => (
							<FolderPreviewCard
								key={folder.id}
								id={folder.id}
								name={folder.name}
								itemCount={cardCounts[folder.id] ?? 0}
								previewCards={previewCards[folder.id] ?? []}
								dragging={folderDnd.draggingId === folder.id}
								onOpen={onOpenFolder}
								onEdit={onEditFolder}
								onDelete={onDeleteFolder}
								onDropCard={onMoveCard}
								onDropFolder={onMoveFolder}
								canAcceptFolder={(draggedId) =>
									canNestFolder(draggedId, folder.id)
								}
								dragProps={folderDnd.getItemProps(folder.id)}
								className="dial-cell"
							/>
						))}

						{cards.map((card) => {
							const itemProps = dnd.getItemProps(card.id);
							const isOver = dnd.overId === card.id;
							const isDragging = dnd.draggingId === card.id;
							return (
								<DialCard
									key={card.id}
									card={card}
									onEdit={onEdit}
									onDelete={onDelete}
									dragProps={itemProps}
									className={cn(
										"dial-cell transition-transform duration-150",
										isOver && "outline-dashed outline-2 outline-white/40",
									)}
									style={{
										opacity: isDragging ? 0.4 : 1,
										transform: isOver ? "scale(1.05)" : undefined,
									}}
								/>
							);
						})}
					</div>
				)}
			</ContextMenuTrigger>

			{/* Empty space context menu */}
			<ContextMenuContent
				className={cn(
					"min-w-48",
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
					className={glassDropdownItem(isLiquid)}
					onClick={onAddFolder}
				>
					<Icon name="folder-plus" size={15} />
					New Folder
				</ContextMenuItem>
				<ContextMenuItem
					className={glassDropdownItem(isLiquid)}
					onClick={onAdd}
				>
					<Icon name="bookmark" size={15} />
					Add Link
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
