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
			return "morning mountain nature landscape";
		case "afternoon":
			return "afternoon beach ocean landscape";
		case "night":
			return "night city skyline landscape";
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
let refreshSession = 0;

interface PexelsRefreshIdentity {
	query: string;
	frequency: WallpaperFrequency;
	imageId: string | null;
}

type RefreshRequestIdentity = PexelsRefreshIdentity | null;

let refreshRequestIdentity: RefreshRequestIdentity = null;

interface PexelsRefreshRequest extends PexelsRefreshIdentity {
	session: number;
}

function getRefreshRequestIdentity(): RefreshRequestIdentity {
	const bg = useSetupStore.getState().settings.background;
	if (bg.type !== "pexels") return null;
	return {
		query: bg.pexelsQuery || DEFAULT_BACKGROUND.pexelsQuery,
		frequency: bg.pexelsFrequency || "daily",
		imageId: bg.pexelsImageId,
	};
}

function matchesRefreshRequestIdentity(
	left: RefreshRequestIdentity,
	right: RefreshRequestIdentity,
): boolean {
	if (left === null || right === null) return left === right;
	return (
		left.query === right.query &&
		left.frequency === right.frequency &&
		left.imageId === right.imageId
	);
}



function isCurrentPexelsRequest(
	request: PexelsRefreshRequest,
	imageId = request.imageId,
): boolean {
	const currentBg = useSetupStore.getState().settings.background;
	return (
		currentBg.type === "pexels" &&
		(currentBg.pexelsQuery || DEFAULT_BACKGROUND.pexelsQuery) === request.query &&
		(currentBg.pexelsFrequency || "daily") === request.frequency &&
		currentBg.pexelsImageId === imageId &&
		refreshSession === request.session
	);
}

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
				? periodModifier(period)
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

async function executeRefresh(
	force: boolean,
	session: number,
	identity: RefreshRequestIdentity,
): Promise<void> {
	try {
		if (
			refreshSession !== session ||
			!matchesRefreshRequestIdentity(identity, getRefreshRequestIdentity())
		) {
			return;
		}

		const bg = useSetupStore.getState().settings.background;
		if (bg.type !== "pexels" || identity === null) return;

		const { frequency, query, imageId } = identity;
		if (
			!force &&
			!shouldFetch(frequency, bg.pexelsLastFetched, bg.pexelsLastPeriod)
		) {
			return;
		}

		const request: PexelsRefreshRequest = {
			query,
			frequency,
			imageId,
			session,
		};
		const period = frequency === "daylight" ? getCurrentPeriod() : undefined;

		const photo = await fetchPexelsPhoto(query, period);
		if (!photo || !isCurrentPexelsRequest(request)) return;

		const imageBlob = await downloadImage(photo.src.large2x);
		if (!imageBlob || !isCurrentPexelsRequest(request)) return;

		const dataUrl = await blobToDataUrl(imageBlob);
		if (!isCurrentPexelsRequest(request)) return;

		const newImageId = await saveBackground(dataUrl);
		if (!isCurrentPexelsRequest(request)) {
			await useImageStore.getState().deleteBackgroundImage(newImageId);
			return;
		}
		const oldImageId = request.imageId;

		useSetupStore.getState().updateBackground({
			pexelsImageId: newImageId,
			pexelsLastFetched: Date.now(),
			pexelsLastPeriod: period || null,
		});

		if (
			oldImageId &&
			oldImageId !== newImageId &&
			isCurrentPexelsRequest(request, newImageId)
		) {
			await useImageStore.getState().deleteBackgroundImage(oldImageId);
		}
	} catch (error) {
		console.warn("[wallpaper] Refresh failed", error);
	}
}

export async function refreshWallpaper(force = false): Promise<void> {
	const identity = getRefreshRequestIdentity();
	if (
		refreshPromise &&
		!force &&
		matchesRefreshRequestIdentity(refreshRequestIdentity, identity)
	) {
		return refreshPromise;
	}

	const session = ++refreshSession;
	const previous = refreshPromise;
	const queued = previous
		? previous.then(
				() => executeRefresh(force, session, identity),
				() => executeRefresh(force, session, identity),
			)
		: executeRefresh(force, session, identity);

	let tracked: Promise<void>;
	tracked = queued.finally(() => {
		if (refreshPromise === tracked) {
			refreshPromise = null;
			refreshRequestIdentity = null;
		}
	});
	refreshPromise = tracked;
	refreshRequestIdentity = identity;
	return tracked;
}
