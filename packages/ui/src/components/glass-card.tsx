"use client";

import { type HTMLAttributes, forwardRef } from "react";

import { type FrostGlassVariant, glassVariantStyles } from "@perch/ui/lib/glass-variants";
import { cn } from "@perch/ui/lib/utils";

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  /**
   * Material of the card surface. `liquid` uses glasscn's rich CSS glass
   * material (backdrop blur + gradient sheen + ambient drift); `flat` falls
   * back to an opaque shadcn card. Any other frost variant is honored too.
   */
  variant?: FrostGlassVariant | "flat";
};

/**
 * A glasscn card surface. This is the single component the Speed Dial uses for
 * every card-shaped tile (site cards, folder tiles, the "New Folder"
 * placeholder), so transparency is always managed by the library and never by
 * ad-hoc bg-white/x + backdrop-blur in feature code.
 *
 * Rounding is left to the consumer (via className) so the card can inherit the
 * user's configurable corner radius.
 */
const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(function GlassCard(
  { variant = "liquid", className, ...props },
  ref,
) {
  const material =
    variant === "flat"
      ? "border border-border bg-card shadow-sm"
      : glassVariantStyles[variant];

  return (
    <div
      ref={ref}
      data-slot="glass-card"
      data-glass-variant={variant}
      className={cn("relative overflow-hidden", material, className)}
      {...props}
    />
  );
});

export { GlassCard, type GlassCardProps };
