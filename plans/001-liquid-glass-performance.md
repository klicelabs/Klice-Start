# 001 — Measure and tune Liquid Glass without visual drift

- **Status**: PLANNED
- **Commit**: `815fad2`
- **Severity**: HIGH
- **Category**: Performance, re-render control, interruptibility, visual-preserving motion
- **Estimated scope**: 6 implementation sub-phases, 1 QA harness, 7–12 source files only when measurements justify them

## Decision

The first implementation must be **harness-only**. A measured hotfix is not justified yet: every runtime impact in the audit is unmeasured. The first source optimization is allowed only after the harness produces a stable baseline and identifies a bottleneck in the same browser/theme/wallpaper scenario that the change is meant to improve.

This plan preserves the current Liquid Glass recipe: SVG displacement, CSS blur/saturation/brightness, transparency, refraction strength, bevels, card-footer material, background treatment, shape geometry, and motion timing remain unchanged unless a measured change is explicitly approved by the gates below. Removing blur, refraction, transparency, or a dense filter because it appears expensive is not an approved shortcut.

## Evidence ledger

The following facts are confirmed by the read-only audit. Runtime consequences are hypotheses until Phase 0 measures them.

| ID | Confirmed fact | Runtime status | First measurement |
| --- | --- | --- | --- |
| F1 | `apps/extension/src/components/newtab/settings/shared/settings-range-slider.tsx:94-99` updates local state and calls `onChange` for every value; `packages/ui/src/lib/hooks/use-slider.ts:125-129` processes every pointer move. | Unmeasured hypothesis: excessive callbacks, React work, CSS-variable writes, or dropped frames during drag. | Slider trace: pointer moves, callbacks, root style mutations, long tasks, frame gaps, next paint. |
| F2 | `appearance-provider.tsx:122-143` writes intensity plus six root CSS variables. | Unmeasured hypothesis: inherited-style recalculation and paint cost. | MutationObserver plus Chrome/Firefox trace; retain exact final variable values. |
| F3 | The audit inventory reports 19 `useAppearance` call sites across 18 files. `DialCard` and `FolderPreviewCard` consume only stable mode/theme values but subscribe to the full context. | Unmeasured hypothesis: intensity changes fan out into broad rerenders. | React Profiler commit counts in a QA-only build, corroborated by browser traces. |
| F4 | `SettingsSidebar` is always mounted from `apps/extension/entrypoints/newtab/App.tsx:852`; root settings state is owned at `App.tsx:372` and descendants render below that root. | Unmeasured hypothesis: closed-panel memory, effect, and commit cost. | Closed DOM subtree count, active observers/listeners, heap where available, and open/close interaction trace. |
| F5 | `packages/ui/src/components/liquid-glass.tsx:49-124` creates cached displacement maps through ImageData loops and `toDataURL`; `:208-234` observes size. Firefox does not render the SVG filter, but map work is not gated by support. | Unmeasured hypothesis: wasted Firefox CPU and observer work; Chrome map cost may also matter on first mount/resize. | Canvas-call shim, ResizeObserver shim, map generation duration, and settled screenshots per browser. |
| F6 | A refractive lens combines SVG displacement with CSS blur/saturation/brightness at `liquid-glass.tsx:259-263, 320-330`. Dense/repeated surfaces are declared at `glass-variants.ts:71-76`, `glass.ts:438-445`, `dial-card.tsx:204-213`, and `folder-preview-card.tsx:206-216`. | Unmeasured hypothesis: nested paint/composite cost. Do not remove or weaken a layer without attribution and visual proof. | Per-interaction global traces plus isolated-background and region/layer inspection. Automated global totals do not provide region/layer attribution; use DevTools or record it as manual/unavailable. |
| F7 | `background-layer.tsx:219-224` applies full-viewport blur/brightness and transitions filter/opacity. | Unmeasured hypothesis: slider retargeting the background filter is a major frame contributor. | Slider trace with the background region isolated. |
| F8 | Search transitions `max-height` and `border-radius` at `unified-search.tsx:610-615` and `opacity`/`transform` at `:707-713`; settings expansion animates `height: "auto"` at `settings-expandable.tsx:41-49`; settings page transitions use Motion `x` at `settings-sidebar.tsx:326-365`; context/popover clip paths are 0.30–0.32 seconds. | Unmeasured hypothesis: layout or main-thread Motion work causes interaction jank. The visual geometry is intentional until measured otherwise. | Per-interaction trace, frame budget, layout/paint/composite attribution, and slow-motion review. |
| F9 | No interaction benchmark or trace harness exists. Existing static outputs are 42 files; JS is 883,674 B raw / 232,152 B Brotli; CSS is 195,593 B raw / 23,215 B Brotli; generated CSS contains 36 `backdrop-filter`, 13 standalone `filter:` declarations, 62 raw `filter` tokens (diagnostic only), and 2 `will-change` occurrences. Existing compile, test, UI type-check, Chrome build, and Firefox build checks passed. | Static facts only; none is a runtime performance result. | Phase 0 establishes runtime numbers and retains the exact standalone declaration count as the single filter guardrail; raw token count explains the old 45-token discrepancy and is not the acceptance baseline. |

