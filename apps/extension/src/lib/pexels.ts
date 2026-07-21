export const PEXELS_PROXY_BASE =
	import.meta.env.VITE_PEXELS_PROXY_URL || "http://localhost:3001/api/pexels";

export function pexelsProxyUrl(): string {
	return PEXELS_PROXY_BASE;
}
