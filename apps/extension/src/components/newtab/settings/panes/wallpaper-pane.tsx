import {
	FileUpload,
	type FileUploadItem,
} from "@klice-start/ui/components/motion/file-upload";
import { Icon } from "@klice-start/ui/icons/icon";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	GRADIENTS,
	MAX_BACKGROUND_IMAGE_BYTES,
	WALLPAPERS,
} from "../../../../lib/constants";
import { cn } from "../../../../lib/utils";
import { useImageStore } from "../../../../stores/image-store";
import { useSetupStore } from "../../../../stores/setup-store";
import type { Settings } from "../../../../types";
import { SectionCard } from "../shared/section-card";
import { SettingsAction } from "../shared/settings-action";
import {
	SETTINGS_FOCUS_RING,
	SETTINGS_PAGE,
	SETTINGS_RADIUS,
} from "../shared/settings-tokens";

type WallpaperLibraryItem =
	| { kind: "wallpaper"; id: string; label: string; thumb: string }
	| { kind: "gradient"; id: string; label: string; css: string }
	| { kind: "solid"; id: "solid"; label: string; css: string }
	| { kind: "image"; id: string; label: string };

type PendingUpload = {
	name: string;
	size: number;
	mime: string;
	previewUrl: string;
	status: "validating" | "ready" | "confirming" | "error";
	progress: number;
	error?: string;
	dataUrl?: string;
};

const WALLPAPER_TILE = cn(
	"group squircle relative flex aspect-[4/3] min-w-0 overflow-hidden border border-neutral-900/10 bg-neutral-900/[0.04] shadow-none transition-[filter,box-shadow] duration-150 focus-visible:outline-none dark:border-white/10 dark:bg-white/[0.04]",
	SETTINGS_RADIUS.surface,
);
const TILE_SELECTED =
	"ring-2 ring-inset ring-[var(--apple-blue)] dark:ring-[var(--apple-blue)]";

const SUPPORTED_IMAGE_TYPES: Record<string, readonly string[]> = {
	"image/jpeg": ["jpg", "jpeg"],
	"image/png": ["png"],
	"image/webp": ["webp"],
	"image/avif": ["avif"],
};
const SUPPORTED_LABEL = "JPEG, PNG, WebP or AVIF";
const UPLOAD_ACCEPT = Object.keys(SUPPORTED_IMAGE_TYPES).join(",");

/** Downscale large user images before they enter the existing image store. */
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
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Could not initialize image processor.");

	context.drawImage(bitmap, 0, 0, width, height);
	bitmap.close();
	return canvas.toDataURL("image/jpeg", 0.88);
}