## Invariants and non-goals

- Test the `liquid` material in both Light and Dark themes, with a simple background control and a complex local wallpaper. Keep Flat material as a regression control where the harness can select it.
- Cover Chrome and Firefox separately. Firefox must retain its current non-SVG fallback; Chrome must retain settled SVG refraction.
- Preserve DOM semantics, keyboard behavior, focus restoration, pointer capture, final slider values, accessibility attributes, reduced-motion behavior, shape/radius geometry, and all settled visual values.
- Keep the current `MAX_LIQUID_GLASS_BLUR = 12` and `MAX_LIQUID_GLASS_REFRACTION = 48` limits unless a future, separately approved plan changes the visual specification.
- Do not add a dependency, start a dev server, or edit application source during this planning task.
- Do not use `any`, `as any`, `: any`, placeholders, `TODO`, `FIXME`, unused imports/variables, `console.log`, or `void` hacks in implementation code. Use `import type` for type-only imports, external imports first, one query/mutation per file, and named exports.

## Repeatable baseline protocol

Phase 0 creates `.qa/liquid-glass-benchmark.mjs` only. It must run against an already-built extension path supplied as an argument and must not start `.qa/serve.mjs`, any dev server, or any network service. Use a temporary browser profile so localStorage fixtures do not mutate the developer's profile.

The harness must:

1. Launch the requested built target in Chromium or Firefox, open the extension's `newtab.html`, and discover the extension URL from the loaded manifest rather than hard-coding an ID.
2. Seed a deterministic fixture modeled on `.qa/verify-radius.mjs`: at least 24 bookmark cards, 6 folders with up to 4 preview tiles, deterministic gradients/favicon data, and no remote requests. Use `apps/extension/public/wallpapers/tokyo-skyline.avif` for the complex-wallpaper case.
3. Set material to Liquid and run each theme/background case at a fixed 1440×900 viewport, device scale factor 1, with one warm-up run followed by five measured runs. Record median, p95, and IQR; if IQR exceeds 20% of the median, repeat with ten measured runs and mark the case noisy rather than accepting an optimization.
   Each warm-up and measured scenario invocation must reseed and reload the deterministic fixture immediately before its action. Do not measure one scenario from the UI state left by another; an action that needs a non-baseline state must establish and verify that precondition itself.
4. Install page-init shims before the app loads for `HTMLCanvasElement.toDataURL`, `CanvasRenderingContext2D.createImageData`, `putImageData`, and `ResizeObserver`. Count calls and duration without changing returned values.
5. Install `PerformanceObserver` entries for `longtask` and `event`, a `requestAnimationFrame` sampler for frame gaps, a `MutationObserver` for `document.documentElement` style-attribute mutations, and marks/measures around each scripted interaction. Capture one trace artifact per interaction invocation when runtime exists: a Chrome trace where CDP is available, or Firefox page Performance data where the selected automation API has no equivalent trace. Use `PerformanceEventTiming.presentationTime` only when the browser exposes finite values; otherwise report event-to-next-paint as unavailable with its reason.
6. Record screenshots only after the interaction settles and record ten animation checkpoints for motion review. Store machine-readable JSON, one per-interaction trace/performance artifact, and screenshots below `.qa/out/liquid-glass/`; generated output is not application source. Automated trace totals are global to that interaction artifact. Isolated-background and region/layer attribution require the explicit manual checklist below and must be manual/unavailable when DevTools cannot provide it.
7. Record React commit counts with a QA-only Profiler wrapper or an equivalent DevTools Profiler export. If the selected built target cannot expose commit data, report the commit metric as unavailable and do not claim that a context optimization was proven by DOM timing alone.

