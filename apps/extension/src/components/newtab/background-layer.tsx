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

	const blur = useSetupStore((s) => s.settings.background.blur);
	const brightness = useSetupStore((s) => s.settings.background.brightness);
	const opacity = useSetupStore((s) => s.settings.background.opacity);

	const getBackgroundImage = useImageStore((s) => s.getBackgroundImage);
	const [bgCss, setBgCss] = useState<string>(color || DEFAULT_BACKGROUND.color);

	const fetchedRef = useRef(false);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			if (type === "pexels") {
				if (!fetchedRef.current) {
					fetchedRef.current = true;
					await refreshWallpaper();
				}
				if (pexelsImageId) {
					try {
						const dataUrl = await getBackgroundImage(pexelsImageId);
						if (dataUrl && !cancelled) {
							setBgCss(`${cssUrl(dataUrl)} center / cover no-repeat`);
							return;
						}
					} catch {
						// fall through
					}
				}
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
				const g = GRADIENTS.find((x) => x.id === gradientId) || GRADIENTS[0];
				if (!cancelled) setBgCss(g.css);
				return;
			}

			if (!cancelled) setBgCss(color || "#0A0A0C");
		})();

		return () => {
			cancelled = true;
		};
	}, [type, imageId, gradientId, color, pexelsImageId, getBackgroundImage]);

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
