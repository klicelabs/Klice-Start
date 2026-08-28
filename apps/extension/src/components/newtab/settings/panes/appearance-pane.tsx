import { Input } from "@klice-start/ui/components/input";
import { Switch } from "@klice-start/ui/components/switch";
import { useSetupStore } from "../../../../stores/setup-store";
import type { AppearanceMode } from "../../../../types";
import { SectionCard } from "../shared/section-card";
import { SelectRow } from "../shared/select-row";
import { SettingRow } from "../shared/setting-row";
import { SliderRow } from "../shared/slider-row";

const THEME_OPTIONS = [
	{ value: "liquid", label: "Liquid (Frosted Glass)" },
	{ value: "classic", label: "Classic (Solid Flat)" },
] as const;

export function AppearancePane() {
	const appearanceMode = useSetupStore((s) => s.settings.appearanceMode);
	const clock = useSetupStore((s) => s.settings.clock);
	const greeting = useSetupStore((s) => s.settings.greeting);
	const updateSettings = useSetupStore((s) => s.updateSettings);
	const updateClock = useSetupStore((s) => s.updateClock);
	const updateGreeting = useSetupStore((s) => s.updateGreeting);

	return (
		<div className="space-y-2">
			<SectionCard title="Material & Theme">
				<SelectRow
					label="Theme style"
					description="Rich translucent glass vs clean opaque surfaces"
					value={appearanceMode}
					options={THEME_OPTIONS}
					onChange={(v) =>
						updateSettings({ appearanceMode: v as AppearanceMode })
					}
				/>
			</SectionCard>

			<SectionCard title="Clock & Time">
				<SettingRow
					label="Enable clock"
					description="Display time and date on the new tab page"
				>
					<Switch
						checked={clock.enabled}
						onCheckedChange={(checked: boolean) =>
							updateClock({ enabled: checked })
						}
					/>
				</SettingRow>

				{clock.enabled && (
					<>
						<SettingRow
							label="24-hour time format"
							description="Use 24-hour time instead of 12-hour AM/PM"
						>
							<Switch
								checked={clock.format24}
								onCheckedChange={(checked: boolean) =>
									updateClock({ format24: checked })
								}
							/>
						</SettingRow>

						<SettingRow
							label="Show seconds"
							description="Display live running seconds in the clock"
						>
							<Switch
								checked={clock.showSeconds}
								onCheckedChange={(checked: boolean) =>
									updateClock({ showSeconds: checked })
								}
							/>
						</SettingRow>

						<SliderRow
							label="Clock scale"
							description="Relative size of the clock widget"
							value={clock.size}
							suffix="%"
							min={60}
							max={200}
							step={5}
							onChange={(v) => updateClock({ size: v })}
						/>
					</>
				)}
			</SectionCard>

			<SectionCard title="Greeting">
				<SettingRow
					label="Personal greeting"
					description="Show time-aware greeting above the clock"
				>
					<Switch
						checked={greeting.enabled}
						onCheckedChange={(checked: boolean) =>
							updateGreeting({ enabled: checked })
						}
					/>
				</SettingRow>

				{greeting.enabled && (
					<div className="px-1 pt-2 pb-3">
						<label
							htmlFor="greeting-name-input"
							className="mb-1.5 block font-medium text-muted-foreground text-xs"
						>
							Your name
						</label>
						<Input
							id="greeting-name-input"
							placeholder="e.g. Alex"
							value={greeting.name}
							onChange={(e) => updateGreeting({ name: e.target.value })}
							className="h-9 rounded-lg border-border/60 bg-secondary/50 px-3 text-foreground text-sm"
						/>
					</div>
				)}
			</SectionCard>
		</div>
	);
}
