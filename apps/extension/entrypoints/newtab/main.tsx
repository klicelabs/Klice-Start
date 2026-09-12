import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.tsx";

import "@klice-start/ui/globals.css";

// Development-only seed hook. The dynamic import inside the DEV branch is
// dropped from production builds, so `src/dev/*` can never ship or run for
// real users. In dev it exposes `window.__kliceSeed.seed()` / `.reset()`.
if (import.meta.env.DEV) {
	void import("../../src/dev/seed").then((m) => m.installDevSeed());
}

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
