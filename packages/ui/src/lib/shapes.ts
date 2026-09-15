/**
 * Klice's shared corner language.
 *
 * Each role pairs the Chromium corner radius with a calibrated Firefox/Zen
 * fallback through --squircle-r. Consumers should use a role rather than
 * choosing a rounded-* utility by feel.
 */
export const KliceShape = {
	panel: "klice-squircle rounded-[28px] [--squircle-r:17px]",
	section: "klice-squircle rounded-[22px] [--squircle-r:13px]",
	surface: "klice-squircle rounded-[18px] [--squircle-r:11px]",
	control: "klice-squircle rounded-[16px] [--squircle-r:10px]",
	thumbnail: "klice-squircle rounded-[12px] [--squircle-r:7px]",
	/** Small badges and segmented controls. */
	pill: "klice-squircle rounded-[14px] [--squircle-r:9px]",
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
	searchCollapsed: "klice-squircle rounded-[28px] [--squircle-r:17px]",
	searchExpanded: "klice-squircle rounded-[22px] [--squircle-r:13px]",
} as const;

export type KliceShapeName = keyof typeof KliceShape;

export function kliceShape(shape: KliceShapeName): string {
	return KliceShape[shape];
}
