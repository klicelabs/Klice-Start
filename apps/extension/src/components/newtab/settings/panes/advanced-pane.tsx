import { Button } from "@klice-start/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@klice-start/ui/components/dialog";
import { useState } from "react";
import { useSetupStore } from "../../../../stores/setup-store";
import type { Card } from "../../../../types";
import { SectionCard } from "../shared/section-card";

interface AdvancedPaneProps {
	onCloseParent?: () => void;
}

export function AdvancedPane({ onCloseParent }: AdvancedPaneProps) {
	const folders = useSetupStore((s) => s.folders);
	const cards = useSetupStore((s) => s.cards as Card[]);
	const customWallpapers = useSetupStore((s) => s.settings.background.customWallpapers ?? []);
	const resetAll = useSetupStore((s) => s.resetAll);

	const [confirmResetOpen, setConfirmResetOpen] = useState(false);
	const [isResetting, setIsResetting] = useState(false);

	async function handlePerformReset() {
		setIsResetting(true);
		try {
			await resetAll();
			setConfirmResetOpen(false);
			onCloseParent?.();
		} finally {
			setIsResetting(false);
		}
	}

	return (
		<div className="space-y-2">
			{/* System & Storage Footprint */}
			<SectionCard
				title="Storage & statistics"
				description="Local IndexedDB and extension storage usage overview"
			>
				<div className="grid grid-cols-3 gap-3 py-2.5">
					<div className="flex flex-col rounded-xl bg-secondary/40 p-3">
						<span className="text-muted-foreground text-xs">Total folders</span>
						<span className="font-semibold text-foreground text-lg">{folders.length}</span>
					</div>
					<div className="flex flex-col rounded-xl bg-secondary/40 p-3">
						<span className="text-muted-foreground text-xs">Total bookmarks</span>
						<span className="font-semibold text-foreground text-lg">{cards.length}</span>
					</div>
					<div className="flex flex-col rounded-xl bg-secondary/40 p-3">
						<span className="text-muted-foreground text-xs">Custom wallpapers</span>
						<span className="font-semibold text-foreground text-lg">{customWallpapers.length}</span>
					</div>
				</div>
			</SectionCard>

			{/* Danger Zone */}
			<SectionCard
				title="Danger zone"
				description="Irreversible actions that affect your local data"
				className="border-destructive/30"
			>
				<div className="flex items-center justify-between py-2.5">
					<div className="flex flex-col">
						<span className="font-medium text-destructive text-sm">Reset all dashboard data</span>
						<span className="text-muted-foreground text-xs">
							Permanently erases all folders, links, custom wallpapers, and stored thumbnails
						</span>
					</div>
					<Button
						type="button"
						variant="destructive"
						size="sm"
						onClick={() => setConfirmResetOpen(true)}
						className="h-8 rounded-lg text-xs"
					>
						Reset all data
					</Button>
				</div>
			</SectionCard>

			{/* Reset Confirmation Dialog */}
			<Dialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
				<DialogContent className="sm:max-w-[420px]">
					<DialogHeader>
						<DialogTitle>Reset all dashboard data?</DialogTitle>
						<DialogDescription>
							This will permanently delete all {cards.length} bookmark{cards.length === 1 ? "" : "s"} across {folders.length} folder{folders.length === 1 ? "" : "s"}, your custom uploaded wallpapers, and all thumbnail caches. This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="pt-2">
						<Button
							type="button"
							variant="ghost"
							onClick={() => setConfirmResetOpen(false)}
							disabled={isResetting}
						>
							Cancel
						</Button>
						<Button
							type="button"
							variant="destructive"
							onClick={handlePerformReset}
							disabled={isResetting}
						>
							{isResetting ? "Resetting…" : "Yes, reset everything"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
