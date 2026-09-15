# Glass Visual Regression Checklist (§44)

Manual pass per release, in Glass AND Flat × Light AND Dark.

## Material purity
- [ ] Flat: no `backdrop-blur`, no `LiquidGlass`, no glass washes anywhere.
- [ ] Glass: toolbar, search, menus, tray, picker, dialog-X follow material.
- [ ] Settings bodies + dialog bodies stay flat (only chrome is glass).
- [ ] No `blur(` value above 12px; refraction stays limited to hero/toolbar.

## Surfaces
- [ ] Collapsed search = hero refract; expanded = dense calm panel.
- [ ] Menus/dropdowns dense; tooltip CSS-only, compact, no refract.
- [ ] Tonal family (density rides `--klice-glass-intensity`, floors preserve identity): Light restrained veils (toolbar 34→44 / hero 24→32 / dense menus/search/footers 54→62) + black primary ink; Dark smoked veils (toolbar 8→16 / hero 6→14 / dense menus/search/footers 38→46) + white primary ink. Dense blur is 8→12px, with the default near 10.4px. Same roles, different density — never a gray middle.
- [ ] Top scroll fade: white diffusion in Light, dark diffusion in Dark.
- [ ] Bookmark body has no glass; footer uses the shared dense material with a natural transition.
- [ ] Subfolder body stays clear and footer uses the same shared dense material; no ad hoc second recipe.

## Foreground & type
- [ ] Glass Light surfaces use opaque black primary ink; Glass Dark uses opaque white primary ink. Secondary/muted/disabled levels are the only softened variants.
- [ ] Selected/keyboard row is the accent row; hover is a neutral wash.
- [ ] Menu rows 13px regular; tabs active medium / inactive regular.
- [ ] `::selection` follows `--selection` (accent).

## Controls & motion
 - [ ] Material segmented Flat|Glass (labels never clip); Flat hides all Glass UI. Glass shows compact rectangular live preview (current wallpaper + toolbar pill + integrated beUI bubble intensity slider, drag bubble + row readout). Wallpaper card: thumb opens library, pencil overlay, in-image title, Opacity/Blur/Brightness in-card. Solid + Pexels live on the Wallpaper page.
- [ ] Intensity 0/60/100 matches the mapping in `glass.ts` and `glass-variants.ts` headers.
- [ ] Transform/opacity only — blur/backdrop/refraction never animate.
- [ ] `prefers-reduced-motion` calm; `prefers-contrast: more` dense + strong ink.

## Perf
- [ ] Grid scroll + menu/search open hold 60fps (refract count stays small).
- [ ] `tsc --noEmit` clean for `@klice-start/ui` and the extension.

## Architecture (where the system lives)

```text
KliceTheme (appearance-provider.tsx)
├── material: glass | flat · appearance: system | light | dark
├── accent (+ --selection) · glassIntensity 0…100 (default 60)
└── glassParams (derived optical recipe) · prefersContrastMore
         ↓  glassIntensityParams() — apps/extension/src/lib/glass.ts
Klice Material Tokens (tokens.css, glass-variants.ts, shapes.ts, surface.ts)
         ↓  glassTierVariant(): hero | surface | search | menu | tooltip | nested
glasscn (LiquidGlass / GlassButtonGroup / GlassIcon) · shadcn/Base UI
(missing glasscn primitives = shadcn + role surface, never invented imports)
         ↓
Product components (no raw Glass recipes outside lib/glass.ts + GlassSurface)
```

## Surface matrix (Apple rule → implementation → file)

| Surface | Rule | Implementation |
|---|---|---|
| Toolbar cluster (Back/Forward, Tabbar, Settings, compact Search) | isolated `toolbar` role: same lens as hero, own restrained veil (Light 34→44 / Dark smoked 8→16), defined hairline edge | `toolbar` → liquid-refract + `glassLensVeil()` · `toolbar/*`, never touches hero/search/menu |
| Expanded Search | denser isolated surface, calm behind text | `search` → dense veil, adaptive ink, results divider · `search/unified-search.tsx` |
| Search results | clear title, restrained meta, icon column, accent selection, no uppercase labels | 14px regular + 11px secondary, accent row · `search/unified-search.tsx` |
| Context Menu | squircle, comfortable rows, accent highlight, subtle separators | 22px outer, 13px regular rows, accent pill (single indicator) · `ui/motion/context-menu.tsx`, `glassMenu`/`glassDropdownItem` |
| Tooltip | compact, dense, readable, no lens | `glassTooltip()` 12px regular, shared dense material · `lib/glass.ts` (today's only product tooltips live in the Flat Settings body and correctly stay Flat; wallpaper-anchored tooltips must render through this surface, never native `title` text) |
| Folder picker | grouped controls, restrained separators | Flat trigger (Flat dialog), dense popup, accent focus · `shared/folder-tree-picker.tsx` |
| Bookmark cards | content, never Glass under images | body = screenshot/gradient; footer = shared dense `liquid-menu` material · `dial-card.tsx` |
| Subfolder cards | body keeps surface role; footer uses the SAME dense material as bookmarks | clear body + shared dense footer material · `folders/folder-preview-card.tsx` |
| Selection Tray | concentric shelf, one primary action | dense tier, adaptive ink, accent Move-here · `selection-tray.tsx` |
| Settings / dialogs | bodies Flat, chrome follows material | 34px Glass hero Back/Close/X in Glass mode · `settings-sidebar.tsx`, `ui/dialog.tsx` (`closeGlass`) |

## §12 Intensity preview matrix
- [ ] Appearance Light / Dark / System × Material Flat / Glass.
- [ ] Intensity clear (0) / mid (60) / tinted (100): preview + chrome update live, no save.
- [ ] Wallpaper white / bright photo / dark photo / colourful.
- [ ] Surfaces follow: toolbar, search, menu, tooltip, footer, subfolder, tray.
