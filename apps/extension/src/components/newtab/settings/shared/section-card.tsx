import { cn } from "../../../../lib/utils";

interface SectionCardProps {
	title?: string;
	description?: string;
	children: React.ReactNode;
	className?: string;
	action?: React.ReactNode;
}

export function SectionCard({
	title,
	description,
	children,
	className,
	action,
}: SectionCardProps) {
	return (
		<div className="flex flex-col">
			{(title || action) && (
				<div className="mb-2 flex items-center justify-between px-1">
					<div className="flex flex-col">
						{title && (
							<h3 className="font-semibold text-[13px] text-foreground tracking-tight">
								{title}
							</h3>
						)}
						{description && (
							<p className="mt-0.5 text-muted-foreground/80 text-xs">
								{description}
							</p>
						)}
					</div>
					{action && <div>{action}</div>}
				</div>
			)}
			<div
				className={cn(
					"relative mb-5 overflow-hidden rounded-xl border border-border/50 bg-card/60 px-4 py-0.5 shadow-sm",
					className,
				)}
			>
				{children}
			</div>
		</div>
	);
}
