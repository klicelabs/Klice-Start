export type FrostGlassVariant =
	| "clear"
	| "frosted"
	| "subtle"
	| "liquid"
	| "liquid-refract";
export type FrostGlassVariantProp = { glassVariant?: FrostGlassVariant };

export const liquidRefractStyles = "bg-transparent border-0 shadow-none";
export const glassVariantStyles: Record<FrostGlassVariant, string> = {
	clear: [
		"backdrop-blur-[2px] backdrop-saturate-[1.9]",
		"bg-black/[0.25]",
		"border border-white/[0.12]",
		"shadow-[0_1px_12px_rgba(0,0,0,0.2)]",
	].join(" "),
	frosted: [
		"backdrop-blur-[16px] backdrop-saturate-[1.6]",
		"bg-black/[0.35]",
		"border border-white/10",
		"shadow-[0_2px_20px_rgba(0,0,0,0.3)]",
	].join(" "),
	subtle: [
		"backdrop-blur-[4px] backdrop-saturate-[1.5]",
		"bg-white/[0.06]",
		"border border-white/[0.08]",
		"shadow-[0_1px_12px_rgba(0,0,0,0.2)]",
	].join(" "),
	liquid: [
		// Liquid Glass is a material, not a theme palette. This is the
		// canonical recipe in every Light, Dark, and System state.
		"backdrop-blur-[12px] backdrop-saturate-[1.6] backdrop-brightness-[0.95]",
		"bg-white/[0.04]",

		// Layered sheen and chromatic wash; intentionally stable across themes.
		"[background-image:radial-gradient(120%_85%_at_15%_8%,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.05)_40%,rgba(255,255,255,0)_70%),radial-gradient(110%_80%_at_85%_100%,rgba(120,170,255,0.12)_0%,rgba(0,0,0,0)_60%),linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(0,0,0,0.18)_100%)]",
		"[background-size:200%_200%,180%_180%,100%_100%]",
		"[background-repeat:no-repeat]",

		// Multi-layer bevel:
		//    - inset top hairline highlight (light-from-above)
		//    - inset fish-eye glow at the bottom (lensing artifact)
		//    - thin inset side rails
		//    - outer contact shadow + broader halo (panel feels floating)
		"shadow-[inset_0_1px_0_0_rgba(255,255,255,0.30),inset_0_-14px_28px_-10px_rgba(180,210,255,0.18),inset_0.5px_0_0_0_rgba(255,255,255,0.10),inset_-0.5px_0_0_0_rgba(255,255,255,0.08),0_28px_70px_-18px_rgba(0,0,0,0.55),0_10px_28px_-10px_rgba(0,0,0,0.40)]",

		// Hairline border for the chamfer's outer edge. Sub-pixel so it reads
		//    as a crisp edge, not a thick rim, on small controls.
		"border-[0.5px] border-white/[0.08]",
	].join(" "),
	"liquid-refract": "",
};
