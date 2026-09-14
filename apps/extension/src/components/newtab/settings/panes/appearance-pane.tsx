// biome-ignore-all lint/a11y/noNoninteractiveTabindex: The wallpaper carousel viewport is intentionally focusable for arrow-key paging.
import { Input } from "@klice-start/ui/components/input";
import {
	FileUpload,
	type FileUploadItem,
} from "@klice-start/ui/components/motion/file-upload";
import { Switch } from "@klice-start/ui/components/switch";
import { Icon } from "@klice-start/ui/icons/icon";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
import { SelectRow } from "../shared/select-row";
import { SettingRow } from "../shared/setting-row";
import { SettingsAction } from "../shared/settings-action";
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

/** Shared selection language for every background tile. */
const TILE_BASE = cn(
	"group squircle relative flex aspect-square w-full min-w-0 overflow-hidden border border-neutral-900/10 bg-neutral-900/[0.04] transition-[filter] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/60 focus-visible:ring-inset dark:border-white/10 dark:bg-white/[0.04] dark:focus-visible:ring-white/40",
	SETTINGS_RADIUS.thumbnail,
);
/** One carousel page holds a 4×3 grid of tiles. */
const CAROUSEL_PAGE_SIZE = 12;
/**
 * Inset selection ring. The viewport clips anything outside a tile, so the
 * ring lives INSIDE the tile geometry (no offset, no external pixels) —
 * first/last/top/bottom selections stay fully visible without any viewport
 * padding compensating for them.
 */
const TILE_SELECTED =
	"ring-2 ring-inset ring-neutral-900/70 dark:ring-white/80";

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

/**
 * Defensive allowlist — the ONLY image formats the uploader accepts.
 * GIF is intentionally excluded: the pipeline flattens to JPEG, so animated
 * images would silently lose their animation. SVG/HTML/scripts are never
 * decoded or interpreted.
 */
const SUPPORTED_IMAGE_TYPES: Record<string, readonly string[]> = {
	"image/jpeg": ["jpg", "jpeg"],
	"image/png": ["png"],
	"image/webp": ["webp"],
	"image/avif": ["avif"],
};
const SUPPORTED_LABEL = "JPEG, PNG, WebP or AVIF";
const UPLOAD_ACCEPT = Object.keys(SUPPORTED_IMAGE_TYPES).join(",");

/** Validate the actual file — never trust the picker's `accept` alone. */
function validateImageFile(file: File): string | null {
	if (!file || file.size <= 0) return "That file is empty.";
	if (file.size > MAX_BACKGROUND_IMAGE_BYTES) {
		return `Image must be ${Math.round(MAX_BACKGROUND_IMAGE_BYTES / (1024 * 1024))} MB or smaller.`;
	}
	const extensions = SUPPORTED_IMAGE_TYPES[file.type];
	if (!extensions) {
		return `Only ${SUPPORTED_LABEL} images are supported.`;
	}
	const ext = file.name.includes(".")
		? file.name.split(".").pop()?.toLowerCase()
		: undefined;
	if (!ext || !extensions.includes(ext)) {
		return "That file doesn't look like a supported image.";
	}
	return null;
}

function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	const exponent = Math.min(
		Math.floor(Math.log(bytes) / Math.log(1024)),
		units.length - 1,
	);
	const value = bytes / 1024 ** exponent;
	return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

type CarouselItem =
	| { kind: "wallpaper"; id: string; label: string; thumb: string }
	| { kind: "gradient"; id: string; label: string; css: string }
	| { kind: "image"; id: string; label: string };

type PendingUpload = {
	key: string;
	file: File;
	name: string;
	size: number;
	mime: string;
	previewUrl: string;
	status: "validating" | "ready" | "confirming" | "error";
	progress: number;
	error?: string;
	dataUrl?: string;
};

/**
 * Appearance owns the look of the dashboard: the theme, the background source
 * (one unified wallpaper collection — bundled photography, gradients and your
 * own uploads) and the effects layered over it. Widgets like the clock and
 * greeting live in General, so nothing here is anything but visual.
 */
