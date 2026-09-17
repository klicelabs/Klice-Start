/**
 * Context-menu scope boundary.
 *
 * The global Speed Dial / Home context menu must never open inside Settings.
 * In-panel targets are covered by `[data-settings-panel]`, but Settings also
 * owns floating surfaces that portals render OUTSIDE the panel DOM (select
 * popups, dropdown menus, tree popovers, dialogs). Those carry the shared
 * `SETTINGS_SCOPE_CLASS` marker so one DOM `closest()` check — which portals
 * cannot escape, since it walks from the real event target — covers both.
 *
 * Rule for new Settings UI: any portal-rendered surface owned by Settings
 * must include `SETTINGS_SCOPE_CLASS` in its class list, or right-clicks on
 * it will leak to the global menu through React-tree event bubbling.
 */

/** Marker class for settings-owned floating surfaces rendered in portals. */
export const SETTINGS_SCOPE_CLASS = "settings-scope";

/** True when a contextmenu target belongs to the Settings surface. */
export function isInsideSettingsScope(
	target: EventTarget | null,
): boolean {
	return (
		target instanceof HTMLElement &&
		target.closest(
			`[data-settings-panel],.${SETTINGS_SCOPE_CLASS}`,
		) !== null
	);
}
