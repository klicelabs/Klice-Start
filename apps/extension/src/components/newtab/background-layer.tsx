import { useEffect, useRef, useState } from "react";
import { DEFAULT_BACKGROUND, GRADIENTS, WALLPAPERS } from "../../lib/constants";
import { cn, cssUrl } from "../../lib/utils";
import { refreshWallpaper } from "../../services/wallpaper";
import { useImageStore } from "../../stores/image-store";
import { useSetupStore } from "../../stores/setup-store";

function getInitialBackgroundCss(): string {
	try {
		const bg = useSetupStore.getState().settings.background;
		if (bg.type === "wallpaper" && bg.wallpaperId) {
			const wallpaper = WALLPAPERS.find((w) => w.id === bg.wallpaperId);
			if (wallpaper) return `${cssUrl(wallpaper.src)} center / cover no-repeat`;
		}
		if (bg.type === "gradient" && bg.gradientId) {
			const g = GRADIENTS.find((x) => x.id === bg.gradientId);
			if (g) return g.css;
		}
		if (bg.type === "solid" && bg.color) {
			return bg.color;
		}
	} catch {
		// Store not ready or in SSR/test
	}
	return DEFAULT_BACKGROUND.color;
}

/** Pre-decode an image off the main thread before setting it as CSS background. */
async function preDecodeImage(src: string): Promise<boolean> {
	try {
		const img = new Image();
		img.src = src;
		if (img.decode) {
			await img.decode();
		}
		return true;
	} catch {
		return false;
	}
}

export function BackgroundLayer({ contained = false }: { contained?: boolean }) {
	const type = useSetupStore((s) => s.settings.background.type);
	const imageId = useSetupStore((s) => s.settings.background.imageId);
	const wallpaperId = useSetupStore((s) => s.settings.background.wallpaperId);
	const gradientId = useSetupStore((s) => s.settings.background.gradientId);
	const color = useSetupStore((s) => s.settings.background.color);
	const pexelsImageId = useSetupStore(
		(s) => s.settings.background.pexelsImageId,
	);
	const pexelsQuery = useSetupStore((s) => s.settings.background.pexelsQuery);
	const pexelsFrequency = useSetupStore(
		(s) => s.settings.background.pexelsFrequency,
	);

	const blur = useSetupStore((s) => s.settings.background.blur);
	const brightness = useSetupStore((s) => s.settings.background.brightness);
	const opacity = useSetupStore((s) => s.settings.background.opacity);

	const getBackgroundImage = useImageStore((s) => s.getBackgroundImage);
	const [bgCss, setBgCss] = useState<string>(getInitialBackgroundCss);

	const lastFetchedKeyRef = useRef<string>("");
	const generationRef = useRef(0);

	async function resolveImage(imgId: string): Promise<string | null> {
		try {
			const dataUrl = await getBackgroundImage(imgId);
			if (dataUrl) {
				await preDecodeImage(dataUrl);
				return `${cssUrl(dataUrl)} center / cover no-repeat`;
			}
		} catch {
			// fall through
		}
		return null;
	}

	function resolvePackagedWallpaper(wpId: string): string | null {
		const wallpaper = WALLPAPERS.find((item) => item.id === wpId);
		return wallpaper
			? `${cssUrl(wallpaper.src)} center / cover no-repeat`
			: null;
	}

	async function applyImage(
		imgId: string,
		isCurrent: () => boolean,
		fallback: string,
	) {
		const css = await resolveImage(imgId);
		if (!isCurrent()) return;
		setBgCss(css || fallback);
	}

	useEffect(() => {
		const generation = ++generationRef.current;
		let cancelled = false;
		const isCurrent = () => !cancelled && generationRef.current === generation;
		const fallback = color || DEFAULT_BACKGROUND.color;

		(async () => {
			if (type === "pexels") {
				let loadedFromCache = false;
				if (pexelsImageId) {
					const css = await resolveImage(pexelsImageId);
					if (!isCurrent()) return;
					if (css) {
						setBgCss(css);
						loadedFromCache = true;
					}
				}

				if (!loadedFromCache && isCurrent()) {
					setBgCss(fallback);
				}

				// If pexelsImageId exists but failed to resolve from IDB, force refresh to recover cache
				const needsCacheRecovery = Boolean(pexelsImageId && !loadedFromCache);

				const fetchKey = `${pexelsQuery}|${pexelsFrequency}`;
				if (lastFetchedKeyRef.current !== fetchKey || needsCacheRecovery) {
					lastFetchedKeyRef.current = fetchKey;
					await refreshWallpaper(needsCacheRecovery);
					if (!isCurrent()) return;
				}

				const freshId =
					useSetupStore.getState().settings.background.pexelsImageId;
				if (freshId && freshId !== pexelsImageId) {
					await applyImage(freshId, isCurrent, fallback);
				}
				return;
			}

			if (type === "image" && imageId) {
				lastFetchedKeyRef.current = "";
				await applyImage(imageId, isCurrent, fallback);
				return;
			}

			if (type === "wallpaper" && wallpaperId) {
				lastFetchedKeyRef.current = "";
				const wallpaper = WALLPAPERS.find((w) => w.id === wallpaperId);
				if (wallpaper) {
					await preDecodeImage(wallpaper.src);
				}
				if (!isCurrent()) return;
				const css = resolvePackagedWallpaper(wallpaperId);
				setBgCss(css || fallback);
				return;
			}

			if (type === "gradient" && gradientId) {
				lastFetchedKeyRef.current = "";
				const g = GRADIENTS.find((x) => x.id === gradientId) || GRADIENTS[0];
				if (isCurrent()) setBgCss(g.css);
				return;
			}

			lastFetchedKeyRef.current = "";
			if (isCurrent()) setBgCss(fallback);
		})();

		return () => {
			cancelled = true;
		};
	}, [
		type,
		pexelsImageId,
		pexelsQuery,
		pexelsFrequency,
		imageId,
		wallpaperId,
		gradientId,
		color,
	]);

	return (
		<div
			id="bg-layer"
			className={cn(
				contained ? "absolute z-0" : "fixed -z-10",
				"inset-0 transition-[filter,opacity] duration-200 ease-out",
			)}
			style={{
				background: bgCss,
				filter: `blur(${blur || 0}px) brightness(${brightness || 100}%)`,
				opacity: (opacity ?? 100) / 100,
			}}
		/>
	);
}
