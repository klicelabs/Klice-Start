import { glassText } from "../../lib/glass";
import { cn } from "../../lib/utils";
import { useAppearance } from "./appearance-provider";

interface EmptyLandingProps {
	/** Current folder name to show as a badge. */
	folderName: string;
	/** Callback when the user clicks the action button. */
	onAdd: () => void;
}

/**
 * Empty-folder message stack. The clock + date live in the global hero wrapper
 * (rendered by App in every state), so this component NEVER renders its own
 * clock — it only supplies the folder badge, the empty message, and the CTA
 * that sit beneath the shared hero. This keeps the clock a single global
 * instance that always reads its size/format from the store, so entering an
 * empty subfolder can no longer reset it.
 */
export function EmptyLanding({ folderName, onAdd }: EmptyLandingProps) {
	const { isLiquid } = useAppearance();

	return (
		<div className="flex items-start justify-center px-6">
			<div
				className="flex flex-col items-center text-center"
				style={{ animation: "emptyLandingIn 220ms ease-out both" }}
			>
				{/* Folder badge — floating nav chip */}
				<div
					className={cn(
						"mb-5 rounded-full px-3 py-1 font-medium text-[12px]",
						isLiquid
							? "bg-white/[0.06] text-white/40 ring-1 ring-white/[0.06]"
							: "border border-border bg-muted text-muted-foreground",
					)}
				>
					{folderName}
				</div>

				<h2
					className={cn(
						"font-medium text-[17px] leading-snug",
						isLiquid ? "text-white/55" : "text-foreground/60",
					)}
				>
					This folder is empty
				</h2>

				<p
					className={cn(
						"mt-3 max-w-[360px] text-[13px] leading-relaxed",
						glassText(isLiquid, "muted"),
					)}
					style={{ opacity: 0.35 }}
				>
					Add a link to get started, or use the extension shortcut on any page
					to save it here.
				</p>

				{/* Action button */}
				<button
					type="button"
					onClick={onAdd}
					className={cn(
						"mt-6 h-10 rounded-full px-5 font-medium text-[13px] transition-all duration-150",
						isLiquid
							? "bg-white/[0.1] text-white/80 ring-1 ring-white/[0.1] hover:bg-white/[0.16] hover:text-white"
							: "bg-primary text-primary-foreground hover:bg-primary/90",
					)}
				>
					Add your first link
				</button>
			</div>
		</div>
	);
}
