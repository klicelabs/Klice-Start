import { Input } from "@klice-start/ui/components/input";
import { Switch } from "@klice-start/ui/components/switch";
import { Icon } from "@klice-start/ui/icons/icon";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ACCENT_OPTIONS } from "../../../../lib/accent";
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
import { SettingsLabel } from "../shared/settings-label";
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

/** The three appearance modes, ordered by the user's most direct choices. */
const MODE_OPTIONS: readonly {
	value: "auto" | "light" | "dark";
	label: string;
	ariaLabel: string;
	/** Preview shell — an abstract surface, not a miniature browser window. */
	shell: string;
	/** Preview panel and content tones. */
	panel: string;
	content: string;
}[] = [
	{
		value: "light",
		label: "Light",
		ariaLabel: "Use light appearance",
		shell: "border-neutral-300 bg-neutral-200",
		panel: "bg-white",
		content: "bg-neutral-200",
	},
	{
		value: "dark",
		label: "Dark",
		ariaLabel: "Use dark appearance",
		shell: "border-neutral-700 bg-neutral-950",
		panel: "bg-neutral-900",
		content: "bg-neutral-700",
	},
	{
		value: "auto",
		label: "System",
		ariaLabel: "Use system appearance",
		shell: "border-neutral-300 bg-neutral-800",
		panel: "bg-neutral-100",
		content: "bg-neutral-600",
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

function CurrentWallpaperPreview({
	background,
	className,
}: CurrentWallpaperPreviewProps & { className?: string }) {
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
				className={cn("size-full object-cover", className)}
			/>
		);
	}
	if (wallpaper) {
		return (
			<img
				src={wallpaper.thumb}
				alt=""
				className={cn("size-full object-cover", className)}
			/>
		);
	}
	return (
		<span
			aria-hidden="true"
			className={cn("block size-full", className)}
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
	const accentColor = useSetupStore((s) => s.settings.accentColor ?? "blue");
	const bg = useSetupStore((s) => s.settings.background);

	const updateSettings = useSetupStore((s) => s.updateSettings);
	const updateBackground = useSetupStore((s) => s.updateBackground);
	const lastAppliedPexelsQuery = useRef(bg.pexelsQuery);
	const reduceMotion = useReducedMotion() ?? false;

	return (
		<div className={SETTINGS_PAGE}>
			{/* Theme */}
			<SectionCard>
				<fieldset className="m-0 border-0 px-1.5 py-2.5" aria-label="Theme">
					<div className="flex items-center gap-2.5">
						<Icon
							name="sun-moon"
							size={16}
							strokeWidth={1.75}
							className="shrink-0 text-neutral-400"
							aria-hidden="true"
						/>
						<SettingsLabel>Theme</SettingsLabel>
					</div>
					<div className="mt-3 grid grid-cols-3 gap-2.5">
						{MODE_OPTIONS.map((mode) => {
							const selected = colorScheme === mode.value;
							return (
								<div
									key={mode.value}
									className="flex min-w-0 flex-col items-center gap-2"
								>
									<button
										type="button"
										onClick={() => updateSettings({ colorScheme: mode.value })}
										aria-label={mode.ariaLabel}
										aria-pressed={selected}
										className={cn("group w-full", SETTINGS_FOCUS_RING)}
									>
										<div
											className={cn(
												"squircle relative aspect-[1.35] w-full overflow-hidden border p-1.5 shadow-none transition-[filter,box-shadow] duration-150 group-hover:brightness-105 motion-reduce:transition-none dark:border-white/10",
												SETTINGS_RADIUS.surface,
												mode.shell,
												selected &&
													"ring-2 ring-[var(--klice-accent)] ring-offset-2 ring-offset-white dark:ring-offset-[#252525]",
											)}
										>
											{mode.value === "auto" ? (
												<div
													className={cn(
														"squircle grid h-full grid-cols-2 gap-1.5 overflow-hidden bg-neutral-100",
														SETTINGS_RADIUS.thumbnail,
													)}
												>
													<div className="bg-neutral-100 p-1.5">
														<div className="h-2.5 w-4/5 rounded-full bg-white" />
														<div className="mt-2 h-1.5 w-full rounded-full bg-neutral-300" />
														<div className="mt-1.5 h-1.5 w-3/4 rounded-full bg-neutral-300" />
													</div>
													<div className="bg-neutral-900 p-1.5">
														<div className="h-2.5 w-4/5 rounded-full bg-neutral-800" />
														<div className="mt-2 h-1.5 w-full rounded-full bg-neutral-700" />
														<div className="mt-1.5 h-1.5 w-3/4 rounded-full bg-neutral-700" />
													</div>
												</div>
											) : (
												<div
													className={cn(
														"squircle h-full p-1.5",
														SETTINGS_RADIUS.thumbnail,
														mode.panel,
													)}
												>
													<div
														className={cn(
															"h-2.5 w-4/5 rounded-full",
															mode.content,
														)}
													/>
													<div
														className={cn(
															"mt-2 h-1.5 w-full rounded-full",
															mode.content,
														)}
													/>
													<div
														className={cn(
															"mt-1.5 h-1.5 w-3/4 rounded-full",
															mode.content,
														)}
													/>
												</div>
											)}
										</div>
									</button>
									{selected ? (
										<motion.span
											layoutId="settings-theme-label"
											transition={
												reduceMotion
													? { duration: 0 }
													: { duration: 0.18, ease: "easeOut" }
											}
											className={cn(
												SETTINGS_RADIUS.pill,
												"bg-[var(--klice-accent)] px-2.5 py-1 font-medium text-[11px] text-[var(--klice-accent-foreground)] leading-none",
											)}
										>
											{mode.label}
										</motion.span>
									) : (
										<span
											className={cn(
												SETTINGS_RADIUS.pill,
												"bg-neutral-900/[0.06] px-2.5 py-1 font-medium text-[11px] text-neutral-500 leading-none dark:bg-white/[0.08] dark:text-neutral-400",
											)}
										>
											{mode.label}
										</span>
									)}
								</div>
							);
						})}
					</div>
				</fieldset>

				<SettingRow label="Accent color" icon="palette">
					<div className="flex items-center gap-2">
						{ACCENT_OPTIONS.map((accent) => {
							const selected = accentColor === accent.id;
							return (
								<button
									key={accent.id}
									type="button"
									onClick={() => updateSettings({ accentColor: accent.id })}
									aria-label={`${accent.label} accent color`}
									aria-pressed={selected}
									title={accent.label}
									className={cn(
										"size-6 rounded-full p-0.5 transition-[box-shadow,transform] duration-150 hover:scale-105 active:scale-95 motion-reduce:transition-none",
										SETTINGS_FOCUS_RING,
										selected &&
											"ring-2 ring-[var(--klice-accent)] ring-offset-1 ring-offset-white dark:ring-offset-[#252525]",
									)}
								>
									<span
										className="block size-full rounded-full"
										style={{ backgroundColor: accent.light }}
									/>
								</button>
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

			{/* Wallpaper library: a visual preview keeps Appearance quick to scan. */}
			<SectionCard>
				<div className="px-1.5 py-2.5">
					<div className="flex items-center gap-2.5">
						<Icon
							name="image"
							size={16}
							strokeWidth={1.75}
							className="shrink-0 text-neutral-400"
							aria-hidden="true"
						/>
						<SettingsLabel>Wallpaper</SettingsLabel>
					</div>
					<button
						type="button"
						onClick={onOpenWallpaper}
						aria-label={`Change wallpaper. Current wallpaper: ${getCurrentWallpaperLabel(bg)}`}
						title="Change wallpaper"
						className={cn(
							"group mt-3 block w-full text-center",
							SETTINGS_FOCUS_RING,
						)}
					>
						<span
							className={cn(
								"squircle block w-full bg-neutral-900/[0.055] p-2.5 shadow-none transition-colors duration-150 group-hover:bg-neutral-900/[0.075] dark:bg-white/[0.055] dark:group-hover:bg-white/[0.08]",
								SETTINGS_RADIUS.surface,
							)}
						>
							<span
								className={cn(
									"squircle relative block aspect-[16/9] w-full overflow-hidden bg-neutral-900/[0.08] transition-[filter] duration-200 group-hover:brightness-[1.03] motion-reduce:transition-none",
									SETTINGS_RADIUS.thumbnail,
								)}
							>
								<CurrentWallpaperPreview background={bg} />
							</span>
						</span>
						<span className="mt-3 block truncate font-medium text-[13px] text-neutral-900 dark:text-neutral-100">
							{getCurrentWallpaperLabel(bg)}
						</span>
						<span
							className={cn(
								"squircle mt-3 flex h-9 w-full items-center justify-center gap-1.5 bg-[var(--klice-accent)] px-3 font-medium text-[12px] text-[var(--klice-accent-foreground)] shadow-none transition-[filter,transform] duration-150 group-hover:brightness-95 group-active:scale-[0.99] motion-reduce:transition-none",
								SETTINGS_RADIUS.control,
							)}
						>
							Change wallpaper
							<Icon name="chevron-right" size={14} aria-hidden="true" />
						</span>
					</button>
				</div>
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
