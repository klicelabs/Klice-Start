import { Button } from "@perch/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@perch/ui/components/dialog";
import { Input } from "@perch/ui/components/input";
import { Label } from "@perch/ui/components/label";
import { Separator } from "@perch/ui/components/separator";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@perch/ui/components/sheet";
import { Switch } from "@perch/ui/components/switch";
import { type ChangeEvent, useRef, useState } from "react";
import { GRADIENTS, SEARCH_ENGINES } from "../../lib/constants";
import { exportBackup, importBackup } from "../../services/backup";
import { importBrowserBookmarks } from "../../services/bookmarks-import";
import { useImageStore } from "../../stores/image-store";
import { useSetupStore } from "../../stores/setup-store";
import type { Settings } from "../../types";

interface SettingsPanelProps {
	open: boolean;
	onClose: () => void;
}

function SettingRow({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex min-h-[44px] items-center justify-between gap-3 border-border/50 border-b px-1 py-2.5 last:border-b-0">
			{children}
		</div>
	);
}

function SectionCard({
	title,
	children,
	className = "",
}: {
	title: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div className="flex flex-col gap-4">
			<h3 className="left-1 m-0 px-3 font-medium text-muted-foreground text-sm">
				{title}
			</h3>
			<div
				className={`squircle relative mb-4 rounded-[3rem] border border-border/30 bg-card p-4 pb-3 shadow-sm first:mt-2 ${className}`}
			>
				{children}
			</div>
		</div>
	);
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
	const settings = useSetupStore((s) => s.settings);
	const updateSettings = useSetupStore((s) => s.updateSettings);
	const updateBackground = useSetupStore((s) => s.updateBackground);
	const updateClock = useSetupStore((s) => s.updateClock);
	const updateGreeting = useSetupStore((s) => s.updateGreeting);
	const updateSearch = useSetupStore((s) => s.updateSearch);
	const updateThumbnailCapture = useSetupStore((s) => s.updateThumbnailCapture);
	const resetAll = useSetupStore((s) => s.resetAll);
	const saveBackgroundImage = useImageStore((s) => s.saveBackgroundImage);

	const bgFileRef = useRef<HTMLInputElement>(null);
	const importFileRef = useRef<HTMLInputElement>(null);
	const [importStatus, setImportStatus] = useState("");
	const [confirmReset, setConfirmReset] = useState(false);

	async function handleReset() {
		await resetAll();
		setConfirmReset(false);
		setImportStatus("");
		onClose();
	}

	// === Background ===
	async function handleSolidColor(color: string) {
		updateBackground({ type: "solid", color } as Partial<
			Settings["background"]
		>);
	}
	async function handleGradient(id: string) {
		updateBackground({ type: "gradient", gradientId: id } as Partial<
			Settings["background"]
		>);
	}
	async function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		const dataUrl = await fileToDataUrl(file);
		const imageId = await saveBackgroundImage(dataUrl);
		updateBackground({ type: "image", imageId } as Partial<
			Settings["background"]
		>);
	}

	// === Bookmarks ===
	async function handleImportBookmarks() {
		setImportStatus("Reading bookmarks…");
		try {
			const { foldersCreated, cardsCreated } = await importBrowserBookmarks();
			setImportStatus(
				`Done: ${foldersCreated} folder(s) and ${cardsCreated} link(s) imported.`,
			);
		} catch (err) {
			setImportStatus(
				err instanceof Error ? err.message : "Could not import bookmarks.",
			);
		}
	}

	// === Data ===
	async function handleExport() {
		await exportBackup();
	}
	async function handleImport(e: ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		try {
			await importBackup(await file.text());
			setImportStatus("Data imported successfully.");
		} catch {
			setImportStatus("Invalid file.");
		}
		e.target.value = "";
	}

	const bg = settings.background;
	const clock = settings.clock;
	const greeting = settings.greeting;
	const search = settings.search;

	return (
		<>
			<Sheet
				open={open}
				onOpenChange={(o) => {
					if (!o) onClose();
				}}
			>
				<SheetContent
					side="right"
					className="w-[380px] overflow-y-auto sm:w-[420px]"
				>
					<SheetHeader>
						<SheetTitle>Settings</SheetTitle>
					</SheetHeader>

					<div className="space-y-1 px-3 pb-8">
						{/* === General === */}
						<SectionCard title="General">
							<SettingRow>
								<span className="text-foreground text-sm">Tile size</span>
								<div className="flex gap-1.5">
									{(["small", "medium", "large"] as const).map((size) => (
										<Button
											key={size}
											variant={
												settings.tileSize === size ? "default" : "secondary"
											}
											size="sm"
											onClick={() => updateSettings({ tileSize: size })}
											className="h-auto px-2.5 py-1 text-xs"
										>
											{size.charAt(0).toUpperCase() + size.slice(1)}
										</Button>
									))}
								</div>
							</SettingRow>

							<SettingRow>
								<span className="text-foreground text-sm">Max columns</span>
								<select
									className="min-w-[72px] rounded-xl border border-border bg-secondary px-3 py-2 text-foreground text-xs outline-none focus:border-ring"
									value={settings.maxColumns}
									onChange={(e) =>
										updateSettings({
											maxColumns: Number.parseInt(e.target.value, 10),
										})
									}
								>
									{[4, 5, 6, 7, 8, 9, 10].map((n) => (
										<option key={n} value={n} className="bg-card">
											{n}
										</option>
									))}
								</select>
							</SettingRow>

							<SettingRow>
								<span className="text-foreground text-sm">Show title</span>
								<Switch
									checked={settings.showTitle}
									onCheckedChange={(v: boolean) =>
										updateSettings({ showTitle: v })
									}
								/>
							</SettingRow>

							<SettingRow>
								<span className="text-foreground text-sm">
									Show delete button
								</span>
								<Switch
									checked={settings.showDeleteButton}
									onCheckedChange={(v: boolean) =>
										updateSettings({ showDeleteButton: v })
									}
								/>
							</SettingRow>

							<SettingRow>
								<span className="text-foreground text-sm">Open in new tab</span>
								<Switch
									checked={settings.openInNewTab}
									onCheckedChange={(v: boolean) =>
										updateSettings({ openInNewTab: v })
									}
								/>
							</SettingRow>
						</SectionCard>

						{/* === Background === */}
						<SectionCard title="Background">
							<div className="mt-2 grid grid-cols-4 gap-2">
								{GRADIENTS.map((g) => (
									<button
										key={g.id}
										className="flex aspect-[4/3] items-center justify-center rounded-2xl border-2 border-transparent bg-center bg-cover font-medium text-[10px] text-white/80 shadow-sm transition-transform hover:scale-[1.04]"
										style={{
											background: g.css,
											textShadow: "0 1px 3px rgba(0,0,0,0.5)",
										}}
										onClick={() => handleGradient(g.id)}
									>
										{g.label}
									</button>
								))}
								<button
									className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-border/60 border-dashed font-medium text-[10px] text-muted-foreground transition-transform hover:scale-[1.04]"
									style={{ backgroundColor: bg.color }}
									onClick={() => handleSolidColor(bg.color)}
								>
									<span>Color</span>
								</button>
								<label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-border/60 border-dashed font-medium text-[10px] text-muted-foreground transition-transform hover:scale-[1.04]">
									<svg
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="1.8"
									>
										<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
									</svg>
									Image
									<input
										ref={bgFileRef}
										type="file"
										accept="image/*"
										className="hidden"
										onChange={handleImageUpload}
									/>
								</label>
							</div>

							<div className="mt-3 flex items-center gap-2">
								<input
									type="color"
									value={bg.color}
									onChange={(e) => handleSolidColor(e.target.value)}
									className="h-[22px] w-[22px] cursor-pointer rounded-full border-2 border-border/30 bg-transparent p-0"
								/>
								<span className="text-muted-foreground text-xs">
									Custom color
								</span>
							</div>

							<SettingRow>
								<span className="text-foreground text-sm">Opacity</span>
								<span className="text-muted-foreground text-xs">
									{bg.opacity}%
								</span>
							</SettingRow>
							<input
								type="range"
								min={20}
								max={100}
								value={bg.opacity}
								onChange={(e) =>
									updateBackground({
										opacity: Number.parseInt(e.target.value, 10),
									} as Partial<Settings["background"]>)
								}
								className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border [&::-webkit-slider-thumb]:mt-[-6.5px] [&::-webkit-slider-thumb]:h-[17px] [&::-webkit-slider-thumb]:w-[17px] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md"
							/>

							<SettingRow>
								<span className="text-foreground text-sm">Blur</span>
								<span className="text-muted-foreground text-xs">
									{bg.blur}px
								</span>
							</SettingRow>
							<input
								type="range"
								min={0}
								max={20}
								value={bg.blur}
								onChange={(e) =>
									updateBackground({
										blur: Number.parseInt(e.target.value, 10),
									} as Partial<Settings["background"]>)
								}
								className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border [&::-webkit-slider-thumb]:mt-[-6.5px] [&::-webkit-slider-thumb]:h-[17px] [&::-webkit-slider-thumb]:w-[17px] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md"
							/>

							<SettingRow>
								<span className="text-foreground text-sm">Brightness</span>
								<span className="text-muted-foreground text-xs">
									{bg.brightness}%
								</span>
							</SettingRow>
							<input
								type="range"
								min={40}
								max={140}
								value={bg.brightness}
								onChange={(e) =>
									updateBackground({
										brightness: Number.parseInt(e.target.value, 10),
									} as Partial<Settings["background"]>)
								}
								className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border [&::-webkit-slider-thumb]:mt-[-6.5px] [&::-webkit-slider-thumb]:h-[17px] [&::-webkit-slider-thumb]:w-[17px] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md"
							/>
						</SectionCard>

						{/* === Clock === */}
						<SectionCard title="Clock & Greeting">
							<SettingRow>
								<span className="text-foreground text-sm">Enable clock</span>
								<Switch
									checked={clock.enabled}
									onCheckedChange={(v: boolean) => updateClock({ enabled: v })}
								/>
							</SettingRow>
							<SettingRow>
								<span className="text-foreground text-sm">24-hour format</span>
								<Switch
									checked={clock.format24}
									onCheckedChange={(v: boolean) => updateClock({ format24: v })}
								/>
							</SettingRow>
							<SettingRow>
								<span className="text-foreground text-sm">Show seconds</span>
								<Switch
									checked={clock.showSeconds}
									onCheckedChange={(v: boolean) =>
										updateClock({ showSeconds: v })
									}
								/>
							</SettingRow>
							<SettingRow>
								<span className="text-foreground text-sm">Greeting</span>
								<Switch
									checked={greeting.enabled}
									onCheckedChange={(v: boolean) =>
										updateGreeting({ enabled: v })
									}
								/>
							</SettingRow>
							{greeting.enabled && (
								<div className="px-1 pt-1 pb-2">
									<Input
										placeholder="Your name"
										value={greeting.name}
										onChange={(e) => updateGreeting({ name: e.target.value })}
										className="rounded-xl border-border bg-secondary px-3 py-2 text-foreground text-sm"
									/>
								</div>
							)}
						</SectionCard>

						{/* === Search === */}
						<SectionCard title="Search">
							<SettingRow>
								<span className="text-foreground text-sm">Show search bar</span>
								<Switch
									checked={search.enabled}
									onCheckedChange={(v: boolean) => updateSearch({ enabled: v })}
								/>
							</SettingRow>
							{search.enabled && (
								<SettingRow>
									<span className="text-foreground text-sm">Search engine</span>
									<select
										className="min-w-[120px] rounded-xl border border-border bg-secondary px-3 py-2 text-foreground text-xs outline-none focus:border-ring"
										value={search.engine}
										onChange={(e) => updateSearch({ engine: e.target.value })}
									>
										{SEARCH_ENGINES.map((engine) => (
											<option
												key={engine.id}
												value={engine.id}
												className="bg-card"
											>
												{engine.label}
											</option>
										))}
									</select>
								</SettingRow>
							)}
						</SectionCard>

						{/* === Bookmarks === */}
						<SectionCard title="Bookmarks">
							<SettingRow>
								<span className="text-foreground text-sm">
									Auto-capture thumbnails
								</span>
								<Switch
									checked={settings.thumbnailCapture.enabled}
									onCheckedChange={(v: boolean) =>
										updateThumbnailCapture({ enabled: v })
									}
								/>
							</SettingRow>
							<div className="px-1 pt-1">
								<Button
									variant="secondary"
									className="w-full rounded-xl text-sm"
									onClick={handleImportBookmarks}
								>
									Import bookmarks
								</Button>
								{importStatus && (
									<p className="mt-2 text-muted-foreground text-xs">
										{importStatus}
									</p>
								)}
							</div>
						</SectionCard>

						{/* === Data === */}
						<SectionCard title="Data">
							<div className="flex gap-2 px-1 pt-1">
								<Button
									variant="secondary"
									className="flex-1 rounded-xl text-sm"
									onClick={handleExport}
								>
									Export JSON
								</Button>
								<Button
									variant="secondary"
									className="flex-1 rounded-xl text-sm"
									onClick={() => importFileRef.current?.click()}
								>
									Import JSON
								</Button>
							</div>
							<input
								ref={importFileRef}
								type="file"
								accept="application/json"
								className="hidden"
								onChange={handleImport}
							/>
							<div className="px-1 pt-3 pb-1">
								<Button
									variant="ghost"
									className="w-full rounded-xl border border-red-500/30 text-red-500 text-sm hover:bg-red-500/10"
									onClick={() => setConfirmReset(true)}
								>
									Reset all
								</Button>
							</div>
						</SectionCard>
					</div>
				</SheetContent>
			</Sheet>

			<Dialog
				open={confirmReset}
				onOpenChange={(o) => {
					if (!o) setConfirmReset(false);
				}}
			>
				<DialogContent className="sm:max-w-[400px]">
					<DialogHeader>
						<DialogTitle>Reset everything?</DialogTitle>
						<DialogDescription>
							This permanently deletes all folders, links, thumbnails, and
							background images. This cannot be undone. Export a backup first if
							you want to keep your data.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="ghost" onClick={() => setConfirmReset(false)}>
							Cancel
						</Button>
						<Button
							className="border-red-500/30 bg-red-500/90 text-white hover:bg-red-500"
							onClick={handleReset}
						>
							Reset all
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

function fileToDataUrl(file: File): Promise<string> {
	const { promise, resolve, reject } = Promise.withResolvers<string>();
	const reader = new FileReader();
	reader.onload = () => resolve(reader.result as string);
	reader.onerror = reject;
	reader.readAsDataURL(file);
	return promise;
}
