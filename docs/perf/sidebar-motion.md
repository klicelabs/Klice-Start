# Settings motion isolation — 2026-11-05

The Settings drawer now slides over Home. It no longer reserves an animated
lane or shrinks the dashboard. This is an intentional interaction change:
content under the drawer is covered until it closes, while the rest of Home
remains interactive. Tiles and wallpaper keep their original size and position.

## Cause and experiment

The previous 280 ms transition interpolated four padding values on Home's
parent and its frame radius. With 30 Flat icons, the frame took 5–17 distinct
widths during each transition and Chromium recorded 10–37 layout passes. With
300 Glass icons, warm opening/closing p95 frame gaps were about 42–50 ms.
The first opening had a 283 ms maximum main-thread frame gap in that run.

An injected-style A/B that removed the inset/radius animation reduced warm
Flat transitions to about 8.5 ms p95 with 300 icons. This falsifies Glass as
the sole cause: live dashboard layout was expensive even in Flat.

The fix isolates layout/paint to a constant-width drawer and animates only its
transform with the existing duration and drawer curve. Home's frame and layout
provider no longer subscribe to the Settings phase; toolbar visibility remains
a separate small subscriber. Visible tile filters remain active; offscreen
filter culling stays in place. No per-tile animation or layout measurement is
added for opening Settings.

## Library choice and lifecycle

[Motion's performance guide](https://motion.dev/docs/performance) distinguishes
compositor properties from layout-triggering properties. Wrapping the old
padding animation in Motion would retain its layout cost. CSS transform
transitions already provide native playback and reversal for this fixed path;
Motion remains responsible for transitions between Settings pages and controls.

Settings starts outside Home's initial React render, prepares at browser idle,
then retains its offscreen controls. This supersedes the earlier P2 decision
to unmount Settings on every close; context menus still unmount. The tradeoff
is retained DOM/subscriptions and idle preparation work in each new tab.
A click before preparation paints the shell first and schedules controls after
that first paint. This does not promise constant-time rendering of arbitrary
Settings content, such as a large bookmark manager.

Completion owns inert/focus together, with a cancellation fallback. Escape
runs after nested controls and before Home's selection handler. Motion 13.2.0's
installed `useReducedMotion` snapshots the preference at mount; this retained
drawer uses a live media-query subscription so changing the preference cannot
leave a visible panel inert while waiting for a nonexistent transition.

## Verification and limits

Run against a clean production build (preserve release ZIPs before cleaning):

```powershell
node scripts/verify-icon-glass-settings-e2e.mjs 30 icon
node scripts/verify-icon-glass-settings-e2e.mjs 300 icon
node scripts/verify-icon-glass-settings-e2e.mjs 1000 icon
node scripts/verify-icon-glass-settings-e2e.mjs 30 icon --cold
node scripts/verify-icon-glass-settings-e2e.mjs 1000 card
node scripts/verify-icon-glass-settings-e2e.mjs 300 icon --no-surface
```

Each invocation covers Flat/Glass × Light/Dark, two open/close cycles, stable
Home geometry and filters, working controls, nested Select Escape, focus return,
interrupted close/reopen, and a live reduced-motion change. The 30-item run also
captures desktop/narrow layouts. Results go to ignored `scripts/results/`.

The first 1,000-icon run kept exactly one Home width in every transition.
Warm samples were mostly 8.4–8.5 ms p95, with outliers up to 25 ms; the first
Flat/Light opening still had a 133 ms maximum gap and 58.4 ms p95. These are
headless Chromium **main-thread rAF gaps**, not presented GPU frames. A targeted
profile also found GC and native work in cold gaps. No universal zero-jank or
GPU FPS claim follows from these measurements. Firefox/GPU hardware validation
and worst-case bookmark-manager mounting are not established by this probe.
