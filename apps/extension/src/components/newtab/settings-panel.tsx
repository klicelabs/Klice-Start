import { Button } from "@klice-start/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@klice-start/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@klice-start/ui/components/dropdown-menu";
import { Input } from "@klice-start/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@klice-start/ui/components/select";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@klice-start/ui/components/sheet";
import { Slider } from "@klice-start/ui/components/slider";
import { Switch } from "@klice-start/ui/components/switch";
import type { IconName } from "@klice-start/ui/icons/icon";
import { Icon } from "@klice-start/ui/icons/icon";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useSvgIcon } from "../../hooks/use-svg-icon";
import {
	GRADIENTS,
	MAX_BACKGROUND_IMAGE_BYTES,
	SEARCH_ENGINES,
	WALLPAPERS,
} from "../../lib/constants";
import { flushPersist } from "../../lib/storage";
import { SEARCH_ENGINE_TO_SVGL } from "../../lib/svgl-mapping";
import { cn } from "../../lib/utils";
import {
	exportBookmarksHtml,
	importBookmarksFromBrowser,
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

function SettingRow({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex min-h-[44px] items-center justify-between gap-3 border-border/50 border-b px-1 py-2.5 last:border-b-0",
				className,
			)}
		>
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

function backgroundSourceKey(background: Settings["background"]): string {
	return [
		background.type,
		background.gradientId ?? "",
		background.imageId ?? "",
		background.wallpaperId ?? "",
		background.pexelsImageId ?? "",
		background.pexelsQuery,
		background.pexelsFrequency,
		background.pexelsPreviousFrequency ?? "",
	].join("\u0000");
}
function PexelsQueryInput({
	value,
	onChange,
}: {
	value: string;
	onChange: (value: string) => void;
}) {
	const [localValue, setLocalValue] = useState(value);
	const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	useEffect(() => {
		setLocalValue(value);
	}, [value]);

	useEffect(() => () => clearTimeout(timerRef.current), []);

	return (
		<Input
			value={localValue}
			onChange={(event) => {
				const nextValue = event.target.value;
				setLocalValue(nextValue);
				clearTimeout(timerRef.current);
				timerRef.current = setTimeout(() => onChange(nextValue), 500);
			}}
			onBlur={() => {
				clearTimeout(timerRef.current);
				if (localValue !== value) onChange(localValue);
			}}
			placeholder="minimalist background, dark architecture"
			className="mt-1 rounded-xl border-border bg-secondary px-3 py-2 text-foreground text-sm"
		/>
	);
}
const PEXELS_FREQUENCY_OPTIONS: readonly {
	value: WallpaperFrequency;
	label: string;
}[] = [
	{ value: "per-tab", label: "Every tab" },
	{ value: "hourly", label: "Hourly" },
	{ value: "daily", label: "Daily" },
	{ value: "daylight", label: "Daylight" },
	{ value: "locked", label: "Locked" },
];

function WallpaperThumbnail({
	src,
	label,
	className = "size-9",
	loading = false,
}: {
	src: string | null | undefined;
	label: string;
	className?: string;
	loading?: boolean;
}) {
	const [status, setStatus] = useState<
		"loading" | "ready" | "missing" | "empty"
	>(src ? "loading" : src === null ? "missing" : loading ? "loading" : "empty");
	const mountedRef = useRef(true);
	const sourceRef = useRef(src);
	sourceRef.current = src;

	useEffect(() => {
		mountedRef.current = true;
		setStatus(
			src
				? "loading"
				: src === null
					? "missing"
					: loading
						? "loading"
						: "empty",
		);
		return () => {
			mountedRef.current = false;
		};
	}, [src, loading]);

	return (
		<span
			className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[8px] text-muted-foreground ${className}`}
			role="img"
			aria-label={
				status === "missing"
					? `${label} preview unavailable`
					: status === "loading"
						? `Loading ${label} preview`
						: `${label} preview`
			}
		>
			{status !== "ready" && status !== "empty" && (
				<span className="px-1 text-center leading-tight">
					{status === "missing" ? "No preview" : "Loading…"}
				</span>
			)}
			{src && (
				<img
					key={src}
					src={src}
					alt=""
					className={`absolute inset-0 size-full object-cover ${
						status === "ready" ? "opacity-100" : "opacity-0"
					}`}
					onLoad={() => {
						if (mountedRef.current && sourceRef.current === src) {
							setStatus("ready");
						}
					}}
					onError={() => {
						if (mountedRef.current && sourceRef.current === src) {
							setStatus("missing");
						}
					}}
				/>
			)}
		</span>
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
			<h3 className="m-0 mb-1.5 px-1 font-medium text-muted-foreground text-xs tracking-wide">
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
	const deleteBackgroundImage = useImageStore((s) => s.deleteBackgroundImage);
	const getBackgroundImage = useImageStore((s) => s.getBackgroundImage);

	const bgFileRef = useRef<HTMLInputElement>(null);
	const importFileRef = useRef<HTMLInputElement>(null);
	const mountedRef = useRef(true);
	const backgroundOperationRef = useRef(0);
	const resetPendingRef = useRef(false);
	const [importStatus, setImportStatus] = useState("");
	const [uploadStatus, setUploadStatus] = useState("");
	const importOperationRef = useRef(0);
	const [confirmReset, setConfirmReset] = useState(false);
	const [userWallpaperPreviews, setUserWallpaperPreviews] = useState<
		Record<string, string | null>
	>({});

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			backgroundOperationRef.current += 1;
			importOperationRef.current += 1;
		};
	}, []);

	async function handleReset() {
		invalidateBackgroundOperation();
		const operation = backgroundOperationRef.current;
		importOperationRef.current += 1;
		const importFileInput = importFileRef.current;
		if (importFileInput) importFileInput.value = "";
		resetPendingRef.current = true;
		try {
			await resetAll();
			if (!mountedRef.current || backgroundOperationRef.current !== operation)
				return;
			setConfirmReset(false);
			setImportStatus("");
			setUploadStatus("");
			setUserWallpaperPreviews({});
			onClose();
		} finally {
			if (backgroundOperationRef.current === operation)
				resetPendingRef.current = false;
		}
	}

	// Load previews for local wallpapers and discard metadata that no longer has
	// a corresponding IDB record. Failed reads remain in place so a transient
	// storage error cannot erase a user's selection.
	const bg = settings.background;
	const customWallpapers = bg.customWallpapers ?? [];
	const legacyImageId =
		bg.imageId &&
		!customWallpapers.some((wallpaper) => wallpaper.id === bg.imageId)
			? bg.imageId
			: null;
	useEffect(() => {
		let active = true;
		if (!open) {
			return () => {
				active = false;
			};
		}

		const wallpaperEntries = [
			...customWallpapers.map((wallpaper) => ({
				id: wallpaper.id,
				cleanupIfMissing: true,
			})),
			...(legacyImageId
				? [{ id: legacyImageId, cleanupIfMissing: false }]
				: []),
		];
		if (wallpaperEntries.length === 0) {
			setUserWallpaperPreviews({});
			return () => {
				active = false;
			};
		}

		Promise.all(
			wallpaperEntries.map(async ({ id, cleanupIfMissing }) => {
				try {
					const preview = await getBackgroundImage(id);
					return [id, preview, cleanupIfMissing && preview === null] as const;
				} catch {
					return [id, null, false] as const;
				}
			}),
		).then((entries) => {
			if (!active || !mountedRef.current) return;
			const previews: Record<string, string | null> = {};
			const staleIds = new Set<string>();
			for (const [id, preview, isMissing] of entries) {
				previews[id] = preview;
				if (isMissing) staleIds.add(id);
			}
			setUserWallpaperPreviews(previews);
			if (staleIds.size === 0) return;

			const latestBackground = useSetupStore.getState().settings.background;
			const remaining = (latestBackground.customWallpapers ?? []).filter(
				(wallpaper) => !staleIds.has(wallpaper.id),
			);
			if (
				remaining.length !== (latestBackground.customWallpapers ?? []).length
			) {
				updateBackground({
					customWallpapers: remaining,
					...(latestBackground.imageId && staleIds.has(latestBackground.imageId)
						? {
								type: "solid",
								imageId: null,
								wallpaperId: null,
							}
						: {}),
				} as Partial<Settings["background"]>);
			}
		});

		return () => {
			active = false;
		};
	}, [
		open,
		getBackgroundImage,
		updateBackground,
		customWallpapers,
		legacyImageId,
	]);

	// === Background ===
	function invalidateBackgroundOperation() {
		backgroundOperationRef.current += 1;
		if (mountedRef.current) setUploadStatus("");
	}
	function handleSolidColor(color: string) {
		invalidateBackgroundOperation();
		updateBackground({
			type: "solid",
			color,
			gradientId: null,
			imageId: null,
			wallpaperId: null,
		} as Partial<Settings["background"]>);
	}

	function handlePexelsToggle(enabled: boolean) {
		invalidateBackgroundOperation();
		if (enabled) {
			updateBackground({ type: "pexels" } as Partial<Settings["background"]>);
			void refreshWallpaper(true);
			return;
		}
		updateBackground({
			type: "solid",
			gradientId: null,
			imageId: null,
			wallpaperId: null,
			pexelsImageId: null,
			pexelsLastFetched: null,
			pexelsLastPeriod: null,
			pexelsPreviousFrequency: null,
		} as Partial<Settings["background"]>);
	}

	function handleGradient(id: string) {
		invalidateBackgroundOperation();
		updateBackground({
			type: "gradient",
			gradientId: id,
			imageId: null,
			wallpaperId: null,
		} as Partial<Settings["background"]>);
	}
	function handleWallpaperSelection(value: string | null) {
		if (value === null) return;
		invalidateBackgroundOperation();
		if (value.startsWith("wallpaper:")) {
			const wallpaperId = value.slice("wallpaper:".length);
			if (!WALLPAPERS.some((wallpaper) => wallpaper.id === wallpaperId)) return;
			updateBackground({
				type: "wallpaper",
				wallpaperId,
				gradientId: null,
				imageId: null,
			} as Partial<Settings["background"]>);
			return;
		}
		if (value.startsWith("image:")) {
			const imageId = value.slice("image:".length);
			if (
				!customWallpapers.some((wallpaper) => wallpaper.id === imageId) &&
				imageId !== legacyImageId
			)
				return;
			updateBackground({
				type: "image",
				imageId,
				wallpaperId: null,
				gradientId: null,
			} as Partial<Settings["background"]>);
		}
	}

	async function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
		const input = e.target;
		const file = input.files?.[0];
		if (!file) {
			setUploadStatus("");
			input.value = "";
			return;
		}
		if (resetPendingRef.current) {
			if (mountedRef.current) {
				setUploadStatus("Reset is in progress. Try uploading again.");
			}
			input.value = "";
			return;
		}
		const sourceKey = backgroundSourceKey(
			useSetupStore.getState().settings.background,
		);
		const operation = ++backgroundOperationRef.current;
		let savedImageId: string | null = null;
		let committed = false;
		try {
			if (!file.type.startsWith("image/")) {
				throw new Error("Choose an image file.");
			}
			if (file.size > MAX_BACKGROUND_IMAGE_BYTES) {
				throw new Error("Image must be 10 MB or smaller.");
			}
			if (mountedRef.current) setUploadStatus("Reading image…");
			const dataUrl = await fileToDataUrl(file);
			if (
				!mountedRef.current ||
				backgroundOperationRef.current !== operation ||
				resetPendingRef.current
			)
				return;

			savedImageId = await saveBackgroundImage(dataUrl);
			const latestBackground = useSetupStore.getState().settings.background;
			if (
				!mountedRef.current ||
				backgroundOperationRef.current !== operation ||
				resetPendingRef.current ||
				backgroundSourceKey(latestBackground) !== sourceKey
			) {
				await deleteBackgroundImage(savedImageId);
				savedImageId = null;
				return;
			}

			const name =
				file.name.replace(/\.[^/.]+$/, "").trim() || "Uploaded wallpaper";
			updateBackground({
				type: "image",
				imageId: savedImageId,
				wallpaperId: null,
				gradientId: null,
				customWallpapers: [
					...(latestBackground.customWallpapers ?? []).filter(
						(wallpaper) => wallpaper.id !== savedImageId,
					),
					{ id: savedImageId, name },
				],
			} as Partial<Settings["background"]>);
			committed = true;
			setUserWallpaperPreviews((previews) => ({
				...previews,
				[savedImageId as string]: dataUrl,
			}));
			setUploadStatus(`Added ${name}.`);
			savedImageId = null;
		} catch (err) {
			if (savedImageId && !committed) {
				try {
					await deleteBackgroundImage(savedImageId);
				} catch {
					// The original error is more useful to the user than cleanup noise.
				}
			}
			if (mountedRef.current && backgroundOperationRef.current === operation) {
				setUploadStatus(
					err instanceof Error ? err.message : "Could not load that image.",
				);
			}
		} finally {
			input.value = "";
		}
	}

	// === Bookmarks ===
	async function handleImportBookmarksFile(e: ChangeEvent<HTMLInputElement>) {
		const input = e.target;
		const file = input.files?.[0];
		if (!file) {
			input.value = "";
			return;
		}
		const operation = ++importOperationRef.current;
		if (mountedRef.current) setImportStatus("Reading bookmarks…");
		try {
			const { foldersCreated, cardsCreated } = await importBookmarksHtml(
				await file.text(),
			);
			if (!mountedRef.current || importOperationRef.current !== operation)
				return;
			setImportStatus(
				`Done: ${foldersCreated} folder(s) and ${cardsCreated} link(s) imported.`,
			);
		} catch (err) {
			if (mountedRef.current && importOperationRef.current === operation) {
				setImportStatus(
					err instanceof Error ? err.message : "Could not import bookmarks.",
				);
			}
		} finally {
			if (importOperationRef.current === operation) {
				input.value = "";
			}
		}
	}

	async function handleImportFromBrowser() {
		const operation = ++importOperationRef.current;
		if (mountedRef.current) setImportStatus("Reading bookmarks…");
		try {
			const { foldersCreated, cardsCreated } =
				await importBookmarksFromBrowser();
			if (!mountedRef.current || importOperationRef.current !== operation)
				return;
			setImportStatus(
				`Done: ${foldersCreated} folder(s) and ${cardsCreated} link(s) imported.`,
			);
		} catch (err) {
			if (mountedRef.current && importOperationRef.current === operation) {
				setImportStatus(
					err instanceof Error ? err.message : "Could not import bookmarks.",
				);
			}
		}
	}

	async function handleExportBookmarks() {
		const operation = ++importOperationRef.current;
		const importFileInput = importFileRef.current;
		if (importFileInput) importFileInput.value = "";
		try {
			await exportBookmarksHtml();
		} catch (err) {
			if (mountedRef.current && importOperationRef.current === operation) {
				setImportStatus(
					err instanceof Error ? err.message : "Could not export bookmarks.",
				);
			}
		}
	}

	const clock = settings.clock;
	const greeting = settings.greeting;
	const search = settings.search;
	const legacyWallpaperOption = legacyImageId
		? {
				value: `image:${legacyImageId}`,
				id: legacyImageId,
				label: "Custom wallpaper",
				src: userWallpaperPreviews[legacyImageId],
				loading: userWallpaperPreviews[legacyImageId] === undefined,
			}
		: null;
	const wallpaperOptions = [
		...WALLPAPERS.map((wallpaper) => ({
			value: `wallpaper:${wallpaper.id}`,
			id: wallpaper.id,
			label: wallpaper.label,
			src: wallpaper.src,
			loading: false,
		})),
		...customWallpapers.map((wallpaper) => ({
			value: `image:${wallpaper.id}`,
			id: wallpaper.id,
			label: wallpaper.name,
			src: userWallpaperPreviews[wallpaper.id],
			loading: userWallpaperPreviews[wallpaper.id] === undefined,
		})),
		...(legacyWallpaperOption ? [legacyWallpaperOption] : []),
	];
	const selectedWallpaperCandidate =
		bg.type === "wallpaper" && bg.wallpaperId
			? `wallpaper:${bg.wallpaperId}`
			: bg.type === "image" && bg.imageId
				? `image:${bg.imageId}`
				: "";
	const selectedWallpaper = wallpaperOptions.find(
		(wallpaper) => wallpaper.value === selectedWallpaperCandidate,
	);
	const selectedWallpaperValue = selectedWallpaper?.value ?? "";
	const selectedGradientId = bg.type === "gradient" ? bg.gradientId : null;

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
						<SectionCard title="Appearance & Background" className="pb-4">
							<SettingRow className="px-1 py-3">
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
										<SelectValue>
											{() =>
												settings.appearanceMode === "liquid" ? "Liquid" : "Flat"
											}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="liquid">Liquid</SelectItem>
										<SelectItem value="classic">Flat</SelectItem>
									</SelectContent>
								</Select>
							</SettingRow>

							<div className="mt-6">
								<h4 className="px-1 font-medium text-muted-foreground text-xs">
									Background
								</h4>
								<Select
									value={selectedWallpaperValue}
									onValueChange={handleWallpaperSelection}
								>
									<SelectTrigger
										id="background-wallpaper-picker"
										size="default"
										className="mt-2 h-11 w-full min-w-0 rounded-xl border-border/60 bg-input/40 px-2.5 hover:bg-input/60"
										aria-label="Background wallpaper"
									>
										{selectedWallpaper && (
											<WallpaperThumbnail
												src={selectedWallpaper.src}
												label={selectedWallpaper.label}
												className="size-8"
												loading={selectedWallpaper.loading}
											/>
										)}
										<SelectValue
											className="min-w-0 truncate"
											placeholder="Choose a wallpaper"
										>
											{() => selectedWallpaper?.label ?? "Choose a wallpaper"}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										{wallpaperOptions.map((wallpaper) => (
											<SelectItem
												key={wallpaper.value}
												value={wallpaper.value}
												className="min-w-0 py-1.5"
											>
												<span className="flex min-w-0 items-center gap-2.5">
													<WallpaperThumbnail
														src={wallpaper.src}
														label={wallpaper.label}
														className="size-8"
														loading={wallpaper.loading}
													/>
													<span className="min-w-0 truncate">
														{wallpaper.label}
													</span>
												</span>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="mt-5">
								<h4 className="px-1 font-medium text-muted-foreground text-xs">
									Presets
								</h4>
								<div className="mt-2 grid grid-cols-4 gap-2">
									{GRADIENTS.map((g) => {
										const isSelected = selectedGradientId === g.id;
										return (
											<button
												type="button"
												key={g.id}
												className={cn(
													"group relative flex aspect-[4/3] items-center justify-center rounded-xl bg-center bg-cover px-1 font-medium text-[10px] text-white/85 shadow-sm transition-[transform,box-shadow] duration-150 hover:scale-[1.02] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]",
													isSelected &&
														"ring-2 ring-foreground/80 ring-offset-2 ring-offset-background",
												)}
												style={{
													background: g.css,
													textShadow: "0 1px 3px rgba(0,0,0,0.5)",
												}}
												onClick={() => handleGradient(g.id)}
												aria-label={`${g.label} preset${isSelected ? ", selected" : ""}`}
												aria-pressed={isSelected}
											>
												{g.label}
											</button>
										);
									})}
								</div>
								<button
									type="button"
									className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full border border-border/50 bg-transparent px-3 font-medium text-muted-foreground text-xs transition-[background-color,color,transform] duration-150 hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99]"
									aria-label="Upload custom image"
									onClick={() => bgFileRef.current?.click()}
								>
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
									<span>Custom image</span>
								</button>
								<input
									ref={bgFileRef}
									type="file"
									accept="image/*"
									className="hidden"
									onChange={handleImageUpload}
								/>
							</div>
							{uploadStatus && (
								<p
									className="mt-2 px-1 text-muted-foreground text-xs"
									role="status"
									aria-live="polite"
								>
									{uploadStatus}
								</p>
							)}

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

							<details className="mt-4 border-border/40 border-t pt-3">
								<summary className="cursor-pointer list-none px-1 font-medium text-muted-foreground text-xs [&::-webkit-details-marker]:hidden">
									Additional background options
								</summary>
								<div className="mt-3 space-y-3">
									<div className="flex min-h-10 items-center justify-between gap-3 px-1">
										<span className="text-foreground text-sm">Solid color</span>
										<input
											type="color"
											value={bg.color}
											onChange={(event) => handleSolidColor(event.target.value)}
											className="size-7 cursor-pointer rounded-full border border-border/50 bg-transparent p-0"
											aria-label="Solid background color"
										/>
									</div>
									<div className="flex min-h-10 items-center justify-between gap-3 px-1">
										<span className="text-foreground text-sm">
											Pexels wallpaper
										</span>
										<Switch
											checked={bg.type === "pexels"}
											onCheckedChange={handlePexelsToggle}
										/>
									</div>
									{bg.type === "pexels" && (
										<div className="space-y-3 px-1">
											<div>
												<span className="text-muted-foreground text-xs">
													Search query
												</span>
												<PexelsQueryInput
													value={bg.pexelsQuery}
													onChange={(query) => {
														updateBackground({ pexelsQuery: query });
														void refreshWallpaper(true);
													}}
												/>
											</div>
											<div>
												<span className="text-muted-foreground text-xs">
													Frequency
												</span>
												<Select
													value={bg.pexelsFrequency}
													onValueChange={(value) => {
														if (!value) return;
														const nextFrequency = value as WallpaperFrequency;
														const currentFrequency = bg.pexelsFrequency;
														if (nextFrequency === currentFrequency) return;
														if (nextFrequency === "locked") {
															updateBackground({
																pexelsFrequency: "locked",
																pexelsPreviousFrequency:
																	currentFrequency !== "locked"
																		? currentFrequency
																		: bg.pexelsPreviousFrequency || "daily",
															});
															return;
														}
														updateBackground({
															pexelsFrequency: nextFrequency,
															pexelsPreviousFrequency: null,
														});
														void refreshWallpaper(true);
													}}
													items={PEXELS_FREQUENCY_OPTIONS}
												>
													<SelectTrigger
														size="sm"
														className="mt-1 min-w-[130px]"
														aria-label="Wallpaper frequency"
													>
														<SelectValue>
															{() =>
																PEXELS_FREQUENCY_OPTIONS.find(
																	(option) =>
																		option.value === bg.pexelsFrequency,
																)?.label ?? bg.pexelsFrequency
															}
														</SelectValue>
													</SelectTrigger>
													<SelectContent>
														{PEXELS_FREQUENCY_OPTIONS.map((option) => (
															<SelectItem
																key={option.value}
																value={option.value}
															>
																{option.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
										</div>
									)}
								</div>
							</details>
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
									<DropdownMenu>
										<DropdownMenuTrigger
											render={
												<Button
													variant="secondary"
													className="flex-1 rounded-xl text-sm"
												/>
											}
										>
											Import Bookmarks
										</DropdownMenuTrigger>
										<DropdownMenuContent
											align="start"
											side="top"
											sideOffset={6}
											className="w-auto min-w-[220px]"
										>
											<DropdownMenuItem onClick={handleImportFromBrowser}>
												<Icon name="globe" className="opacity-70" />
												Import from Browser
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => importFileRef.current?.click()}
											>
												<Icon name="upload" className="opacity-70" />
												Import from HTML File
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
									<Button
										variant="secondary"
										className="flex-1 rounded-xl text-sm"
										onClick={handleExportBookmarks}
									>
										Export Bookmarks
									</Button>
								</div>
								{importStatus && (
									<p
										className="mt-2 text-muted-foreground text-xs"
										role="status"
										aria-live="polite"
									>
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
	reader.onload = () => {
		if (typeof reader.result === "string") {
			resolve(reader.result);
		} else {
			reject(new Error("Could not read that image."));
		}
	};
	reader.onerror = () => reject(new Error("Could not read that image."));
	reader.onabort = () => reject(new Error("Image reading was cancelled."));
	try {
		reader.readAsDataURL(file);
	} catch {
		reject(new Error("Could not read that image."));
	}
	return promise;
}
