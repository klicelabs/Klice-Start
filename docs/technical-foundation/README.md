# Klice Start Technical Foundation

This suite defines the **target technical architecture** for turning Klice Start from a single-device local extension into a subscription SaaS. It is the technical counterpart to [`../product-foundation/`](../product-foundation/README.md): where that suite owns *why* and *what*, this one owns *how the system is shaped* — at the level of durable decisions and contracts, not implementation code.

## Current Stage
Everything here describes where Klice Start is going, not what exists today. Today Klice Start is a single-device, local-only Manifest V3 extension with **no backend, no accounts, no billing, and no build step** (see [CLAUDE.md](../../CLAUDE.md)). Two things in this suite are *not* aspirational and are true right now:

1. **The `Storage` seam** in `js/db.js` already exists and is already the single persistence interface the rest of the extension uses.
2. **The platform capture limits** in document 00 are fixed browser constraints, true today and permanently.

Everything else — Supabase, Next.js, sync, auth, Pro — is the target the decisions below commit to.

## Documents
0. [Screenshot Capture Reality](./00-screenshot-capture-reality.md) — the platform truth about screenshots and the four decisions (D1–D4) the rest of the suite depends on.
1. [System Architecture](./01-system-architecture.md) — the components (extension, web app, backend, mobile) and the `Storage` seam as the sync frontier.
2. [Data Model](./02-data-model.md) — logical entities and how today's local `state` maps to durable multi-device storage.
3. [Storage Seam & Sync Contract](./03-storage-seam-sync-contract.md) — the `Storage` method surface as a stable contract, and the sync/conflict model behind it.
4. [Auth & Account Model](./04-auth-account-model.md) — identity, the anonymous→authenticated transition, and sessions across surfaces.
5. [Billing & Entitlements](./05-billing-entitlements.md) — merchant-of-record billing and how entitlement flows to the point of enforcement.
6. [Free/Pro Boundary](./06-free-pro-boundary.md) — what is free, what is paid, and the cost-of-operation principle that draws the line.

## Reading Order
Read **00 first** — it is a hard dependency of the data model and the Free/Pro boundary, and its decisions are locked. Then 01 for the map, then 02–06 in order; each specifies one box or one arrow from the architecture.

## Locked Decisions
These are settled inputs, not open for re-litigation within this suite:
- **Backend:** Supabase (Postgres + Auth + Storage + Realtime).
- **Billing:** Merchant-of-Record (Polar or Lemon Squeezy), not raw Stripe.
- **Web framework:** Next.js (landing + dashboard). Extension stays vanilla-JS MV3.
- **Mobile:** responsive PWA on the same backend; no browser new-tab override.
- **Screenshot D1–D4:** accepted (see document 00).

## Governance
This suite mirrors the product foundation's principle of **one responsibility per document, referenced not restated**. When extending it: preserve document boundaries, add cross-cutting concepts as a single canonical section plus references, and keep the Current Stage section honest as reality catches up to the target.

## Status
Draft — v0.1. Decisions proposed and, for 00, accepted.

## Version
0.1

## Last Review
2026-07-14
