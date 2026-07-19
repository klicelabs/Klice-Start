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
import { getSubtreeIds } from "../../../lib/folder-tree";
import type { Folder } from "../../../types";
import { FolderTreePicker } from "../../shared/folder-tree-picker";

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

/**
 * Viewport-safe add/edit folder dialog. Fixed header + footer with scrollable
 * content area. Never exceeds viewport height.
 */
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
				className="flex flex-col sm:max-w-[400px]"
				style={{ maxHeight: "calc(100vh - 2rem)" }}
			>
				{/* Fixed header */}
				<DialogHeader className="shrink-0">
					<DialogTitle>
						{editingFolder ? "Edit folder" : "New folder"}
					</DialogTitle>
				</DialogHeader>

				{/* Scrollable content */}
				<form
					onSubmit={handleSubmit}
					className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
				>
					<div className="space-y-4 px-0.5">
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
					</div>

					{/* Fixed footer */}
					<DialogFooter
						className={`shrink-0 border-border/30 border-t pt-3 ${editingFolder && canDelete ? "sm:justify-between" : ""}`}
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