/** Validate the actual file, not only the browser picker's accept hint. */
function validateImageFile(file: File): string | null {
	if (!file || file.size <= 0) return "That file is empty.";
	if (file.size > MAX_BACKGROUND_IMAGE_BYTES) {
		return `Image must be ${Math.round(MAX_BACKGROUND_IMAGE_BYTES / (1024 * 1024))} MB or smaller.`;
	}

	const extensions = SUPPORTED_IMAGE_TYPES[file.type];
	if (!extensions) return `Only ${SUPPORTED_LABEL} images are supported.`;

	const extension = file.name.includes(".")
		? file.name.split(".").pop()?.toLowerCase()
		: undefined;
	if (!extension || !extensions.includes(extension)) {
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

interface WallpaperTileProps {
	customPreviews: Record<string, string | null>;
	item: WallpaperLibraryItem;
	selected: boolean;
	onDelete: (event: MouseEvent, id: string) => void;
	onSelect: (item: WallpaperLibraryItem) => void;
}

function WallpaperTile({
	customPreviews,
	item,
	selected,
	onDelete,
	onSelect,
}: WallpaperTileProps) {
	const tileLabel =
		item.kind === "gradient"
			? `Use ${item.label} gradient`
			: item.kind === "solid"
				? "Use solid colour background"
				: `Use ${item.label} wallpaper`;

	return (
		<div
			className={cn(
				WALLPAPER_TILE,
				selected ? TILE_SELECTED : "hover:brightness-105",
			)}
			data-wallpaper-tile={item.id}
		>
			<button
				type="button"
				onClick={() => onSelect(item)}
				aria-label={tileLabel}
				aria-pressed={selected}
				className={cn(
					"absolute inset-0 flex flex-col justify-end text-left focus-visible:outline-none",
					SETTINGS_FOCUS_RING,
				)}
			>
				{item.kind === "wallpaper" ? (
					<img
						src={item.thumb}
						alt=""
						className="absolute inset-0 size-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
						loading="lazy"
					/>
				) : item.kind === "image" && customPreviews[item.id] ? (
					<img
						src={customPreviews[item.id] ?? ""}
						alt=""
						className="absolute inset-0 size-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
						loading="lazy"
					/>
				) : (
					<span
						aria-hidden="true"
						className="absolute inset-0 size-full"
						style={{
							background:
								item.kind === "gradient" || item.kind === "solid"
									? item.css
									: "linear-gradient(135deg, #27272a, #09090b)",
						}}
					/>
				)}
				<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
				<span className="relative z-10 truncate px-2.5 pb-2 font-medium text-[11px] text-white/95 drop-shadow-xs">
					{item.label}
				</span>
			</button>

			{selected ? (
				<span className="absolute top-2 right-2 z-10 flex size-5 items-center justify-center rounded-full bg-[var(--apple-blue)] text-white shadow-sm">
					<Icon name="check" size={12} strokeWidth={3} aria-hidden="true" />
				</span>
			) : null}

			{item.kind === "image" ? (
				<button
					type="button"
					onClick={(event) => onDelete(event, item.id)}
					aria-label={`Delete ${item.label} wallpaper`}
					title={`Delete ${item.label}`}
					className={cn(
						"absolute top-2 right-2 z-20 flex size-7 items-center justify-center rounded-full bg-black/50 text-white/85 opacity-0 shadow-sm transition-[background-color,color,opacity] hover:bg-black/75 hover:text-white focus-visible:opacity-100 group-hover:opacity-100",
						SETTINGS_FOCUS_RING,
						selected && "hidden",
					)}
				>
					<Icon name="trash" size={13} strokeWidth={2} aria-hidden="true" />
				</button>
			) : null}
		</div>
	);
}

export function WallpaperPane() {
	const bg = useSetupStore((state) => state.settings.background);
	const updateBackground = useSetupStore((state) => state.updateBackground);
	const commitCustomWallpaper = useSetupStore(
		(state) => state.commitCustomWallpaper,
	);
	const removeCustomWallpaper = useSetupStore(
		(state) => state.removeCustomWallpaper,
	);
	const saveBackgroundImage = useImageStore(
		(state) => state.saveBackgroundImage,
	);
	const deleteBackgroundImage = useImageStore(
		(state) => state.deleteBackgroundImage,
	);
	const getBackgroundImage = useImageStore((state) => state.getBackgroundImage);
	const reduceMotion = useReducedMotion() ?? false;
	const customWallpapers = bg.customWallpapers ?? [];
	const [uploaderOpen, setUploaderOpen] = useState(false);
	const [pending, setPending] = useState<PendingUpload | null>(null);
	const [customPreviews, setCustomPreviews] = useState<
		Record<string, string | null>
	>({});

	useEffect(() => {
		let active = true;
		if (customWallpapers.length === 0) {
			setCustomPreviews({});
			return;
		}

		Promise.all(
			customWallpapers.map(async (wallpaper) => {
				try {
					const dataUrl = await getBackgroundImage(wallpaper.id);
					return [wallpaper.id, dataUrl] as const;
				} catch {
					return [wallpaper.id, null] as const;
				}
			}),
		).then((entries) => {
			if (!active) return;
			const next: Record<string, string | null> = {};
			for (const [id, url] of entries) next[id] = url;
			setCustomPreviews(next);
		});

		return () => {
			active = false;
		};
	}, [customWallpapers, getBackgroundImage]);

	useEffect(
		() => () => {
			if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
		},
		[pending?.previewUrl],
	);

	const libraryItems = useMemo<WallpaperLibraryItem[]>(
		() => [
			{ kind: "solid", id: "solid", label: "Solid colour", css: bg.color },
			...WALLPAPERS.map((wallpaper) => ({
				kind: "wallpaper" as const,
				id: wallpaper.id,
				label: wallpaper.label,
				thumb: wallpaper.thumb,
			})),
			...GRADIENTS.map((gradient) => ({
				kind: "gradient" as const,
				id: gradient.id,
				label: gradient.label,
				css: gradient.css,
			})),
			...customWallpapers.map((wallpaper) => ({
				kind: "image" as const,
				id: wallpaper.id,
				label: wallpaper.name,
			})),
		],
		[bg.color, customWallpapers],
	);

	function isSelected(item: WallpaperLibraryItem) {
		if (item.kind === "wallpaper")
			return bg.type === "wallpaper" && bg.wallpaperId === item.id;
		if (item.kind === "gradient")
			return bg.type === "gradient" && bg.gradientId === item.id;
		if (item.kind === "solid") return bg.type === "solid";
		return bg.type === "image" && bg.imageId === item.id;
	}

	function handleSelect(item: WallpaperLibraryItem) {
		if (item.kind === "wallpaper") {
			updateBackground({
				type: "wallpaper",
				wallpaperId: item.id,
				gradientId: null,
				imageId: null,
			} as Partial<Settings["background"]>);
			return;
		}
		if (item.kind === "gradient") {
			updateBackground({
				type: "gradient",
				gradientId: item.id,
				wallpaperId: null,
				imageId: null,
			} as Partial<Settings["background"]>);
			return;
		}
		if (item.kind === "solid") {
			updateBackground({
				type: "solid",
				color: bg.color,
				wallpaperId: null,
				gradientId: null,
				imageId: null,
			} as Partial<Settings["background"]>);
			return;
		}
		updateBackground({
			type: "image",
			imageId: item.id,
			wallpaperId: null,
			gradientId: null,
		} as Partial<Settings["background"]>);
	}

	function clearPending() {
		setPending((previous) => {
			if (previous?.previewUrl) URL.revokeObjectURL(previous.previewUrl);
			return null;
		});
	}

	async function stageUpload(file: File) {
		if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
		const name =
			file.name.replace(/\.[^/.]+$/, "").trim() || "Uploaded wallpaper";
		const next: PendingUpload = {
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

	async function handleConfirmUpload() {
		if (pending?.status !== "ready" || !pending.dataUrl) return;
		const snapshot = pending;
		const dataUrl = snapshot.dataUrl;
		if (!dataUrl) return;
		setPending({ ...snapshot, status: "confirming", progress: 100 });

		try {
			const savedId = await saveBackgroundImage(dataUrl);
			const existing = customWallpapers.some(
				(wallpaper) => wallpaper.id === savedId,
			);
			commitCustomWallpaper({ id: savedId, name: snapshot.name });
			setCustomPreviews((previous) => ({ ...previous, [savedId]: dataUrl }));
			if (snapshot.previewUrl) URL.revokeObjectURL(snapshot.previewUrl);
			setPending(null);
			setUploaderOpen(false);
			toast.success("Wallpaper added", {
				description: existing
					? `“${snapshot.name}” is already in your collection.`
					: `“${snapshot.name}” joined your collection.`,
			});
		} catch {
			setPending({
				...snapshot,
				status: "error",
				error: "Couldn't save that image. Try again.",
			});
		}
	}

	async function handleDeleteCustomImage(event: MouseEvent, id: string) {
		event.stopPropagation();
		await deleteBackgroundImage(id);
		removeCustomWallpaper(id);
		setCustomPreviews((previous) => {
			const next = { ...previous };
			delete next[id];
			return next;
		});
	}

	return (
		<div className={SETTINGS_PAGE} data-settings-wallpaper-page="true">
			<SectionCard>
				<div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,7.5rem),1fr))] gap-2.5">
					<button
						type="button"
						onClick={() => setUploaderOpen((previous) => !previous)}
						aria-expanded={uploaderOpen}
						className={cn(
							WALLPAPER_TILE,
							"items-center justify-center gap-2 border-neutral-900/20 border-dashed bg-neutral-900/[0.025] text-neutral-500 hover:bg-neutral-900/[0.06] hover:text-neutral-900 dark:border-white/20 dark:bg-white/[0.025] dark:text-neutral-400 dark:hover:bg-white/[0.07] dark:hover:text-neutral-100",
							SETTINGS_FOCUS_RING,
							uploaderOpen && "ring-2 ring-[var(--apple-blue)] ring-inset",
						)}
						data-wallpaper-upload="true"
					>
						<span className="flex size-9 items-center justify-center rounded-full bg-neutral-900/[0.06] dark:bg-white/[0.08]">
							<Icon name="upload" size={17} aria-hidden="true" />
						</span>
						<span className="font-medium text-[12px]">
							{uploaderOpen ? "Close upload" : "Add image"}
						</span>
					</button>

					{libraryItems.map((item) => (
						<WallpaperTile
							key={`${item.kind}-${item.id}`}
							customPreviews={customPreviews}
							item={item}
							selected={isSelected(item)}
							onDelete={handleDeleteCustomImage}
							onSelect={handleSelect}
						/>
					))}
				</div>

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
							<div className="flex flex-col gap-2.5 pt-3">
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
		</div>
	);
}
