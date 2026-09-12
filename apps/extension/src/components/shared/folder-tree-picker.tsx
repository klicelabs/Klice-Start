import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@klice-start/ui/components/select";
import { Icon } from "@klice-start/ui/icons/icon";
import { glassVariantStyles } from "@klice-start/ui/lib/glass-variants";
import { useMemo } from "react";
import { buildTree, type FolderTreeNode } from "../../lib/folder-tree";
import { cn } from "../../lib/utils";
import type { Folder } from "../../types";

const ROOT_VALUE = "__root__";

interface FlatFolder {
	id: string;
	name: string;
	depth: number;
}

function flattenTree(tree: FolderTreeNode[]): FlatFolder[] {
	const result: FlatFolder[] = [];
	function walk(nodes: FolderTreeNode[], depthOffset: number) {
		for (const node of nodes) {
			result.push({
				id: node.folder.id,
				name: node.folder.name,
				depth: node.depth + depthOffset,
			});
			walk(node.children, depthOffset);
		}
	}
	walk(tree, 0);
	return result;
}

interface FolderTreePickerProps {
	folders: Folder[];
	value: string | null;
	onChange: (folderId: string | null) => void;
	label?: string;
	excludeIds?: string[];
	allowRoot?: boolean;
	rootLabel?: string;
	className?: string;
	isLiquid?: boolean;
}

export function FolderTreePicker({
	folders,
	value,
	onChange,
	label,
	excludeIds,
	allowRoot = true,
	rootLabel = "No parent",
	className,
	isLiquid = false,
}: FolderTreePickerProps) {
	const tree = useMemo(() => buildTree(folders), [folders]);
	const flatFolders = useMemo(() => flattenTree(tree), [tree]);
	const disabledSet = useMemo(() => new Set(excludeIds ?? []), [excludeIds]);

	const selectValue: string = value ?? ROOT_VALUE;

	function handleChange(next: string | null) {
		onChange(next === ROOT_VALUE ? null : next);
	}

	return (
		<Select value={selectValue} onValueChange={handleChange}>
			<SelectTrigger
				className={cn(
					className,
					isLiquid &&
						cn(
							glassVariantStyles.liquid,
							"border-white/[0.25] text-white",
							"[&>svg]:text-white/80",
						),
				)}
			>
				<Icon
					name="folder"
					size={14}
					className={cn("shrink-0", isLiquid ? "text-white/80" : "opacity-70")}
				/>
				<SelectValue>
					{value
						? (folders.find((f) => f.id === value)?.name ?? "Select folder")
						: rootLabel}
				</SelectValue>
			</SelectTrigger>
			<SelectContent
				className={cn(
					isLiquid &&
						cn(glassVariantStyles.liquid, "border-white/[0.16] text-white"),
					!isLiquid && "bg-popover backdrop-blur-none",
				)}
			>
				{allowRoot && (
					<SelectItem value={ROOT_VALUE}>
						<span className="flex items-center gap-2">
							<Icon
								name="folder"
								size={14}
								className={cn(
									"shrink-0",
									isLiquid ? "text-white/70" : "opacity-50",
								)}
							/>
							{rootLabel}
						</span>
					</SelectItem>
				)}
				{flatFolders.map((f) => (
					<SelectItem key={f.id} value={f.id} disabled={disabledSet.has(f.id)}>
						<span
							className="flex items-center gap-2"
							style={{ paddingLeft: `${f.depth * 16}px` }}
						>
							<Icon
								name="folder"
								size={14}
								className={cn(
									"shrink-0",
									isLiquid ? "text-white/70" : "opacity-70",
								)}
							/>
							{f.name}
						</span>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
