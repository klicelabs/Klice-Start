import { extApi } from "./extension-api";

// Passive tab captures cannot use activeTab: that grant only follows a user
// gesture on the target tab, and a background visit-capture has none.
// captureVisibleTab additionally requires the literal "<all_urls>" pattern —
// the install-time http/https wildcard grants do NOT satisfy its internal
// requirement (verified empirically: contains(http+https) = true yet the API
// still throws "Either the '<all_urls>' or 'activeTab' permission is
// required"). "<all_urls>" is declared optional and granted exactly once
// through a refresh click or the Settings consent flow (below); both
// contains() and request() must query that same literal pattern.
const CAPTURE_ORIGINS = ["<all_urls>"];

export async function hasThumbnailCapturePermission(): Promise<boolean> {
	return extApi().permissions.contains({ origins: CAPTURE_ORIGINS });
}

/** Invoke directly in the click stack, before awaiting any other API. */
export async function requestThumbnailCapturePermission(): Promise<boolean> {
	return extApi().permissions.request({ origins: CAPTURE_ORIGINS });
}
