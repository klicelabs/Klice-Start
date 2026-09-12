import {
	InputGroupAddon,
	InputGroupInput,
} from "@klice-start/ui/components/input-group";
import { Icon } from "@klice-start/ui/icons/icon";
import { glassVariantStyles } from "@klice-start/ui/lib/glass-variants";
import { type FormEvent, useState } from "react";
import { useSvgIcon } from "../../../hooks/use-svg-icon";
import { SEARCH_ENGINES } from "../../../lib/constants";
import { SEARCH_ENGINE_TO_SVGL } from "../../../lib/svgl-mapping";
import { faviconUrl } from "../../../lib/url";
import { cn } from "../../../lib/utils";
import { useSetupStore } from "../../../stores/setup-store";
import { SvgIcon } from "../../shared/svg-icon";
import { useAppearance } from "../appearance-provider";

/**
 * Inline Spotlight-style search field. The pill is ONE control composed from
 * the shared shadcn InputGroup pattern: the `form` is the group (it owns
 * border, material, radius, hover and focus), `InputGroupAddon` holds the
 * engine glyph, and `InputGroupInput` is chromeless — it never paints an
 * independent border or focus ring inside the pill.
 *
 * Rendered on the new-tab hero only when `settings.search.enabled`. The
 * Ctrl/Cmd+K command palette (GlobalSearch) is separate.
 */
export function SearchBar() {
	const { isLiquid } = useAppearance();
	const enabled = useSetupStore((s) => s.settings.search.enabled);
	const engineId = useSetupStore((s) => s.settings.search.engine);
	const customPlaceholder = useSetupStore((s) => s.settings.search.placeholder);
	const iconMode = useSetupStore((s) => s.settings.search.iconMode);
	const openInNewTab = useSetupStore((s) => s.settings.openInNewTab);
	const [query, setQuery] = useState("");
	const [logoFailedFor, setLogoFailedFor] = useState<string | null>(null);

	const engine =
		SEARCH_ENGINES.find((s) => s.id === engineId) ?? SEARCH_ENGINES[0];

	// Placeholder: user's custom string wins; otherwise a dynamic default that
	// names the active engine, e.g. `Search with "Google"`.
	const placeholder =
		customPlaceholder.trim() || `Search with "${engine.label}"`;

	const svglTitle =
		iconMode === "engine" ? SEARCH_ENGINE_TO_SVGL[engineId] : null;
	const { svgXml, isLoading } = useSvgIcon(svglTitle);
	const showEngineLogo = iconMode === "engine" && logoFailedFor !== engineId;

	if (!enabled) return null;

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		const q = query.trim();
		if (!q) return;
		const url = engine.queryUrl.replace("%s", encodeURIComponent(q));
		window.open(url, openInNewTab ? "_blank" : "_self");
		setQuery("");
	}

	return (
		<form
			onSubmit={handleSubmit}
			data-slot="input-group"
			className={cn(
				"group/input-group relative flex w-full max-w-xl items-center gap-2.5 rounded-full px-4 py-2.5 transition-all duration-200",
				// The whole rounded container is the field. In liquid mode it uses
				// the exact same shared "liquid" glass variant as every other
				// surface; in flat mode a solid opaque card.
				isLiquid
					? cn(
							glassVariantStyles.liquid,
							"focus-within:ring-2 focus-within:ring-white/40",
						)
					: "border border-border bg-card shadow-sm focus-within:ring-2 focus-within:ring-ring hover:bg-muted",
			)}
		>
			<InputGroupAddon align="inline-start" className="py-0 pl-0">
				{/* Wrapped so the addon's svg-sizing rule never restyles the glyph. */}
				<span className="flex shrink-0 items-center">
					{showEngineLogo && svgXml && !isLoading ? (
						<SvgIcon
							svgXml={svgXml}
							className="h-[18px] w-[18px] shrink-0"
							alt={engine.label}
						/>
					) : showEngineLogo ? (
						<img
							src={faviconUrl(engine.homepage)}
							alt=""
							className="h-[18px] w-[18px] shrink-0 rounded-[4px]"
							onError={() => setLogoFailedFor(engineId)}
						/>
					) : (
						<Icon
							name="search"
							size={18}
							className={cn(
								"shrink-0",
								isLiquid ? "text-white/60" : "text-muted-foreground",
							)}
						/>
					)}
				</span>
			</InputGroupAddon>
			<InputGroupInput
				type="text"
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				placeholder={placeholder}
				aria-label={placeholder}
				className={cn(
					"h-auto px-0 py-0 text-[15px]",
					isLiquid
						? "text-white placeholder-white/50"
						: "text-foreground placeholder-muted-foreground",
				)}
			/>
		</form>
	);
}
