import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@klice-start/ui/components/dialog";
import { Input } from "@klice-start/ui/components/input";
import { Icon } from "@klice-start/ui/icons/icon";
import { useEffect, useState } from "react";
import { SETTINGS_SCOPE_CLASS } from "../../lib/context-scope";
import { cn } from "../../lib/utils";
import {
	SETTINGS_ACTION,
	SETTINGS_ACTION_PRIMARY,
	SETTINGS_FOCUS_RING,
	SETTINGS_INPUT,
	SETTINGS_RADIUS,
} from "../newtab/settings/shared/settings-tokens";

export type SelectionCreateMode = "folder" | "subfolder";

interface CreateFolderFromSelectionDialogProps {
	open: boolean;
	mode: SelectionCreateMode;
	selectionSummary: string;
	parentName?: string;
	isLiquid: boolean;
	onOpenChange: (open: boolean) => void;
	/** Return false when the live selection can no longer be grouped. */
	onCreate: (name: string) => boolean;
}

export function CreateFolderFromSelectionDialog({
	open,
	mode,
	selectionSummary,
	parentName,
	isLiquid,
	onOpenChange,
	onCreate,
}: CreateFolderFromSelectionDialogProps) {
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (open) {
			setName("");
			setError(null);
		}
	}, [open]);

	const folderLabel = mode === "folder" ? "folder" : "subfolder";
	const title = `Create new ${folderLabel} from selection`;
	const destination =
		mode === "folder"
			? "Top-level folder"
			: parentName
				? `Inside ${parentName}`
				: "Inside the current folder";

	function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const trimmed = name.trim();
		if (!trimmed) {
			setError("Enter a name to continue.");
			return;
		}
		if (!onCreate(trimmed)) {
			setError("These items can’t be grouped in this location.");
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				glassVariant={isLiquid ? "liquid" : "classic"}
				className={cn(
					"squircle",
					SETTINGS_SCOPE_CLASS,
					SETTINGS_RADIUS.panel,
					"sm:max-w-[380px]",
				)}
			>
				<form className="flex flex-col gap-5" onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription
							className={isLiquid ? "text-white/70" : undefined}
						>
							Move {selectionSummary || "the selected items"} into it.
						</DialogDescription>
					</DialogHeader>

					<div className="flex flex-col gap-2">
						<label
							className={cn(
								"font-medium text-[12px]",
								isLiquid ? "text-white/85" : "text-flat-ink",
							)}
							htmlFor="create-folder-from-selection-name"
						>
							Name
						</label>
						<Input
							id="create-folder-from-selection-name"
							autoFocus
							value={name}
							placeholder={mode === "folder" ? "Folder name" : "Subfolder name"}
							onChange={(event) => {
								setName(event.target.value);
								if (error) setError(null);
							}}
							aria-invalid={error ? true : undefined}
							aria-describedby={
								error ? "create-folder-from-selection-error" : undefined
							}
							glassVariant={isLiquid ? "liquid" : "classic"}
							className={cn(
								"h-10 text-[13px]",
								isLiquid
									? "border-white/[0.28] bg-white/[0.08] text-white placeholder:text-white/45"
									: SETTINGS_INPUT,
							)}
						/>
						{error && (
							<p
								id="create-folder-from-selection-error"
								className="text-destructive text-xs"
								role="alert"
							>
								{error}
							</p>
						)}
					</div>

					<div
						className={cn(
							"flex items-center gap-2 rounded-[12px] px-3 py-2.5 text-[12px]",
							isLiquid
								? "bg-white/[0.09] text-white/75"
								: "bg-flat-sunken-raised text-flat-ink-muted",
						)}
					>
						<Icon name="folder" size={14} className="shrink-0 opacity-70" />
						<span className="min-w-0 truncate">{destination}</span>
					</div>

					<DialogFooter className="pt-1">
						<button
							type="button"
							onClick={() => onOpenChange(false)}
							className={cn(
								"squircle inline-flex h-9 items-center justify-center px-3 font-medium text-xs",
								SETTINGS_RADIUS.control,
								SETTINGS_ACTION,
								SETTINGS_FOCUS_RING,
								isLiquid &&
									"bg-white/[0.10] text-white/85 hover:bg-white/[0.16] hover:text-white",
							)}
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={!name.trim()}
							className={cn(
								"squircle inline-flex h-9 items-center justify-center gap-1.5 px-3 font-medium text-xs",
								SETTINGS_RADIUS.control,
								SETTINGS_ACTION_PRIMARY,
								SETTINGS_FOCUS_RING,
								"bg-[var(--apple-blue)] text-white hover:bg-[var(--apple-blue)]/90 disabled:pointer-events-none disabled:opacity-40",
							)}
						>
							<Icon name="folder-plus" size={14} aria-hidden="true" />
							Create {folderLabel}
						</button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
