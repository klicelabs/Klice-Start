/**
 * Diagnostic: image measurement outside a browser.
 *
 * The browser measures an icon with fetch → blob → <img> → canvas and samples
 * the alpha of a cover-fit 32×32 edge ring. Bun has no canvas, so this
 * decodes the PNG bytes directly (node:zlib inflate + PNG unfilter) and
 * computes the SAME metric. That makes the real resolver runnable in a
 * script, so the selected asset per domain can be proven offline.
 *
 * Run: cd apps/extension && bun run scripts/probe-icon-sources.ts
 */

import { inflateSync } from "node:zlib";

export interface MeasuredAsset {
	naturalWidth: number;
	naturalHeight: number;
	/** Fraction of the cover-fit 32×32 edge ring with alpha > 40/255. */
	opaqueEdgeRatio: number;
}

const EDGE_ALPHA_THRESHOLD = 40;
const GRID = 32;

interface Png {
	width: number;
	height: number;
	/** RGBA samples, 4 bytes per pixel. */
	pixels: Uint8Array;
}

function paeth(a: number, b: number, c: number): number {
	const p = a + b - c;
	const pa = Math.abs(p - a);
	const pb = Math.abs(p - b);
	const pc = Math.abs(p - c);
	if (pa <= pb && pa <= pc) return a;
	if (pb <= pc) return b;
	return c;
}

function decodePng(bytes: Uint8Array): Png | null {
	const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
	for (let i = 0; i < signature.length; i += 1) {
		if (bytes[i] !== signature[i]) return null;
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let offset = 8;
	let width = 0;
	let height = 0;
	let bitDepth = 8;
	let colorType = 6;
	let interlace = 0;
	const idat: Uint8Array[] = [];
	let palette: Uint8Array | null = null;
	let transparency: Uint8Array | null = null;

	while (offset + 8 <= bytes.length) {
		const length = view.getUint32(offset);
		const type = String.fromCharCode(
			bytes[offset + 4],
			bytes[offset + 5],
			bytes[offset + 6],
			bytes[offset + 7],
		);
		const dataStart = offset + 8;
		if (type === "IHDR") {
			width = view.getUint32(dataStart);
			height = view.getUint32(dataStart + 4);
			bitDepth = bytes[dataStart + 8];
			colorType = bytes[dataStart + 9];
			interlace = bytes[dataStart + 12];
		} else if (type === "PLTE") {
			palette = bytes.subarray(dataStart, dataStart + length);
		} else if (type === "tRNS") {
			transparency = bytes.subarray(dataStart, dataStart + length);
		} else if (type === "IDAT") {
			idat.push(bytes.subarray(dataStart, dataStart + length));
		} else if (type === "IEND") {
			break;
		}
		offset = dataStart + length + 4;
	}

	if (!width || !height || interlace !== 0) return null;
	if (bitDepth !== 8 && bitDepth !== 16) return null;

	const channels =
		colorType === 0
			? 1
			: colorType === 2
				? 3
				: colorType === 3
					? 1
					: colorType === 4
						? 2
						: 4;
	const bytesPerSample = bitDepth === 16 ? 2 : 1;
	const bytesPerPixel = channels * bytesPerSample;
	const lineBytes = width * bytesPerPixel;

	let raw: Uint8Array;
	try {
		const merged = new Uint8Array(
			idat.reduce((sum, chunk) => sum + chunk.length, 0),
		);
		let cursor = 0;
		for (const chunk of idat) {
			merged.set(chunk, cursor);
			cursor += chunk.length;
		}
		raw = new Uint8Array(inflateSync(merged));
	} catch {
		return null;
	}
	if (raw.length < height * (lineBytes + 1)) return null;

	// Unfilter in place.
	const out = new Uint8Array(height * lineBytes);
	let previous = new Uint8Array(lineBytes);
	for (let y = 0; y < height; y += 1) {
		const filter = raw[y * (lineBytes + 1)];
		const row = raw.subarray(
			y * (lineBytes + 1) + 1,
			y * (lineBytes + 1) + 1 + lineBytes,
		);
		const current = new Uint8Array(lineBytes);
		for (let x = 0; x < lineBytes; x += 1) {
			const a = x >= bytesPerPixel ? current[x - bytesPerPixel] : 0;
			const b = previous[x];
			const c = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
			const value = row[x];
			switch (filter) {
				case 0:
					current[x] = value;
					break;
				case 1:
					current[x] = (value + a) & 0xff;
					break;
				case 2:
					current[x] = (value + b) & 0xff;
					break;
				case 3:
					current[x] = (value + ((a + b) >> 1)) & 0xff;
					break;
				case 4:
					current[x] = (value + paeth(a, b, c)) & 0xff;
					break;
				default:
					return null;
			}
		}
		out.set(current, y * lineBytes);
		previous = current;
	}

	// Expand to RGBA.
	const pixels = new Uint8Array(width * height * 4);
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const base = y * lineBytes + x * bytesPerPixel;
			const target = (y * width + x) * 4;
			if (colorType === 6 || colorType === 4) {
				const gray = colorType === 4;
				pixels[target] = out[base];
				pixels[target + 1] = gray ? out[base] : out[base];
				pixels[target + 2] = gray ? out[base] : out[base + 1];
				pixels[target + 3] = colorType === 4 ? out[base + 1] : out[base + 3];
			} else if (colorType === 2) {
				pixels[target] = out[base];
				pixels[target + 1] = out[base + 1];
				pixels[target + 2] = out[base + 2];
				pixels[target + 3] = 255;
			} else if (colorType === 0) {
				pixels[target] = out[base];
				pixels[target + 1] = out[base];
				pixels[target + 2] = out[base];
				pixels[target + 3] = 255;
			} else {
				const index = out[base];
				const p = (index ?? 0) * 3;
				pixels[target] = palette ? (palette[p] ?? 0) : 0;
				pixels[target + 1] = palette ? (palette[p + 1] ?? 0) : 0;
				pixels[target + 2] = palette ? (palette[p + 2] ?? 0) : 0;
				pixels[target + 3] = transparency ? (transparency[index] ?? 255) : 255;
			}
		}
	}
	return { width, height, pixels };
}

