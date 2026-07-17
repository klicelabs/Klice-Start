import { Button } from "@perch/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@perch/ui/components/dialog";
import { Input } from "@perch/ui/components/input";
import { Label } from "@perch/ui/components/label";
import { type FormEvent, useEffect, useState } from "react";
import { getSubtreeIds } from "../../lib/folder-tree";
import type { Folder } from "../../types";
import { FolderTreePicker } from "./folder-tree-picker";

export interface FolderDialogSavePayload {
	name: string;
	folderId: string | null;
	parentId: string | null;
}

interface FolderDialogProps {
	open: boolean;
	editingFolder: Folder | null;
	folders: Folder[];
	/** Parent pre-selected when creating a new folder (e.g. the active folder). */
	defaultParentId: string | null;
	canDelete: boolean;
	onSave: (data: FolderDialogSavePayload) => void;
	onDelete: (folderId: string) => void;
	onClose: () => void;
}

export function FolderDialog({
	open,
	editingFolder,
	folders,
	defaultParentId,
	canDelete,
	onSave,
	onDelete,
	onClose,
}: FolderDialogProps) {
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

	// When editing, a folder cannot be moved into itself or a descendant.
	const subtreeIds = editingFolder
		? getSubtreeIds(folders, editingFolder.id)
		: [];
	const excludedIds = subtreeIds;
	// Everything that would be removed by a recursive delete.
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
			<DialogContent className="sm:max-w-[400px]">
				<DialogHeader>
					<DialogTitle>
						{editingFolder ? "Edit folder" : "New folder"}
					</DialogTitle>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="folder-name">Folder name</Label>
						<Input
							id="folder-name"
							value={name}
							autoFocus
							onChange={(e) => {
								setName(e.target.value);
								if (error) setError(null);
							}}
							placeholder="e.g. Work"
							aria-invalid={error ? true : undefined}
						/>
					</div>

					<FolderTreePicker
						folders={folders}
						value={parentId}
						onChange={setParentId}
						label="Parent folder"
						excludeIds={excludedIds}
						allowRoot
						rootLabel="No parent (top level)"
					/>

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

					<DialogFooter
						className={editingFolder && canDelete ? "sm:justify-between" : ""}
					>
						{editingFolder &&
							canDelete &&
							(confirmingDelete ? (
								<Button
									type="button"
									className="bg-red-500 text-white hover:bg-red-600"
									onClick={() => onDelete(editingFolder.id)}
								>
									Delete permanently
								</Button>
							) : (
								<Button
									type="button"
									variant="outline"
									className="border-red-500/30 text-red-500 hover:bg-red-500/10"
									onClick={() => setConfirmingDelete(true)}
								>
									Delete
								</Button>
							))}
						<div className="flex gap-2 sm:ml-auto">
							<Button type="button" variant="ghost" onClick={onClose}>
								Cancel
							</Button>
							<Button type="submit">Save</Button>
						</div>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
