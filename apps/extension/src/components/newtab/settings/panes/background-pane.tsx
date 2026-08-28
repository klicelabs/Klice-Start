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
import type { Settings, WallpaperFrequency } from "../../../../types";
import { SectionCard } from "../shared/section-card";
import { SettingRow } from "../shared/setting-row";
import { SliderRow } from "../shared/slider-row";

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

export function BackgroundPane() {
	const bg = useSetupStore((s) => s.settings.background);
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
			{/* Built-in Curated Wallpapers */}
			<SectionCard
				title="Curated Wallpapers"
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
										? "ring-2 ring-foreground/90 ring-offset-2 ring-offset-background shadow-sm"
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
				title="Custom Wallpapers"
				description="Upload your own background images"
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
								<button
									type="button"
									key={cw.id}
									onClick={() => handleSelectCustomImage(cw.id)}
									className={cn(
										"group relative flex aspect-[16/10] flex-col justify-end overflow-hidden rounded-xl border border-white/10 bg-muted/40 p-1.5 text-left transition-[transform,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]",
										isSelected
											? "ring-2 ring-foreground/90 ring-offset-2 ring-offset-background shadow-sm"
											: "hover:scale-[1.02]",
									)}
									title={cw.name}
									aria-pressed={isSelected}
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
									<button
										type="button"
										onClick={(e) => handleDeleteCustomImage(e, cw.id)}
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
								</button>
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
						className="px-1 pb-2 font-medium text-xs text-primary"
						role="status"
					>
						{uploadStatus}
					</p>
				)}
			</SectionCard>

			{/* Gradients */}
			<SectionCard
				title="Gradient Presets"
				description="Minimal atmospheric gradients"
			>
				<div className="my-2 grid grid-cols-4 gap-2.5">
					{GRADIENTS.map((g) => {
						const isSelected = bg.type === "gradient" && bg.gradientId === g.id;
						return (
							<button
								type="button"
								key={g.id}
								onClick={() => handleSelectGradient(g.id)}
								className={cn(
									"group relative flex aspect-[16/10] items-center justify-center rounded-xl px-2 font-medium text-xs text-white shadow-xs transition-[transform,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]",
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
			<SectionCard title="Image Adjustments">
				<SliderRow
					label="Opacity"
					description="Background transparency"
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
					description="Softens busy wallpaper photography"
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
					description="Adjust wallpaper exposure for optimal card contrast"
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
			<SectionCard title="Other Sources">
				<SettingRow
					label="Solid background color"
					description="Clean solid color fallback"
				>
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
							className="size-7 cursor-pointer rounded-full border border-border/50 bg-transparent p-0"
							aria-label="Solid background color"
						/>
						<span className="font-mono text-muted-foreground text-xs">
							{bg.color}
						</span>
					</div>
				</SettingRow>

				<SettingRow
					label="Pexels dynamic wallpaper"
					description="Automatically fetch fresh photography from Pexels"
				>
					<Switch
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

						<SettingRow
							label="Update frequency"
							description="Cadence for rotating Pexels wallpapers"
						>
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
								<SelectTrigger size="sm" className="min-w-[150px]">
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
		</div>
	);
}
