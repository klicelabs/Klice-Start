import { Input } from "@klice-start/ui/components/input";
import { Switch } from "@klice-start/ui/components/switch";
import { Icon } from "@klice-start/ui/icons/icon";
import { useEffect, useRef, useState } from "react";
import { GRADIENTS, WALLPAPERS } from "../../../../lib/constants";
import { cn } from "../../../../lib/utils";
import { refreshWallpaper } from "../../../../services/wallpaper";
import { useImageStore } from "../../../../stores/image-store";
import { useSetupStore } from "../../../../stores/setup-store";
import type { Settings, WallpaperFrequency } from "../../../../types";
import { SectionCard } from "../shared/section-card";
import { SelectRow } from "../shared/select-row";
import { SettingRow } from "../shared/setting-row";
import { SettingsExpandable } from "../shared/settings-expandable";
import {
	SETTINGS_CONTROL_WIDTH,
	SETTINGS_FOCUS_RING,
	SETTINGS_INPUT,
	SETTINGS_PAGE,
	SETTINGS_RADIUS,
	SETTINGS_SWITCH,
} from "../shared/settings-tokens";
import { SliderRow } from "../shared/slider-row";

const PEXELS_FREQUENCY_OPTIONS: readonly {
	value: WallpaperFrequency;
	label: string;
}[] = [
	{ value: "daily", label: "Daily" },
	{ value: "hourly", label: "Hourly" },
	{ value: "per-tab", label: "Every new tab" },
	{ value: "daylight", label: "Follow daylight" },
	{ value: "locked", label: "Keep current" },
];

/** The three appearance modes, described once instead of three times. */
const MODE_OPTIONS: readonly {
	value: "auto" | "light" | "dark";
	label: string;
	ariaLabel: string;
	/** Preview shell — the window body. */
	shell: string;
	/** Preview title bar background + rule. */
	bar: string;
	/** The little page glyph inside the preview. */
	glyph: string;
}[] = [
	{
		value: "auto",
		label: "Auto",
		ariaLabel: "Use automatic appearance",
		shell:
			"border-border/60 bg-gradient-to-r from-neutral-200 via-neutral-200 to-neutral-900",
		bar: "border-border/40 bg-background/50",
		glyph: "bg-foreground/20",
	},
	{
		value: "light",
		label: "Light",
		ariaLabel: "Use light appearance",
		shell: "border-neutral-300 bg-neutral-100",
		bar: "border-neutral-300 bg-white",
		glyph: "bg-neutral-300",
	},
	{
		value: "dark",
		label: "Dark",
		ariaLabel: "Use dark appearance",
		shell: "border-neutral-700 bg-neutral-900",
		bar: "border-neutral-800 bg-neutral-950",
		glyph: "bg-neutral-700",
	},
];

/**
 * Appearance owns the look of the dashboard: the theme, the background source
 * (wallpaper source, dynamic photography and effects layered over it). The
 * complete wallpaper library lives in its own page so this pane stays focused
 * on quick, high-frequency visual adjustments.
 */
interface AppearancePaneProps {
	onOpenWallpaper: () => void;
}

interface CurrentWallpaperPreviewProps {
	background: Settings["background"];
}

function CurrentWallpaperPreview({ background }: CurrentWallpaperPreviewProps) {
	const getBackgroundImage = useImageStore((state) => state.getBackgroundImage);
	const [imageUrl, setImageUrl] = useState<string | null>(null);
	const activeImageId =
		background.type === "image"
			? background.imageId
			: background.type === "pexels"
				? background.pexelsImageId
				: null;

	useEffect(() => {
		let active = true;
		setImageUrl(null);
		if (!activeImageId) {
			return;
		}
		getBackgroundImage(activeImageId)
			.then((url) => {
				if (active) setImageUrl(url);
			})
			.catch(() => {
				if (active) setImageUrl(null);
			});
		return () => {
			active = false;
		};
	}, [activeImageId, getBackgroundImage]);

	const wallpaper =
		background.type === "wallpaper"
			? WALLPAPERS.find((item) => item.id === background.wallpaperId)
			: undefined;
	const gradient =
		background.type === "gradient"
			? GRADIENTS.find((item) => item.id === background.gradientId)
			: undefined;

	if (imageUrl) {
		return (
			<img
				src={imageUrl}
				alt=""
				className={cn("size-full object-cover", SETTINGS_RADIUS.thumbnail)}
			/>
		);
	}
	if (wallpaper) {
		return (
			<img
				src={wallpaper.thumb}
				alt=""
				className={cn("size-full object-cover", SETTINGS_RADIUS.thumbnail)}
			/>
		);
	}
	return (
		<span
			aria-hidden="true"
			className={cn("block size-full", SETTINGS_RADIUS.thumbnail)}
			style={{
				background:
					gradient?.css ??
					(background.type === "solid" ? background.color : "#27272a"),
			}}
		/>
	);
}

