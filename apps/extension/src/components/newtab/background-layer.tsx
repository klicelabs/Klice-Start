import { useEffect, useState } from "react";
import { DEFAULT_BACKGROUND, GRADIENTS } from "../../lib/constants";
import { unsplashImageUrl } from "../../lib/unsplash";
import { cssUrl } from "../../lib/utils";
import { useImageStore } from "../../stores/image-store";
import { useSetupStore } from "../../stores/setup-store";

export function BackgroundLayer() {
	// Source fields (only these re-resolve bgCss)
	const type = useSetupStore((s) => s.settings.background.type);
	const imageId = useSetupStore((s) => s.settings.background.imageId);
	const gradientId = useSetupStore((s) => s.settings.background.gradientId);
	const color = useSetupStore((s) => s.settings.background.color);
	const unsplashUrl = useSetupStore((s) => s.settings.background.unsplashUrl);
	const unsplashSig = useSetupStore((s) => s.settings.background.unsplashSig);
	const unsplashLocked = useSetupStore(
		(s) => s.settings.background.unsplashLocked,
	);

	// Filter fields (applied directly in style — no effect re-run)
	const blur = useSetupStore((s) => s.settings.background.blur);
	const brightness = useSetupStore((s) => s.settings.background.brightness);
	const opacity = useSetupStore((s) => s.settings.background.opacity);

	const updateBackground = useSetupStore((s) => s.updateBackground);
	const getBackgroundImage = useImageStore((s) => s.getBackgroundImage);
	const [bgCss, setBgCss] = useState<string>(
		color || DEFAULT_BACKGROUND.color,
	);

	// Resolve background source (only when source fields change)
	useEffect(() => {
		let cancelled = false;

		(async () => {
			if (type === "unsplash") {
				const url = unsplashUrl || unsplashImageUrl(unsplashSig || 1);
				if (!cancelled) setBgCss(`${cssUrl(url)} center / cover no-repeat`);
				return;
			}

			if (type === "image" && imageId) {
				try {
					const dataUrl = await getBackgroundImage(imageId);
					if (dataUrl && !cancelled) {
						setBgCss(`${cssUrl(dataUrl)} center / cover no-repeat`);
						return;
					}
				} catch {
					// fall through
				}
			}

			if (type === "gradient" && gradientId) {
				const g =
					GRADIENTS.find((x) => x.id === gradientId) || GRADIENTS[0];
				if (!cancelled) setBgCss(g.css);
				return;
			}

			if (!cancelled) setBgCss(color || "#0A0A0C");
		})();

		return () => {
			cancelled = true;
		};
	}, [type, imageId, gradientId, color, unsplashUrl, unsplashSig, getBackgroundImage]);

	// Unsplash auto-refresh with visibility gate
	useEffect(() => {
		if (type !== "unsplash" || unsplashLocked) return;

		function maybeNext() {
			if (document.visibilityState === "hidden") return;
			const sig = Date.now();
			updateBackground({
				unsplashSig: sig,
				unsplashUrl: unsplashImageUrl(sig),
				unsplashDownloadUrl: unsplashImageUrl(sig),
			});
		}

		const interval = window.setInterval(maybeNext, 10 * 60 * 1000);

		return () => window.clearInterval(interval);
	}, [type, unsplashLocked, updateBackground]);

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
