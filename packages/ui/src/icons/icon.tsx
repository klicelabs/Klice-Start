import type { LucideProps } from "lucide-react";
import { type IconName, iconMap } from "./icon-map";

export type { IconName };

interface IconProps extends LucideProps {
	name: IconName;
}

export function Icon({ name, ...props }: IconProps) {
	const LucideIcon = iconMap[name];
	if (!LucideIcon) return null;
	return <LucideIcon {...props} />;
}