function getCurrentWallpaperLabel(background: Settings["background"]): string {
	if (background.type === "solid") return "Solid colour";
	if (background.type === "gradient") {
		return (
			GRADIENTS.find((item) => item.id === background.gradientId)?.label ??
			"Gradient"
		);
	}
	if (background.type === "image") {
		return (
			background.customWallpapers?.find(
				(item) => item.id === background.imageId,
			)?.name ?? "Uploaded wallpaper"
		);
	}
	if (background.type === "pexels") return "Dynamic photography";
	return (
		WALLPAPERS.find((item) => item.id === background.wallpaperId)?.label ??
		"Wallpaper"
	);
}

export function AppearancePane({ onOpenWallpaper }: AppearancePaneProps) {
	const appearanceMode = useSetupStore((s) => s.settings.appearanceMode);
	const isLiquidGlass = appearanceMode === "liquid";
	const colorScheme = useSetupStore((s) => s.settings.colorScheme ?? "auto");
	const bg = useSetupStore((s) => s.settings.background);

	const updateSettings = useSetupStore((s) => s.updateSettings);
	const updateBackground = useSetupStore((s) => s.updateBackground);
	const lastAppliedPexelsQuery = useRef(bg.pexelsQuery);

	return (
		<div className={SETTINGS_PAGE}>
			{/* Theme */}
			<SectionCard>
				<SettingRow label="Theme" icon="sun-moon" align="start">
					<div className="grid w-[min(12.5rem,100%)] grid-cols-3 gap-2">
						{MODE_OPTIONS.map((mode) => {
							const selected = colorScheme === mode.value;
							return (
								<div
									key={mode.value}
									className="flex min-w-0 flex-col items-center gap-1.5"
								>
									<button
										type="button"
										onClick={() => updateSettings({ colorScheme: mode.value })}
										aria-label={mode.ariaLabel}
										aria-pressed={selected}
										className={cn(
											cn(
												"group w-full p-0 transition-[filter] duration-150 motion-reduce:transition-none",
												SETTINGS_RADIUS.surface,
											),
											SETTINGS_FOCUS_RING,
										)}
									>
										<div
											className={cn(
												cn(
													"squircle relative aspect-[16/10] w-full overflow-hidden border p-1 shadow-none transition-[filter,box-shadow] duration-150 group-hover:brightness-105 motion-reduce:transition-none",
													SETTINGS_RADIUS.surface,
												),
												mode.shell,
												selected &&
													"ring-2 ring-neutral-900/70 ring-offset-2 ring-offset-white dark:ring-white/80 dark:ring-offset-[#252525]",
											)}
										>
											<div
												className={cn(
													"flex h-3 w-full items-center border-b px-1",
													mode.bar,
												)}
											>
												<div className="flex gap-1">
													<div className="size-1.5 rounded-full bg-red-400" />
													<div className="size-1.5 rounded-full bg-amber-400" />
													<div className="size-1.5 rounded-full bg-emerald-400" />
												</div>
											</div>
											<div className="mt-1.5 flex justify-center">
												<div
													className={cn("h-2 w-8 rounded-full", mode.glyph)}
												/>
											</div>
										</div>
									</button>
									<span
										className={cn(
											"font-medium text-[12px]",
											selected
												? "text-neutral-900 dark:text-neutral-100"
												: "text-neutral-500 dark:text-neutral-400",
										)}
									>
										{mode.label}
									</span>
								</div>
							);
						})}
					</div>
				</SettingRow>

				<SettingRow
					label="Liquid Glass"
					icon="glass-water"
					tooltip="Frosted Speed Dial surfaces that pick up the wallpaper. Settings itself stays flat."
				>
					<Switch
						className={SETTINGS_SWITCH}
						aria-label="Liquid Glass"
						checked={isLiquidGlass}
						onCheckedChange={(checked: boolean) =>
							updateSettings({
								appearanceMode: checked ? "liquid" : "classic",
							})
						}
					/>
				</SettingRow>
			</SectionCard>

			{/* Wallpaper library: a single row keeps Appearance quick to scan. */}
			<SectionCard>
				<SettingRow
					label="Wallpaper"
					icon="image"
					description={getCurrentWallpaperLabel(bg)}
				>
					<button
						type="button"
						onClick={onOpenWallpaper}
						aria-label="Open Wallpaper settings"
						title="Open Wallpaper settings"
						className={cn(
							"group inline-flex items-center gap-2",
							SETTINGS_FOCUS_RING,
						)}
					>
						<span
							className={cn(
								"block h-9 w-14 overflow-hidden shadow-none transition-[filter] duration-150 group-hover:brightness-105",
								SETTINGS_RADIUS.thumbnail,
							)}
						>
							<CurrentWallpaperPreview background={bg} />
						</span>
						<Icon
							name="chevron-right"
							size={15}
							className="text-neutral-400 transition-transform duration-150 group-hover:translate-x-0.5 dark:text-neutral-500"
							aria-hidden="true"
						/>
					</button>
				</SettingRow>
			</SectionCard>

			{/* Colour and dynamic photography */}
			<SectionCard>
				<SettingRow label="Solid colour" icon="droplet">
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
							className="size-7 rounded-full border border-neutral-900/20 bg-transparent p-0 dark:border-white/20"
							aria-label="Solid background colour"
						/>
						<span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
							{bg.color}
						</span>
					</div>
				</SettingRow>

				<SettingRow
					label="Pexels photography"
					icon="camera"
					tooltip="Fresh photos on a schedule, instead of a fixed wallpaper."
				>
					<Switch
						className={SETTINGS_SWITCH}
						aria-label="Use Pexels photography"
						checked={bg.type === "pexels"}
						onCheckedChange={(enabled: boolean) => {
							if (enabled) {
								updateBackground({ type: "pexels" } as Partial<
									Settings["background"]
								>);
								refreshWallpaper(true).catch(() => undefined);
							} else {
								updateBackground({
									type: "wallpaper",
									wallpaperId: "tokyo-skyline",
								} as Partial<Settings["background"]>);
							}
						}}
					/>
				</SettingRow>

				<SettingsExpandable
					expanded={bg.type === "pexels"}
					label="Pexels photography options"
				>
					<SettingRow label="Photo theme" icon="search">
						<Input
							id="pexels-query-input"
							aria-label="Photo theme keywords"
							placeholder="minimalist landscape"
							value={bg.pexelsQuery}
							onChange={(e) =>
								updateBackground({ pexelsQuery: e.target.value })
							}
							onBlur={(e) => {
								if (e.target.value === lastAppliedPexelsQuery.current) return;
								lastAppliedPexelsQuery.current = e.target.value;
								refreshWallpaper(true).catch(() => undefined);
							}}
							className={cn(
								cn(
									SETTINGS_CONTROL_WIDTH,
									SETTINGS_RADIUS.control,
									"h-9 px-3 text-sm",
								),
								SETTINGS_INPUT,
							)}
						/>
					</SettingRow>

					<SelectRow
						label="Refresh"
						icon="timer"
						value={bg.pexelsFrequency}
						options={PEXELS_FREQUENCY_OPTIONS}
						onChange={(val) => {
							const next = val as WallpaperFrequency;
							updateBackground({ pexelsFrequency: next });
							if (next !== "locked")
								refreshWallpaper(true).catch(() => undefined);
						}}
					/>
				</SettingsExpandable>
			</SectionCard>

			{/* Effects layered over the background */}
			<SectionCard>
				<SliderRow
					label="Opacity"
					icon="eye"
					value={bg.opacity}
					suffix="%"
					min={20}
					max={100}
					step={10}
					onChange={(v) =>
						updateBackground({ opacity: v } as Partial<Settings["background"]>)
					}
				/>

				<SliderRow
					label="Blur"
					icon="blend"
					value={bg.blur}
					suffix="px"
					min={0}
					max={20}
					step={2}
					onChange={(v) =>
						updateBackground({ blur: v } as Partial<Settings["background"]>)
					}
				/>

				<SliderRow
					label="Brightness"
					icon="sun"
					value={bg.brightness}
					suffix="%"
					min={40}
					max={140}
					step={10}
					onChange={(v) =>
						updateBackground({ brightness: v } as Partial<
							Settings["background"]
						>)
					}
				/>
			</SectionCard>
		</div>
	);
}
