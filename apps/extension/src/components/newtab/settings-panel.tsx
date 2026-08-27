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
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useSvgIcon } from "../../hooks/use-svg-icon";
import { GRADIENTS, SEARCH_ENGINES } from "../../lib/constants";
import { flushPersist } from "../../lib/storage";
import { SEARCH_ENGINE_TO_SVGL } from "../../lib/svgl-mapping";
import {
	exportBookmarksHtml,
	importBookmarksHtml,
} from "../../services/bookmarks-html";
import { refreshWallpaper } from "../../services/wallpaper";
import { useImageStore } from "../../stores/image-store";
import { useSetupStore } from "../../stores/setup-store";
import type { Settings, WallpaperFrequency } from "../../types";
import { SvgIcon } from "../shared/svg-icon";

function EngineIcon({ engineId }: { engineId: string }) {
	const svglTitle = SEARCH_ENGINE_TO_SVGL[engineId];
	const { svgXml, isLoading } = useSvgIcon(svglTitle ?? null);

	if (isLoading || !svgXml) {
		const label = SEARCH_ENGINES.find((e) => e.id === engineId)?.label ?? "?";
		return (
			<span className="flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-muted font-bold text-[9px] text-muted-foreground">
				{label.charAt(0)}
			</span>
		);
	}

	return (
		<SvgIcon svgXml={svgXml} className="size-4 shrink-0" alt={svglTitle} />
	);
}

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
	const [local, setLocal] = useState(value);
	const dragging = useRef(false);

	useEffect(() => {
		if (!dragging.current) setLocal(value);
	}, [value]);

	return (
		<div className="flex min-h-[44px] items-center gap-4 border-border/50 border-b px-1 py-2.5 last:border-b-0">
			<div className="flex min-w-0 shrink-0 basis-[46%] flex-col">
				<span className="text-foreground text-sm">{label}</span>
				<span className="text-muted-foreground text-xs tabular-nums">
					{local}
					{suffix}
				</span>
			</div>
			<Slider
				min={min}
				max={max}
				step={step}
				value={[local]}
				onValueChange={([v]) => {
					dragging.current = true;
					setLocal(v);
					onChange(v);
				}}
				onValueCommit={() => {
					dragging.current = false;
					flushPersist();
				}}
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

function PexelsQueryInput({
	value,
	onChange,
}: {
	value: string;
	onChange: (val: string) => void;
}) {
	const [localVal, setLocalVal] = useState(value);
	const timerRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		setLocalVal(value);
	}, [value]);

	return (
		<Input
			value={localVal}
			onChange={(e) => {
				const val = e.target.value;
				setLocalVal(val);
				if (timerRef.current) clearTimeout(timerRef.current);
				timerRef.current = setTimeout(() => {
					onChange(val);
				}, 500);
			}}
			onBlur={() => {
				if (timerRef.current) clearTimeout(timerRef.current);
				if (localVal !== value) {
					onChange(localVal);
				}
			}}
			placeholder="minimalist background, dark architecture"
			className="mt-1 rounded-xl border-border bg-secondary px-3 py-2 text-foreground text-sm"
		/>
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
		<div className="flex flex-col">
			<h3 className="m-0 mb-1.5 px-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
				{title}
			</h3>
			<div
				className={`relative mb-4 rounded-2xl border border-border/40 bg-card/60 px-4 py-1 ${className}`}
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
	async function handleImportBookmarksFile(e: ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		setImportStatus("Reading bookmarks…");
		try {
			const { foldersCreated, cardsCreated } = await importBookmarksHtml(
				await file.text(),
			);
			setImportStatus(
				`Done: ${foldersCreated} folder(s) and ${cardsCreated} link(s) imported.`,
			);
		} catch (err) {
			setImportStatus(
				err instanceof Error ? err.message : "Could not import bookmarks.",
			);
		}
		e.target.value = "";
	}

	async function handleExportBookmarks() {
		try {
			await exportBookmarksHtml();
		} catch (err) {
			setImportStatus(
				err instanceof Error ? err.message : "Could not export bookmarks.",
			);
		}
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
					className="settings-sheet w-[540px] overflow-y-auto sm:w-[600px]"
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
										type="button"
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
									type="button"
									className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-border/60 border-dashed font-medium text-[10px] text-muted-foreground transition-transform hover:scale-[1.04]"
									style={{ backgroundColor: bg.color }}
									onClick={() => handleSolidColor(bg.color)}
								>
									<span>Color</span>
								</button>
								<label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-border/60 border-dashed font-medium text-[10px] text-muted-foreground transition-transform hover:scale-[1.04]">
									<svg
										aria-hidden="true"
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

							<Separator className="my-2" />

							<div className="flex items-center justify-between">
								<span className="font-medium text-foreground text-sm">
									Pexels Wallpaper
								</span>
								<Switch
									checked={bg.type === "pexels"}
									onCheckedChange={(enabled) => {
										if (enabled) {
											updateBackground({ type: "pexels" } as Partial<
												Settings["background"]
											>);
											refreshWallpaper(true);
										} else {
											updateBackground({
												type: "solid",
												gradientId: null,
												imageId: null,
												pexelsImageId: null,
												pexelsLastFetched: null,
												pexelsLastPeriod: null,
												pexelsPreviousFrequency: null,
											} as Partial<Settings["background"]>);
										}
									}}
								/>
							</div>

							{bg.type === "pexels" && (
								<div className="mt-2 space-y-2">
									<div>
										<Label className="text-muted-foreground text-xs">
											Search query
										</Label>
										<PexelsQueryInput
											value={bg.pexelsQuery}
											onChange={(newQuery) => {
												updateBackground({
													pexelsQuery: newQuery,
												} as Partial<Settings["background"]>);
												refreshWallpaper(true);
											}}
										/>
									</div>
									<div>
										<Label className="text-muted-foreground text-xs">
											Frequency
										</Label>
										<Select
											value={bg.pexelsFrequency}
											onValueChange={(v) => {
												if (!v) return;
												const newFreq = v as WallpaperFrequency;
												const currentFreq = bg.pexelsFrequency;
												if (newFreq === currentFreq) return;

												if (newFreq === "locked") {
													updateBackground({
														pexelsFrequency: "locked",
														pexelsPreviousFrequency:
															currentFreq !== "locked"
																? currentFreq
																: bg.pexelsPreviousFrequency || "daily",
													} as Partial<Settings["background"]>);
												} else {
													updateBackground({
														pexelsFrequency: newFreq,
														pexelsPreviousFrequency: null,
													} as Partial<Settings["background"]>);
													refreshWallpaper(true);
												}
											}}
										>
											<SelectTrigger
												size="sm"
												className="mt-1 min-w-[130px]"
												aria-label="Wallpaper frequency"
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="per-tab">Every tab</SelectItem>
												<SelectItem value="hourly">Hourly</SelectItem>
												<SelectItem value="daily">Daily</SelectItem>
												<SelectItem value="daylight">Daylight</SelectItem>
												<SelectItem value="locked">Locked</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>
							)}
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
													<EngineIcon engineId={search.engine} />
													<SelectValue />
												</span>
											</SelectTrigger>
											<SelectContent>
												{SEARCH_ENGINES.map((engine) => (
													<SelectItem key={engine.id} value={engine.id}>
														<span className="flex items-center gap-2">
															<EngineIcon engineId={engine.id} />
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
											placeholder={`Search with "${
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
							<div className="px-1 py-2">
								<div className="flex gap-2">
									<Button
										variant="secondary"
										className="flex-1 rounded-xl text-sm"
										onClick={() => importFileRef.current?.click()}
									>
										Import Bookmarks
									</Button>
									<Button
										variant="secondary"
										className="flex-1 rounded-xl text-sm"
										onClick={handleExportBookmarks}
									>
										Export Bookmarks
									</Button>
								</div>
								{importStatus && (
									<p className="mt-2 text-muted-foreground text-xs">
										{importStatus}
									</p>
								)}
							</div>
							<input
								ref={importFileRef}
								type="file"
								accept="text/html,.htm,.html"
								className="hidden"
								onChange={handleImportBookmarksFile}
							/>
						</SectionCard>

						{/* === Reset === */}
						<div className="pt-4 pb-2 text-center">
							<button
								type="button"
								className="rounded-sm border-0 bg-transparent text-muted-foreground text-xs transition-colors hover:text-red-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/30"
								onClick={() => setConfirmReset(true)}
							>
								Reset all data
							</button>
						</div>
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
							background images. This cannot be undone. Export your bookmarks
							first if you want to keep your links.
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
