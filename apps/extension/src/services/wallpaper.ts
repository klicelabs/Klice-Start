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

async function fetchWithRetry(
	input: RequestInfo | URL,
	init?: RequestInit,
	maxRetries = 2,
): Promise<Response> {
	let lastError: unknown;
	for (let i = 0; i <= maxRetries; i++) {
		try {
			const res = await fetch(input, init);
			if (res.ok || res.status === 404 || res.status === 400) return res;
			if (res.status === 429) {
				const retryAfter = res.headers.get("Retry-After");
				const delay = retryAfter
					? Number.parseInt(retryAfter, 10) * 1000
					: Math.min((i + 1) * 2000, 10_000);
				await new Promise((r) => setTimeout(r, delay));
				continue;
			}
			if (res.status >= 500 && i < maxRetries) {
				await new Promise((r) => setTimeout(r, (i + 1) * 1000));
				continue;
			}
			return res;
		} catch (err) {
			lastError = err;
			if (i < maxRetries) {
				await new Promise((r) => setTimeout(r, (i + 1) * 1000));
			}
		}
	}
	throw lastError ?? new Error("fetchWithRetry exhausted retries");
}

let refreshPromise: Promise<void> | null = null;

async function fetchPexelsPhoto(
	query: string,
	period?: DaylightPeriod,
): Promise<PexelsPhotoResponse | null> {
	try {
		const isDefaultQuery =
			!query.trim() || query === DEFAULT_BACKGROUND.pexelsQuery;

		const body: Record<string, unknown> = {
			perPage: 40,
		};

		if (period) {
			body.query = isDefaultQuery
				? `${periodModifier(period)} landscape`
				: `${query}, ${periodModifier(period)}`;
		} else if (!isDefaultQuery) {
			body.query = query;
		}

		const res = await fetchWithRetry(pexelsProxyUrl(), {
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
	if (refreshPromise) {
		if (!force) return refreshPromise;
		try {
			await refreshPromise;
		} catch {
			// ignore previous failure
		}
	}

	const executeRefresh = async () => {
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

		// Re-check type & state after async ops
		const currentBg = useSetupStore.getState().settings.background;
		if (currentBg.type !== "pexels") {
			useImageStore.getState().deleteBackgroundImage(imageId);
			return;
		}

		const oldImageId = currentBg.pexelsImageId;

		useSetupStore.getState().updateBackground({
			pexelsImageId: imageId,
			pexelsLastFetched: Date.now(),
			pexelsLastPeriod: period || null,
		});

		if (oldImageId && oldImageId !== imageId) {
			useImageStore.getState().deleteBackgroundImage(oldImageId);
		}
	};

	refreshPromise = executeRefresh().finally(() => {
		refreshPromise = null;
	});

	return refreshPromise;
}
