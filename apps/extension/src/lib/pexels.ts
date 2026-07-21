export const PEXELS_PROXY_BASE = "http://localhost:3001/api/pexels";

export function pexelsProxyUrl(): string {
	return PEXELS_PROXY_BASE;
}

export function pexelsDownloadUrl(photo: {
	src: { original: string };
	photographer: string;
	photographer_url: string;
}): string {
	return photo.src.original;
}
