import { afterEach, expect, test } from "bun:test";
import { parseHTML } from "linkedom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { BackgroundLayer } from "../src/components/newtab/background-layer";
import { useImageStore } from "../src/stores/image-store";
import { useSetupStore } from "../src/stores/setup-store";

const { window } = parseHTML(
	"<!doctype html><html><body><div id=wallpaper-test></div></body></html>",
);
const originalImage = globalThis.Image;
const originalGetBackgroundImage = useImageStore.getState().getBackgroundImage;
const pending = new Map<string, Promise<void>>();
class TestImage {
	src = "";
	decoding = "";
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	decode() {
		return pending.get(this.src) ?? Promise.resolve();
	}
}
let root: Root | null = null;

async function mount() {
	Object.assign(globalThis, {
		window,
		document: window.document,
		navigator: window.navigator,
		HTMLElement: window.HTMLElement,
		Element: window.Element,
		Node: window.Node,
		Image: TestImage,
	});
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	document.body.innerHTML = "<div id=wallpaper-test></div>";
	const target = document.getElementById("wallpaper-test");
	if (!target) throw new Error("wallpaper test target missing");
	useSetupStore.getState().updateBackground({
		type: "wallpaper",
		wallpaperId: "alpine-lake-sunbeams",
	});
	root = createRoot(target);
	await act(async () => {
		root?.render(<BackgroundLayer />);
	});
}

function background() {
	return document.querySelector("#bg-layer")?.getAttribute("style") ?? "";
}

afterEach(async () => {
	await act(async () => root?.unmount());
	root = null;
	pending.clear();
	globalThis.Image = originalImage;
	useImageStore.setState({
		getBackgroundImage: originalGetBackgroundImage,
		previewBackgroundImage: null,
	});
	useSetupStore.setState(useSetupStore.getInitialState());
});

test("wallpaper changes wait for decode and stale completions cannot replace a newer choice", async () => {
	await mount();
	const deferred = Promise.withResolvers<void>();
	pending.set("/wallpapers/tokyo-skyline.avif", deferred.promise);
	await act(async () => {
		useSetupStore.getState().updateBackground({ wallpaperId: "tokyo-skyline" });
	});
	expect(background()).toContain("alpine-lake-sunbeams");
	await act(async () => {
		useSetupStore.getState().updateBackground({ wallpaperId: "mountain-lake" });
	});
	expect(background()).toContain("/wallpapers/mountain-lake.avif");
	await act(async () => deferred.resolve());
	expect(background()).toContain("/wallpapers/mountain-lake.avif");
	expect(background()).not.toContain("tokyo-skyline");
	expect(document.querySelectorAll(".wallpaper-outgoing")).toHaveLength(1);
});

test("a broken image keeps the existing background visible", async () => {
	await mount();
	const deferred = Promise.withResolvers<void>();
	pending.set("/wallpapers/tokyo-skyline.avif", deferred.promise);
	await act(async () => {
		useSetupStore.getState().updateBackground({ wallpaperId: "tokyo-skyline" });
	});
	await act(async () => deferred.reject(new Error("corrupt photo")));
	expect(background()).toContain("alpine-lake-sunbeams");
});

test("a custom wallpaper decode failure preserves the visible wallpaper", async () => {
	await mount();
	const deferred = Promise.withResolvers<void>();
	const customSource = "data:image/png;base64,broken-custom-photo";
	pending.set(customSource, deferred.promise);
	await act(async () => {
		useImageStore.setState({ getBackgroundImage: async () => customSource });
		useSetupStore
			.getState()
			.updateBackground({ type: "image", imageId: "custom-photo" });
	});
	expect(background()).toContain("alpine-lake-sunbeams");
	await act(async () =>
		deferred.reject(new Error("custom image failed to decode")),
	);
	expect(background()).toContain("alpine-lake-sunbeams");
	expect(background()).not.toContain("broken-custom-photo");
});

test("an invalid upload preview preserves the visible wallpaper", async () => {
	await mount();
	const deferred = Promise.withResolvers<void>();
	const previewSource = "data:image/png;base64,broken-upload-preview";
	pending.set(previewSource, deferred.promise);
	await act(async () => {
		useImageStore.getState().setBackgroundPreview(previewSource);
	});
	expect(background()).toContain("alpine-lake-sunbeams");
	await act(async () =>
		deferred.reject(new Error("upload preview failed to decode")),
	);
	expect(background()).toContain("alpine-lake-sunbeams");
	expect(background()).not.toContain("broken-upload-preview");
});