## Exact before/after benchmark matrix

Run the same matrix before Phase 1 and after every meaningful source optimization. A meaningful optimization is any code change intended to reduce a measured runtime cost. Use the same build, fixture, viewport, browser version, and five-run protocol for before and after.

| Case | Browser | Theme | Background | Interaction traces |
| --- | --- | --- | --- | --- |
| C-L-S | Chrome | Light | Simple deterministic gradient | Idle, intensity 0→100→0 drag, open/close Settings, pane navigation, search open/type/close, card context menu, settings expandable, resize-triggered lens mount |
| C-D-S | Chrome | Dark | Simple deterministic gradient | Same |
| C-L-W | Chrome | Light | `tokyo-skyline.avif` complex wallpaper | Same |
| C-D-W | Chrome | Dark | `tokyo-skyline.avif` complex wallpaper | Same |
| F-L-S | Firefox | Light | Simple deterministic gradient | Same |
| F-D-S | Firefox | Dark | Simple deterministic gradient | Same |
| F-L-W | Firefox | Light | `tokyo-skyline.avif` complex wallpaper | Same |
| F-D-W | Firefox | Dark | `tokyo-skyline.avif` complex wallpaper | Same |

Interaction details are fixed: warm up once; reseed and reload before every scenario invocation; perform five measured repetitions; drag for exactly 1,000 ms with a fixed 240 Hz synthetic pointer schedule and restore Settings to closed before the next scenario; require the Settings-open scenario to observe a closed state before asserting the open transition; navigate through every visible Settings pane once; type a fixed 20-character query; open and close one card context menu and one trigger-anchored popover; expand and collapse the available settings expandable twice; force one viewport resize that changes a refractive element's integer width or height. Report each interaction independently, retain one trace/performance artifact per invocation, and also report the worst case in each matrix row.

## Acceptance thresholds

Every gate compares the same case's before and after result. “No regression” means no guardrail below may worsen by more than 5%; a noisy case cannot pass until its variance is controlled. Automated global trace totals are evidence for global work only. They do not satisfy isolated-background or region/layer attribution; those fields require manual DevTools inspection or an explicit unavailable result.

