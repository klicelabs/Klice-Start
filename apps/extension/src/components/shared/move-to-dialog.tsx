import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@klice-start/ui/components/dialog";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SETTINGS_SCOPE_CLASS } from "../../lib/context-scope";
import { getSubtreeIds } from "../../lib/folder-tree";
import { glassShape } from "../../lib/glass";
import { describeMoveGroup } from "../../lib/move-selection";
import { cn } from "../../lib/utils";
import { useMoveDialogStore } from "../../stores/move-dialog-store";
import { useSelectionStore } from "../../stores/selection-store";
import { useSetupStore } from "../../stores/setup-store";
import { SettingsAction } from "../newtab/settings/shared/settings-action";
import { useAppearance } from "../newtab/appearance-provider";
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
	const { isLiquid } = useAppearance();

	// undefined = nothing chosen yet; null = explicitly chosen Top level.
	const [destinationId, setDestinationId] = useState<string | null | undefined>(
		undefined,
	);
	const [error, setError] = useState<string | null>(null);

	const open = ids !== null;

	// Fresh session per opening: never inherit a previous destination.
	// The selected payload can change while the dialog remains mounted/open;
	// reset the explicit destination for that new move session.
	// biome-ignore lint/correctness/useExhaustiveDependencies: ids marks a new move payload.
	useEffect(() => {
		if (open) {
			setDestinationId(undefined);
			setError(null);
		}
	}, [open, ids]);

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
		setDestinationId(undefined);
		setError(null);
		close();
	}

	function handleMove() {
		if (destinationId === undefined) return;
		if (cardIds.length === 0 && folderIds.length === 0) {
			setError("Nothing left to move.");
			return;
		}
		if (destinationId === null && cardIds.length > 0) {
			setError("Bookmarks can't live at the top level.");
			return;
		}
		const dest =
			destinationId === null
				? null
				: (folders.find((f) => f.id === destinationId) ?? null);
		moveItemsToContainer(destinationId, cardIds, folderIds);
		const total = cardIds.length + folderIds.length;
		toast.success(total === 1 ? "Item moved" : `${total} items moved`, {
			description: dest
				? `to ${dest.name} · ${describeMoveGroup(cardIds.length, folderIds.length)}`
				: `to the top level · ${describeMoveGroup(cardIds.length, folderIds.length)}`,
		});
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
			<DialogContent
				closeGlass={isLiquid}
				className={cn(
					glassShape("panel"),
					SETTINGS_SCOPE_CLASS,
					"sm:max-w-[360px]",
				)}
			>
				<DialogHeader>
					<DialogTitle>Move to folder</DialogTitle>
					<DialogDescription>
						{summary ? `Move ${summary}.` : "Choose a destination."}
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-2 py-1">
					<FolderTreePicker
						folders={folders}
						value={destinationId ?? null}
						onChange={(id) => {
							setDestinationId(id);
							setError(null);
						}}
						allowRoot={cardIds.length === 0}
						rootLabel="Top level"
						excludeIds={excludeIds}
						isLiquid={isLiquid}
						className="h-9 w-full text-xs"
					/>
					{error && (
						<p className="text-destructive text-xs" role="alert">
							{error}
						</p>
					)}
				</div>

				<DialogFooter className="pt-1">
					<SettingsAction onClick={handleClose}>Cancel</SettingsAction>
					<SettingsAction
						tone="primary"
						onClick={handleMove}
						disabled={destinationId === undefined}
					>
						Move here
					</SettingsAction>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
