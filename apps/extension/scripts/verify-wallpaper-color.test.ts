import { afterEach, describe, expect, test } from "bun:test";
import {
	formatHex,
	hsvaToRgba,
	parseHex,
	rgbaToHsva,
} from "../../../packages/ui/src/components/motion/color-picker";
import { useImageStore } from "../src/stores/image-store";

function validHex(value: string) {
	const parsed = parseHex(value);
	if (!parsed) throw new Error(`Invalid test color: ${value}`);
	return parsed;
}

const images = useImageStore.getState();
afterEach(() => {
	images.clearBackgroundColorPreview();
	images.clearBackgroundPreview();
});

describe("official beUI wallpaper color math", () => {
	test("accepts supported hex forms and rejects invalid fields", () => {
		expect(formatHex(validHex(" #aBc "))).toBe("#aabbcc");
		expect(parseHex("#12345")).toBeNull();
		expect(parseHex("#gggggg")).toBeNull();
		expect(parseHex("#abcd")?.a).toBe(0.87);
	});

	test("round-trips opaque RGB without channel drift", () => {
		for (const color of [
			"#000000",
			"#ffffff",
			"#3478f6",
			"#22c55e",
			"#f59e0b",
			"#ef4444",
			"#a855f7",
		]) {
			expect(formatHex(hsvaToRgba(rgbaToHsva(validHex(color))))).toBe(color);
		}
	});

	test("retains hue in gray and saturation in black", () => {
		const previous = { h: 215, s: 70, v: 90, a: 1 };
		expect(rgbaToHsva(validHex("#808080"), previous).h).toBe(215);
		const black = rgbaToHsva(validHex("#000000"), previous);
		expect(black).toEqual({ h: 215, s: 70, v: 0, a: 1 });
	});

	test("opaque selection removes alpha without changing RGB", () => {
		const hsv = rgbaToHsva(validHex("#3478f680"));
		expect(formatHex(hsvaToRgba({ ...hsv, a: 1 }))).toBe("#3478f6");
	});
});

describe("transient background color", () => {
	test("preview frames and clearing do not alter staged images", () => {
		images.setBackgroundPreview("data:image/png;base64,staged");
		for (const color of ["#ffffff", "#3478f6", "#18181b"]) {
			images.setBackgroundColorPreview(color);
			expect(useImageStore.getState().previewBackgroundColor).toBe(color);
		}
		images.clearBackgroundColorPreview();
		expect(useImageStore.getState().previewBackgroundColor).toBeNull();
		expect(useImageStore.getState().previewBackgroundImage).toBe(
			"data:image/png;base64,staged",
		);
	});
});
