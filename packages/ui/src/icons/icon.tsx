import type { LucideProps } from "lucide-react";
import { iconMap, type IconName } from "./icon-map";

interface IconProps extends LucideProps {
  name: IconName;
}

export function Icon({ name, ...props }: IconProps) {
  const LucideIcon = iconMap[name];
  if (!LucideIcon) return null;
  return <LucideIcon {...props} />;
}
