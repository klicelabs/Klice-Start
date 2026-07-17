import {
	Empty,
	EmptyDescription,
	EmptyTitle,
} from "@perch/ui/components/empty";
import { useDragAndDrop } from "../../hooks/use-drag-and-drop";
import { computeGridMaxWidth, useSetupStore } from "../../stores/setup-store";
import type { Card, Folder } from "../../types";
import { DialCard } from "./dial-card";
import { FolderBreadcrumb } from "./folder-breadcrumb";
import { FolderCard } from "./folder-card";

interface DialGridProps {
	cards: Card[];
	/** Direct subfolders of the active folder, rendered as navigable tiles. */
	subfolders: Folder[];
	/** All folders + active id, used to render the breadcrumb trail. */
	folders: Folder[];
	activeFolderId: string;
	cardCounts: Record<string, number>;
	onEdit: (id: string) => void;
	onDelete: (id: string) => void;
	onReorder: (fromId: string, toId: string) => void;
	/** Reorder two sibling subfolders (drag one folder tile onto another same-level one). */
	onReorderFolders: (fromId: string, toId: string) => void;
	onAdd: () => void;
	onOpenFolder: (id: string) => void;
	onEditFolder: (id: string) => void;
	onNavigate: (id: string) => void;
	onMoveCard: (cardId: string, folderId: string) => void;
	/** Nest a folder inside another (drop a folder tile onto a folder tile). */
	onMoveFolder: (folderId: string, targetFolderId: string) => void;
	/** Cycle-safe check: may `folderId` be nested under the tile being hovered. */
	canNestFolder: (folderId: string, targetFolderId: string) => boolean;
}

export function DialGrid({
	cards,
	subfolders,
	folders,
	activeFolderId,
	cardCounts,
	onEdit,
	onDelete,
	onReorder,
	onReorderFolders,
	onAdd,
	onOpenFolder,
	onEditFolder,
	onNavigate,
	onMoveCard,
	onMoveFolder,
	canNestFolder,
}: DialGridProps) {
	const tileSize = useSetupStore((s) => s.settings.tileSize);
	const maxColumns = useSetupStore((s) => s.settings.maxColumns);
	const gridMaxWidth = computeGridMaxWidth(tileSize, maxColumns);

	const dnd = useDragAndDrop({ onDrop: onReorder, kind: "card" });
	const folderDnd = useDragAndDrop({ onDrop: onReorderFolders, kind: "folder" });

	const isEmpty = cards.length === 0 && subfolders.length === 0;

	return (
		<section
			className="dial-grid-wrap mx-auto w-full px-6"
			style={{ maxWidth: gridMaxWidth }}
		>
			<FolderBreadcrumb
				folders={folders}
				activeFolderId={activeFolderId}
				onNavigate={onNavigate}
			/>

			{isEmpty ? (
				<Empty className="flex flex-col items-center gap-3 py-16">
					<EmptyTitle className="font-semibold text-[17px] text-white/80">
						This folder is empty
					</EmptyTitle>
					<EmptyDescription className="max-w-xs text-center text-[13px] text-white/40">
						Add a link to get started, or use the extension shortcut on any page
						to save it here.
					</EmptyDescription>
					<button
						type="button"
						onClick={onAdd}
						className="mt-1 rounded-xl border border-white/15 bg-white/5 px-4 py-2 font-medium text-[13px] text-white/80 transition-colors hover:bg-white/10"
					>
						Add your first link
					</button>
				</Empty>
			) : (
				<div
					className="dial-grid"
					data-tile={tileSize}
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, var(--tile-w, 148px))",
						gap: "var(--grid-gap, 22px)",
						justifyContent: "center",
					}}
				>
					{subfolders.map((folder) => (
						<div key={folder.id} className="dial-cell relative">
							<FolderCard
								id={folder.id}
								name={folder.name}
								itemCount={cardCounts[folder.id] ?? 0}
								dragging={folderDnd.draggingId === folder.id}
								onOpen={onOpenFolder}
								onEdit={onEditFolder}
								onDropCard={onMoveCard}
								onDropFolder={onMoveFolder}
								canAcceptFolder={(draggedId) => canNestFolder(draggedId, folder.id)}
								dragProps={folderDnd.getItemProps(folder.id)}
							/>
						</div>
					))}

					{cards.map((card) => {
						const itemProps = dnd.getItemProps(card.id);
						const isOver = dnd.overId === card.id;
						const isDragging = dnd.draggingId === card.id;
						return (
							<div
								key={card.id}
								className="dial-cell relative transition-transform duration-150"
								style={{
									opacity: isDragging ? 0.4 : 1,
									transform: isOver ? "scale(1.05)" : undefined,
								}}
							>
								{isOver && (
									<span
										aria-hidden
										className="pointer-events-none absolute -inset-1.5 rounded-[20px] border-2 border-white/40 border-dashed"
									/>
								)}
								<DialCard
									card={card}
									onEdit={onEdit}
									onDelete={onDelete}
									dragProps={itemProps}
								/>
							</div>
						);
					})}
				</div>
			)}
		</section>
	);
}
