/**
 * Klice's shared corner language.
 *
 * Each role reads a semantic variable pair from tokens.css (--shape-*), so
 * the Settings corner scale drives every role at once and no consumer ever
 * picks a rounded-* utility by feel. Chromium renders corner-shape: squircle
 * from the radius; the paired fallback var keeps the calibrated Gecko
 * radius. Search has independent field and results surfaces: both keep
 * squircle geometry and follow the user's corner scale. The field uses
 * the section's calibrated fallback; its detached result panel uses panel.
 * Toolbar controls remain circular capsules.
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
	/** Search field: finite tier radius with the section's Gecko calibration. */
	searchCollapsed:
		"klice-search-surface klice-squircle rounded-[var(--shape-search-collapsed,28px)] [--squircle-r:var(--shape-section-fallback,13px)]",
	/** Default search material geometry; detached result panels use panel. */
	searchExpanded: `${SURFACE_SHAPE} klice-search-surface`,
} as const;

export type KliceShapeName = keyof typeof KliceShape;

export function kliceShape(shape: KliceShapeName): string {
	return KliceShape[shape];
}
