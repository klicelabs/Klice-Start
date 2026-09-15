"use client";

import { type FrostGlassVariantProp, glassVariantStyles } from "@klice-start/ui/lib/glass-variants";
import { cn } from "@klice-start/ui/lib/utils";

import { Button } from "./button";
import { LiquidGlass } from "./liquid-glass";

type GlassButtonProps = React.ComponentProps<typeof Button> & FrostGlassVariantProp;

/**
 * Glass-styled button.
 *
 * No cursor override on either branch: Klice Start uses the platform arrow
 * cursor for normal clickable UI. `Button` renders a real `<button>`, which
 * the UA stylesheet already gives an arrow, so nothing needs forcing here.
 */
function GlassButton({ className, glassVariant = "liquid-refract", ...props }: GlassButtonProps) {
  if (glassVariant === "liquid-refract") {
    return (
      <LiquidGlass blur={8}>
        <Button
          data-slot="glass-button"
          data-glass-variant={glassVariant}
          className={cn("text-foreground bg-transparent border-0 shadow-none", className)}
          {...props}
        />
      </LiquidGlass>
    );
  }

  return (
    <Button
      data-slot="glass-button"
      data-glass-variant={glassVariant}
      className={cn("text-foreground", glassVariantStyles[glassVariant], className)}
      {...props}
    />
  );
}

export { GlassButton };
