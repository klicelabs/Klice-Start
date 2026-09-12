import { Icon, type IconName } from "@klice-start/ui/icons/icon";
import {
	settingsSidebarIconStyles,
	settingsSidebarStyles,
} from "@klice-start/ui/lib/glass-variants";
import { cn } from "../../../lib/utils";
import { SETTINGS_PANE_LABELS, type SettingsPaneId } from "./settings-types";
import { TrafficLights } from "./traffic-lights";

interface SidebarCategory {
	id: SettingsPaneId;
	label: string;
	icon: IconName;
	color: string;
}

interface SettingsSidebarProps {
	activePane: SettingsPaneId;
	onSelectPane: (pane: SettingsPaneId) => void;
	onClose: () => void;
}

// Distinct semantic tile colors provide wayfinding without adding a second
// visual language to the Settings surface.
const CATEGORIES: readonly SidebarCategory[] = [
	{
		id: "general",
		label: SETTINGS_PANE_LABELS.general,
		color: "bg-slate-500",
		icon: "settings",
	},
	{
		id: "appearance",
		label: SETTINGS_PANE_LABELS.appearance,
		color: "bg-sky-500",
		icon: "palette",
	},
	{
		id: "search",
		label: SETTINGS_PANE_LABELS.search,
		color: "bg-emerald-500",
		icon: "search",
	},
	{
		id: "bookmarks",
		label: SETTINGS_PANE_LABELS.bookmarks,
		color: "bg-amber-500",
		icon: "bookmark",
	},
	{
		id: "advanced",
		label: SETTINGS_PANE_LABELS.advanced,
		color: "bg-rose-500",
		icon: "sliders",
	},
];

export function SettingsSidebar({
	activePane,
	onSelectPane,
	onClose,
}: SettingsSidebarProps) {
	return (
		<nav
			className={cn(
				"flex w-52 shrink-0 flex-col overflow-hidden max-[380px]:w-28 max-[480px]:w-36 max-[640px]:w-40",
				settingsSidebarStyles,
			)}
			aria-label="Settings categories"
		>
			{/* Window chrome belongs to the sidebar title region, as in macOS. */}
			<div className="flex h-12 shrink-0 items-center px-[18px] max-[480px]:px-3">
				<TrafficLights onClose={onClose} />
			</div>

			<div className="settings-content-scroll min-h-0 flex-1 overflow-y-auto px-2.5 pt-1 pb-4 max-[480px]:px-2">
				<div className="flex flex-col gap-0.5">
					{CATEGORIES.map((category) => {
						const isActive = activePane === category.id;

						return (
							<button
								type="button"
								key={category.id}
								aria-current={isActive ? "page" : undefined}
								aria-label={category.label}
								onClick={() => onSelectPane(category.id)}
								className={cn(
									"flex min-h-8 w-full items-center gap-2.5 rounded-lg px-2 py-1 text-left font-medium text-[13px] leading-none transition-[background-color,color,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-[480px]:gap-2 max-[480px]:px-1.5",
									isActive
										? "bg-foreground/[0.10] font-semibold text-foreground ring-1 ring-foreground/[0.08] ring-inset"
										: "text-foreground/75 hover:bg-foreground/[0.07] hover:text-foreground",
								)}
							>
								<span className={cn(settingsSidebarIconStyles, category.color)}>
									<Icon name={category.icon} size={13} aria-hidden="true" />
								</span>
								<span className="truncate">{category.label}</span>
							</button>
						);
					})}
				</div>
			</div>
		</nav>
	);
}