/**
 * Cover-fit the image into 32×32 (like the browser's drawImage) and measure
 * the alpha of the outer ring.
 */
export function measurePngBytes(bytes: Uint8Array): MeasuredAsset | null {
	const png = decodePng(bytes);
	if (!png) return null;
	const { width, height, pixels } = png;

	const scale = Math.max(GRID / width, GRID / height);
	const drawWidth = width * scale;
	const drawHeight = height * scale;
	const offsetX = (drawWidth - GRID) / 2;
	const offsetY = (drawHeight - GRID) / 2;

	let edgePixels = 0;
	let opaquePixels = 0;
	for (let y = 0; y < GRID; y += 1) {
		for (let x = 0; x < GRID; x += 1) {
			const isEdge = x === 0 || y === 0 || x === GRID - 1 || y === GRID - 1;
			if (!isEdge) continue;
			edgePixels += 1;
			const sourceX = Math.min(
				width - 1,
				Math.max(0, Math.floor((x + offsetX) / scale)),
			);
			const sourceY = Math.min(
				height - 1,
				Math.max(0, Math.floor((y + offsetY) / scale)),
			);
			const alpha = pixels[(sourceY * width + sourceX) * 4 + 3] ?? 0;
			if (alpha > EDGE_ALPHA_THRESHOLD) opaquePixels += 1;
		}
	}
	if (edgePixels === 0) return null;
	return {
		naturalWidth: width,
		naturalHeight: height,
		opaqueEdgeRatio: opaquePixels / edgePixels,
	};
}

/** Fetch + measure an icon URL. Non-PNG payloads report as unmeasurable. */
export async function measureRemoteAsset(
	url: string,
): Promise<MeasuredAsset | null> {
	try {
		const res = await fetch(url, {
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
				// Ask for PNG explicitly: CDNs content-negotiate and would
				// otherwise answer WebP/AVIF, which the browser decodes but
				// this offline decoder cannot.
				Accept: "image/png,image/x-icon,*/*;q=0.5",
			},
			redirect: "follow",
		});
		if (!res.ok) return null;
		const buffer = new Uint8Array(await res.arrayBuffer());
		return measurePngBytes(buffer);
	} catch {
		return null;
	}
}
