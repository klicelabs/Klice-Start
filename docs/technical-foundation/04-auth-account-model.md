# 04 — Auth & Account Model

## Objective
Define who a Perch user is to the system, how identity is established across the extension and the web dashboard, and how a person moves from anonymous local use to an authenticated account without losing their setup. Auth exists to enable sync and Pro — not as a gate in front of the product's core local value.

## Scope
The account model, the anonymous→authenticated transition, session handling across the extension and the Next.js dashboard, and the identity contract the sync seam depends on.

## Out of Scope
Password/token cryptography, provider configuration, SQL for user tables, and billing (see [Billing & Entitlements](./05-billing-entitlements.md)). This document decides the model and its contracts, not the implementation.

## Owners
Founders, Engineering Leadership, Head of Product.

## Dependencies
- [System Architecture](./01-system-architecture.md) names Supabase Auth as the identity provider.
- [Storage Seam & Sync Contract](./03-storage-seam-sync-contract.md) requires a session + entitlement signal to select its adapter.
- [Data Model](./02-data-model.md) scopes every synced entity to an owner.

## Cross-References
Read this before designing sign-in, before scoping any table to a user, and before deciding what the product does for a logged-out person. The non-negotiable "no mandatory accounts for local value" from [Company Vision](../product-foundation/01-company-vision.md) governs every decision here.

## Status
Draft — target account model. No auth exists in the shipped extension today.

## Version
0.1

## Last Review
2026-07-14

---

## Reality Note
Today Perch has **no accounts, no auth, and no concept of a user** — it is a single-device local extension (see [CLAUDE.md](../../CLAUDE.md)). Everything in this document is target-state. The one constraint that is *not* aspirational is the principle it must obey: the product's core value works with no account at all, and that is a permanent stance, not a phase.

---

## Core principle: local value is never gated by auth
The free, single-device product must be fully usable with **no account whatsoever**. Saving cards, organizing folders, backgrounds, search, first-visit screenshots — all of it works logged out, forever. This is the [Company Vision](../product-foundation/01-company-vision.md) value "user control is non-negotiable / no mandatory accounts for local value" expressed as an architectural rule.

Auth is introduced only when the user wants something that inherently spans devices or a server: **sync, cloud backup, and Pro AI**. An account is the key to continuity, never the key to the front door.

## The account model

### What a user is
A Perch account is a single identity that owns a setup and carries an entitlement (Free or Pro). One person, one account, potentially many devices. The account exists to answer two questions the seam and billing ask: *whose data is this?* and *what is this person entitled to?*

### Anonymous state
Before sign-in, a device has a purely local setup with no owner. It is not a shadow account or a hidden user row — it is local data belonging to no server identity. This keeps the logged-out product honest: nothing about an anonymous user exists on any server.

### The anonymous → authenticated transition
This is the highest-stakes moment in the account model. When an anonymous user creates an account, their existing local setup must **adopt into** the new account, not be replaced by an empty cloud setup.

The contract:
- On first authentication, the local setup is claimed by the new account and becomes the seed of the synced setup.
- If the account already has server data (e.g. the user signed up on another device first), the two must **merge**, not overwrite — the local setup is reconciled into the account using the same conflict rules as [Storage Seam & Sync Contract](./03-storage-seam-sync-contract.md), never silently discarded.
- The user is never presented with an empty screen immediately after signing in on a device that already had content. Losing a setup at sign-in would violate the ownership promise more severely than any other failure.

## Sessions across two surfaces
Perch has two authenticated surfaces with different lifetimes and expectations:

| Surface | Session expectation | Rationale |
| --- | --- | --- |
| Extension (new tab) | Long-lived, silently refreshed, rarely re-prompts. | The new tab opens dozens of times a day; a re-login prompt on a high-frequency surface is a quality defect ([Product Culture](../product-foundation/deferred/07-product-culture.md) once activated — latency/friction as disrespect). |
| Web dashboard (Next.js) | Standard web session. | Conventional expectations; less frequent, more administrative. |

The contract between them:
- Both authenticate against the same identity provider ([System Architecture](./01-system-architecture.md)) and resolve to the same account.
- The extension holds its session such that opening a new tab never blocks on a network auth round-trip — session validity is checked in the background, and expiry degrades to local-adapter behavior (per [03](./03-storage-seam-sync-contract.md)) rather than locking the user out of their own data.
- Sign-out on one surface does not destroy local data on the extension; it stops sync and returns that device to anonymous-equivalent local behavior for the data already present.

## The identity contract for sync
[Storage Seam & Sync Contract](./03-storage-seam-sync-contract.md) selects its adapter based on session + entitlement. Auth must therefore expose, cleanly and synchronously enough for the seam:
1. **Is there a valid session?** (authenticated vs anonymous)
2. **Which account?** (the owner id every synced entity is scoped to)
3. **What entitlement?** (Free vs Pro — sourced from [Billing & Entitlements](./05-billing-entitlements.md), surfaced here as part of session state)

The seam never talks to the auth provider directly; it reads this resolved session state. This keeps auth swappable behind the same boundary discipline the whole architecture follows.

## Degradation and failure
- **Auth provider unreachable:** the extension continues in local-adapter mode with existing data; it does not block orientation. Sync resumes when auth recovers.
- **Session expired mid-use:** silent refresh; on failure, degrade to local, surface a calm reconnect affordance, never a hard wall in front of the new tab.
- **Account deleted:** local data on device is retained under the ownership guarantee; server data is removed per the user's request. Deletion is a user right, and it must not leave the local product broken.

## Constraints handed downstream

To **[Data Model](./02-data-model.md)**:
- Every synced entity is scoped to an owner account id; anonymous local data has no owner and no server row.

To **[Billing & Entitlements](./05-billing-entitlements.md)**:
- Entitlement is attached to the account and surfaced as part of session state; billing is the source of truth, auth is the carrier.

To **[Storage Seam & Sync Contract](./03-storage-seam-sync-contract.md)**:
- Provide session + entitlement as resolved state, not as a live dependency on the auth provider.

## Open questions
- **Multiple identities merging** — if a user signs into two different accounts on one device over time, how local residue is attributed. Likely a rare edge; needs a defined rule before launch.
- **Team/shared setups** — the [Data Model](./02-data-model.md) reserves a `Workspace` term for the future; whether accounts ever become multi-user is deferred, not decided here.
- **Session lifetime tuning** for the extension surface — the exact silent-refresh window is an implementation calibration.
