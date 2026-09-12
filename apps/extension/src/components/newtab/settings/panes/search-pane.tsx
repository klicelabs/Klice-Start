import { Input } from "@klice-start/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@klice-start/ui/components/select";
import { Switch } from "@klice-start/ui/components/switch";
import { useSvgIcon } from "../../../../hooks/use-svg-icon";
import { SEARCH_ENGINES } from "../../../../lib/constants";
import { SEARCH_ENGINE_TO_SVGL } from "../../../../lib/svgl-mapping";
import { useSetupStore } from "../../../../stores/setup-store";
import { SvgIcon } from "../../../shared/svg-icon";
import { SectionCard } from "../shared/section-card";
import { SelectRow } from "../shared/select-row";
import { SettingRow } from "../shared/setting-row";

function EngineIcon({ engineId }: { engineId: string }) {
	const svglTitle = SEARCH_ENGINE_TO_SVGL[engineId];
	const { svgXml, isLoading } = useSvgIcon(svglTitle ?? null);

	if (isLoading || !svgXml) {
		const label = SEARCH_ENGINES.find((e) => e.id === engineId)?.label ?? "?";
		return (
			<span className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-muted font-bold text-[9px] text-muted-foreground">
				{label.charAt(0)}
			</span>
		);
	}

	return (
		<SvgIcon svgXml={svgXml} className="size-4 shrink-0" alt={svglTitle} />
	);
}

const ICON_MODE_OPTIONS = [
	{ value: "search", label: "Classic magnifying glass" },
	{ value: "engine", label: "Active engine logo" },
] as const;

export function SearchPane() {
	const search = useSetupStore((s) => s.settings.search);
	const updateSearch = useSetupStore((s) => s.updateSearch);

	const activeEngine =
		SEARCH_ENGINES.find((e) => e.id === search.engine) ?? SEARCH_ENGINES[0];

	return (
		<div className="space-y-2">
			<SectionCard title="Search bar">
				<SettingRow label="Show search bar">
					<Switch
						aria-label="Show search bar"
						checked={search.enabled}
						onCheckedChange={(checked: boolean) =>
							updateSearch({ enabled: checked })
						}
					/>
				</SettingRow>
			</SectionCard>

			{search.enabled && (
				<SectionCard title="Search configuration">
					<SettingRow label="Default search engine">
						<Select
							value={search.engine}
							onValueChange={(v) => v && updateSearch({ engine: v })}
						>
							<SelectTrigger
								size="sm"
								className="min-w-[140px]"
								aria-label="Search engine"
							>
								<span className="flex items-center gap-2">
									<EngineIcon engineId={search.engine} />
									<SelectValue />
								</span>
							</SelectTrigger>
							<SelectContent>
								{SEARCH_ENGINES.map((engine) => (
									<SelectItem key={engine.id} value={engine.id}>
										<span className="flex items-center gap-2">
											<EngineIcon engineId={engine.id} />
											{engine.label}
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</SettingRow>

					<SelectRow
						label="Input leading icon"
						value={search.iconMode}
						options={ICON_MODE_OPTIONS}
						onChange={(v) =>
							updateSearch({ iconMode: v as "engine" | "search" })
						}
						triggerClassName="min-w-[180px]"
					/>

					<div className="border-border/40 border-t px-1 pt-3 pb-2">
						<label
							htmlFor="search-placeholder-input"
							className="mb-1 block font-medium text-muted-foreground text-xs"
						>
							Custom placeholder text
						</label>
						<Input
							id="search-placeholder-input"
							placeholder={`Search with "${activeEngine.label}"`}
							value={search.placeholder}
							onChange={(e) => updateSearch({ placeholder: e.target.value })}
							className="h-9 rounded-lg border-border/60 bg-secondary/50 px-3 text-foreground text-sm"
						/>
						<p className="mt-1.5 px-0.5 text-muted-foreground/80 text-xs">
							Leave empty to automatically name the active search engine.
						</p>
					</div>
				</SectionCard>
			)}
		</div>
	);
}
