import {
  Plus,
  Search,
  Settings,
  Upload,
  X,
  FolderPlus,
  GripVertical,
  Clock,
  Folder,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Check,
  Globe,
  Pencil,
  Trash2,
  TriangleAlert,
  Loader,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Semantic icon name → LucideIcon mapping.
 *
 * NUNCA importar lucide-react diretamente nos componentes da extensão.
 * Use <Icon name="settings" /> de @perch/ui/icons/icon.
 */
export const iconMap = {
  plus: Plus,
  search: Search,
  settings: Settings,
  upload: Upload,
  x: X,
  "folder-plus": FolderPlus,
  grip: GripVertical,
  clock: Clock,
  folder: Folder,
  "chevron-right": ChevronRight,
  "chevron-left": ChevronLeft,
  "chevron-down": ChevronDown,
  check: Check,
  globe: Globe,
  pencil: Pencil,
  trash: Trash2,
  alert: TriangleAlert,
  loader: Loader,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof iconMap;
