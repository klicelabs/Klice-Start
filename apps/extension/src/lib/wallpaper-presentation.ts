/** A failed decode never replaces an already visible wallpaper. */
export function decodeWallpaper(
	src: string,
	timeoutMs = 15_000,
): Promise<boolean> {
	return new Promise((resolve) => {
		const image = new Image();
		image.decoding = "async";
		let settled = false;
		const finish = (loaded: boolean) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			image.onload = null;
			image.onerror = null;
			resolve(loaded);
		};
		const timeout = setTimeout(() => finish(false), timeoutMs);
		image.onerror = () => finish(false);
		image.onload = () => {
			if (typeof image.decode !== "function") finish(true);
		};
		image.src = src;
		if (typeof image.decode === "function") {
			image.decode().then(
				() => finish(true),
				() => finish(false),
			);
		}
	});
}

/** Persisted or upstream links cannot introduce script URLs in credits. */
export function pexelsCreditUrl(value: string | undefined): string | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		return url.protocol === "https:" &&
			(url.hostname === "pexels.com" || url.hostname === "www.pexels.com") &&
			!url.username &&
			!url.password
			? url.href
			: null;
	} catch {
		return null;
	}
}
