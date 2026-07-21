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

/** Score a photo: higher is better for wallpaper use. Favors 16:9 + high res. */
function scorePhoto(photo: PexelsPhoto): number {
	const resolution = photo.width * photo.height;
	const aspectRatio = photo.width / photo.height;
	const targetRatio = 16 / 9;
	const aspectScore = -Math.abs(aspectRatio - targetRatio) * 1_000_000;
	return resolution + aspectScore;
}

/** Pick the best photo from a list, filtering below minimum resolution. */
function pickBest(photos: PexelsPhoto[]): PexelsPhoto | null {
	const filtered = photos.filter(
		(p) => p.width >= MIN_WIDTH && p.height >= MIN_HEIGHT,
	);
	if (filtered.length === 0) return null;
	filtered.sort((a, b) => scorePhoto(b) - scorePhoto(a));
	return filtered[0];
}

export async function POST(req: Request) {
	try {
		const { query, perPage = 40, color = "black" } = (await req.json()) as {
			query?: string;
			perPage?: number;
			color?: string;
		};

		if (!PEXELS_API_KEY) {
			return NextResponse.json(
				{ error: "PEXELS_API_KEY not configured on server" },
				{ status: 500 },
			);
		}

		// When no query is provided, use the /v1/curated endpoint which returns
		// hand-picked high-quality photos from the Pexels team.
		// When a query is provided, use /v1/search with a dark color filter.
		const useCurated = !query || !query.trim();

		let url: string;
		if (useCurated) {
			const params = new URLSearchParams({
				per_page: String(Math.min(perPage, 80)),
				orientation: "landscape",
			});
			url = `${PEXELS_API_BASE}/curated?${params.toString()}`;
		} else {
			const params = new URLSearchParams({
				query,
				per_page: String(Math.min(perPage, 80)),
				orientation: "landscape",
				size: "large",
				color,
			});
			url = `${PEXELS_API_BASE}/search?${params.toString()}`;
		}

		const res = await fetch(url, {
			headers: { Authorization: PEXELS_API_KEY },
		});

		if (!res.ok) {
			const text = await res.text();
			return NextResponse.json(
				{ error: `Pexels API error: ${res.status}`, details: text },
				{ status: res.status },
			);
		}

		const data = (await res.json()) as PexelsResponse;

		if (!data.photos?.length) {
			return NextResponse.json({ error: "No photos found" }, { status: 404 });
		}

		const best = pickBest(data.photos);
		if (!best) {
			return NextResponse.json(
				{ error: "No photos meet minimum resolution (1920x1080)" },
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
