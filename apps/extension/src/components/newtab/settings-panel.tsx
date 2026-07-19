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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@perch/ui/components/select";
import { Separator } from "@perch/ui/components/separator";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@perch/ui/components/sheet";
import { Slider } from "@perch/ui/components/slider";
import { Switch } from "@perch/ui/components/switch";
import type { IconName } from "@perch/ui/icons/icon";
import { Icon } from "@perch/ui/icons/icon";
import { type ChangeEvent, type ReactNode, useRef, useState } from "react";
import { GRADIENTS, SEARCH_ENGINES } from "../../lib/constants";
import { exportBackup, importBackup } from "../../services/backup";
import { importBrowserBookmarks } from "../../services/bookmarks-import";
import { useImageStore } from "../../stores/image-store";
import { useSetupStore } from "../../stores/setup-store";
import type { Settings } from "../../types";

const ENGINE_ICONS: Record<string, ReactNode> = {
	google: (
		<svg viewBox="0 0 24 24" className="size-4" xmlns="http://www.w3.org/2000/svg">
			<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
			<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
			<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
			<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
		</svg>
	),
	bing: (
		<svg viewBox="0 0 24 24" className="size-4" xmlns="http://www.w3.org/2000/svg">
			<path d="M4.545 3v18l7.272 3.5L21 17.5l-2.727-2.5-6.363 3.5V10.5L11 13l6-3.636L11.817 3H4.545z" fill="#008373"/>
			<path d="M4.545 21l7.272 3.5V10.5L4.545 7v14z" fill="#006B5E" opacity="0.4"/>
		</svg>
	),
	duckduckgo: (
		<svg viewBox="0 0 24 24" className="size-4" xmlns="http://www.w3.org/2000/svg">
			<circle cx="12" cy="12" r="12" fill="#DE5833"/>
			<path d="M9 8.5c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5m3 0c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
			<path d="M12 18c-2 0-3.5-1-4-2.5m8 0C15.5 17 14 18 12 18" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
			<circle cx="10" cy="8" r="0.75" fill="#14307E"/>
			<circle cx="14" cy="8" r="0.75" fill="#14307E"/>
			<path d="M8 14c1 2 2.5 3 4 3s3-1 4-3" stroke="#3CA82B" strokeWidth="1.2" fill="none"/>
		</svg>
	),
	brave: (
		<svg viewBox="0 0 24 24" className="size-4" xmlns="http://www.w3.org/2000/svg">
			<path d="M12 1L8 5L6 3L3 6L5 8L3 12L6 17L8 16L12 22L16 16L18 17L21 12L19 8L21 6L18 3L16 5L12 1Z" fill="#F15A22"/>
			<path d="M12 18l-3-5 1-4h4l1 4-3 5z" fill="#fff" opacity="0.7"/>
		</svg>
	),
	ecosia: (
		<svg viewBox="0 0 24 24" className="size-4" xmlns="http://www.w3.org/2000/svg">
			<circle cx="12" cy="12" r="11" fill="#3CA82B"/>
			<path d="M12 3C9 3 7 6 7 9c0 3 2 5 5 8 3-3 5-5 5-8 0-3-2-6-5-6z" fill="#fff"/><path d="M12 3C8 3 7 7 7 9c0 3 2 6 5 8V3z" fill="#fff" opacity="0.4"/>
		</svg>
	),
};

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

/**
 * A labelled slider laid out inline — label (and optional value) on the left,
 * the track filling the right half — matching the browser settings reference.
 */
function SliderRow({
	label,
	value,
	suffix = "",
	min,
	max,
	step = 1,
	onChange,
}: {
	label: string;
	value: number;
	suffix?: string;
	min: number;
	max: number;
	step?: number;
	onChange: (value: number) => void;
}) {
	return (
		<div className="flex min-h-[44px] items-center gap-4 border-border/50 border-b px-1 py-2.5 last:border-b-0">
			<div className="flex min-w-0 shrink-0 basis-[46%] flex-col">
				<span className="text-foreground text-sm">{label}</span>
				<span className="text-muted-foreground text-xs tabular-nums">
					{value}
					{suffix}
				</span>
			</div>
			<Slider
				min={min}
				max={max}
				step={step}
				value={[value]}
				onValueChange={(v) => onChange(v[0])}
				className="flex-1"
				aria-label={label}
			/>
		</div>
	);
}