| Metric | Harness definition | Acceptance threshold |
| --- | --- | --- |
| Frame budget | p95 `requestAnimationFrame` interval during the active interaction | ≤16.7 ms at the fixed 60 Hz test budget, or at least 95% of frames within budget |
| Dropped frames | Expected 60 Hz frames minus observed frames, normalized by expected frames | ≤5% in every case; optimization must improve the target case by ≥20% if it was above the budget before |
| Next paint | p95 event-to-next-paint for the scripted interaction | ≤200 ms, with no >5% regression; a candidate must improve the target interaction by ≥20% if this is the selected bottleneck |
| Long tasks | Total and p95 duration of `longtask` entries in the active window | No >5% regression; selected candidate must reduce total long-task time by ≥20% or reach zero long tasks in the target window |
| Slider stream | Pointer moves, `onValueChange` deliveries, provider-root style mutations, and final value | Pointer updates are applied at most once per animation frame; final value is exact; callback/root-write count falls ≥25% from baseline; no lost terminal event |
| React fan-out | Profiler commits for stable consumers during intensity-only drag | `DialCard`, `FolderPreviewCard`, and all other stable-only consumers record zero intensity-triggered commits; live glass consumers commit no more than once per coalesced frame |
| Settings closed cost | Heavy settings descendant node count and active observer/listener count after close settles | Heavy subtree is absent or detached after the close transition; no Settings pane effect/observer/listener remains active while closed; focus returns to `#settings-trigger` |
| Liquid map work | Canvas pixel/map calls and duration by browser | Firefox performs zero displacement-map generation and zero refractive ResizeObserver work; Chrome settled map count and visual behavior match baseline, with no >5% regression in mount/resize timing |
| Filter/layer cost | Automated per-interaction global trace totals plus manual isolated-background and region/layer attribution | No filter, blur, saturation, brightness, transparency, or refraction layer is removed by default; a measured equivalent change must improve a manually attributed candidate region's selected metric ≥20% and meet visual gates. Global trace totals alone cannot clear this gate; if DevTools attribution is unavailable, leave the regional metric unavailable. |
| Visual stability | Settled screenshot diff at identical viewport, scale, fixture, and browser | Diff ratio ≤0.1%, no structural/semantic difference, and no visible refraction/fallback flash; manual review must approve all eight matrix rows |
| Static guardrails | Build file count and generated asset sizes; exact standalone CSS declarations | 42 output files unless a target's build legitimately changes its manifest; JS/CSS raw and Brotli sizes each stay within +1% of 883,674/232,152 B and 195,593/23,215 B; counts do not increase above 36 `backdrop-filter`, 13 standalone `filter:` declarations, and 2 `will-change` without written evidence. The 62 raw `filter` tokens are diagnostic only and are not a second baseline. |

## Phased implementation plan

### Phase 0 — Build the baseline harness (harness-only, P0)

**Goal and evidence:** Make the eight-row matrix reproducible and expose runtime numbers for F1–F9. No source optimization is allowed in this phase.

**Implementer 0 write scope:** create `.qa/liquid-glass-benchmark.mjs` only. It may write generated JSON/PNG/trace output below `.qa/out/liquid-glass/` during execution. It must not edit `apps/`, `packages/`, `package.json`, lockfiles, `.qa/serve.mjs`, or existing QA checks.

**Validator 0:** a different worker reads the entire harness, verifies the no-server/no-network boundary and deterministic fixture, runs its help/argument validation and one available existing built-target smoke run, and confirms that the JSON contains all matrix rows and all metrics. Validator 0 must not modify the harness.

**Gate:** Baseline is accepted only when all eight rows have five-run results, every warm-up and measured scenario starts from a reseeded baseline, the intensity drag restores Settings closed, the Settings-open scenario proves a closed-to-open transition, noise is reported, Chrome/Firefox capability differences are explicit, each interaction has a trace/performance artifact when runtime exists, and the baseline output preserves the supplied static numbers as guardrails. Automated global trace totals do not count as isolated-background or region/layer attribution; those fields must be manually captured or remain unavailable. Do not proceed to a source phase if the harness cannot distinguish an unsupported metric from a zero value.

**Required checks:** `bun run --cwd apps/extension compile`, `bun test apps/extension/scripts`, and `bun run --cwd packages/ui check-types` are expected to remain green when a built target is available. Do not start a dev server.

### Phase 1 — Coalesce the continuous slider stream (P1)

**Measured trigger:** Proceed only if the baseline shows more than one update per frame, ≥25% excess callback/root-style work, a frame/long-task regression, or p95 next paint above threshold during the intensity drag.

**Implementer 1 write scope:**

- `packages/ui/src/lib/hooks/use-slider.ts`
- An adjacent test file only if the existing UI test runner already supports it; otherwise put behavioral assertions in the Phase 0 harness, not in application source.

The implementer must coalesce pointer-move coordinates to the latest value in one `requestAnimationFrame` callback per frame. Pointer-down remains immediate. Keyboard changes remain immediate. Pointer-up, pointer-cancel, lost capture, and unmount must synchronously flush the latest pending coordinate, cancel the pending frame, and preserve the exact terminal value. Do not debounce keyboard input or change snapping, pointer capture, focus, or range semantics.

The current downstream contract remains unchanged:

