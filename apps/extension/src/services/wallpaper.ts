import { saveBackground } from "../lib/idb";
import { DEFAULT_BACKGROUND } from "../lib/constants";
import { pexelsProxyUrl } from "../lib/pexels";
import { useImageStore } from "../stores/image-store";
import { useSetupStore } from "../stores/setup-store";
import type { WallpaperFrequency } from "../types";

export type DaylightPeriod = "morning" | "afternoon" | "night";

export function getCurrentPeriod(): DaylightPeriod {
	const h = new Date().getHours();
	if (h >= 6 && h < 12) return "morning";
	if (h >= 12 && h < 18) return "afternoon";
	return "night";
}

function shouldFetch(
	frequency: WallpaperFrequency,
	lastFetched: number | null,
	lastPeriod: DaylightPeriod | null,
): boolean {
	if (frequency === "locked") return false;

	if (frequency === "per-tab") return true;

	const now = Date.now();

	if (frequency === "hourly") {
		if (lastFetched === null) return true;
		return now - lastFetched > 3_600_000;
	}

	if (frequency === "daily") {
		if (lastFetched === null) return true;
		return now - lastFetched > 86_400_000;
	}

	if (frequency === "daylight") {
		const currentPeriod = getCurrentPeriod();
		if (currentPeriod !== lastPeriod) return true;
		if (lastFetched === null) return true;
		return now - lastFetched > 86_400_000;
	}

	return false;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
	const { promise, resolve, reject } = Promise.withResolvers<string>();
	const reader = new FileReader();
	reader.onload = () => resolve(reader.result as string);
	reader.onerror = () => reject(reader.error);
	reader.readAsDataURL(blob);
	return promise;
}

function periodModifier(period: DaylightPeriod): string {
	switch (period) {
		case "morning":
			return "morning sunlight";
		case "afternoon":
			return "afternoon golden hour";
		case "night":
			return "night dark";
	}
}

interface PexelsPhotoResponse {
	id: number;
	url: string;
	photographer: string;
	photographerUrl: string;
	src: {
		original: string;
		large2x: string;
		large: string;
		medium: string;
		small: string;
	};
	width: number;
	height: number;
}

async function fetchPexelsPhoto(
	query: string,
	period?: DaylightPeriod,
): Promise<PexelsPhotoResponse | null> {
	try {
		// When the query is still the default (user hasn't customized it),
		// send no query so the proxy uses the /v1/curated endpoint —
		// hand-picked photos from the Pexels team.
		// When the user has typed their own query, send it with a dark color
		// filter for search.
		const isDefaultQuery =
			!query.trim() || query === DEFAULT_BACKGROUND.pexelsQuery;

		const body: Record<string, unknown> = {
			perPage: 40,
		};

		if (!isDefaultQuery) {
			body.query = period
				? `${query}, ${periodModifier(period)}`
				: query;
			body.color = "black";
		}

		const res = await fetch(pexelsProxyUrl(), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});

		if (!res.ok) {
			console.warn("[wallpaper] Pexels proxy returned", res.status);
			return null;
		}

		return (await res.json()) as PexelsPhotoResponse;
	} catch (err) {
		console.warn("[wallpaper] Pexels fetch failed", err);
		return null;
	}
}

async function downloadImage(url: string): Promise<Blob | null> {
	try {
		const res = await fetch(url, { mode: "cors" });
		if (!res.ok) return null;
		return await res.blob();
	} catch {
		return null;
	}
}

export async function refreshWallpaper(force = false): Promise<void> {
	const state = useSetupStore.getState();
	const bg = state.settings.background;

	if (bg.type !== "pexels") return;

	const frequency = bg.pexelsFrequency || "daily";

	if (
		!force &&
		!shouldFetch(frequency, bg.pexelsLastFetched, bg.pexelsLastPeriod)
	) {
		return;
	}

	const period = frequency === "daylight" ? getCurrentPeriod() : undefined;

	const photo = await fetchPexelsPhoto(bg.pexelsQuery, period);
	if (!photo) return;

	const imageBlob = await downloadImage(photo.src.large2x);
	if (!imageBlob) return;

	const dataUrl = await blobToDataUrl(imageBlob);
	const imageId = await saveBackground(dataUrl);

	useSetupStore.getState().updateBackground({
		type: "pexels",
		pexelsImageId: imageId,
		pexelsLastFetched: Date.now(),
		pexelsLastPeriod: period || null,
	});

	// Delete old background image from IDB to avoid bloat
	const oldImageId = bg.pexelsImageId;
	if (oldImageId && oldImageId !== imageId) {
		useImageStore.getState().deleteBackgroundImage(oldImageId);
	}
}
