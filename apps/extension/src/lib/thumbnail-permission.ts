import { extApi } from "./extension-api";

// Passive tab captures cannot use activeTab: that grant only follows a user
// gesture on the target tab. Both Chromium and Firefox require <all_urls>.
const CAPTURE_ORIGINS = ["<all_urls>"];

export async function hasThumbnailCapturePermission(): Promise<boolean> {
	return extApi().permissions.contains({ origins: CAPTURE_ORIGINS });
}

/** Call only from a Settings click so the browser can show its permission UI. */
export async function requestThumbnailCapturePermission(): Promise<boolean> {
	return extApi().permissions.request({ origins: CAPTURE_ORIGINS });
}
