import { RECOMMENDED_SITES } from "../../lib/recommended-sites";
import { faviconUrl } from "../../lib/url";
import { cn } from "../../lib/utils";
import { useSetupStore } from "../../stores/setup-store";
import { useAppearance } from "./appearance-provider";

interface EmptyLandingProps {
	/** Current folder name to show as a badge. */
	folderName: string;
	/** Callback when the user clicks the action button. */
	onAdd: () => void;
}

const STARTER_SUGGESTIONS = RECOMMENDED_SITES.slice(0, 6);

export function EmptyLanding({ folderName, onAdd }: EmptyLandingProps) {
	const { isLiquid } = useAppearance();
	const activeFolderId = useSetupStore((s) => s.activeFolderId);
	const addCard = useSetupStore((s) => s.addCard);

	function handleAddStarter(site: (typeof STARTER_SUGGESTIONS)[0]) {
		addCard({
			folderId: activeFolderId,
			title: site.name,
			url: site.url,
			favicon: faviconUrl(site.url),
			thumbId: null,
		});
	}

	const isMac =
		typeof navigator !== "undefined" &&
		/Mac|iPhone|iPad|iPod/.test(navigator.platform);
	const shortcutKey = isMac ? "⌘⇧D" : "Ctrl+Shift+D";

	return (
		<div className="flex items-start justify-center px-6 py-4">
			<div
				className="flex max-w-md flex-col items-center text-center"
				style={{ animation: "emptyLandingIn 220ms ease-out both" }}
			>
				{/* Folder badge */}
				<div
					className={cn(
						"mb-4 rounded-full px-3 py-1 font-medium text-xs shadow-xs",
						isLiquid
							? "border border-white/10 bg-white/10 text-white/70 backdrop-blur-md"
							: "border border-border bg-muted text-muted-foreground",
					)}
				>
					{folderName}
				</div>

				<h2 className="font-semibold text-foreground text-lg tracking-tight">
					This folder is empty
				</h2>

				<p className="mt-2 max-w-sm text-muted-foreground text-xs leading-relaxed">
					Add a link manually, pick from the quick suggestions below, or press{" "}
					<kbd
						className={cn(
							"rounded px-1.5 py-0.5 font-mono text-[11px]",
							isLiquid
								? "border border-white/15 bg-white/10 text-white/90"
								: "border border-border bg-muted text-foreground",
						)}
					>
						{shortcutKey}
					</kbd>{" "}
					on any web page to save it here.
				</p>

				{/* Primary Action */}
				<button
					type="button"
					onClick={onAdd}
					className={cn(
						"mt-5 h-9 rounded-full px-5 font-medium text-xs transition-[background-color,color,transform,box-shadow] duration-150 ease-out active:scale-[0.97]",
						isLiquid
							? "border border-white/20 bg-white/15 text-white shadow-xs backdrop-blur-md hover:bg-white/25 hover:shadow-sm"
							: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
					)}
				>
					Add custom link
				</button>

				{/* Quick starter chips */}
				<div className="mt-8 flex flex-col items-center gap-2.5">
					<span className="font-medium text-[11px] text-muted-foreground/80 uppercase tracking-wider">
						Quick Add Popular Sites
					</span>
					<div className="flex flex-wrap items-center justify-center gap-1.5">
						{STARTER_SUGGESTIONS.map((site) => (
							<button
								key={site.url}
								type="button"
								onClick={() => handleAddStarter(site)}
								className={cn(
									"flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97]",
									isLiquid
										? "border border-white/10 bg-white/[0.08] text-white/80 hover:bg-white/20 hover:text-white"
										: "border border-border/70 bg-card text-foreground hover:bg-muted",
								)}
								title={`Add ${site.name} to ${folderName}`}
							>
								<img
									src={faviconUrl(site.url)}
									alt=""
									className="size-3.5 rounded-xs"
									onError={(e) => {
										e.currentTarget.style.display = "none";
									}}
								/>
								<span>{site.name}</span>
								<span className="opacity-50">+</span>
							</button>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
