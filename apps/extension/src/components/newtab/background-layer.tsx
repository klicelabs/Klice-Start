import { useEffect, useState } from "react";
import { DEFAULT_BACKGROUND, GRADIENTS } from "../../lib/constants";
import { cssUrl } from "../../lib/utils";
import { useImageStore } from "../../stores/image-store";
import { useSetupStore } from "../../stores/setup-store";

export function BackgroundLayer() {
	const background = useSetupStore((s) => s.settings.background);
	const getBackgroundImage = useImageStore((s) => s.getBackgroundImage);
	const [bgCss, setBgCss] = useState<string>(
		background.color || DEFAULT_BACKGROUND.color,
	);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			if (background.type === "image" && background.imageId) {
				try {
					const dataUrl = await getBackgroundImage(background.imageId);
					if (dataUrl && !cancelled) {
						setBgCss(`${cssUrl(dataUrl)} center / cover no-repeat`);
						return;
					}
				} catch {
					// fall through
				}
			}

			if (background.type === "gradient" && background.gradientId) {
				const g =
					GRADIENTS.find((x) => x.id === background.gradientId) || GRADIENTS[0];
				if (!cancelled) setBgCss(g.css);
				return;
			}

			if (!cancelled) setBgCss(background.color || "#0A0A0C");
		})();

		return () => {
			cancelled = true;
		};
	}, [background, getBackgroundImage]);

	return (
		<div
			id="bg-layer"
			className="fixed inset-0 -z-10"
			style={{
				background: bgCss,
				filter: `blur(${background.blur || 0}px) brightness(${background.brightness || 100}%)`,
				opacity: (background.opacity ?? 100) / 100,
			}}
		/>
	);
}