```ts
// packages/ui/src/lib/hooks/use-slider.ts:125-129 — current
const onPointerMove = useCallback(
	(event: PointerEvent<HTMLDivElement>) => {
		if (!draggingRef.current || disabled) return;
		commitFromX(event.clientX);
	},
	[disabled, commitFromX],
);
```

```tsx
// apps/extension/src/components/newtab/settings/shared/settings-range-slider.tsx:94-99 — current consumer
onValueChange={(next) => {
	interacting.current = true;
	setLocal(next);
	onChange(next);
	scheduleInteractionFlush();
}}
```

**Validator 1:** read the complete changed hook, enforce the no-slop policy, verify terminal-event and keyboard behavior, run the UI type-check and relevant tests, and run the full eight-row matrix. Validator 1 must not modify code.

**After-change benchmark and gate:** use the exact matrix and thresholds above. Keep the change only if the slider-stream threshold passes, visual screenshots remain within the visual gate, all final values match, and no other interaction regresses by >5%. Otherwise roll back only Phase 1 and retain the baseline.

### Phase 2A — Split stable appearance subscriptions (P1)

**Measured trigger:** Proceed only if the Profiler or trace confirms intensity-only updates commit stable subscribers, especially cards, or if broad context propagation is the selected cause of the slider cost.

**Implementer 2A write scope:**

- `apps/extension/src/components/newtab/appearance-provider.tsx`
- `apps/extension/src/components/newtab/dial-card.tsx`
- `apps/extension/src/components/newtab/folders/folder-preview-card.tsx`

Create stable, named hooks backed by separate memoized contexts with this exact conceptual split:

- `useAppearanceMode()` → `mode`, `material`, `isLiquid`.
- `useAppearanceTheme()` → `colorScheme`, `accentColor`, `resolvedDark`.
- `useAppearanceGlass()` → `glassIntensity`, `glassParams`.
- `useAppearanceContrast()` → `prefersContrastMore`.

Keep `useAppearance()` temporarily as a compatibility export, but the migrated application must not use it for rendering. Preserve `AppearanceContext` values and preserve the root CSS writer exactly, including `--klice-glass-intensity` and all six derived writes:

```tsx
// apps/extension/src/components/newtab/appearance-provider.tsx:133-143 — current contract
root.style.setProperty(
	"--klice-glass-intensity",
	String(glassIntensity / 100),
);
for (const [name, value] of Object.entries(glassCssVariables(glassParams))) {
	root.style.setProperty(name, value);
}
```

`DialCard` and `FolderPreviewCard` must subscribe only to stable mode/theme hooks. Their current subscription is the issue being measured:

```tsx
// dial-card.tsx:56 and folder-preview-card.tsx:78 — current
const { isLiquid, resolvedDark } = useAppearance();
```

**Validator 2A:** read the provider and both card files completely, verify context values cannot change identity on unrelated updates, run type-check/tests, and run the exact intensity-drag matrix. Do not modify code.

**After-change benchmark and gate:** the two card components must have zero intensity-triggered commits, settled screenshots must pass, and slider/frame/next-paint metrics must not regress >5%. If the stable context still commits, stop and report the dependency that remains before migrating more consumers.

### Phase 2B — Migrate the remaining appearance consumers (P1)

**Implementer 2B write scope:** only the following current consumer files; do not edit the provider or card files from Phase 2A:

- `apps/extension/src/components/newtab/empty-landing.tsx`
- `apps/extension/src/components/newtab/page-context-menu.tsx`
- `apps/extension/src/components/newtab/selection-tray.tsx`
- `apps/extension/src/components/newtab/search/unified-search.tsx`
- `apps/extension/src/components/newtab/toolbar/folder-tabs-overflow.tsx`
- `apps/extension/src/components/newtab/toolbar/folder-tabs.tsx`
- `apps/extension/src/components/newtab/toolbar/glass-surface.tsx`
- `apps/extension/src/components/newtab/toolbar/toolbar-actions.tsx`
- `apps/extension/src/components/newtab/toolbar/toolbar-icon-button.tsx`
- `apps/extension/src/components/newtab/toolbar/navigation-toolbar.tsx`
- `apps/extension/src/components/shared/move-to-dialog.tsx`
- `apps/extension/src/components/newtab/settings/panes/advanced-pane.tsx`
- `apps/extension/src/components/newtab/settings/panes/bookmarks-pane.tsx`

