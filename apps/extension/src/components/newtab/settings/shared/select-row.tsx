import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@klice-start/ui/components/select";
import { SettingRow } from "./setting-row";

interface SelectOption<T extends string> {
	value: T;
	label: string;
	icon?: React.ReactNode;
}

interface SelectRowProps<T extends string> {
	label: string;
	description?: string;
	value: T;
	options: readonly SelectOption<T>[];
	onChange: (value: T) => void;
	triggerClassName?: string;
}

export function SelectRow<T extends string>({
	label,
	description,
	value,
	options,
	onChange,
	triggerClassName = "min-w-[130px]",
}: SelectRowProps<T>) {
	return (
		<SettingRow label={label} description={description}>
			<Select
				value={value}
				onValueChange={(v) => v && onChange(v as T)}
				items={options}
			>
				<SelectTrigger
					size="sm"
					className={triggerClassName}
					aria-label={label}
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map((opt) => (
						<SelectItem key={opt.value} value={opt.value}>
							<span className="flex items-center gap-2">
								{opt.icon}
								{opt.label}
							</span>
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</SettingRow>
	);
}
