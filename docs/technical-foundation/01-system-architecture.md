# 01 — System Architecture

## Objective
Define the shape of the Perch system once it becomes a SaaS: the parts that exist, what each is responsible for, how they communicate, and — most importantly — the single seam through which the local-only extension becomes a synced product without rewriting its interface. This document is the map every later technical document plugs into.

## Scope
The runtime components (extension, web app, backend, mobile), their responsibilities and boundaries, the client-to-backend communication model, the `Storage` seam as the sync fronteir, and the offline-first stance. Component-level contracts (data shapes, sync semantics, auth flows, billing) are named here and specified in their own documents.

## Out of Scope
Database schema (see [Data Model](./02-data-model.md)), the sync contract detail (see [Storage Seam & Sync Contract](./03-storage-seam-sync-contract.md)), auth flows (see [Auth & Account Model](./04-auth-account-model.md)), billing (see [Billing & Entitlements](./05-billing-entitlements.md)), and vendor selection beyond what is already locked.

## Owners
Founders, Engineering Leadership, Head of Product.

## Dependencies
- [Screenshot Capture Reality](./00-screenshot-capture-reality.md) — the extension's capture path and the server-render boundary constrain what the extension and backend each own.
- Product intent in [Company Vision](../product-foundation/01-company-vision.md) (local-first, performance-as-respect, ownership) and [Product Strategy](../product-foundation/02-product-strategy.md) (sync as the paid reason).

## Cross-References
Read this first among the technical documents after the screenshot reality. Every other technical document specifies one box or one arrow drawn here.

## Status
Draft — proposed architecture for acceptance.

## Version
0.1

## Last Review
2026-07-14

---

## Reality Note
This describes a **target SaaS architecture**, not the shipped extension. Today Perch is a single-device, local-only Manifest V3 extension with no backend, no accounts, and no build step (see [CLAUDE.md](../../CLAUDE.md)). The components below marked as backend, web app, or mobile do not exist yet; the extension and its `Storage` seam do. This document describes where the system is going and, deliberately, how to get there without discarding what already works.

---

## The Governing Principle
Perch is **local-first**. The extension must deliver its full core value with no account, no network, and no backend — exactly as it does today. Sync, accounts, and server rendering are additive layers that enhance a product that already works offline, never prerequisites for it. This is not only a product stance ([Company Vision](../product-foundation/01-company-vision.md)); it is the architectural constraint that shapes every decision here: **the network is an enhancement, never a dependency of the core loop.**

## Components

### 1. The Extension (client of record)
A vanilla-JS Manifest V3 extension. It owns the new-tab surface, all direct user interaction, local persistence, and the only screenshot capture path (`captureVisibleTab`, per [00](./00-screenshot-capture-reality.md)). It remains fully functional with the backend absent or unreachable. It is the source of truth for a user with no account.

Critically, the extension's application logic (`app.js`) does **not** know whether a backend exists. It talks only to the `Storage` seam (see below). This is what makes the SaaS pivot a swap behind an interface rather than a rewrite.

### 2. The Web App (Next.js: landing + dashboard)
Two responsibilities under one framework:
- **Landing / marketing / pricing** — the public surface, checkout entry, store links.
- **Authenticated dashboard** — account management, subscription state, sync status, and a browser-accessible view of the user's setup. On mobile, this dashboard is the responsive PWA (there is no new-tab override on mobile).

The web app is a client of the same backend as the extension; it holds no privileged logic the extension cannot also reach through its own authenticated path.

### 3. The Backend (Supabase)
Postgres + Auth + Storage + Realtime, plus the headless render service for D2. It owns: durable multi-device state, identity, entitlements, cloud image storage, and universal-link rendering. It is the arbiter of *shared* truth across devices, but never the arbiter of *whether the user can use Perch* — an unauthenticated user is a first-class user.

The headless render service (D2 from [00](./00-screenshot-capture-reality.md)) is a backend-only concern. The extension never calls it directly for capture; it consumes its output like any other synced image.

### 4. Mobile (PWA)
No browser new-tab override exists on mobile. The mobile path is the responsive PWA served by the web app, sharing the same backend, auth, and data model. It is a view onto the synced setup, not a second product.

## The Seam: How Local Becomes Synced
The entire pivot pivots on one interface. The extension persists through a `Storage` object exposing a small, fixed set of async methods (get/set state, save/get/delete images). `app.js` and the service worker touch **only** these methods — never `chrome.storage`, `IndexedDB`, or the network directly.

This means:
- **Today**, `Storage` is backed by `chrome.storage.local` (light state) and IndexedDB (images).
- **In the SaaS**, for a signed-in Pro user, `Storage` is backed by a sync adapter that reconciles local cache with Supabase.
- **`app.js` changes in neither case.** The swap happens entirely inside the seam.

Two rules protect this seam and are binding on all later work:
1. **No component above the seam may bypass it.** Any code that reaches for `chrome.storage`, IndexedDB, or `fetch` outside the `Storage` implementation breaks the sync strategy and is a defect.
2. **The seam's method contract is additive-stable.** Backend sync is introduced by changing what the methods *do internally*, not by changing what they are or adding backend-shaped parameters to their callers.

The precise contract of these methods, and the sync semantics behind them, are specified in [Storage Seam & Sync Contract](./03-storage-seam-sync-contract.md).

## Communication Model
- **Extension ↔ Backend:** direct authenticated calls from the sync adapter (inside the seam) to Supabase, plus Realtime subscriptions for cross-device propagation. The extension holds its own session; it does not proxy through the web app.
- **Web App ↔ Backend:** standard authenticated Supabase access for dashboard and account surfaces.
- **Billing provider → Backend:** the Merchant-of-Record notifies the backend of subscription state via webhook; the backend is the single writer of entitlement (see [Billing & Entitlements](./05-billing-entitlements.md)).
- **Backend render service → storage:** universal-link thumbnails (D2) are produced server-side and land in cloud image storage, then flow to clients through the same sync path as any other image.

There is no direct client-to-client communication. All cross-device continuity flows through the backend.

## Offline-First Stance
- The core loop (open new tab, see setup, open/organize cards, capture the visited tab) must complete with **zero** network calls.
- Sync is a background reconciliation, never a blocking step in front of orientation. A failed or slow network degrades to "not yet synced," never to "cannot use Perch." This is the architectural expression of "performance is respect" and "latency is a defect."
- The local cache is always readable and writable first; the network catches up. This ordering is mandatory, not a performance optimization.

## Boundaries That Must Not Blur
- The extension never depends on the backend for the core loop.
- The backend never becomes the only source of the user's data — the local cache is a full, usable copy, which is also what makes [Backup](../product-foundation/09-product-glossary.md) meaningful.
- Entitlement gating lives at the backend for server capabilities (D2 rendering, sync), because the client cannot be trusted to enforce access to a resource it does not host. Client-side gating is UX, never the security boundary (see [Billing & Entitlements](./05-billing-entitlements.md)).
- The web dashboard and the extension are peers over the same backend, not a hierarchy.

## Open Questions
- **Q1 — Sync adapter residence.** Does the sync adapter run in the service worker, a shared module, or partly in both? Affects Realtime subscription lifetime under MV3's service-worker suspension. Deferred to [03](./03-storage-seam-sync-contract.md).
- **Q2 — Web dashboard write parity.** Can the dashboard edit the setup, or is it read/status-only at first? A scope decision that changes how much conflict resolution the sync contract must handle early.
- **Q3 — Render service coupling.** Is the D2 render service part of Supabase (Edge Function) or a separate service? Cost and cold-start trade-off, deferred to [05](./05-billing-entitlements.md)/architecture detail.