Replace every remaining internal `useAppearance()` render subscription with the smallest named hook set needed by that file. `glass-surface.tsx`, toolbar actions, toolbar icon button, navigation toolbar's glass path, and `empty-landing.tsx` may use `useAppearanceGlass()`; stable-only files must not. `navigation-toolbar.tsx` has two current subscriptions and both must be migrated. Do not change classes, inline visual values, markup, or effect behavior.

**Validator 2B:** read every listed file, verify every audit-inventory call site is migrated (recount at execution time because the audit inventory is 19 calls/18 files), enforce no-slop, run type-check/tests, and run the exact matrix. Then a phase-wide validator reads the provider, all migrated consumers, and both cards together for hook identity, imports, and visual recipe coherence.

**After-change benchmark and gate:** stable-only consumers record zero intensity-triggered commits; live glass consumers update at most once per coalesced frame; root CSS values and screenshots remain equivalent; no frame/INP regression >5%.

### Phase 3A — Release the closed Settings subtree (P1)

**Measured trigger:** Proceed only if the baseline confirms non-zero closed Settings subtree/effect/observer cost or meaningful commit/memory cost.

**Implementer 3A write scope:** `apps/extension/entrypoints/newtab/App.tsx` only.

Mount `SettingsSidebar` only while `showSettings || settingsLayoutOpen` is true. Keep it mounted throughout the close transition because `settingsLayoutOpen` remains true until `onLayoutTransitionEnd`. Do not replace the existing `settingsLayoutOpen` layout contract or change `handleSettingsLayoutTransitionEnd`. The target render condition must preserve the current props and callbacks:

```tsx
// App.tsx:852-859 — current
<SettingsSidebar
	open={showSettings}
	layoutOpen={settingsLayoutOpen}
	onClose={() => setShowSettings(false)}
	onLayoutTransitionEnd={handleSettingsLayoutTransitionEnd}
	initialPane={settingsPane}
	initialAction={settingsAction}
/>
```

The closed state must not unmount before focus restoration or the transform close transition finishes. The open path must still set layout-open and show-open in the existing order.

**Validator 3A:** read the whole changed App section, verify open/close state sequencing, focus/keyboard behavior, and no stale callback, run checks, and run the exact matrix. Do not modify code.

**After-change benchmark and gate:** heavy closed Settings descendants and their measurable effects/observers are absent after close settles; `#settings-trigger` regains focus; open/close p95 next paint and screenshots pass; no other case regresses >5%.

### Phase 3B — Preserve Settings motion while removing only proven Motion overhead (P1, conditional)

**Implementer 3B write scope:** `apps/extension/src/components/newtab/settings/settings-sidebar.tsx` only. This worker also completes the Settings file's appearance-hook migration if Phase 2B intentionally left it here; no other consumer file may be edited.

First apply only the named-hook migration. Then, only if the baseline trace attributes the settings page transition's jank to Motion's numeric `x` path, preserve the exact numeric offsets while using a full transform string:

```tsx
// settings-sidebar.tsx:326-365 — current values to preserve
initial={{ opacity: 0, x: paneDirection * 16 }}
animate={{ opacity: 1, x: 0 }}
exit={{ opacity: 0, x: paneDirection * -12 }}
transition={{ duration: DURATION.navigation, ease: EASE.out }}
```

The approved target, for the motion-safe branch only, is equivalent `transform: translateX(<same pixel value>)` plus the same opacity and `DURATION.navigation`/`EASE.out`. Reduced motion must retain no positional movement and the existing instant timing. Do not change search height/radius animation, settings `height: "auto"`, clip paths, or durations in this sub-phase.

**Validator 3B:** read the whole SettingsSidebar file, verify the transform values and reduced-motion branch, run checks, and run the exact matrix. Then a phase-wide validator reads `App.tsx` and `settings-sidebar.tsx` together for mount/transition/focus integration.

