import { Icon } from "@perch/ui/icons/icon";
import { type FormEvent, useMemo } from "react";
import { SEARCH_ENGINES } from "../../lib/constants";
import { isValidUrl, normalizeUrl } from "../../lib/url";
import { useSetupStore } from "../../stores/setup-store";

export function SearchBar() {
	const enabled = useSetupStore((s) => s.settings.search.enabled);
	const engineId = useSetupStore((s) => s.settings.search.engine);

	const engine = useMemo(
		() => SEARCH_ENGINES.find((e) => e.id === engineId) ?? SEARCH_ENGINES[0],
		[engineId],
	);

	if (!enabled) return null;

	function handleSubmit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const data = new FormData(e.currentTarget);
		const q = (data.get("q") as string)?.trim();
		if (!q) return;

		// A bare domain or full URL navigates directly; anything else is a search.
		if (isValidUrl(q) && /^[\w.-]+\.[a-z]{2,}/i.test(q)) {
			window.location.href = normalizeUrl(q);
		} else {
			window.location.href = engine.queryUrl.replace(
				"%s",
				encodeURIComponent(q),
			);
		}
	}

	return (
		<form
			onSubmit={handleSubmit}
			role="search"
			className="search-pill flex w-full max-w-[480px] items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5"
		>
			<Icon name="search" size={16} className="shrink-0 opacity-55" />
			<input
				name="q"
				type="text"
				aria-label={`Search with ${engine.label} or enter a URL`}
				placeholder={`Search ${engine.label} or enter URL...`}
				className="flex-1 border-none bg-transparent text-[14px] text-white/90 placeholder-white/40 outline-none"
				autoComplete="off"
				spellCheck={false}
			/>
		</form>
	);
}
