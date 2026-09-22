import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.tsx";

import "@klice-start/ui/globals.css";
import { readFirstPaintSnapshot } from "../../src/lib/first-paint-snapshot";

// Development-only seed hook. The dynamic import inside the DEV branch is
// dropped from production builds, so `src/dev/*` can never ship or run for
// real users. In dev it exposes `window.__kliceSeed.seed()` / `.reset()`.
if (import.meta.env.DEV) {
	void import("../../src/dev/seed").then((m) => m.installDevSeed());
}

// polish/first-paint-snapshot: checkpoint the mirror before first render.
// The store module already seeded its initial state from this same mirror at
// import time (module evaluation precedes this line — and creation-time
// seeding schedules no persist write, so a slow hydration can never flush
// pre-hydration defaults over stored data). This explicit read keeps the
// pre-mount ordering guarantee visible at the call site. Storage still wins
// once it resolves.
void readFirstPaintSnapshot();

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
