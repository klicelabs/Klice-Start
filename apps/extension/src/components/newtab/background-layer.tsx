import { useEffect, useRef, useState } from "react";
import { DEFAULT_BACKGROUND, GRADIENTS } from "../../lib/constants";
import { cssUrl } from "../../lib/utils";
import { refreshWallpaper } from "../../services/wallpaper";
import { useImageStore } from "../../stores/image-store";
import { useSetupStore } from "../../stores/setup-store";

export function BackgroundLayer() {
	const type = useSetupStore((s) => s.settings.background.type);
	const imageId = useSetupStore((s) => s.settings.background.imageId);
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

	async function resolveImage(
		imageId: string,
	): Promise<string | null> {
		try {
			const dataUrl = await getBackgroundImage(imageId);
			if (dataUrl) return `${cssUrl(dataUrl)} center / cover no-repeat`;
		} catch {
			// fall through
		}
		return null;
	}

	async function applyImage(imageId: string) {
		const css = await resolveImage(imageId);
		if (css) setBgCss(css);
	}

	useEffect(() => {
		let cancelled = false;

		(async () => {
			if (type === "pexels") {
				let loadedFromCache = false;
				if (pexelsImageId) {
					const css = await resolveImage(pexelsImageId);
					if (css && !cancelled) {
						setBgCss(css);
						loadedFromCache = true;
					}
					if (cancelled) return;
				}

				// If pexelsImageId exists but failed to resolve from IDB, force refresh to recover cache
				const needsCacheRecovery = Boolean(pexelsImageId && !loadedFromCache);

				const fetchKey = `${pexelsQuery}|${pexelsFrequency}`;
				if (lastFetchedKeyRef.current !== fetchKey || needsCacheRecovery) {
					lastFetchedKeyRef.current = fetchKey;
					await refreshWallpaper(needsCacheRecovery);
				}

				if (!cancelled) {
					const freshId =
						useSetupStore.getState().settings.background.pexelsImageId;
					if (freshId && freshId !== pexelsImageId) {
						await applyImage(freshId);
					}
				}
				return;
			}

			if (type === "image" && imageId) {
				lastFetchedKeyRef.current = "";
				await applyImage(imageId);
				return;
			}

			if (type === "gradient" && gradientId) {
				lastFetchedKeyRef.current = "";
				const g = GRADIENTS.find((x) => x.id === gradientId) || GRADIENTS[0];
				if (!cancelled) setBgCss(g.css);
				return;
			}

			lastFetchedKeyRef.current = "";
			if (!cancelled) setBgCss(color || "#0A0A0C");
		})();

		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [type, pexelsImageId, pexelsQuery, pexelsFrequency, imageId, gradientId, color]);

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