export function AppearancePane() {
	const appearanceMode = useSetupStore((s) => s.settings.appearanceMode);
	const isLiquidGlass = appearanceMode === "liquid";
	const colorScheme = useSetupStore((s) => s.settings.colorScheme ?? "auto");
	const bg = useSetupStore((s) => s.settings.background);

	const updateSettings = useSetupStore((s) => s.updateSettings);
	const updateBackground = useSetupStore((s) => s.updateBackground);
	const commitCustomWallpaper = useSetupStore((s) => s.commitCustomWallpaper);
	const removeCustomWallpaper = useSetupStore((s) => s.removeCustomWallpaper);

	const saveBackgroundImage = useImageStore((s) => s.saveBackgroundImage);
	const deleteBackgroundImage = useImageStore((s) => s.deleteBackgroundImage);
	const getBackgroundImage = useImageStore((s) => s.getBackgroundImage);

	const reduceMotion = useReducedMotion() ?? false;
	const [uploaderOpen, setUploaderOpen] = useState(false);
	const [pending, setPending] = useState<PendingUpload | null>(null);
	const [customPreviews, setCustomPreviews] = useState<
		Record<string, string | null>
	>({});
	const customWallpapers = bg.customWallpapers ?? [];
	const lastAppliedPexelsQuery = useRef(bg.pexelsQuery);

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

	// Revoke the object-URL preview when it is replaced or unmounted.
	useEffect(
		() => () => {
			if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
		},
		[pending?.previewUrl],
	);

	/** One unified collection: bundled photos, gradients, then your uploads. */
	const carouselItems: CarouselItem[] = useMemo(
		() => [
			...WALLPAPERS.map(
				(wp): CarouselItem => ({
					kind: "wallpaper",
					id: wp.id,
					label: wp.label,
					thumb: wp.thumb,
				}),
			),
			...GRADIENTS.map(
				(g): CarouselItem => ({
					kind: "gradient",
					id: g.id,
					label: g.label,
					css: g.css,
				}),
			),
			...customWallpapers.map(
				(cw): CarouselItem => ({ kind: "image", id: cw.id, label: cw.name }),
			),
		],
		[customWallpapers],
	);

	function isItemSelected(item: CarouselItem): boolean {
		if (item.kind === "wallpaper")
			return bg.type === "wallpaper" && bg.wallpaperId === item.id;
		if (item.kind === "gradient")
			return bg.type === "gradient" && bg.gradientId === item.id;
		return bg.type === "image" && bg.imageId === item.id;
	}

	function handleSelectItem(item: CarouselItem) {
		if (item.kind === "wallpaper") {
			updateBackground({
				type: "wallpaper",
				wallpaperId: item.id,
				gradientId: null,
				imageId: null,
			} as Partial<Settings["background"]>);
		} else if (item.kind === "gradient") {
			updateBackground({
				type: "gradient",
				gradientId: item.id,
				wallpaperId: null,
				imageId: null,
			} as Partial<Settings["background"]>);
		} else {
			updateBackground({
				type: "image",
				imageId: item.id,
				wallpaperId: null,
				gradientId: null,
			} as Partial<Settings["background"]>);
		}
	}

	/* ---------- carousel paging (one 4×3 grid per page) ---------- */
	const viewportRef = useRef<HTMLElement>(null);
	const [activePage, setActivePage] = useState(0);

	const carouselPages = useMemo(() => {
		const pages: CarouselItem[][] = [];
		for (let i = 0; i < carouselItems.length; i += CAROUSEL_PAGE_SIZE) {
			pages.push(carouselItems.slice(i, i + CAROUSEL_PAGE_SIZE));
		}
		return pages.length > 0 ? pages : [[]];
	}, [carouselItems]);
	const pageCount = carouselPages.length;

	useEffect(() => {
		setActivePage((prev) => Math.min(prev, pageCount - 1));
	}, [pageCount]);

	function handleViewportScroll() {
		const el = viewportRef.current;
		if (!el) return;
		const client = el.clientWidth || 1;
		const page = Math.min(
			pageCount - 1,
			Math.max(0, Math.round(el.scrollLeft / client)),
		);
		if (page !== activePage) setActivePage(page);
	}

	function scrollToPage(page: number) {
		const el = viewportRef.current;
		if (!el) return;
		const clamped = Math.min(pageCount - 1, Math.max(0, page));
		el.scrollTo({
			left: clamped * el.clientWidth,
			behavior: reduceMotion ? "auto" : "smooth",
		});
	}

	function handleViewportKeyDown(e: React.KeyboardEvent) {
		if (e.key === "ArrowRight") {
			e.preventDefault();
			scrollToPage(activePage + 1);
		} else if (e.key === "ArrowLeft") {
			e.preventDefault();
			scrollToPage(activePage - 1);
		} else if (e.key === "Home") {
			e.preventDefault();
			scrollToPage(0);
		} else if (e.key === "End") {
			e.preventDefault();
			scrollToPage(pageCount - 1);
		}
	}

	/* ---------- upload (staged, then explicitly confirmed) ---------- */
	function clearPending() {
		setPending((prev) => {
			if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
			return null;
		});
	}

	async function stageUpload(file: File) {
		if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
		const name =
			file.name.replace(/\.[^/.]+$/, "").trim() || "Uploaded wallpaper";
		const next: PendingUpload = {
			key: `${Date.now()}-${file.name}`,
			file,
			name,
			size: file.size,
			mime: file.type || "unknown",
			previewUrl: typeof URL !== "undefined" ? URL.createObjectURL(file) : "",
			status: "validating",
			progress: 12,
		};
		setPending(next);

		const rejection = validateImageFile(file);
		if (rejection) {
			setPending({ ...next, status: "error", error: rejection, progress: 0 });
			return;
		}
		if (typeof createImageBitmap === "undefined") {
			setPending({
				...next,
				status: "error",
				error: "This browser can't read images here.",
				progress: 0,
			});
			return;
		}

		try {
			setPending({ ...next, progress: 35 });
			const dataUrl = await downscaleImageFile(file);
			setPending({ ...next, status: "ready", progress: 100, dataUrl });
		} catch {
			setPending({
				...next,
				status: "error",
				error: "Couldn't read that image. It may be corrupted.",
				progress: 0,
			});
		}
	}

	function handleFilesAdded(_items: FileUploadItem[], files: File[]) {
		const file = files[0];
		if (file) stageUpload(file).catch(() => undefined);
	}

	/**
	 * Confirm persists the image to the wallpaper library (bytes + metadata)
	 * WITHOUT applying it — selecting a tile is the separate action that applies
	 * the active Speed Dial wallpaper immediately.
	 */
	async function handleConfirmUpload() {
		if (pending?.status !== "ready" || !pending.dataUrl) return;
		const snapshot = pending;
		const dataUrl = snapshot.dataUrl;
		if (!dataUrl) return;
		setPending({ ...snapshot, status: "confirming", progress: 100 });
		try {
			const savedId = await saveBackgroundImage(dataUrl);
			const existing = customWallpapers.some((w) => w.id === savedId);
			commitCustomWallpaper({ id: savedId, name: snapshot.name });
			setCustomPreviews((prev) => ({ ...prev, [savedId]: dataUrl }));
			if (snapshot.previewUrl) URL.revokeObjectURL(snapshot.previewUrl);
			setPending(null);
			setUploaderOpen(false);
			toast.success("Wallpaper added", {
				description: existing
					? `“${snapshot.name}” is already in your collection.`
					: `“${snapshot.name}” joined your collection.`,
			});
			// Reveal the new tile at the end of the same carousel.
			if (!existing) {
				requestAnimationFrame(() => {
					const el = viewportRef.current;
					if (el) {
						el.scrollTo({
							left: el.scrollWidth,
							behavior: reduceMotion ? "auto" : "smooth",
						});
					}
				});
			}
		} catch {
			setPending({
				...snapshot,
				status: "error",
				error: "Couldn't save that image. Try again.",
			});
		}
	}

	async function handleDeleteCustomImage(e: React.MouseEvent, id: string) {
		e.stopPropagation();
		await deleteBackgroundImage(id);
		removeCustomWallpaper(id);
		setCustomPreviews((prev) => {
			const next = { ...prev };
			delete next[id];
			return next;
		});
	}

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

			{/* One unified wallpaper collection.
			    Four stacked regions, each in normal flow so nothing can cover
			    the tiles: header (label + arrows) → viewport → dots → CTA. */}
			<SectionCard>
				<div className="flex items-center justify-between gap-2 px-1.5 pt-1.5">
					<p className="min-w-0 truncate font-medium text-[12px] text-neutral-500 dark:text-neutral-400">
						Wallpaper
						<span className="ml-1.5 font-normal text-[11px] text-neutral-400 tabular-nums dark:text-neutral-500">
							{carouselItems.length}
						</span>
					</p>
					<div className="flex shrink-0 items-center gap-0.5">
						<button
							type="button"
							onClick={() => scrollToPage(activePage - 1)}
							disabled={activePage === 0}
							aria-label="Previous wallpapers"
							className={cn(
								"inline-flex size-6 items-center justify-center rounded-full text-neutral-500 transition-[background-color,color,opacity] hover:bg-neutral-900/[0.06] hover:text-neutral-800 disabled:pointer-events-none disabled:opacity-30 dark:text-neutral-400 dark:hover:bg-white/[0.08] dark:hover:text-neutral-100",
								SETTINGS_FOCUS_RING,
							)}
						>
							<Icon name="chevron-left" size={13} aria-hidden="true" />
						</button>
						<button
							type="button"
							onClick={() => scrollToPage(activePage + 1)}
							disabled={activePage >= pageCount - 1}
							aria-label="Next wallpapers"
							className={cn(
								"inline-flex size-6 items-center justify-center rounded-full text-neutral-500 transition-[background-color,color,opacity] hover:bg-neutral-900/[0.06] hover:text-neutral-800 disabled:pointer-events-none disabled:opacity-30 dark:text-neutral-400 dark:hover:bg-white/[0.08] dark:hover:text-neutral-100",
								SETTINGS_FOCUS_RING,
							)}
						>
							<Icon name="chevron-right" size={13} aria-hidden="true" />
						</button>
					</div>
				</div>
				<div className="px-1.5 pt-1">
					<section
						ref={viewportRef}
						aria-roledescription="carousel"
						aria-label={`Wallpaper collection, page ${activePage + 1} of ${pageCount}`}
						tabIndex={0}
						onScroll={handleViewportScroll}
						onKeyDown={handleViewportKeyDown}
						className={cn(
							"scrollbar-hidden flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth",
							"focus-visible:outline-none",
							SETTINGS_FOCUS_RING,
							SETTINGS_RADIUS.thumbnail,
						)}
					>
						{carouselPages.map((page, pageIndex) => {
							const pageKey =
								page.map((item) => `${item.kind}-${item.id}`).join("|") ||
								"wallpaper-page-empty";
							return (
								<section
									key={pageKey}
									aria-roledescription="slide"
									aria-label={`Wallpapers, page ${pageIndex + 1} of ${pageCount}`}
									className="grid w-full shrink-0 snap-start grid-cols-4 content-start gap-2"
								>
									{page.map((item) => {
										const selected = isItemSelected(item);
										const tileLabel =
											item.kind === "image"
												? `Use ${item.label} wallpaper`
												: item.kind === "gradient"
													? `Use ${item.label} gradient`
													: `Use ${item.label} wallpaper`;
										return (
											<div
												key={`${item.kind}-${item.id}`}
												className={cn(
													TILE_BASE,
													"flex-col justify-end",
													selected ? TILE_SELECTED : "hover:brightness-105",
												)}
											>
												<button
													type="button"
													onClick={() => handleSelectItem(item)}
													aria-label={tileLabel}
													aria-pressed={selected}
													className="absolute inset-0 flex flex-col justify-end p-1.5 text-left focus-visible:outline-none"
												>
													{item.kind === "wallpaper" ? (
														<img
															src={item.thumb}
															alt=""
															className="absolute inset-0 size-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
															loading="lazy"
														/>
													) : item.kind === "image" &&
														customPreviews[item.id] ? (
														<img
															src={customPreviews[item.id] ?? ""}
															alt=""
															className="absolute inset-0 size-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
															loading="lazy"
														/>
													) : item.kind === "gradient" ? (
														<span
															aria-hidden="true"
															className="absolute inset-0 size-full"
															style={{
																background: (item as { css: string }).css,
															}}
														/>
													) : null}
													<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
													<span className="relative z-10 truncate font-medium text-[11px] text-white/90 drop-shadow-xs">
														{item.label}
													</span>
												</button>
												{selected ? (
													<span className="absolute top-1.5 right-1.5 z-10 flex size-4 items-center justify-center rounded-full bg-white text-black">
														<Icon
															name="check"
															size={10}
															strokeWidth={3.5}
															aria-hidden="true"
														/>
													</span>
												) : null}
												{item.kind === "image" ? (
													<button
														type="button"
														onClick={(e) => handleDeleteCustomImage(e, item.id)}
														aria-label={`Delete ${item.label} wallpaper`}
														className={cn(
															"absolute top-1.5 right-1.5 z-20 flex size-5 items-center justify-center rounded-full bg-black/50 text-white/80 opacity-0 shadow-none transition-[background-color,color,opacity] hover:bg-black/70 hover:text-white focus-visible:opacity-100 group-hover:opacity-100",
															SETTINGS_FOCUS_RING,
															selected && "hidden",
														)}
													>
														<Icon
															name="x"
															size={11}
															strokeWidth={2.5}
															aria-hidden="true"
														/>
													</button>
												) : null}
											</div>
										);
									})}
								</section>
							);
						})}
					</section>
				</div>

				{/* Pager: one compact pill of dots, centred in its own row */}
				<div className="flex items-center justify-center px-1.5 py-1.5">
					<nav
						aria-label="Wallpaper pages"
						className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900/[0.05] px-2.5 py-[7px] dark:bg-white/[0.06]"
					>
						{Array.from({ length: pageCount }, (_, pageIndex) => ({
							index: pageIndex,
							key: `wallpaper-page-${pageIndex + 1}`,
						})).map(({ index, key }) => {
							const active = index === activePage;
							return (
								<button
									key={key}
									type="button"
									onClick={() => scrollToPage(index)}
									aria-label={`Go to wallpaper page ${index + 1}`}
									aria-current={active ? "true" : undefined}
									className={cn(
										"size-1.5 rounded-full transition-all duration-200 motion-reduce:transition-none",
										SETTINGS_FOCUS_RING,
										active
											? "scale-110 bg-neutral-800 dark:bg-white"
											: "bg-neutral-400/60 hover:bg-neutral-500 dark:bg-white/30 dark:hover:bg-white/50",
									)}
								/>
							);
						})}
					</nav>
				</div>

				{/* Quiet secondary action, bottom-right of the same card */}
				<div className="flex items-center justify-end px-1.5 pt-0.5 pb-1">
					<button
						type="button"
						onClick={() => setUploaderOpen((prev) => !prev)}
						aria-expanded={uploaderOpen}
						className={cn(
							"font-medium text-[12px] text-[var(--apple-blue)] underline decoration-[var(--apple-blue)]/40 underline-offset-2 transition-opacity hover:opacity-75",
							SETTINGS_FOCUS_RING,
						)}
					>
						{uploaderOpen ? "Close" : "Add new"}
					</button>
				</div>

				{/* Same-card expansion — upload lives here, nowhere else */}
				<AnimatePresence initial={false}>
					{uploaderOpen ? (
						<motion.div
							key="wallpaper-uploader"
							initial={{ height: 0, opacity: 0 }}
							animate={{ height: "auto", opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							transition={
								reduceMotion
									? { duration: 0 }
									: { duration: 0.22, ease: [0.23, 1, 0.32, 1] }
							}
							className="overflow-hidden"
						>
							<div className="flex flex-col gap-2 px-1.5 pb-1.5">
								<FileUpload
									value={[]}
									onValueChange={() => undefined}
									accept={UPLOAD_ACCEPT}
									multiple={false}
									maxFiles={1}
									title="Drop an image here"
									description={`${SUPPORTED_LABEL} · up to 10 MB`}
									browseLabel="Browse"
									onFilesAdded={handleFilesAdded}
									className="w-full space-y-0"
									classNames={{
										dropzone: cn(
											"squircle border-neutral-900/[0.1] bg-transparent px-3 py-2.5 shadow-none hover:border-neutral-900/[0.2] active:scale-100 dark:border-white/[0.12] dark:hover:border-white/[0.2] [&>span:first-child>svg]:size-4 [&>span:first-child]:size-9 [&>span:first-child]:bg-neutral-900/[0.05] [&>span:first-child]:text-neutral-500 dark:[&>span:first-child]:bg-white/[0.06] dark:[&>span:first-child]:text-neutral-300 [&>span:last-child]:border-neutral-900/[0.1] [&>span:last-child]:text-neutral-700 dark:[&>span:last-child]:border-white/[0.12] dark:[&>span:last-child]:text-neutral-200 [&>span:nth-child(2)>span:first-child]:font-medium [&>span:nth-child(2)>span:first-child]:text-[13px]",
											SETTINGS_RADIUS.surface,
										),
										action:
											"bg-transparent shadow-none active:scale-100 hover:bg-neutral-900/[0.05] hover:text-neutral-900 dark:hover:bg-white/[0.08] dark:hover:text-white",
										queue: "hidden",
									}}
								/>

								{/* Single coherent status card — the preview lives
								    INSIDE it, never detached below. */}
								{pending ? (
									<div
										role="status"
										className={cn(
											"squircle relative overflow-hidden border border-neutral-900/[0.08] bg-neutral-900/[0.03] p-2.5 dark:border-white/[0.08] dark:bg-white/[0.04]",
											SETTINGS_RADIUS.surface,
										)}
									>
										<div className="flex items-center gap-2.5">
											<span
												className={cn(
													"relative grid size-11 shrink-0 place-items-center overflow-hidden bg-neutral-900/[0.06] dark:bg-white/[0.07]",
													SETTINGS_RADIUS.thumbnail,
												)}
											>
												{pending.previewUrl ? (
													<img
														src={pending.previewUrl}
														alt=""
														className="absolute inset-0 size-full object-cover"
													/>
												) : (
													<Icon
														name="image"
														size={16}
														className="text-neutral-400"
														aria-hidden="true"
													/>
												)}
											</span>
											<span className="min-w-0 flex-1">
												<span className="block truncate font-medium text-[13px] text-neutral-900 dark:text-neutral-100">
													{pending.name}
												</span>
												<span className="mt-0.5 block text-[11px] text-neutral-500 dark:text-neutral-400">
													{pending.mime === "unknown"
														? formatBytes(pending.size)
														: `${pending.mime.replace("image/", "").toUpperCase()} · ${formatBytes(pending.size)}`}
													{pending.status === "error" && pending.error
														? ` · ${pending.error}`
														: null}
												</span>
											</span>
											<span className="flex shrink-0 items-center gap-1">
												{pending.status === "validating" ||
												pending.status === "confirming" ? (
													<Icon
														name="loader"
														size={15}
														className="animate-spin text-neutral-500 dark:text-neutral-400"
														aria-hidden="true"
													/>
												) : pending.status === "ready" ? (
													<Icon
														name="check"
														size={15}
														className="text-emerald-600 dark:text-emerald-400"
														aria-hidden="true"
													/>
												) : null}
												<button
													type="button"
													onClick={clearPending}
													aria-label={`Remove ${pending.name}`}
													className={cn(
														"inline-flex size-7 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-900/[0.06] hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-white/[0.08] dark:hover:text-neutral-100",
														SETTINGS_FOCUS_RING,
													)}
												>
													<Icon name="x" size={13} aria-hidden="true" />
												</button>
											</span>
										</div>
										{(pending.status === "validating" ||
											pending.status === "ready" ||
											pending.status === "confirming") && (
											<div
												role="progressbar"
												aria-valuemin={0}
												aria-valuemax={100}
												aria-valuenow={Math.round(pending.progress)}
												aria-label={`${pending.name} progress`}
												className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-900/[0.08] dark:bg-white/[0.1]"
											>
												<motion.div
													className={cn(
														"h-full rounded-full",
														pending.status === "ready"
															? "bg-emerald-500"
															: "bg-[var(--apple-blue)]",
													)}
													initial={false}
													animate={{
														scaleX: Math.max(
															0,
															Math.min(1, pending.progress / 100),
														),
													}}
													style={{ transformOrigin: "left" }}
													transition={
														reduceMotion
															? { duration: 0 }
															: { duration: 0.25, ease: [0.23, 1, 0.32, 1] }
													}
												/>
											</div>
										)}
										{pending.status === "ready" && (
											<div className="mt-2 flex items-center justify-end">
												<SettingsAction
													tone="primary"
													onClick={handleConfirmUpload}
												>
													Confirm
												</SettingsAction>
											</div>
										)}
									</div>
								) : null}
							</div>
						</motion.div>
					) : null}
				</AnimatePresence>
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
