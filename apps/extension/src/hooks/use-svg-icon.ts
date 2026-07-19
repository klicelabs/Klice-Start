import { useEffect, useState } from "react";
import { getSvgXml } from "../services/svgl";

interface UseSvgIconOptions {
	/** Use the light‑theme variant instead of the dark one. */
	forceLight?: boolean;
}

interface UseSvgIconResult {
	svgXml: string | null;
	isLoading: boolean;
	error: Error | null;
}

/**
 * Fetches the raw SVG XML for a given brand title from the SVGL API.
 *
 * 1. Reads the cached metadata index (instant if already fetched).
 * 2. Lazily fetches the actual SVG XML from the resolved route URL.
 *
 * Returns `{ svgXml, isLoading, error }`. When `svgXml` is `null` and
 * `isLoading` is `false`, the brand was not found or the fetch failed — use
 * your fallback strategy.
 */
export function useSvgIcon(
	title: string | null | undefined,
	options?: UseSvgIconOptions,
): UseSvgIconResult {
	const [svgXml, setSvgXml] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		const query = title;
		if (!query) {
			setSvgXml(null);
			setIsLoading(false);
			setError(null);
			return;
		}

		let cancelled = false;

		async function load() {
			setIsLoading(true);
			setError(null);

			try {
				const xml = await getSvgXml(query!, options?.forceLight);
				if (cancelled) return;
				setSvgXml(xml);
			} catch (err) {
				if (cancelled) return;
				setError(
					err instanceof Error ? err : new Error("Failed to load SVG icon"),
				);
				setSvgXml(null);
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		}

		load();

		return () => {
			cancelled = true;
		};
	}, [title, options?.forceLight]);

	return { svgXml, isLoading, error };
}
