import { useId } from "react";
import { cn } from "../../../../lib/utils";

interface SettingRowProps {
	children: React.ReactNode;
	className?: string;
	description?: string;
	label?: React.ReactNode;
}

export function SettingRow({
	children,
	className,
	description,
	label,
}: SettingRowProps) {
	const labelId = useId();

	if (label) {
		const descriptionId = description ? `${labelId}-description` : undefined;

		return (
			<fieldset
				className={cn(
					"m-0 flex min-h-[44px] min-w-0 items-center justify-between gap-4 border-0 border-border/40 border-b p-0 px-1 py-2.5 last:border-b-0 max-[480px]:flex-wrap max-[480px]:gap-2",
					className,
				)}
				aria-labelledby={labelId}
				aria-describedby={descriptionId}
			>
				<div className="flex min-w-0 flex-1 flex-col">
					<span
						id={labelId}
						className="font-medium text-[13px] text-foreground leading-snug"
					>
						{label}
					</span>
					{description && (
						<span
							id={descriptionId}
							className="text-muted-foreground text-xs leading-normal"
						>
							{description}
						</span>
					)}
				</div>
				<div className="flex shrink-0 items-center gap-2 max-[480px]:ml-auto max-[480px]:max-w-full">
					{children}
				</div>
			</fieldset>
		);
	}

	return (
		<div
			className={cn(
				"flex min-h-[44px] items-center justify-between gap-4 border-border/40 border-b px-1 py-2.5 last:border-b-0 max-[480px]:flex-wrap max-[480px]:gap-2",
				className,
			)}
		>
			{children}
		</div>
	);
}
