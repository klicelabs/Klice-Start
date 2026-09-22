import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.tsx";

import "@klice-start/ui/globals.css";
import {
	applyWallpaperPrehydrate,
	clearPrehydrateWhenLive,
} from "../../src/lib/wallpaper-snapshot";
import { useSetupStore } from "../../src/stores/setup-store";

// Development-only seed hook. The dynamic import inside the DEV branch is
// dropped from production builds, so `src/dev/*` can never ship or run for
// real users. In dev it exposes `window.__kliceSeed.seed()` / `.reset()`.
if (import.meta.env.DEV) {
	void import("../../src/dev/seed").then((m) => m.installDevSeed());
}

// polish/wallpaper-flash: paint frame 1 from the localStorage mirror BEFORE
// React mounts (default state + async hydration would otherwise flash the
// default wallpaper). chrome.storage.local stays source of truth — the shim
// lifts once #bg-layer carries its runtime value.
applyWallpaperPrehydrate();

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);

clearPrehydrateWhenLive(
	() => useSetupStore.persist.hasHydrated(),
	(cb) => {
		useSetupStore.persist.onFinishHydration(cb);
	},
);
