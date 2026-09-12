import { Button } from "@klice-start/ui/components/button";
import { Input } from "@klice-start/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@klice-start/ui/components/select";
import { Switch } from "@klice-start/ui/components/switch";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import {
	GRADIENTS,
	MAX_BACKGROUND_IMAGE_BYTES,
	WALLPAPERS,
} from "../../../../lib/constants";
import { cn } from "../../../../lib/utils";
import { refreshWallpaper } from "../../../../services/wallpaper";
import { useImageStore } from "../../../../stores/image-store";
import { useSetupStore } from "../../../../stores/setup-store";
import type {
	AppearanceMode,
	Settings,
	WallpaperFrequency,
} from "../../../../types";
import { SectionCard } from "../shared/section-card";
import { SelectRow } from "../shared/select-row";
import { SettingRow } from "../shared/setting-row";
import { SliderRow } from "../shared/slider-row";

const THEME_OPTIONS = [
	{ value: "liquid", label: "Liquid (Frosted glass)" },
	{ value: "classic", label: "Classic (Solid flat)" },
] as const;

const PEXELS_FREQUENCY_OPTIONS: readonly {
	value: WallpaperFrequency;
	label: string;
}[] = [
	{ value: "daily", label: "Daily" },
	{ value: "hourly", label: "Hourly" },
	{ value: "per-tab", label: "Every new tab" },
	{ value: "daylight", label: "Daylight (Morning / Afternoon / Night)" },
	{ value: "locked", label: "Locked (Keep current)" },
];

/** Downscale large user images to ≤2560px on the longest edge before storing. */
async function downscaleImageFile(
	file: File,
	maxDimension = 2560,
): Promise<string> {
	const bitmap = await createImageBitmap(file);
	let { width, height } = bitmap;

	if (width > maxDimension || height > maxDimension) {
		if (width > height) {
			height = Math.round((height * maxDimension) / width);
			width = maxDimension;
		} else {
			width = Math.round((width * maxDimension) / height);
			height = maxDimension;
		}
	}

	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Could not initialize image processor.");

	ctx.drawImage(bitmap, 0, 0, width, height);
	bitmap.close();

	return canvas.toDataURL("image/jpeg", 0.88);
}

