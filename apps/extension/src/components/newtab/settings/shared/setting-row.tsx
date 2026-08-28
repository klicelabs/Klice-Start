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
	if (label) {
		return (
			<div
				className={cn(
					"flex min-h-[44px] items-center justify-between gap-4 border-border/40 border-b px-1 py-2.5 last:border-b-0",
					className,
				)}
			>
				<div className="flex min-w-0 flex-1 flex-col">
					<span className="font-normal text-foreground text-sm leading-snug">
						{label}
					</span>
					{description && (
						<span className="text-muted-foreground text-xs leading-normal">
							{description}
						</span>
					)}
				</div>
				<div className="flex shrink-0 items-center gap-2">{children}</div>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"flex min-h-[44px] items-center justify-between gap-4 border-border/40 border-b px-1 py-2.5 last:border-b-0",
				className,
			)}
		>
			{children}
		</div>
	);
}