/**
 * A labelled shadcn Select laid out inline — the unified dropdown control for
 * every discrete-choice setting in the sidebar (tile size, layout, max columns,
 * search engine, appearance). Flat styling, no glass.
 */
function SelectRow<T extends string>({
	label,
	value,
	options,
	onChange,
	triggerClassName = "min-w-[120px]",
}: {
	label: string;
	value: T;
	options: readonly { value: T; label: string }[];
	onChange: (value: T) => void;
	triggerClassName?: string;
}) {
	return (
		<SettingRow>
			<span className="text-foreground text-sm">{label}</span>
			<Select
				value={value}
				onValueChange={(v) => v && onChange(v as T)}
				items={options}
			>
				<SelectTrigger
					size="sm"
					className={triggerClassName}
					aria-label={label}
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map((opt) => (
						<SelectItem key={opt.value} value={opt.value}>
							{opt.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</SettingRow>
	);
}

/**
 * A labelled row of icon toggle buttons — an intuitive, wordless selector where
 * each option is represented by a glyph (used for the Card shape aspect ratio).
 * Radix/shadcn Button primitives, flat styling.
 */
function IconChoiceRow<T extends string>({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: T;
	options: readonly { value: T; icon: IconName; label: string }[];
	onChange: (value: T) => void;
}) {
	return (
		<SettingRow>
			<span className="text-foreground text-sm">{label}</span>
			<div className="flex gap-1">
				{options.map((opt) => (
					<Button
						key={opt.value}
						variant={value === opt.value ? "default" : "secondary"}
						size="icon-sm"
						onClick={() => onChange(opt.value)}
						aria-label={opt.label}
						aria-pressed={value === opt.value}
						title={opt.label}
					>
						<Icon name={opt.icon} size={16} />
					</Button>
				))}
			</div>
		</SettingRow>
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
					className="w-[420px] overflow-y-auto sm:w-[460px]"
				>
					<SheetHeader>
						<SheetTitle>Settings</SheetTitle>
					</SheetHeader>

					<div className="space-y-1 px-3 pb-8">
						{/* === Layout === */}
						<SectionCard title="Layout">
							<SelectRow
								label="Tile size"
								value={settings.tileSize}
								options={[
									{ value: "small", label: "Small" },
									{ value: "medium", label: "Medium" },
									{ value: "large", label: "Large" },
								]}
								onChange={(tileSize) => updateSettings({ tileSize })}
							/>

							<SelectRow
								label="Max columns"
								value={String(settings.maxColumns)}
								triggerClassName="min-w-[80px]"
								options={[4, 5, 6, 7, 8, 9, 10].map((n) => ({
									value: String(n),
									label: String(n),
								}))}
								onChange={(v) =>
									updateSettings({ maxColumns: Number.parseInt(v, 10) })
								}
							/>

							<SelectRow
								label="Layout"
								value={settings.dialLayout}
								options={[
									{ value: "card", label: "Card" },
									{ value: "icon", label: "Icon" },
								]}
								onChange={(dialLayout) => updateSettings({ dialLayout })}
							/>

							{settings.dialLayout === "card" && (
								<IconChoiceRow
									label="Card shape"
									value={settings.cardAspect}
									options={[
										{ value: "square", icon: "square", label: "Square" },
										{
											value: "horizontal",
											icon: "rectangle-horizontal",
											label: "Landscape",
										},
										{
											value: "vertical",
											icon: "rectangle-vertical",
											label: "Portrait",
										},
									]}
									onChange={(cardAspect) => updateSettings({ cardAspect })}
								/>
							)}

							{settings.dialLayout === "icon" && (
								<SettingRow>
									<span className="text-foreground text-sm">Show titles</span>
									<Switch
										checked={settings.iconShowLabel}
										onCheckedChange={(v: boolean) =>
											updateSettings({ iconShowLabel: v })
										}
									/>
								</SettingRow>
							)}
						</SectionCard>

						{/* === Speed Dial === */}
						<SectionCard title="Speed Dial">
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

						{/* === Appearance & Background === */}
						<SectionCard title="Appearance & Background">
							<SettingRow>
								<span className="text-foreground text-sm">Theme</span>
								<Select
									value={settings.appearanceMode}
									onValueChange={(v) =>
										v &&
										updateSettings({
											appearanceMode: v as Settings["appearanceMode"],
										})
									}
								>
									<SelectTrigger
										size="sm"
										className="min-w-[130px]"
										aria-label="Theme"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="liquid">Liquid Glass</SelectItem>
										<SelectItem value="classic">Flat</SelectItem>
									</SelectContent>
								</Select>
							</SettingRow>

							<Separator className="my-1" />

							<h4 className="px-0.5 font-medium text-muted-foreground text-xs">
								Background
							</h4>

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

							<SliderRow
								label="Opacity"
								value={bg.opacity}
								suffix="%"
								min={20}
								max={100}
								onChange={(v) =>
									updateBackground({
										opacity: v,
									} as Partial<Settings["background"]>)
								}
							/>
							<SliderRow
								label="Blur"
								value={bg.blur}
								suffix="px"
								min={0}
								max={20}
								onChange={(v) =>
									updateBackground({
										blur: v,
									} as Partial<Settings["background"]>)
								}
							/>
							<SliderRow
								label="Brightness"
								value={bg.brightness}
								suffix="%"
								min={40}
								max={140}
								onChange={(v) =>
									updateBackground({
										brightness: v,
									} as Partial<Settings["background"]>)
								}
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
							{clock.enabled && (
								<SliderRow
									label="Clock size"
									value={clock.size}
									suffix="%"
									min={60}
									max={200}
									step={5}
									onChange={(v) => updateClock({ size: v })}
								/>
							)}
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
								<>
									<SettingRow>
										<span className="text-foreground text-sm">
											Search engine
										</span>
										<Select
											value={search.engine}
											onValueChange={(v) => v && updateSearch({ engine: v })}
										>
											<SelectTrigger
												size="sm"
												className="min-w-[120px]"
												aria-label="Search engine"
											>
												<span className="flex items-center gap-1.5">
													{ENGINE_ICONS[search.engine]}
													<SelectValue />
												</span>
											</SelectTrigger>
											<SelectContent>
												{SEARCH_ENGINES.map((engine) => (
													<SelectItem key={engine.id} value={engine.id}>
														<span className="flex items-center gap-2">
															{ENGINE_ICONS[engine.id]}
															{engine.label}
														</span>
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</SettingRow>

									<SelectRow
										label="Input icon"
										value={search.iconMode}
										options={[
											{ value: "search", label: "Magnifier" },
											{ value: "engine", label: "Engine logo" },
										]}
										onChange={(iconMode) => updateSearch({ iconMode })}
									/>

									<div className="px-1 pt-1 pb-2">
										<Input
											placeholder={`Buscar com "${
												(
													SEARCH_ENGINES.find((e) => e.id === search.engine) ??
													SEARCH_ENGINES[0]
												).label
											}"`}
											value={search.placeholder}
											onChange={(e) =>
												updateSearch({ placeholder: e.target.value })
											}
											className="rounded-xl border-border bg-secondary px-3 py-2 text-foreground text-sm"
										/>
										<p className="mt-1.5 px-1 text-muted-foreground text-xs">
											Custom placeholder — leave empty to name the engine
											automatically.
										</p>
									</div>
								</>
							)}
						</SectionCard>

						{/* === Data & Bookmarks === */}
						<SectionCard title="Data & Bookmarks">
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
							<div className="flex gap-2 px-1 pt-3">
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
