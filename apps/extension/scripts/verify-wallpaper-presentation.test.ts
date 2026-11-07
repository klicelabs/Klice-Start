import { afterEach, expect, test } from "bun:test";

import {
	decodeWallpaper,
	pexelsCreditUrl,
} from "../src/lib/wallpaper-presentation";

const originalImage = globalThis.Image;
afterEach(() => {
	globalThis.Image = originalImage;
});

test("a wallpaper remains pending until decoding completes", async () => {
	const decoded = Promise.withResolvers<void>();
	class PendingImage {
		src = "";
		decoding = "";
		onload: (() => void) | null = null;
		onerror: (() => void) | null = null;
		decode() {
			return decoded.promise;
		}
	}
	globalThis.Image = PendingImage as unknown as typeof Image;
	let complete = false;
	const ready = decodeWallpaper("data:image/png;base64,photo").then(
		(result) => {
			complete = true;
			return result;
		},
	);
	await Promise.resolve();
	expect(complete).toBe(false);
	decoded.resolve();
	expect(await ready).toBe(true);
});

test("decode failures and stalled loads preserve the visible wallpaper", async () => {
	class BrokenImage {
		src = "";
		decoding = "";
		onload: (() => void) | null = null;
		onerror: (() => void) | null = null;
		decode() {
			return Promise.reject(new Error("corrupt image"));
		}
	}
	globalThis.Image = BrokenImage as unknown as typeof Image;
	expect(await decodeWallpaper("broken")).toBe(false);
	class StalledImage extends BrokenImage {
		decode() {
			return new Promise<void>(() => undefined);
		}
	}
	globalThis.Image = StalledImage as unknown as typeof Image;
	expect(await decodeWallpaper("stalled", 5)).toBe(false);
});

test("credit links accept only HTTPS Pexels pages", () => {
	expect(pexelsCreditUrl("https://www.pexels.com/@photographer/")).toBe(
		"https://www.pexels.com/@photographer/",
	);
	for (const value of [
		"javascript:alert(1)",
		"https://pexels.com.attacker.test/photo",
		"http://pexels.com/",
		"https://user:secret@pexels.com/",
		"bad URL",
	]) {
		expect(pexelsCreditUrl(value)).toBeNull();
	}
});
