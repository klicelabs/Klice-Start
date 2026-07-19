import { glassVariantStyles } from "@perch/ui/lib/glass-variants";
import { Icon } from "@perch/ui/icons/icon";
import { type FormEvent, useState } from "react";
import { SEARCH_ENGINES } from "../../../lib/constants";
import { SEARCH_ENGINE_TO_SVGL } from "../../../lib/svgl-mapping";
import { faviconUrl } from "../../../lib/url";
import { cn } from "../../../lib/utils";
import { useSetupStore } from "../../../stores/setup-store";
import { SvgIcon } from "../../shared/svg-icon";
import { useSvgIcon } from "../../../hooks/use-svg-icon";
import { useAppearance } from "../appearance-provider";

/**
 * Inline Spotlight-style search field. The component *is* the input — a single
 * rounded container with a leading glyph; there is no nested fake input. Focus,
 * hover and click all act on the one field. Submitting runs the query on the
 * user's chosen search engine.
 *
 * Rendered on the new-tab hero only when `settings.search.enabled`. The
 * Ctrl/Cmd+K command palette (GlobalSearch) is separate.
 */
export function SearchBar() {
	const { isLiquid } = useAppearance();
	const enabled = useSetupStore((s) => s.settings.search.enabled);
	const engineId = useSetupStore((s) => s.settings.search.engine);
	const customPlaceholder = useSetupStore(
		(s) => s.settings.search.placeholder,
	);
	const iconMode = useSetupStore((s) => s.settings.search.iconMode);
	const openInNewTab = useSetupStore((s) => s.settings.openInNewTab);
	const [query, setQuery] = useState("");
	const [logoFailed, setLogoFailed] = useState(false);

	if (!enabled) return null;

	const engine =
		SEARCH_ENGINES.find((s) => s.id === engineId) ?? SEARCH_ENGINES[0];

	// Placeholder: user's custom string wins; otherwise a dynamic default that
	// names the active engine, e.g. `Search with "Google"`.
	const placeholder =
		customPlaceholder.trim() || `Search with "${engine.label}"`;

	const svglTitle = iconMode === "engine" ? SEARCH_ENGINE_TO_SVGL[engineId] : null;
	const { svgXml, isLoading } = useSvgIcon(svglTitle);
	const showEngineLogo = iconMode === "engine" && !logoFailed;

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
			className={cn(
				"group relative flex w-full max-w-xl items-center gap-2.5 rounded-full px-4 py-2.5 transition-all duration-200",
				// The whole rounded container is the field. In liquid mode it uses
				// the exact same shared "liquid" glass variant as every other
				// surface; in flat mode a solid opaque card.
				isLiquid
					? cn(glassVariantStyles.liquid, "focus-within:ring-2 focus-within:ring-white/25")
					: "border border-border bg-card shadow-sm hover:bg-muted focus-within:ring-2 focus-within:ring-ring",
			)}
		>
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
					onError={() => setLogoFailed(true)}
				/>
			) : (
				<Icon
					name="search"
					size={18}
					className={cn(
						"shrink-0",
						isLiquid ? "text-white/50" : "text-muted-foreground",
					)}
				/>
			)}
			<input
				type="text"
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				placeholder={placeholder}
				aria-label={placeholder}
				// The bare input carries no box of its own — the form is the box.
				// focus-visible:outline-none defeats the global :focus-visible rule
				// (tokens.css) that was drawing the inner rounded outline.
				data-search-input=""
				className={cn(
					"w-full border-0 bg-transparent p-0 text-[15px] outline-none focus:ring-0",
					isLiquid
						? "text-white placeholder-white/40"
						: "text-foreground placeholder-muted-foreground",
				)}
			/>
		</form>
	);
}
