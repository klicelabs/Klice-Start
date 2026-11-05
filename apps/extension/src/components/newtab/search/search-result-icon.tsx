import { Icon, type IconName } from "@klice-start/ui/icons/icon";
import { faviconUrl } from "../../../lib/url";
import { IconAppTile } from "../icon-app-tile";

/** The Home app-art pipeline, at list scale; no separate favicon system. */
export function SearchResultIcon({
	url,
	favicon,
	icon,
}: {
	url?: string;
	favicon?: string | null;
	icon: IconName;
}) {
	return url ? (
		<IconAppTile
			url={url}
			favicon={favicon || faviconUrl(url)}
			className="klice-search-app-icon"
		/>
	) : (
		<span className="klice-search-result-icon">
			<Icon name={icon} size={18} aria-hidden="true" />
		</span>
	);
}
