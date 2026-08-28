import { cn } from "../../../lib/utils";
import type { SettingsPaneId } from "./settings-types";

interface SidebarCategory {
	id: SettingsPaneId;
	label: string;
	icon: React.ReactNode;
	color: string; // Background color for the macOS squircle
}

interface SettingsSidebarProps {
	activePane: SettingsPaneId;
	onSelectPane: (pane: SettingsPaneId) => void;
}

const CATEGORIES: readonly SidebarCategory[] = [
	{
		id: "general",
		label: "General",
		color: "bg-slate-500 text-white",
		icon: (
			<svg
				aria-hidden="true"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
				<circle cx="12" cy="12" r="3" />
			</svg>
		),
	},
	{
		id: "appearance",
		label: "Appearance",
		color: "bg-sky-500 text-white",
		icon: (
			<svg
				aria-hidden="true"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="M12 2a10 10 0 0 0-8 16.27L2 22l3.73-2A10 10 0 1 0 12 2z" />
				<path d="m15.5 8.5-3 3" />
			</svg>
		),
	},
	{
		id: "background",
		label: "Background",
		color: "bg-violet-600 text-white",
		icon: (
			<svg
				aria-hidden="true"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
				<circle cx="9" cy="9" r="2" />
				<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
			</svg>
		),
	},
	{
		id: "search",
		label: "Search",
		color: "bg-emerald-600 text-white",
		icon: (
			<svg
				aria-hidden="true"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<circle cx="11" cy="11" r="8" />
				<path d="m21 21-4.3-4.3" />
			</svg>
		),
	},
	{
		id: "bookmarks",
		label: "Bookmarks",
		color: "bg-amber-500 text-white",
		icon: (
			<svg
				aria-hidden="true"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
			</svg>
		),
	},
	{
		id: "import-export",
		label: "Import & Export",
		color: "bg-teal-600 text-white",
		icon: (
			<svg
				aria-hidden="true"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="m21 15-4 4-4-4" />
				<path d="M17 19V3" />
				<path d="m3 9 4-4 4 4" />
				<path d="M7 5v16" />
			</svg>
		),
	},
	{
		id: "advanced",
		label: "Advanced",
		color: "bg-rose-600 text-white",
		icon: (
			<svg
				aria-hidden="true"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
				<path d="M12 9v4" />
				<path d="M12 17h.01" />
			</svg>
		),
	},
];

export function SettingsSidebar({
	activePane,
	onSelectPane,
}: SettingsSidebarProps) {
	return (
		<nav
			className="flex w-52 shrink-0 flex-col gap-1 border-border/40 border-r bg-muted/20 p-3"
			aria-label="Settings categories"
		>
			<div className="px-2 pt-1 pb-2">
				<span className="font-semibold text-foreground text-sm tracking-tight">
					Settings
				</span>
			</div>

			<div
				className="flex flex-1 flex-col gap-0.5"
				role="tablist"
				aria-orientation="vertical"
			>
				{CATEGORIES.map((cat) => {
					const isActive = activePane === cat.id;
					return (
						<button
							type="button"
							key={cat.id}
							role="tab"
							aria-selected={isActive}
							onClick={() => onSelectPane(cat.id)}
							className={cn(
								"group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left font-medium text-xs transition-[background-color,color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]",
								isActive
									? "bg-foreground/10 text-foreground font-semibold shadow-xs"
									: "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
							)}
						>
							<span
								className={cn(
									"flex size-6 shrink-0 items-center justify-center rounded-[6px] shadow-2xs transition-transform duration-150 group-hover:scale-105",
									cat.color,
								)}
							>
								{cat.icon}
							</span>
							<span className="truncate">{cat.label}</span>
						</button>
					);
				})}
			</div>
		</nav>
	);
}
