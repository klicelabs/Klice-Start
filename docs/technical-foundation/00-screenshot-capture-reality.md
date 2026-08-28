# 00 — Screenshot Capture Reality

## Objective
Establish the hard platform truth about how Klice Start can and cannot obtain website screenshots, and derive from it the product and data decisions that every later technical document depends on. This document exists to prevent the team from designing a data model, a Free/Pro boundary, or a marketing promise around a capability the browser does not grant.

## Scope
What the extension platform permits and forbids for screenshot capture, the capture triggers that exist today, the decision on what the MVP promises, the decision on where universal-link thumbnails belong, and the resulting constraints handed to the data model and the Free/Pro boundary.

## Out of Scope
Implementation code, headless-render vendor selection, image storage schema, sync mechanics. Those belong to [System Architecture](./01-system-architecture.md), [Data Model](./02-data-model.md), and later documents. This document decides *what is true and what we promise*, not *how it is built*.

## Owners
Founders, Head of Product, Engineering Leadership.

## Dependencies
- Product side: the Free/Pro split and the "real screenshots, not favicons" promise in [Product Strategy](../product-foundation/02-product-strategy.md) and [Product Requirements](../product-foundation/08-product-requirements.md).
- This document is a hard dependency of [Data Model](./02-data-model.md) and [Free/Pro Boundary](./06-free-pro-boundary.md). Neither may be finalized before the decisions here are accepted.

## Cross-References
Read this before designing any surface, table, or paid tier that assumes a card has an image. When a screenshot expectation conflicts with a platform limit, the limit wins and this document records why.

## Status
Draft — first technical-foundation document. Decisions here are proposed for acceptance; the rest of the technical suite is blocked on them.

## Version
0.1

## Last Review
2026-07-14

---

## Reality Note
This is the first document of a **target SaaS architecture**, not a description of the shipped extension. Today Klice Start is a single-device, local-only Manifest V3 extension with no backend, no accounts, and no build step (see [CLAUDE.md](../../CLAUDE.md)). Where this document describes server-side rendering, cloud storage, or paid tiers, it is describing where Klice Start intends to go — the same "durable target, not current reality" stance the product foundation README takes. The **platform limits** described below, however, are true today and will remain true; they are the fixed points the strategy must respect.

---

## The Platform Truth

A Manifest V3 extension can capture a screenshot of exactly one thing: **the visible area of the currently active tab**, via `chrome.tabs.captureVisibleTab`. This is the only screenshot primitive the platform exposes, and it carries three non-negotiable conditions:

1. **The tab must be active and focused.** The API captures what is on screen. A backgrounded tab, a tab in another window, or a URL the user is not looking at cannot be captured.
2. **The user must have navigated there.** The extension cannot render an arbitrary URL on the user's behalf to photograph it.
3. **Capture is opportunistic, not on-demand.** The image exists only because the user happened to visit the page while the extension was watching.

This is a security boundary, not a missing feature. It will not be lifted by a permission, a flag, or a cleverer API call.

## Rejected Workarounds
The following have been considered and are rejected as permanent dead ends, not "later" items:

- **Hidden iframe rendering.** Breaks on `X-Frame-Options` / CSP for exactly the high-value sites users save most (Google, banks, GitHub, social). Produces blank or refused frames.
- **`tabs.create` then capture then close.** Flashes real tabs at the user, steals focus, and violates the calm/ownership promise in [Company Vision](../product-foundation/01-company-vision.md). Racy and user-hostile.
- **Fetching the page server-side from the extension and rendering HTML.** Loses auth state, misses client-rendered content, and reproduces none of the visual truth a screenshot promises.

Attempting any of these is a defect, not an optimization.

## What Exists Today
Two capture triggers are already built and working within the platform truth:

1. **Explicit save.** When the user saves the active tab (toolbar popup, context menu, or the keyboard command), the extension captures the visible tab immediately and attaches the image to the new card.
2. **First-visit auto-capture.** For a card that has no image yet (typically an imported bookmark), the service worker watches for the user to *actually visit* that URL, waits for the page to settle, confirms the tab is still active on the expected URL, and captures. It is debounced and URL-canonicalized to avoid duplicates and wrong-page captures.

