import { Button } from "@perch/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@perch/ui/components/dialog";
import { GlassButton } from "@perch/ui/components/glass-button";
import { Input } from "@perch/ui/components/input";
import { Label } from "@perch/ui/components/label";
import { type FormEvent, useEffect, useState } from "react";
import { getSubtreeIds } from "../../../lib/folder-tree";
import { glassText } from "../../../lib/glass";
import { cn } from "../../../lib/utils";
import type { Folder } from "../../../types";
import { FolderTreePicker } from "../../shared/folder-tree-picker";
import { useAppearance } from "../appearance-provider";

export interface AddFolderDialogSavePayload {
	name: string;
	folderId: string | null;
	parentId: string | null;
}

interface AddFolderDialogProps {
	open: boolean;
	editingFolder: Folder | null;
	folders: Folder[];
	/** Parent pre-selected when creating a new folder. */
	defaultParentId: string | null;
	canDelete: boolean;
	onSave: (data: AddFolderDialogSavePayload) => void;
	onDelete: (folderId: string) => void;
	onClose: () => void;
}

export function AddFolderDialog({
	open,
	editingFolder,
	folders,
	defaultParentId,
	canDelete,
	onSave,
	onDelete,
	onClose,
}: AddFolderDialogProps) {
	const { isLiquid } = useAppearance();
	const glassV = isLiquid ? "liquid" : "classic";
	const [name, setName] = useState("");
	const [parentId, setParentId] = useState<string | null>(defaultParentId);
	const [error, setError] = useState<string | null>(null);
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	useEffect(() => {
		if (!open) return;
		if (editingFolder) {
			setName(editingFolder.name);
			setParentId(editingFolder.parentId);
		} else {
			setName("");
			setParentId(defaultParentId);
		}
		setError(null);
		setConfirmingDelete(false);
	}, [open, editingFolder, defaultParentId]);

	const subtreeIds = editingFolder
		? getSubtreeIds(folders, editingFolder.id)
		: [];
	const excludedIds = subtreeIds;
	const descendantCount = subtreeIds.length - 1;

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		const finalName = name.trim();
		if (!finalName) {
			setError("Enter a folder name.");
			return;
		}
		onSave({ name: finalName, folderId: editingFolder?.id ?? null, parentId });
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => {
				if (!o) onClose();
			}}
		>
			<DialogContent
				glassVariant={glassV}
				className="flex flex-col sm:max-w-[460px]"
				style={{ maxHeight: "calc(100vh - 6rem)" }}
			>
				<DialogHeader className="shrink-0">
					<DialogTitle className={cn(isLiquid && "text-white")}>
						{editingFolder ? "Edit folder" : "New folder"}
					</DialogTitle>
				</DialogHeader>

				<form
					onSubmit={handleSubmit}
					className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
				>
					<div className="space-y-4 px-0.5">
						<div className="flex items-center gap-3">
							<Label
								htmlFor="folder-name"
								className={cn(
									"w-24 shrink-0 font-medium text-sm",
									glassText(isLiquid, "secondary"),
								)}
							>
								Folder name
							</Label>
							<Input
								id="folder-name"
								value={name}
								autoFocus
								glassVariant={glassV}
								onChange={(e) => {
									setName(e.target.value);
									if (error) setError(null);
								}}
								placeholder="e.g. Work"
								aria-invalid={error ? true : undefined}
								className="flex-1"
							/>
						</div>

						<div className="flex items-center gap-3">
							<Label
								className={cn(
									"w-24 shrink-0 font-medium text-sm",
									glassText(isLiquid, "secondary"),
								)}
							>
								Parent
							</Label>
							<FolderTreePicker
								folders={folders}
								value={parentId}
								onChange={setParentId}
								label="Parent folder"
								excludeIds={excludedIds}
								allowRoot
								rootLabel="No parent (top level)"
								className="flex-1"
								isLiquid={isLiquid}
							/>
						</div>

						{error && (
							<p className="text-[13px] text-red-400" role="alert">
								{error}
							</p>
						)}

						{confirmingDelete && editingFolder && (
							<p
								className="rounded-lg bg-red-500/10 px-3 py-2 text-[12px] text-red-300"
								role="alert"
							>
								{descendantCount > 0
									? `This deletes "${editingFolder.name}", its ${descendantCount} subfolder(s), and all links inside. This can't be undone.`
									: `This deletes "${editingFolder.name}" and all its links. This can't be undone.`}
							</p>
						)}
					</div>

					<DialogFooter
						className={cn(
							"shrink-0 border-t pt-3",
							isLiquid ? "border-white/[0.10]" : "border-border/30",
							editingFolder && canDelete ? "sm:justify-between" : "",
						)}
					>
						{editingFolder &&
							canDelete &&
							(confirmingDelete ? (
								<Button
									type="button"
									className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
									onClick={() => onDelete(editingFolder.id)}
								>
									Delete permanently
								</Button>
							) : (
								<Button
									type="button"
									variant="outline"
									className="border-destructive/30 text-destructive hover:bg-destructive/10"
									onClick={() => setConfirmingDelete(true)}
								>
									Delete
								</Button>
							))}
						<div className="flex gap-2 sm:ml-auto">
							{isLiquid ? (
								<GlassButton
									type="button"
									variant="ghost"
									glassVariant="liquid"
									onClick={onClose}
								>
									Cancel
								</GlassButton>
							) : (
								<Button type="button" variant="ghost" onClick={onClose}>
									Cancel
								</Button>
							)}
							{isLiquid ? (
								<GlassButton type="submit" glassVariant="liquid">
									Save
								</GlassButton>
							) : (
								<Button type="submit">Save</Button>
							)}
						</div>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
