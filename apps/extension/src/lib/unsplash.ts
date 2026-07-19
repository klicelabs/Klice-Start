const UNSPLASH_QUERY = "nature,landscape,wallpaper";
const UNSPLASH_SIZE = "2560x1440";

export function unsplashImageUrl(sig: number): string {
	return `https://source.unsplash.com/featured/${UNSPLASH_SIZE}/?${UNSPLASH_QUERY}&sig=${encodeURIComponent(String(sig))}`;
}

export function unsplashDownloadUrl(sig: number): string {
	return unsplashImageUrl(sig);
}
