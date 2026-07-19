import { cn } from "../../lib/utils";

interface SvgIconProps {
	svgXml: string | null;
	className?: string;
	alt?: string;
}

/**
 * Renders the raw SVG XML fetched from SVGL inside a constrained container.
 *
 * **Sanitisation:**
 * Strips `width`, `height`, `fill`, and `stroke` from the root `<svg>` element
 * so the icon fills its container and inherits colour from the parent.
 * Tailwind classes on the wrapper control sizing via `w-* h-*`.
 */
export function SvgIcon({ svgXml, className, alt }: SvgIconProps) {
	if (!svgXml) return null;

	const sanitised = svgXml
		// Remove width/height so the SVG fills its container
		.replace(/<svg([^>]*?)\s(width|height)=["'][^"']*["']/gi, "<svg$1")
		// Remove fill and stroke from the root svg tag so we can control colour
		// via CSS (parent text‑color or utility classes)
		.replace(/<svg([^>]*?)\s(fill|stroke)=["'][^"']*["']/gi, "<svg$1")
		// Clean up leftover double spaces from removals
		.replace(/(\s){2,}/g, " ")
		// Ensure viewBox is preserved
		.replace(/<svg(\s)/, '<svg preserveAspectRatio="xMidYMid meet" ');

	return (
		<span
			className={cn("inline-flex items-center justify-center", className)}
			role="img"
			aria-label={alt ?? ""}
			dangerouslySetInnerHTML={{ __html: sanitised }}
		/>
	);
}
