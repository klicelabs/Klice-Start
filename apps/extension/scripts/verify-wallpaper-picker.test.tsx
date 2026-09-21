import { afterEach, expect, test } from "bun:test";
import { parseHTML } from "linkedom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { WallpaperPane } from "../src/components/newtab/settings/panes/wallpaper-pane";
import { useSetupStore } from "../src/stores/setup-store";

const { window } = parseHTML(
	"<!doctype html><html><body><div id=app></div></body></html>",
);

Object.assign(globalThis, {
	window,
	document: window.document,
	self: window,
	navigator: window.navigator,
	HTMLElement: window.HTMLElement,
	HTMLInputElement: window.HTMLInputElement,
	Element: window.Element,
	Node: window.Node,
	Event: window.Event,
	MutationObserver: window.MutationObserver,
	requestAnimationFrame: (callback: FrameRequestCallback) =>
		setTimeout(() => callback(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

afterEach(() => {
	act(() => root?.unmount());
	root = null;
	useSetupStore.setState(useSetupStore.getInitialState());
	document.body.innerHTML = "<div id=app></div>";
});

async function mountPane() {
	const mount = document.getElementById("app");
	if (!mount) throw new Error("test mount missing");
	root = createRoot(mount);
	await act(async () => {
		root?.render(<WallpaperPane />);
	});
}

function solidTile() {
	const tile = document.querySelector('[data-wallpaper-tile="solid"]');
	if (!tile) throw new Error("solid tile missing");
	return tile;
}

test("the solid tile is the only colour picker in the pane", async () => {
	await mountPane();

	// The lower "Solid colour" row used to hold a second `<input type="color">`.
	// Exactly one picker must exist, and it must live inside the solid tile.
	const pickers = [...document.querySelectorAll('input[type="color"]')];
	expect(pickers).toHaveLength(1);
	expect(pickers[0]?.closest('[data-wallpaper-tile="solid"]')).not.toBeNull();
});

test("the solid tile swatch and selected state track the applied colour", async () => {
	useSetupStore.setState({
		settings: {
			...useSetupStore.getState().settings,
			background: {
				...useSetupStore.getState().settings.background,
				type: "solid",
				color: "#123456",
			},
		},
	});
	await mountPane();

	const tile = solidTile();
	const picker = tile.querySelector('input[type="color"]');
	if (!picker) throw new Error("colour picker missing");

	// The swatch renders the applied colour, and the picker agrees with it.
	expect(picker.getAttribute("value")).toBe("#123456");
	const swatch = tile.querySelector("span[aria-hidden]")?.getAttribute("style");
	expect(swatch).toContain("#123456");
	// Active tile carries the accent ring and the check badge.
	expect(tile.className).toContain("ring-[var(--klice-accent)]");
	expect(tile.querySelector("svg")).not.toBeNull();
});

test("picking a colour on the solid tile applies it live", async () => {
	useSetupStore.setState({
		settings: {
			...useSetupStore.getState().settings,
			background: {
				...useSetupStore.getState().settings.background,
				type: "wallpaper",
				wallpaperId: "tokyo-skyline",
			},
		},
	});
	await mountPane();

	const picker = solidTile().querySelector('input[type="color"]');
	if (!picker) throw new Error("colour picker missing");

	await act(async () => {
		picker.value = "#abcdef";
		picker.dispatchEvent(new window.Event("input", { bubbles: true }));
	});

	const background = useSetupStore.getState().settings.background;
	expect(background.type).toBe("solid");
	expect(background.color).toBe("#abcdef");
	// Applying solid must clear the other source ids so exactly one source wins.
	expect(background.wallpaperId).toBeNull();
	expect(background.gradientId).toBeNull();
	expect(background.imageId).toBeNull();
});

test("Pexels is hidden from the picker without touching the applied source", async () => {
	useSetupStore.setState({
		settings: {
			...useSetupStore.getState().settings,
			background: {
				...useSetupStore.getState().settings.background,
				type: "pexels",
				pexelsQuery: "minimalist landscape",
			},
		},
	});
	await mountPane();

	// The section is gated behind a local flag, so no Pexels control renders.
	expect(document.body.textContent).not.toContain("Pexels");
	expect(document.getElementById("pexels-query-input")).toBeNull();

	// Hiding the picker must never rewrite what the user already has applied.
	const background = useSetupStore.getState().settings.background;
	expect(background.type).toBe("pexels");
	expect(background.pexelsQuery).toBe("minimalist landscape");
});
