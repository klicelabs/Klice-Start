import { Icon } from "@klice-start/ui/icons/icon";
import { glassFocusRing } from "../../lib/glass";
import { cn } from "../../lib/utils";
import { useAppearance } from "./appearance-provider";

interface InlineFolderNavProps {
	currentName: string;
	parentName: string;
	onBack: () => void;
}

/**
 * In-flow subfolder navigation. Lives in the normal page rhythm between the
 * search hero and the grid. When it scrolls out of view, the toolbar's left
 * zone takes over with the same back + breadcrumb (see NavigationToolbar).
 */
export function InlineFolderNav({
	currentName,
	parentName,
	onBack,
}: InlineFolderNavProps) {
	const { isLiquid } = useAppearance();
	return (
		<button
			type="button"
			onClick={onBack}
			aria-label={`Back to ${parentName}`}
			title={`Back to ${parentName}`}
			className={cn(
				"group flex min-w-0 max-w-full items-center gap-1 rounded-full py-1 pr-3 pl-1 transition-colors duration-150",
				glassFocusRing(isLiquid),
				isLiquid
					? "text-white/85 hover:bg-white/[0.10] hover:text-white"
					: "text-foreground hover:bg-muted",
			)}
		>
			<Icon
				name="chevron-left"
				size={20}
				className={cn(
					"shrink-0 transition-transform duration-150 group-active:scale-95",
					isLiquid ? "text-white/60" : "text-muted-foreground",
				)}
			/>
			<span className="truncate font-semibold text-[17px] tracking-tight">
				{currentName}
			</span>
		</button>
	);
}