export function AppearancePane() {
	const appearanceMode = useSetupStore((s) => s.settings.appearanceMode);
	const colorScheme = useSetupStore((s) => s.settings.colorScheme ?? "auto");
	const clock = useSetupStore((s) => s.settings.clock);
	const greeting = useSetupStore((s) => s.settings.greeting);
	const bg = useSetupStore((s) => s.settings.background);

	const updateSettings = useSetupStore((s) => s.updateSettings);
	const updateClock = useSetupStore((s) => s.updateClock);
	const updateGreeting = useSetupStore((s) => s.updateGreeting);
	const updateBackground = useSetupStore((s) => s.updateBackground);

	const saveBackgroundImage = useImageStore((s) => s.saveBackgroundImage);
	const deleteBackgroundImage = useImageStore((s) => s.deleteBackgroundImage);
	const getBackgroundImage = useImageStore((s) => s.getBackgroundImage);

	const bgFileRef = useRef<HTMLInputElement>(null);
	const [uploadStatus, setUploadStatus] = useState("");
	const [customPreviews, setCustomPreviews] = useState<
		Record<string, string | null>
	>({});
	const customWallpapers = bg.customWallpapers ?? [];

	// Load previews for custom wallpapers
	useEffect(() => {
		let active = true;
		if (customWallpapers.length === 0) {
			setCustomPreviews({});
			return;
		}

		Promise.all(
			customWallpapers.map(async (w) => {
				try {
					const dataUrl = await getBackgroundImage(w.id);
					return [w.id, dataUrl] as const;
				} catch {
					return [w.id, null] as const;
				}
			}),
		).then((entries) => {
			if (!active) return;
			const map: Record<string, string | null> = {};
			for (const [id, url] of entries) map[id] = url;
			setCustomPreviews(map);
		});

		return () => {
			active = false;
		};
	}, [customWallpapers, getBackgroundImage]);

	function handleSelectWallpaper(id: string) {
		updateBackground({
			type: "wallpaper",
			wallpaperId: id,
			gradientId: null,
			imageId: null,
		} as Partial<Settings["background"]>);
	}

	function handleSelectGradient(id: string) {
		updateBackground({
			type: "gradient",
			gradientId: id,
			wallpaperId: null,
			imageId: null,
		} as Partial<Settings["background"]>);
	}

	function handleSelectCustomImage(id: string) {
		updateBackground({
			type: "image",
			imageId: id,
			wallpaperId: null,
			gradientId: null,
		} as Partial<Settings["background"]>);
	}

	async function handleDeleteCustomImage(e: React.MouseEvent, id: string) {
		e.stopPropagation();
		await deleteBackgroundImage(id);
		const remaining = customWallpapers.filter((w) => w.id !== id);
		const isCurrentlyActive = bg.type === "image" && bg.imageId === id;
		updateBackground({
			customWallpapers: remaining,
			...(isCurrentlyActive
				? { type: "wallpaper", wallpaperId: "tokyo-skyline", imageId: null }
				: {}),
		} as Partial<Settings["background"]>);
	}

	async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;

		try {
			if (!file.type.startsWith("image/")) {
				throw new Error("Please choose an image file.");
			}
			if (file.size > MAX_BACKGROUND_IMAGE_BYTES) {
				throw new Error("Image must be 10 MB or smaller.");
			}
			setUploadStatus("Processing & optimizing image…");
			const dataUrl = await downscaleImageFile(file);
			const savedId = await saveBackgroundImage(dataUrl);

			const name =
				file.name.replace(/\.[^/.]+$/, "").trim() || "Uploaded wallpaper";
			const updatedList = [
				...customWallpapers.filter((w) => w.id !== savedId),
				{ id: savedId, name },
			];

			updateBackground({
				type: "image",
				imageId: savedId,
				wallpaperId: null,
				gradientId: null,
				customWallpapers: updatedList,
			} as Partial<Settings["background"]>);

			setCustomPreviews((prev) => ({ ...prev, [savedId]: dataUrl }));
			setUploadStatus(`Added "${name}"`);
			setTimeout(() => setUploadStatus(""), 3000);
		} catch (err) {
			setUploadStatus(
				err instanceof Error ? err.message : "Failed to load image.",
			);
		} finally {
			e.target.value = "";
		}
	}

	return (
		<div className="space-y-2">
			{/* Appearance Color Scheme Selector (macOS Style: Auto / Light / Dark) */}
			<SectionCard title="Appearance">
				<div className="py-2.5">
					<div className="grid grid-cols-3 gap-3">
						{/* Auto */}
						<button
							type="button"
							onClick={() => updateSettings({ colorScheme: "auto" })}
							aria-label="Use automatic appearance"
							aria-pressed={colorScheme === "auto"}
							className={cn(
								"group flex flex-col items-center gap-2 rounded-xl p-2 transition-[box-shadow,transform] duration-150 focus-visible:outline-none active:scale-[0.98]",
								colorScheme === "auto"
									? "shadow-xs ring-2 ring-primary ring-offset-2 ring-offset-background"
									: "hover:bg-foreground/5",
							)}
						>
							<div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-border/60 bg-gradient-to-r from-neutral-200 via-neutral-200 to-neutral-900 p-1 shadow-2xs">
								<div className="flex h-3 w-full items-center justify-between border-border/40 border-b bg-background/50 px-1 backdrop-blur-xs">
									<div className="flex gap-1">
										<div className="size-1.5 rounded-full bg-red-400" />
										<div className="size-1.5 rounded-full bg-amber-400" />
										<div className="size-1.5 rounded-full bg-emerald-400" />
									</div>
								</div>
								<div className="mt-1.5 flex justify-center">
									<div className="h-2 w-8 rounded-full bg-foreground/20" />
								</div>
							</div>
							<span
								className={cn(
									"font-medium text-xs",
									colorScheme === "auto"
										? "font-medium text-primary"
										: "text-muted-foreground",
								)}
							>
								Auto
							</span>
						</button>

						{/* Light */}
						<button
							type="button"
							onClick={() => updateSettings({ colorScheme: "light" })}
							aria-label="Use light appearance"
							aria-pressed={colorScheme === "light"}
							className={cn(
								"group flex flex-col items-center gap-2 rounded-xl p-2 transition-[box-shadow,transform] duration-150 focus-visible:outline-none active:scale-[0.98]",
								colorScheme === "light"
									? "shadow-xs ring-2 ring-primary ring-offset-2 ring-offset-background"
									: "hover:bg-foreground/5",
							)}
						>
							<div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-neutral-300 bg-neutral-100 p-1 shadow-2xs">
								<div className="flex h-3 w-full items-center justify-between border-neutral-300 border-b bg-white px-1">
									<div className="flex gap-1">
										<div className="size-1.5 rounded-full bg-red-400" />
										<div className="size-1.5 rounded-full bg-amber-400" />
										<div className="size-1.5 rounded-full bg-emerald-400" />
									</div>
								</div>
								<div className="mt-1.5 flex justify-center">
									<div className="h-2 w-8 rounded-full bg-neutral-300" />
								</div>
							</div>
							<span
								className={cn(
									"font-medium text-xs",
									colorScheme === "light"
										? "font-medium text-primary"
										: "text-muted-foreground",
								)}
							>
								Light
							</span>
						</button>

						{/* Dark */}
						<button
							type="button"
							onClick={() => updateSettings({ colorScheme: "dark" })}
							aria-label="Use dark appearance"
							aria-pressed={colorScheme === "dark"}
							className={cn(
								"group flex flex-col items-center gap-2 rounded-xl p-2 transition-[box-shadow,transform] duration-150 focus-visible:outline-none active:scale-[0.98]",
								colorScheme === "dark"
									? "shadow-xs ring-2 ring-primary ring-offset-2 ring-offset-background"
									: "hover:bg-foreground/5",
							)}
						>
							<div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900 p-1 shadow-2xs">
								<div className="flex h-3 w-full items-center justify-between border-neutral-800 border-b bg-neutral-950 px-1">
									<div className="flex gap-1">
										<div className="size-1.5 rounded-full bg-red-400" />
										<div className="size-1.5 rounded-full bg-amber-400" />
										<div className="size-1.5 rounded-full bg-emerald-400" />
									</div>
								</div>
								<div className="mt-1.5 flex justify-center">
									<div className="h-2 w-8 rounded-full bg-neutral-700" />
								</div>
							</div>
							<span
								className={cn(
									"font-medium text-xs",
									colorScheme === "dark"
										? "font-medium text-primary"
										: "text-muted-foreground",
								)}
							>
								Dark
							</span>
						</button>
					</div>
				</div>
			</SectionCard>

			{/* Theme Material */}
			<SectionCard title="Material style">
				<SelectRow
					label="Surface material"
					value={appearanceMode}
					options={THEME_OPTIONS}
					onChange={(v) =>
						updateSettings({ appearanceMode: v as AppearanceMode })
					}
				/>
			</SectionCard>

			{/* Curated Wallpapers */}
			<SectionCard
				title="Curated wallpapers"
				description="High-resolution photography optimized for instant loading"
			>
				<div className="my-2 grid grid-cols-4 gap-2.5">
					{WALLPAPERS.map((wp) => {
						const isSelected =
							bg.type === "wallpaper" && bg.wallpaperId === wp.id;
						return (
							<button
								type="button"
								key={wp.id}
								onClick={() => handleSelectWallpaper(wp.id)}
								className={cn(
									"group relative flex aspect-[16/10] flex-col justify-end overflow-hidden rounded-xl border border-white/10 bg-muted/40 p-1.5 text-left transition-[transform,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]",
									isSelected
										? "shadow-sm ring-2 ring-foreground/90 ring-offset-2 ring-offset-background"
										: "hover:scale-[1.02] hover:shadow-xs",
								)}
								title={wp.label}
								aria-pressed={isSelected}
							>
								<img
									src={wp.thumb}
									alt={wp.label}
									className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
									loading="lazy"
								/>
								<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
								<span className="relative z-10 truncate font-medium text-[11px] text-white/90 drop-shadow-xs">
									{wp.label}
								</span>
								{isSelected && (
									<div className="absolute top-1.5 right-1.5 z-10 flex size-4 items-center justify-center rounded-full bg-white text-black shadow-xs">
										<svg
											aria-hidden="true"
											width="10"
											height="10"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="3.5"
										>
											<polyline points="20 6 9 17 4 12" />
										</svg>
									</div>
								)}
							</button>
						);
					})}
				</div>
			</SectionCard>

			{/* Custom Wallpapers */}
			<SectionCard
				title="Custom wallpapers"
				action={
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() => bgFileRef.current?.click()}
						className="h-7 gap-1.5 rounded-lg text-xs"
					>
						<svg
							aria-hidden="true"
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.5"
						>
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
						</svg>
						Upload image
					</Button>
				}
			>
				<input
					ref={bgFileRef}
					type="file"
					accept="image/*"
					className="hidden"
					onChange={handleUpload}
				/>

				{customWallpapers.length > 0 ? (
					<div className="my-2 grid grid-cols-4 gap-2.5">
						{customWallpapers.map((cw) => {
							const isSelected = bg.type === "image" && bg.imageId === cw.id;
							const previewSrc = customPreviews[cw.id];
							return (
								<div
									key={cw.id}
									className={cn(
										"group relative flex aspect-[16/10] flex-col justify-end overflow-hidden rounded-xl border border-white/10 bg-muted/40 p-1.5 text-left transition-[transform,box-shadow] duration-150",
										isSelected
											? "shadow-sm ring-2 ring-foreground/90 ring-offset-2 ring-offset-background"
											: "hover:scale-[1.02]",
									)}
								>
									<button
										type="button"
										onClick={() => handleSelectCustomImage(cw.id)}
										aria-label={`Use ${cw.name} wallpaper`}
										aria-pressed={isSelected}
										className="absolute inset-0 flex flex-col justify-end p-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
									>
										{previewSrc && (
											<img
												src={previewSrc}
												alt={cw.name}
												className="absolute inset-0 size-full object-cover"
											/>
										)}
										<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
										<span className="relative z-10 truncate font-medium text-[11px] text-white/90">
											{cw.name}
										</span>
									</button>
									<button
										type="button"
										onClick={(e) => handleDeleteCustomImage(e, cw.id)}
										aria-label={`Delete ${cw.name} wallpaper`}
										title="Delete wallpaper"
										className="absolute top-1.5 right-1.5 z-20 flex size-5 items-center justify-center rounded-full bg-black/60 text-white/80 opacity-0 transition-opacity hover:bg-red-500 hover:text-white group-hover:opacity-100"
									>
										<svg
											aria-hidden="true"
											width="10"
											height="10"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2.5"
										>
											<line x1="18" y1="6" x2="6" y2="18" />
											<line x1="6" y1="6" x2="18" y2="18" />
										</svg>
									</button>
								</div>
							);
						})}
					</div>
				) : (
					<div className="py-4 text-center text-muted-foreground text-xs">
						No custom wallpapers uploaded yet.
					</div>
				)}

				{uploadStatus && (
					<p
						className="px-1 pb-2 font-medium text-primary text-xs"
						role="status"
					>
						{uploadStatus}
					</p>
				)}
			</SectionCard>

			{/* Gradients */}
			<SectionCard title="Gradient presets">
				<div className="my-2 grid grid-cols-4 gap-2.5">
					{GRADIENTS.map((g) => {
						const isSelected = bg.type === "gradient" && bg.gradientId === g.id;
						return (
							<button
								type="button"
								key={g.id}
								onClick={() => handleSelectGradient(g.id)}
								className={cn(
									"group relative flex aspect-[16/10] items-center justify-center rounded-xl px-2 font-medium text-white text-xs shadow-xs transition-[transform,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]",
									isSelected
										? "ring-2 ring-foreground/90 ring-offset-2 ring-offset-background"
										: "hover:scale-[1.02]",
								)}
								style={{ background: g.css }}
								aria-pressed={isSelected}
							>
								<span className="drop-shadow-sm">{g.label}</span>
							</button>
						);
					})}
				</div>
			</SectionCard>

			{/* Visual Adjustments */}
			<SectionCard title="Image adjustments">
				<SliderRow
					label="Opacity"
					value={bg.opacity}
					suffix="%"
					min={20}
					max={100}
					onChange={(v) =>
						updateBackground({ opacity: v } as Partial<Settings["background"]>)
					}
				/>

				<SliderRow
					label="Blur filter"
					value={bg.blur}
					suffix="px"
					min={0}
					max={20}
					onChange={(v) =>
						updateBackground({ blur: v } as Partial<Settings["background"]>)
					}
				/>

				<SliderRow
					label="Brightness"
					value={bg.brightness}
					suffix="%"
					min={40}
					max={140}
					onChange={(v) =>
						updateBackground({ brightness: v } as Partial<
							Settings["background"]
						>)
					}
				/>
			</SectionCard>

			{/* Solid Color & Pexels */}
			<SectionCard title="Other sources">
				<SettingRow label="Solid color">
					<div className="flex items-center gap-2">
						<input
							type="color"
							value={bg.color}
							onChange={(e) =>
								updateBackground({
									type: "solid",
									color: e.target.value,
									wallpaperId: null,
									gradientId: null,
									imageId: null,
								} as Partial<Settings["background"]>)
							}
							className="size-7 rounded-full border border-border/50 bg-transparent p-0"
							aria-label="Solid background color"
						/>
						<span className="font-mono text-muted-foreground text-xs">
							{bg.color}
						</span>
					</div>
				</SettingRow>

				<SettingRow label="Pexels dynamic photography">
					<Switch
						aria-label="Use Pexels dynamic photography"
						checked={bg.type === "pexels"}
						onCheckedChange={(enabled: boolean) => {
							if (enabled) {
								updateBackground({ type: "pexels" } as Partial<
									Settings["background"]
								>);
								void refreshWallpaper(true);
							} else {
								updateBackground({
									type: "wallpaper",
									wallpaperId: "tokyo-skyline",
								} as Partial<Settings["background"]>);
							}
						}}
					/>
				</SettingRow>

				{bg.type === "pexels" && (
					<div className="space-y-3 border-border/40 border-t px-1 pt-3 pb-2">
						<div>
							<label
								htmlFor="pexels-query-input"
								className="mb-1 block font-medium text-muted-foreground text-xs"
							>
								Search theme / keyword
							</label>
							<Input
								id="pexels-query-input"
								placeholder="e.g. minimalist landscape, dark architecture"
								defaultValue={bg.pexelsQuery}
								onBlur={(e) => {
									if (e.target.value !== bg.pexelsQuery) {
										updateBackground({ pexelsQuery: e.target.value });
										void refreshWallpaper(true);
									}
								}}
								className="h-9 rounded-lg border-border/60 bg-secondary/50 px-3 text-foreground text-sm"
							/>
						</div>

						<SettingRow label="Update frequency">
							<Select
								value={bg.pexelsFrequency}
								onValueChange={(val) => {
									if (!val) return;
									const next = val as WallpaperFrequency;
									updateBackground({ pexelsFrequency: next });
									if (next !== "locked") void refreshWallpaper(true);
								}}
								items={PEXELS_FREQUENCY_OPTIONS}
							>
								<SelectTrigger
									size="sm"
									className="min-w-[150px]"
									aria-label="Update wallpaper frequency"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{PEXELS_FREQUENCY_OPTIONS.map((opt) => (
										<SelectItem key={opt.value} value={opt.value}>
											{opt.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</SettingRow>
					</div>
				)}
			</SectionCard>

			{/* Clock & Greeting */}
			<SectionCard title="Clock & time">
				<SettingRow label="Enable clock">
					<Switch
						aria-label="Enable clock"
						checked={clock.enabled}
						onCheckedChange={(checked: boolean) =>
							updateClock({ enabled: checked })
						}
					/>
				</SettingRow>

				{clock.enabled && (
					<>
						<SettingRow label="24-hour time format">
							<Switch
								aria-label="Use 24-hour time format"
								checked={clock.format24}
								onCheckedChange={(checked: boolean) =>
									updateClock({ format24: checked })
								}
							/>
						</SettingRow>

						<SettingRow label="Show seconds">
							<Switch
								aria-label="Show seconds"
								checked={clock.showSeconds}
								onCheckedChange={(checked: boolean) =>
									updateClock({ showSeconds: checked })
								}
							/>
						</SettingRow>

						<SliderRow
							label="Clock size"
							value={clock.size}
							suffix="%"
							min={60}
							max={200}
							step={5}
							onChange={(v) => updateClock({ size: v })}
						/>
					</>
				)}
			</SectionCard>

			<SectionCard title="Greeting">
				<SettingRow label="Personal greeting">
					<Switch
						aria-label="Enable personal greeting"
						checked={greeting.enabled}
						onCheckedChange={(checked: boolean) =>
							updateGreeting({ enabled: checked })
						}
					/>
				</SettingRow>

				{greeting.enabled && (
					<div className="px-1 pt-2 pb-3">
						<label
							htmlFor="greeting-name-input"
							className="mb-1.5 block font-medium text-muted-foreground text-xs"
						>
							Your name
						</label>
						<Input
							id="greeting-name-input"
							placeholder="e.g. Alex"
							value={greeting.name}
							onChange={(e) => updateGreeting({ name: e.target.value })}
							className="h-9 rounded-lg border-border/60 bg-secondary/50 px-3 text-foreground text-sm"
						/>
					</div>
				)}
			</SectionCard>
		</div>
	);
}
