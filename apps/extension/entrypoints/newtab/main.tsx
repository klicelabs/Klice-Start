import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.tsx";

import "@klice-start/ui/globals.css";
import {
	readFirstPaintSnapshot,
	snapshotPatch,
} from "../../src/lib/first-paint-snapshot";
import { useSetupStore } from "../../src/stores/setup-store";

// Development-only seed hook. The dynamic import inside the DEV branch is
// dropped from production builds, so `src/dev/*` can never ship or run for
// real users. In dev it exposes `window.__kliceSeed.seed()` / `.reset()`.
if (import.meta.env.DEV) {
	void import("../../src/dev/seed").then((m) => m.installDevSeed());
}

// polish/first-paint-snapshot: seed the first render with the user's display
// flags before React mounts (defaults + async hydration would flash widgets
// that the user disabled). Pre-mount setState is silent — no subscribers yet,
// so no commit fires; chrome.storage.local still wins once it resolves.
const firstPaint = readFirstPaintSnapshot();
if (firstPaint && Object.keys(firstPaint).length > 0) {
	useSetupStore.setState((s) => snapshotPatch(s, firstPaint));
}

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
