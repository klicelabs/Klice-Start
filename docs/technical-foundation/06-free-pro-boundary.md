# 06 — Free/Pro Boundary

## Objective
State precisely what Perch gives away for free and what it charges for, in technical terms, and defend why the line sits where it does. This document turns the locked Free/Pro split into an enforceable boundary that every feature decision can check against.

## Scope
The principle that draws the line, the enumerated Free capabilities, the enumerated Pro capabilities, the enforcement rule, and the anti-patterns the boundary must never adopt.

## Out of Scope
Pricing, billing mechanics (see [Billing & Entitlements](./05-billing-entitlements.md)), and per-feature UX of upgrade prompts.

## Owners
Founders, Head of Product, Engineering Leadership.

## Dependencies
- [Screenshot Capture Reality](./00-screenshot-capture-reality.md) — D1/D2 already place screenshot capability on the correct side of this line.
- [Billing & Entitlements](./05-billing-entitlements.md) — how the gate is enforced.
- [System Architecture](./01-system-architecture.md) — which capabilities are local vs server.
- Monetization and Free/Pro stance in [Product Strategy](../product-foundation/02-product-strategy.md).

## Cross-References
Read this before assigning any feature to a tier. When unsure which side a feature belongs on, the drawing principle below decides — not revenue appetite.

## Status
Draft — target boundary. Everything is free today because nothing paid exists.

## Version
0.1

## Last Review
2026-07-14

---

## Reality Note
There is no Free/Pro split in the shipped extension; it is entirely free and local. This document defines the **intended** boundary. The **drawing principle** — not what merely reflects a paid stage — is the durable part.

---

## The drawing principle
**Free gets the full local-first product. Pro pays for what genuinely costs money to run.**

The line is not "cripple the free version until it hurts enough to pay." The line is **cost of operation**:

- Anything that runs entirely on the user's device costs Perch nothing per user and belongs to **Free**.
- Anything that requires servers, storage, bandwidth, rendering, or model inference has a real marginal cost per user and belongs to **Pro**.

This makes the boundary honest and self-justifying: a user is not paying to remove an artificial limit, they are paying for a service that has a bill behind it. It also aligns with [Company Vision](../product-foundation/01-company-vision.md): "Free = generous local-first single-device" is a promise, not a funnel.

## Free — the complete local product
Free is not a demo. It is a product a person could use forever on one device and feel they own something excellent:

- The full Dashboard: unlimited cards, folders, nested folders, and widgets.
- Full drag-and-drop with the native-app fluidity that is a P0 quality bar, not a paid upgrade.
- Local screenshots for **visited** sites (D1), including first-visit auto-capture.
- Free-text search across all cards and folders (see boundary with semantic search below).
- All appearance controls that run locally: gradients, solid colors, blur/brightness/opacity, and user-uploaded background images.
- Local import of browser bookmarks and local export/import of the setup (this is also the downgrade safety valve from [05](./05-billing-entitlements.md)).
- Every state fully designed: empty, loading, error, offline. Free is not a lower-quality experience; it is a smaller-surface one.

Quality is never the paid axis. A free user gets the same craft, speed, and calm as a Pro user — [Company Vision](../product-foundation/01-company-vision.md) makes quality the brand, not the upsell.

## Pro — what has a bill behind it
Pro unlocks capabilities that cannot run for free because they consume server resources:

| Pro capability | Why it costs money |
| --- | --- |
| **Sync across devices** | Server storage, bandwidth, conflict arbitration, realtime delivery ([03](./03-storage-seam-sync-contract.md)). |
| **Cloud backup** | Durable server-side storage of the user's setup and images. |
| **Universal-link thumbnails** (D2) | Headless rendering of unvisited URLs on the backend ([00](./00-screenshot-capture-reality.md)). |
| **AI organization** | Model inference to suggest structure for cards/folders (suggestions only, user stays in control). |
| **Semantic search** | Embedding + retrieval infrastructure beyond local free-text search. |
| **Premium image/theme bank** | Curated/licensed assets served and maintained. |

The unifying test: **every Pro capability is enforceable server-side** ([05](./05-billing-entitlements.md)). If a proposed Pro feature runs entirely on the client, it fails this test — either it belongs in Free, or it needs a genuine server component to justify the tier.

## Where the line runs inside a feature
Some capabilities span the boundary. The split is always local-vs-server, never quality-vs-quality:

- **Search:** local free-text search is Free; meaning-based semantic search (server inference) is Pro.
- **Screenshots:** capture of visited pages is Free (D1); render of unvisited pages is Pro (D2). Freshness always prefers the local capture (D3).
- **Backgrounds:** user uploads and generated gradients/colors are Free; the curated premium bank is Pro.
- **Backup:** local export/import is Free and always available (so no one is ever locked out of their own data); continuous cloud backup is Pro.

## Anti-patterns this boundary refuses
Drawn directly from the values in [Company Vision](../product-foundation/01-company-vision.md) and the culture in [Product Culture](../product-foundation/deferred/07-product-culture.md) (once activated):

- **No crippled free tier.** We never degrade a local capability *just* to create an upgrade reason. Limits must reflect real cost, not manufactured pain.
- **No data hostage.** Downgrading never deletes or locks the user's existing setup; export stays available ([05](./05-billing-entitlements.md)).
- **No ads, no sponsored tiles, no attention monetization** — ever, on any tier. This is not a Pro-removes-ads model because ads never exist.
- **No paywalling of quality.** Speed, craft, accessibility, and calm are universal. There is no "premium polish."
- **No dark-pattern prompts.** Upgrade moments are relevant and honest, never fear/scarcity/shame-based.

## Constraints handed downstream
This is the final document of the technical foundation. It hands forward one standing rule to all future feature planning:

> Before assigning a feature to Pro, prove it has a per-user operational cost that Free cannot absorb. If it runs on the user's device for free, it is Free. Revenue need is not a reason to move the line; operational cost is the only reason.

## Open questions
- **Sync scope on Free:** whether Free ever includes a *single-device* cloud backup as a trust/anti-loss gesture, or whether all cloud is strictly Pro. Leaning strictly Pro (cloud has a cost), but flagged as a product-trust decision.
- **AI free taste:** whether a tightly limited, low-cost AI trial exists on Free to demonstrate value, or whether AI is strictly Pro. An inference-cost decision, deferred.
- **Fair-use ceilings on Pro** (e.g. render volume, storage) — real costs may require ceilings; those must be generous and transparent, never silent throttles.
