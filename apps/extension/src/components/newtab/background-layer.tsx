import { useEffect, useRef, useState } from "react";
import { DEFAULT_BACKGROUND, GRADIENTS, WALLPAPERS } from "../../lib/constants";
import { cssUrl } from "../../lib/utils";
import { refreshWallpaper } from "../../services/wallpaper";
import { useImageStore } from "../../stores/image-store";
import { useSetupStore } from "../../stores/setup-store";

export function BackgroundLayer() {
	const type = useSetupStore((s) => s.settings.background.type);
	const imageId = useSetupStore((s) => s.settings.background.imageId);
	const wallpaperId = useSetupStore((s) => s.settings.background.wallpaperId);
	const gradientId = useSetupStore((s) => s.settings.background.gradientId);
	const color = useSetupStore((s) => s.settings.background.color);
	const pexelsImageId = useSetupStore(
		(s) => s.settings.background.pexelsImageId,
	);
	const pexelsQuery = useSetupStore(
		(s) => s.settings.background.pexelsQuery,
	);
	const pexelsFrequency = useSetupStore(
		(s) => s.settings.background.pexelsFrequency,
	);

	const blur = useSetupStore((s) => s.settings.background.blur);
	const brightness = useSetupStore((s) => s.settings.background.brightness);
	const opacity = useSetupStore((s) => s.settings.background.opacity);

	const getBackgroundImage = useImageStore((s) => s.getBackgroundImage);
	const [bgCss, setBgCss] = useState<string>(color || DEFAULT_BACKGROUND.color);

	const lastFetchedKeyRef = useRef<string>("");
	const generationRef = useRef(0);

	async function resolveImage(imageId: string): Promise<string | null> {
		try {
			const dataUrl = await getBackgroundImage(imageId);
			if (dataUrl) return `${cssUrl(dataUrl)} center / cover no-repeat`;
		} catch {
			// fall through
		}
		return null;
	}

	function resolvePackagedWallpaper(wallpaperId: string): string | null {
		const wallpaper = WALLPAPERS.find((item) => item.id === wallpaperId);
		return wallpaper
			? `${cssUrl(wallpaper.src)} center / cover no-repeat`
			: null;
	}

	async function applyImage(
		imageId: string,
		isCurrent: () => boolean,
		fallback: string,
	) {
		const css = await resolveImage(imageId);
		if (!isCurrent()) return;
		setBgCss(css || fallback);
	}

	useEffect(() => {
		const generation = ++generationRef.current;
		let cancelled = false;
		const isCurrent = () =>
			!cancelled && generationRef.current === generation;
		const fallback = color || DEFAULT_BACKGROUND.color;

		(async () => {
			if (type === "pexels") {
				setBgCss(fallback);
				let loadedFromCache = false;
				if (pexelsImageId) {
					const css = await resolveImage(pexelsImageId);
					if (!isCurrent()) return;
					if (css) {
						setBgCss(css);
						loadedFromCache = true;
					}
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
				setBgCss(fallback);
				await applyImage(imageId, isCurrent, fallback);
				return;
			}

			if (type === "wallpaper" && wallpaperId) {
				lastFetchedKeyRef.current = "";
				setBgCss(fallback);
				const css = resolvePackagedWallpaper(wallpaperId);
				if (isCurrent()) setBgCss(css || fallback);
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
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
			className="fixed inset-0 -z-10"
			style={{
				background: bgCss,
				filter: `blur(${blur || 0}px) brightness(${brightness || 100}%)`,
				opacity: (opacity ?? 100) / 100,
			}}
		/>
	);
}
