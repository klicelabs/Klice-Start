import { Button } from "@klice-start/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@klice-start/ui/components/dialog";
import { useMemo, useState } from "react";
import { getSubtreeIds } from "../../lib/folder-tree";
import { useMoveDialogStore } from "../../stores/move-dialog-store";
import { useSelectionStore } from "../../stores/selection-store";
import { useSetupStore } from "../../stores/setup-store";
import { FolderTreePicker } from "./folder-tree-picker";

/**
 * Lightweight "Move to…" destination picker for the current selection (or a
 * single item). Not Settings — one labelled picker + Move/Cancel.
 *
 * Moves are atomic (one store call), order-preserving, and cycle-safe:
 * folders cannot land inside themselves or their descendants, and bookmarks
 * cannot live at the top level.
 */
export function MoveToDialog() {
	const ids = useMoveDialogStore((s) => s.ids);
	const close = useMoveDialogStore((s) => s.close);
	const folders = useSetupStore((s) => s.folders);
	const cards = useSetupStore((s) => s.cards);
	const moveItemsToContainer = useSetupStore((s) => s.moveItemsToContainer);

	const [destinationId, setDestinationId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const open = ids !== null;

	const { cardIds, folderIds, excludeIds, summary } = useMemo(() => {
		if (!ids)
			return { cardIds: [], folderIds: [], excludeIds: [], summary: "" };
		const cardIdSet = new Set(cards.map((c) => c.id));
		const cardIds = ids.filter((id) => cardIdSet.has(id));
		const folderIds = ids.filter((id) => folders.some((f) => f.id === id));
		const excludeIds = folderIds.flatMap((id) => getSubtreeIds(folders, id));
		const parts: string[] = [];
		if (cardIds.length > 0)
			parts.push(
				`${cardIds.length} bookmark${cardIds.length === 1 ? "" : "s"}`,
			);
		if (folderIds.length > 0)
			parts.push(
				`${folderIds.length} folder${folderIds.length === 1 ? "" : "s"}`,
			);
		return { cardIds, folderIds, excludeIds, summary: parts.join(" + ") };
	}, [ids, cards, folders]);

	function handleClose() {
		setDestinationId(null);
		setError(null);
		close();
	}

	function handleMove() {
		if (!destinationId) return;
		if (cardIds.length === 0 && folderIds.length === 0) {
			setError("Nothing left to move.");
			return;
		}
		moveItemsToContainer(destinationId, cardIds, folderIds);
		useSelectionStore.getState().clear();
		handleClose();
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(isOpen) => {
				if (!isOpen) handleClose();
			}}
		>
			<DialogContent className="rounded-[24px] sm:max-w-[360px]">
				<DialogHeader>
					<DialogTitle>Move to folder</DialogTitle>
					<DialogDescription>
						{summary ? `Move ${summary}.` : "Choose a destination."}
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-2 py-1">
					<FolderTreePicker
						folders={folders}
						value={destinationId}
						onChange={(id) => {
							setDestinationId(id);
							setError(null);
						}}
						allowRoot={cardIds.length === 0}
						rootLabel="Top level"
						excludeIds={excludeIds}
						className="h-9 w-full text-xs"
					/>
					{error && (
						<p className="text-destructive text-xs" role="alert">
							{error}
						</p>
					)}
				</div>

				<DialogFooter className="pt-1">
					<Button type="button" variant="ghost" onClick={handleClose}>
						Cancel
					</Button>
					<Button type="button" onClick={handleMove} disabled={!destinationId}>
						Move here
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
