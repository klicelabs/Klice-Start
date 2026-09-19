import { glassCardFooter } from "./glass";

export type CardFooterVariant = "glass" | "fade";

/**
 * Card mode can swap its title treatment without touching card layout.
 * Keep the established Glass footer behind the same seam for a quick rollback.
 */
export const CARD_FOOTER_VARIANT: CardFooterVariant = "fade";

export function cardFooterMaterial(
	isLiquid: boolean,
	variant: CardFooterVariant = CARD_FOOTER_VARIANT,
): string {
	return variant === "glass" ? glassCardFooter(isLiquid) : "card-footer-fade";
}
