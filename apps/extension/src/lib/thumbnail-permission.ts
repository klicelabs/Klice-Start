import { extApi } from "./extension-api";

// Passive tab captures cannot use activeTab: that grant only follows a user
// gesture on the target tab. The manifest installs http://*/* and https://*/*
// as host permissions, and permissions.contains() matches patterns literally
// — '<all_urls>' does NOT match those two (it is its own pattern, covering
// non-http schemes), so the gate must query the exact granted patterns.
const CAPTURE_ORIGINS = ["http://*/*", "https://*/*"];

export async function hasThumbnailCapturePermission(): Promise<boolean> {
	return extApi().permissions.contains({ origins: CAPTURE_ORIGINS });
}

/** Call only from a Settings click so the browser can show its permission UI. */
export async function requestThumbnailCapturePermission(): Promise<boolean> {
	return extApi().permissions.request({ origins: CAPTURE_ORIGINS });
}
