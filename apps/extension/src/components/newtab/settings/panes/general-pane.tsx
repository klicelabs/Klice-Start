import { Button } from "@klice-start/ui/components/button";
import { Switch } from "@klice-start/ui/components/switch";
import { Icon, type IconName } from "@klice-start/ui/icons/icon";
import { useSetupStore } from "../../../../stores/setup-store";
import type { CardAspect } from "../../../../types";
import { SectionCard } from "../shared/section-card";
import { SelectRow } from "../shared/select-row";
import { SettingRow } from "../shared/setting-row";

const TILE_SIZE_OPTIONS = [
	{ value: "small", label: "Small (132px)" },
	{ value: "medium", label: "Medium (160px)" },
	{ value: "large", label: "Large (196px)" },
] as const;

const COLUMN_OPTIONS = [4, 5, 6, 7, 8, 9, 10].map((n) => ({
	value: String(n),
	label: `${n} columns`,
}));

const LAYOUT_OPTIONS = [
	{ value: "card", label: "Card (Speed Dial)" },
	{ value: "icon", label: "Icon (App Launcher)" },
] as const;

const CARD_SHAPES: readonly {
	value: CardAspect;
	icon: IconName;
	label: string;
}[] = [
	{
		value: "vertical",
		icon: "rectangle-vertical",
		label: "Portrait (Vivaldi)",
	},
	{ value: "horizontal", icon: "rectangle-horizontal", label: "Landscape" },
	{ value: "square", icon: "square", label: "Square" },
];

const COMMON_TIMEZONES = [
	{ value: "auto", label: "Automatic (Local System)" },
	{ value: "UTC", label: "UTC" },
	{ value: "America/New_York", label: "New York (EST/EDT)" },
	{ value: "America/Chicago", label: "Chicago (CST/CDT)" },
	{ value: "America/Denver", label: "Denver (MST/MDT)" },
	{ value: "America/Los_Angeles", label: "Los Angeles (PST/PDT)" },
	{ value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
	{ value: "Europe/London", label: "London (GMT/BST)" },
	{ value: "Europe/Paris", label: "Paris / Berlin (CET/CEST)" },
	{ value: "Asia/Tokyo", label: "Tokyo (JST)" },
	{ value: "Asia/Shanghai", label: "Shanghai (CST)" },
	{ value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
];

export function GeneralPane() {
	const tileSize = useSetupStore((s) => s.settings.tileSize);
	const maxColumns = useSetupStore((s) => s.settings.maxColumns);
	const dialLayout = useSetupStore((s) => s.settings.dialLayout);
	const cardAspect = useSetupStore((s) => s.settings.cardAspect);
	const iconShowLabel = useSetupStore((s) => s.settings.iconShowLabel);
	const showTitle = useSetupStore((s) => s.settings.showTitle);
	const showDeleteButton = useSetupStore((s) => s.settings.showDeleteButton);
	const openInNewTab = useSetupStore((s) => s.settings.openInNewTab);
	const timezone = useSetupStore((s) => s.settings.clock.timezone);
	const updateSettings = useSetupStore((s) => s.updateSettings);
	const updateClock = useSetupStore((s) => s.updateClock);

	return (
		<div className="space-y-2">
			<SectionCard title="Layout & Density">
				<SelectRow
					label="Tile size"
					description="Width of each shortcut card or icon"
					value={tileSize}
					options={TILE_SIZE_OPTIONS}
					onChange={(v) =>
						updateSettings({ tileSize: v as "small" | "medium" | "large" })
					}
				/>

				<SelectRow
					label="Max columns"
					description="Maximum number of grid columns on wide displays"
					value={String(maxColumns)}
					options={COLUMN_OPTIONS}
					onChange={(v) =>
						updateSettings({ maxColumns: Number.parseInt(v, 10) })
					}
				/>

				<SelectRow
					label="Display style"
					description="Speed Dial card tiles vs compact app icons"
					value={dialLayout}
					options={LAYOUT_OPTIONS}
					onChange={(v) => updateSettings({ dialLayout: v as "card" | "icon" })}
				/>

				{dialLayout === "card" && (
					<SettingRow
						label="Card proportion"
						description="Aspect ratio of thumbnail cards"
					>
						<div className="flex gap-1">
							{CARD_SHAPES.map((opt) => {
								const isSelected = cardAspect === opt.value;
								return (
									<Button
										key={opt.value}
										type="button"
										variant={isSelected ? "default" : "secondary"}
										size="icon-sm"
										onClick={() => updateSettings({ cardAspect: opt.value })}
										aria-label={opt.label}
										aria-pressed={isSelected}
										title={opt.label}
										className="size-8 rounded-lg"
									>
										<Icon name={opt.icon} size={15} />
									</Button>
								);
							})}
						</div>
					</SettingRow>
				)}

				{dialLayout === "icon" && (
					<SettingRow
						label="Show site titles"
						description="Display site name beneath each icon"
					>
						<Switch
							checked={iconShowLabel}
							onCheckedChange={(checked: boolean) =>
								updateSettings({ iconShowLabel: checked })
							}
						/>
					</SettingRow>
				)}
			</SectionCard>

			<SectionCard title="Card Behavior">
				<SettingRow
					label="Show site title"
					description="Display favicon and name footer below card thumbnails"
				>
					<Switch
						checked={showTitle}
						onCheckedChange={(checked: boolean) =>
							updateSettings({ showTitle: checked })
						}
					/>
				</SettingRow>

				<SettingRow
					label="Show delete button on hover"
					description="Show direct delete shortcut on card hover"
				>
					<Switch
						checked={showDeleteButton}
						onCheckedChange={(checked: boolean) =>
							updateSettings({ showDeleteButton: checked })
						}
					/>
				</SettingRow>

				<SettingRow
					label="Open links in new tab"
					description="Clicking cards opens a new browser tab"
				>
					<Switch
						checked={openInNewTab}
						onCheckedChange={(checked: boolean) =>
							updateSettings({ openInNewTab: checked })
						}
					/>
				</SettingRow>
			</SectionCard>

			<SectionCard title="Timezone">
				<SelectRow
					label="Clock timezone"
					description="Timezone used for clock and daylight wallpaper changes"
					value={timezone || "auto"}
					options={COMMON_TIMEZONES}
					onChange={(v) => updateClock({ timezone: v })}
					triggerClassName="min-w-[180px]"
				/>
			</SectionCard>
		</div>
	);
}
