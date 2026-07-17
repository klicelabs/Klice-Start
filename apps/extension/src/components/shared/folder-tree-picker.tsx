import { Label } from "@perch/ui/components/label";
import { Icon } from "@perch/ui/icons/icon";
import { useMemo, useState } from "react";
import { buildTree, type FolderTreeNode, getAncestors } from "../../lib/folder-tree";
import { cn } from "../../lib/utils";
import type { Folder } from "../../types";

interface FolderTreePickerProps {
	folders: Folder[];
	/** Selected folder id, or null for the root level. */
	value: string | null;
	onChange: (folderId: string | null) => void;
	/** Optional heading rendered above the tree. */
	label?: string;
	/** Folder ids that cannot be selected (e.g. a folder's own subtree, to prevent cycles). */
	excludeIds?: string[];
	/** Whether the "root" (top-level) option is selectable. Defaults to true. */
	allowRoot?: boolean;
	/** Label for the root option when allowRoot is true. */
	rootLabel?: string;
	className?: string;
}

/**
 * A collapsible hierarchical folder selector, styled like the VS Code sidebar:
 * each folder with children gets an expand/collapse chevron; leaves get a
 * spacer so labels stay aligned. Branches on the path to the current selection
 * start expanded so the chosen folder is always visible.
 */
export function FolderTreePicker({
	folders,
	value,
	onChange,
	label,
	excludeIds,
	allowRoot = true,
	rootLabel = "Home (root)",
	className,
}: FolderTreePickerProps) {
	const tree = useMemo(() => buildTree(folders), [folders]);
	const disabledIds = useMemo(() => new Set(excludeIds ?? []), [excludeIds]);

	// Expand the ancestors of the current selection by default so it's visible.
	const [expanded, setExpanded] = useState<Set<string>>(() => {
		const initial = new Set<string>();
		if (value) for (const a of getAncestors(folders, value)) initial.add(a.id);
		return initial;
	});

	const toggle = (id: string) =>
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});

	return (
		<div className="space-y-2">
			{label && <Label>{label}</Label>}
			<div
				role="tree"
				aria-label={label ?? "Choose a folder"}
				className={cn(
					"max-h-[240px] overflow-y-auto rounded-2xl border border-border/50 bg-secondary/40 p-1.5",
					className,
				)}
			>
				{allowRoot && (
					<PickerRow
						depth={0}
						hasChildren={false}
						expanded={false}
						label={rootLabel}
						selected={value === null}
						disabled={false}
						onToggle={() => {}}
						onSelect={() => onChange(null)}
					/>
				)}
				{tree.map((node) => (
					<TreeBranch
						key={node.folder.id}
						node={node}
						baseDepth={allowRoot ? 1 : 0}
						value={value}
						disabledIds={disabledIds}
						expanded={expanded}
						onToggle={toggle}
						onChange={onChange}
					/>
				))}
			</div>
		</div>
	);
}

function TreeBranch({
	node,
	baseDepth,
	value,
	disabledIds,
	expanded,
	onToggle,
	onChange,
}: {
	node: FolderTreeNode;
	baseDepth: number;
	value: string | null;
	disabledIds: Set<string>;
	expanded: Set<string>;
	onToggle: (id: string) => void;
	onChange: (id: string) => void;
}) {
	const { folder, children } = node;
	const hasChildren = children.length > 0;
	const isOpen = expanded.has(folder.id);

	return (
		<>
			<PickerRow
				depth={baseDepth + node.depth}
				hasChildren={hasChildren}
				expanded={isOpen}
				label={folder.name}
				selected={value === folder.id}
				disabled={disabledIds.has(folder.id)}
				onToggle={() => onToggle(folder.id)}
				onSelect={() => onChange(folder.id)}
			/>
			{hasChildren &&
				isOpen &&
				children.map((child) => (
					<TreeBranch
						key={child.folder.id}
						node={child}
						baseDepth={baseDepth}
						value={value}
						disabledIds={disabledIds}
						expanded={expanded}
						onToggle={onToggle}
						onChange={onChange}
					/>
				))}
		</>
	);
}

function PickerRow({
	depth,
	hasChildren,
	expanded,
	label,
	selected,
	disabled,
	onToggle,
	onSelect,
}: {
	depth: number;
	hasChildren: boolean;
	expanded: boolean;
	label: string;
	selected: boolean;
	disabled: boolean;
	onToggle: () => void;
	onSelect: () => void;
}) {
	return (
		<div
			className="flex items-center"
			style={{ paddingLeft: `${4 + depth * 14}px` }}
		>
			{hasChildren ? (
				<button
					type="button"
					aria-label={expanded ? "Collapse" : "Expand"}
					aria-expanded={expanded}
					tabIndex={-1}
					onClick={(e) => {
						e.stopPropagation();
						onToggle();
					}}
					className="flex size-5 shrink-0 items-center justify-center rounded text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
				>
					<Icon name={expanded ? "chevron-down" : "chevron-right"} size={13} />
				</button>
			) : (
				<span className="size-5 shrink-0" aria-hidden="true" />
			)}
			<button
				type="button"
				role="treeitem"
				aria-selected={selected}
				aria-level={depth + 1}
				disabled={disabled}
				onClick={onSelect}
				className={cn(
					"flex min-w-0 flex-1 items-center gap-2 rounded-xl py-1.5 pr-2 pl-1 text-left text-[13px] transition-colors",
					selected ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/6",
					disabled && "cursor-not-allowed opacity-30 hover:bg-transparent",
				)}
			>
				<Icon name="folder" size={14} className="shrink-0 opacity-70" />
				<span className="truncate">{label}</span>
				{selected && (
					<Icon name="check" size={13} className="ml-auto shrink-0 opacity-80" />
				)}
			</button>
		</div>
	);
}
