/**
 * Klice's shared corner language.
 *
 * Each role reads a semantic variable pair from tokens.css (--shape-*), so
 * the Settings corner scale drives every role at once and no consumer ever
 * picks a rounded-* utility by feel. Chromium renders corner-shape: squircle
 * from the radius; the paired fallback var keeps the calibrated Gecko
 * radius. The collapsed search field is the deliberate exception: its
 * geometry is engine-agnostic (one shared value per tier, capped by the
 * field's half-height, never a radius/fallback pair). The expanded results
 * surface is the regular surface role, so it uses the same radius/fallback
 * pair as every other app surface — only the resting field and the toolbar
 * are ever full-rounded. At Rounded the search surface also opts out of
 * the squircle curvature (see `.klice-search-surface` in tokens.css) so the
 * resting field renders true circular capsule ends, and the expanded state
 * drops one role (section → surface) so focus visibly reduces the radius.
 *
 * Consumers should use a role rather than choosing a rounded-* utility.
 */
const SURFACE_SHAPE =
	"klice-squircle rounded-[var(--shape-surface,18px)] [--squircle-r:var(--shape-surface-fallback,11px)]";

export const KliceShape = {
	panel:
		"klice-squircle rounded-[var(--shape-panel,28px)] [--squircle-r:var(--shape-panel-fallback,17px)]",
	section:
		"klice-squircle rounded-[var(--shape-section,22px)] [--squircle-r:var(--shape-section-fallback,13px)]",
	surface: SURFACE_SHAPE,
	/** Bookmark/folder cards: the grid's primary surface silhouette. */
	card: "klice-squircle rounded-[var(--shape-card,18px)] [--squircle-r:var(--shape-card-fallback,10px)]",
	control:
		"klice-squircle rounded-[var(--shape-control,16px)] [--squircle-r:var(--shape-control-fallback,10px)]",
	thumbnail:
		"klice-squircle rounded-[var(--shape-thumb,12px)] [--squircle-r:var(--shape-thumb-fallback,7px)]",
	/** Small badges and segmented controls. */
	pill: "klice-squircle rounded-[var(--shape-pill,14px)] [--squircle-r:var(--shape-pill-fallback,9px)]",
	/**
	 * Shared 34px toolbar surface. Always a true pill/capsule
	 * (`.klice-toolbar-pill`), never squircle.
	 */
	toolbar: "klice-toolbar-pill rounded-full",
	/**
	 * Shared toolbar segment. Always a true pill/capsule
	 * (`.klice-toolbar-pill`), never squircle.
	 */
	toolbarControl: "klice-toolbar-pill rounded-full",
	/**
	 * Shared 34px icon control. Always a true pill/capsule
	 * (`.klice-toolbar-pill`), never squircle.
	 */
	toolbarIcon: "klice-toolbar-pill rounded-full",
	/**
	 * Outer shell of a grouped toolbar control (e.g. Back/Forward). Resolves
	 * to the same capsule as every other toolbar pill: the outer ends of the
	 * first/last segment inherit this geometry (see `.klice-button-group` in
	 * globals.css), so the surface and its segments can never disagree.
	 */
	toolbarGroup: "klice-toolbar-group rounded-full",
	/**
	 * Collapsed search hero. Tier-driven (12/22/28px) like every other
	 * surface: the resting field follows the corner preference, and at
	 * Rounded the 28px token is exactly half the 56px field height (a true
	 * capsule silhouette via overlap scaling). Values stay FINITE:
	 * rounded-full resolves to calc(infinity * 1px), and border-radius
	 * cannot interpolate from infinity — the surface would hold the pill
	 * through the whole open transition and snap to the surface radius at
	 * the end (the shape-morph regression). Finite endpoints interpolate
	 * continuously, so expansion, radius and content share one timeline.
	 */
	searchCollapsed:
		"klice-search-surface klice-squircle rounded-[var(--shape-search-collapsed,28px)] [--squircle-r:var(--shape-search-collapsed,28px)]",
	/**
	 * Expanded search surface. It is the regular surface role — one step
	 * below the field's section step — so focus always REDUCES the radius
	 * (28→24, 22→18, 12→10) instead of keeping the capsule value on a large
	 * container. Keeping the surface radius/fallback pair also gives Gecko
	 * the calibrated radius instead of a raw circular one. The endpoints
	 * stay finite, so the open/close morph remains interpolable.
	 * `klice-search-surface` lets the Rounded tier opt both search states
	 * out of the squircle curvature, so the resting field is a true capsule
	 * and the shape cannot pop mid-morph.
	 */
	searchExpanded: `${SURFACE_SHAPE} klice-search-surface`,
} as const;

export type KliceShapeName = keyof typeof KliceShape;

export function kliceShape(shape: KliceShapeName): string {
	return KliceShape[shape];
}
