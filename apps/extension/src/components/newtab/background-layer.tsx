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

	/** Resolve store-based image to a CSS background value, or null if not found. */
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

	/** Set background from a store image ID. */
	async function applyImage(imageId: string) {
		const css = await resolveImage(imageId);
		if (css) setBgCss(css);
	}

	useEffect(() => {
		let cancelled = false;

		(async () => {
			if (type === "pexels") {
				// Already have an image loaded? Apply it immediately so the user
				// sees the previous wallpaper while a fresh one is fetched.
				const hadImage = !!pexelsImageId;
				if (pexelsImageId) {
					const css = await resolveImage(pexelsImageId);
					if (css && !cancelled) {
						setBgCss(css);
						if (cancelled) return;
					}
				}

				// Fetch a fresh wallpaper (skipped if shouldFetch says no).
				if (!fetchedRef.current || !hadImage) {
					fetchedRef.current = true;
					await refreshWallpaper();
				}

				// Read the NEW image id from the store and apply it immediately,
				// rather than waiting for a React re-render to pick it up.
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
				await applyImage(imageId);
				return;
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
		// Intentionally only re-run when the background SOURCE changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [type, imageId, gradientId, color]);

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
