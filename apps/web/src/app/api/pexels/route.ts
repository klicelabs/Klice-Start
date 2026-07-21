import { NextResponse } from "next/server";

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const PEXELS_API_BASE = "https://api.pexels.com/v1";
const MIN_WIDTH = 1920;
const MIN_HEIGHT = 1080;

interface PexelsPhoto {
	id: number;
	width: number;
	height: number;
	url: string;
	photographer: string;
	photographer_url: string;
	src: {
		original: string;
		large2x: string;
		large: string;
		medium: string;
		small: string;
	};
}

interface PexelsResponse {
	photos: PexelsPhoto[];
}

function scorePhoto(photo: PexelsPhoto): number {
	const resolution = photo.width * photo.height;
	const aspectRatio = photo.width / photo.height;
	const targetRatio = 16 / 9;
	const aspectScore = -Math.abs(aspectRatio - targetRatio) * 1_000_000;
	return resolution + aspectScore;
}

function pickBest(photos: PexelsPhoto[]): PexelsPhoto | null {
	if (photos.length === 0) return null;

	const filtered = photos.filter(
		(p) => p.width >= MIN_WIDTH && p.height >= MIN_HEIGHT,
	);
	const candidates = filtered.length > 0 ? filtered : photos;
	candidates.sort((a, b) => scorePhoto(b) - scorePhoto(a));

	// Pick randomly from top N candidates (up to 8) to avoid repeating identical image
	const topCandidates = candidates.slice(0, Math.min(candidates.length, 8));
	const randomIndex = Math.floor(Math.random() * topCandidates.length);
	return topCandidates[randomIndex];
}

export async function POST(req: Request) {
	try {
		let body: {
			query?: string;
			perPage?: number;
			color?: string;
			page?: number;
		} = {};

		try {
			body = (await req.json()) as typeof body;
		} catch {
			// Empty or non-JSON body ok
		}

		const { query, perPage = 40, color, page } = body;

		if (!PEXELS_API_KEY) {
			return NextResponse.json(
				{ error: "PEXELS_API_KEY not configured on server" },
				{ status: 500 },
			);
		}

		const useCurated = !query || !query.trim();

		let fetchUrl = (isCurated: boolean, searchPage?: number) => {
			const randomPage = isCurated
				? Math.floor(Math.random() * 15) + 1
				: Math.floor(Math.random() * 8) + 1;
			const targetPage = searchPage ?? page ?? randomPage;

			const params = new URLSearchParams({
				per_page: String(Math.min(perPage, 80)),
				orientation: "landscape",
				page: String(targetPage),
			});

			if (!isCurated && query) {
				params.append("query", query);
				params.append("size", "large");
				if (color && color.trim()) {
					params.append("color", color.trim());
				}
			}

			const endpoint = isCurated ? "curated" : "search";
			return `${PEXELS_API_BASE}/${endpoint}?${params.toString()}`;
		};

		let res = await fetch(fetchUrl(useCurated), {
			headers: { Authorization: PEXELS_API_KEY },
		});

		if (res.status === 429) {
			const retryAfter = res.headers.get("Retry-After") || "60";
			return NextResponse.json(
				{ error: "Rate limited", retryAfter },
				{
					status: 429,
					headers: { "Retry-After": retryAfter },
				},
			);
		}

		let data: PexelsResponse | null = null;
		if (res.ok) {
			data = (await res.json()) as PexelsResponse;
		}

		// Fallback: If search returned 0 photos or non-200, try curated fallback
		if ((!useCurated && (!res.ok || !data?.photos?.length)) || !data) {
			res = await fetch(fetchUrl(true), {
				headers: { Authorization: PEXELS_API_KEY },
			});
			if (res.ok) {
				data = (await res.json()) as PexelsResponse;
			}
		}

		if (!res.ok || !data?.photos?.length) {
			const text = res.ok ? "No photos found" : await res.text();
			return NextResponse.json(
				{ error: `Pexels API error: ${res.status}`, details: text },
				{ status: res.status >= 400 ? res.status : 404 },
			);
		}

		const best = pickBest(data.photos);
		if (!best) {
			return NextResponse.json(
				{ error: "No photos available" },
				{ status: 404 },
			);
		}

		return NextResponse.json({
			id: best.id,
			url: best.url,
			photographer: best.photographer,
			photographerUrl: best.photographer_url,
			src: best.src,
			width: best.width,
			height: best.height,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