**After-change benchmark and gate:** accept the transform conversion only if settings navigation frame/next-paint metrics improve ≥20% in the selected trace and visual/motion review shows the same 16 px entry and 12 px exit trajectory. If not, retain the existing `x` implementation and keep the subtree-release change independently.

### Phase 4 — Gate displacement-map work by actual SVG support (P1)

**Measured trigger:** Proceed only after Phase 0 confirms Firefox invokes map-generation or refractive ResizeObserver work despite the unsupported SVG path.

**Implementer 4 write scope:** `packages/ui/src/components/liquid-glass.tsx` only.

Use the existing `supportsSvgBackdropFilter()` decision at the point where map generation and refractive observation are scheduled. The target is to create a displacement map and observe geometry only for `refract && supported`; Firefox must take the existing CSS fallback branch. Preserve these existing settled branches and caps:

```tsx
// liquid-glass.tsx:258-263 — settled visual contract
const refractionActive = refract && supported && mapUrl !== "";
const backdropFilter = refractionActive
	? `url(#${filterId}) blur(${effectiveBlur}px) saturate(${saturation}) brightness(${effectiveBrightness})`
	: refract
		? `blur(${Math.min(MAX_LIQUID_GLASS_BLUR, effectiveBlur + 2)}px) saturate(${saturation}) brightness(${effectiveBrightness})`
		: undefined;
```

Do not alter the UA policy, map geometry, cache key, texture size, bezel, blur cap, refraction cap, SVG filter graph, rim, veil, or fallback values. Avoid a Chrome first-paint refraction flash: the support state and map scheduling must be ordered so the settled Chrome screenshot is equivalent and the transient branch is reviewed in slow motion.

**Validator 4:** read the entire component, verify SSR/first-client-render behavior, browser fallback semantics, cache behavior, and no-slop; run UI checks and the exact matrix. Do not modify code.

**After-change benchmark and gate:** Firefox canvas map calls and refractive observers are zero; Chrome has equivalent settled refraction and no visible flash; map mount/resize timing does not regress >5%; all visual and static gates pass.

### Phase 5 — Measured paint and motion triage; no speculative filter weakening (P2)

This is a stop-and-measure gate for F6–F8, not permission to simplify the design. The Phase 0 harness must capture per-interaction global evidence, while DevTools/manual inspection must isolate the background and attribute candidate regions/layers before any source edit is proposed. If that attribution is unavailable, no regional filter/layer optimization is approved.

**Ownership if a measured candidate exists:**

- Paint/material worker: `packages/ui/src/lib/glass-variants.ts`, `apps/extension/src/lib/glass.ts`, and `apps/extension/src/components/newtab/background-layer.tsx` only.
- Motion worker: `apps/extension/src/components/newtab/search/unified-search.tsx`, `apps/extension/src/components/newtab/settings/shared/settings-expandable.tsx`, `packages/ui/src/components/motion/context-menu.tsx`, and `packages/ui/src/components/motion/popover-morph.tsx` only.

The paint/material worker may change a recipe only when manual region/layer attribution shows that the named region consumes at least 30% of active paint/composite time and an equivalent implementation is expected to improve the selected metric by ≥20%. Automated global trace totals may corroborate the finding but cannot substitute for region/layer attribution. It must preserve computed blur, saturation, brightness, alpha, refraction, bevel, shape, and settled screenshots. The full-viewport background filter is never disabled during a slider as an unmeasured shortcut.

The motion worker may change a layout or clip-path animation only when the trace identifies layout/paint work as the selected bottleneck and the benchmark improves ≥20%. Search `max-height`/`border-radius`, settings `height: "auto"`, context-menu 0.30 s clip/opacity, and popover-morph 0.32 s clip transitions are not changed merely because they are not transform/opacity-only. Keyboard context-menu behavior must remain instant, and reduced motion must retain its current accessibility behavior.

Each worker gets a different validator immediately after implementation. A phase-wide validator then reads all changed files together. Every accepted candidate reruns the full matrix; any candidate that fails its ≥20% improvement or visual gate is reverted without retaining a partial recipe change.

## Final integration and visual review

After the last accepted optimization, an integration worker runs all existing checks and rebuilds every affected browser target:

```text
bun run --cwd apps/extension compile
bun test apps/extension/scripts
bun run --cwd packages/ui check-types
bun run --cwd apps/extension build
bun run --cwd apps/extension build:firefox
```

The final validator is separate from the implementers. It reads the full diff and benchmark JSON, verifies the static guardrails, confirms there is no dev-server process, and reruns the matrix if any build or source change occurred after the last benchmark.

The visual review must cover Chrome/Firefox × Light/Dark × simple/complex wallpaper at rest and during slider, Settings, search, context-menu, popover, and expandable interactions. Inspect animations at 10% playback and frame-by-frame, and toggle `prefers-reduced-motion`. Reduced motion may remove movement but must retain useful opacity/color/state feedback. Review the next day or after a fresh session if practical.

The final Impeccable/Emil review uses this required Before/After table and rejects any result that trades visual fidelity for an unmeasured number:

| Before | After | Why |
| --- | --- | --- |
| Every audit runtime consequence is unmeasured; static counts are the only available numbers. | Each accepted change has same-matrix before/after p95, frame, long-task, commit, map, and screenshot evidence. | Performance work must fix the measured bottleneck, not an imagined one. |
| Pointer moves reach `commitFromX` and the settings callback for every incoming event. | Pointer moves apply the latest coordinate at most once per frame and flush the terminal coordinate synchronously. | Coalesce high-frequency work without changing slider semantics. |
| Stable card consumers subscribe to the full appearance context. | Stable cards subscribe only to stable mode/theme contexts; live glass consumers alone receive intensity changes. | Reduce rerender fan-out without changing the material recipe. |
| Settings descendants remain mounted while closed. | The heavy subtree is mounted through the close transition and released after it settles, with focus restoration intact. | Remove closed cost without changing spatial or accessibility behavior. |
| Firefox may generate unused displacement maps before the support gate is applied. | Firefox skips unsupported map/observer work while retaining the exact existing CSS fallback. | Remove work that cannot affect Firefox pixels. |
| Dense filters, background blur, layout height, and clip paths are merely suspected costs. | They remain unchanged unless a trace attributes cost and an equivalent visual-preserving change clears the ≥20% gate. | Never weaken Liquid Glass as an unmeasured shortcut. |

## Risks and rollback

| Risk | Detection | Rollback |
| --- | --- | --- |
| rAF coalescing drops the final pointer value or changes keyboard behavior. | Terminal-value assertions, keyboard trace, and pointer cancel/lost-capture tests fail. | Revert Phase 1 only; keep the baseline harness. |
| A split context leaves a live value in a stable hook or creates unstable provider identities. | Profiler commits remain, stale optical values appear, or type/visual checks fail. | Revert Phase 2A/2B as a unit; do not add memoization blindly. |
| Settings unmount happens before close transition/focus restoration. | Focus is lost, `onTransitionEnd` does not fire, or screenshot trajectory changes. | Restore always-mounted behavior; retain only benchmark evidence. |
| Support gating causes a Chrome first-paint fallback flash or changes Firefox fallback pixels. | Slow-motion review, screenshot diff, or browser-specific visual review fails. | Revert Phase 4; keep the existing capability function and map order. |
| A dense-filter/background experiment weakens refraction, transparency, or wallpaper contrast. | Computed-style comparison, screenshot diff, or Emil/Impeccable review fails. | Revert the experiment wholesale; do not tune thresholds to excuse visual drift. |
| Browser/version noise makes p95 comparisons unstable. | IQR exceeds 20% of median or browser capability is unavailable. | Increase repetitions, report unavailable metrics explicitly, and pause source optimization. |

## Required animation plan documents

Because this is a single synthesized plan, `plans/001-liquid-glass-performance.md` is the one self-contained animation/performance implementation document required by `improve-animations`. No additional per-finding animation plan is required. `plans/README.md` records the execution order and status. Any future Phase 5 visual motion change that cannot be specified with the exact measured target and visual gates above must receive a new, separately reviewed plan rather than an improvised edit.
