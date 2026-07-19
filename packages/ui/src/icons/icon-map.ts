import type { LucideIcon } from "lucide-react";
import {
	ArrowLeft,
	Bookmark,
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Clock,
	Ellipsis,
	Folder,
	FolderPlus,
	Globe,
	GripVertical,
	Loader,
	Pencil,
	Plus,
	RectangleHorizontal,
	RectangleVertical,
	Search,
	Settings,
	Square,
	Trash2,
	TriangleAlert,
	Upload,
	X,
} from "lucide-react";

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
	ellipsis: Ellipsis,
	bookmark: Bookmark,
	"arrow-left": ArrowLeft,
	// Aspect-ratio glyphs for the Card shape selector.
	square: Square,
	"rectangle-horizontal": RectangleHorizontal,
	"rectangle-vertical": RectangleVertical,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof iconMap;