Both are honest: an image exists only for a page the user has genuinely viewed.

## The Consequence
This splits every card into two states, and the split is structural, not cosmetic:

- **Visited cards** can have a real, current screenshot.
- **Unvisited cards** — imported favorites the user never opened, or a fresh setup on a new device — **cannot**, by any local means. The best the client can offer them is a favicon or a generated placeholder.

"Real screenshots of every saved site" is therefore **not deliverable locally**. The product must either soften that promise or move the missing capability to a place where the platform limit does not apply: a server.

## Decisions

### D1 — MVP promises visited-card screenshots only
The free, local-first MVP promises real screenshots for **sites the user has visited while Klice Start is installed**. Imported-but-unvisited cards show a favicon or placeholder until first visit, at which point auto-capture upgrades them. The marketing and empty-state copy must reflect this honestly (see [Brand Strategy](../product-foundation/deferred/06-brand-strategy.md) once activated — "do not overpromise future capabilities"). We do not claim universal screenshots on the free tier.

### D2 — Universal-link thumbnails are a Pro, server-side capability
Screenshots for URLs the user has **not** visited (and refreshing stale ones without requiring a visit) require rendering the page somewhere the active-tab limit does not apply — i.e., headless rendering on the backend. This is confirmed as a **Pro-tier** feature, consistent with the locked Free/Pro split. It is a server concern; the extension never gains this power. Vendor and mechanism are deferred to a later technical document.

### D3 — The client is the source of truth for a screenshot's *freshness*, the server for its *existence*
Locally captured screenshots (D1) are always the freshest possible for visited pages and take precedence. Server-rendered thumbnails (D2) fill the gap for unvisited pages and may be staler. When both exist for a card, a locally captured image — proof the user actually saw that page — wins over a server render.

### D4 — Image absence is a first-class, designed state
Because a large share of cards will legitimately have no screenshot (fresh device, bulk import, D2 not purchased), "no image yet" is not an error or a loading state — it is a normal, designed appearance that must look intentional and calm, per the empty-state and quality expectations in [Experience Principles](../product-foundation/04-experience-principles.md). A card without an image is not a broken card.

## Constraints Handed Downstream

To **[Data Model](./02-data-model.md)**:
- A card's image reference must express *origin* (locally captured vs server-rendered) and *freshness* (when captured), because D3 requires the sync layer to arbitrate between the two without a screenshot ever silently overwriting a fresher one.
- Image absence must be a valid, unremarkable state for a card — not modeled as an error.
- Locally captured images and server-rendered thumbnails are distinct sources that may coexist for one card; the schema must hold both without conflating them.

To **[Free/Pro Boundary](./06-free-pro-boundary.md)**:
- The line is not "screenshots vs no screenshots." Free gets *visited-card* screenshots (D1). Pro gets *universal* screenshots for unvisited/stale cards via server rendering (D2).
- Entitlement must gate a **server capability**, not a client UI toggle — the extension is physically incapable of the Pro behavior, so the gate lives where the rendering happens.

To **[System Architecture](./01-system-architecture.md)**:
- Headless rendering (D2) is a backend service, isolated from the extension. The extension's only screenshot path remains `captureVisibleTab`; it never calls the render service directly for its own capture.

## Open Questions
- **Q1 — Placeholder strategy for D4.** Favicon-on-tint, generated gradient from the domain, or letter mark? A design decision, but it affects how "empty" a fresh setup feels and therefore first-run perceived quality.
- **Q2 — Staleness policy.** When is a locally captured screenshot old enough to warrant a silent re-capture on the next visit? Never, time-based, or content-change-based? Feeds `thumbnailCapture` settings and D3's freshness arbitration.
- **Q3 — Server render trigger for D2.** On card creation, on first sync, or lazily on first dashboard view? Cost and perceived-latency trade-off, deferred to the billing/architecture docs but flagged here as the decision that sizes the render bill.
