# 05 — Billing & Entitlements

## Objective
Define how Klice Start charges for Pro and how the resulting entitlement flows from the payment provider to the point where a feature is allowed or refused. Billing exists to fund the product without contradicting its values — no dark patterns, no attention monetization, no gating of local value.

## Scope
The merchant-of-record billing model, the subscription lifecycle, how an entitlement is established and revoked, and where the Free/Pro gate is enforced. The specific gated capabilities are enumerated in [Free/Pro Boundary](./06-free-pro-boundary.md); this document owns the *mechanism*.

## Out of Scope
Provider selection between the two candidates, pricing numbers, tax jurisdictions, webhook payload schemas, and dunning copy. Those are execution decisions on top of this model.

## Owners
Founders, Head of Product, Engineering Leadership.

## Dependencies
- [Auth & Account Model](./04-auth-account-model.md) — entitlement attaches to an account.
- [Storage Seam & Sync Contract](./03-storage-seam-sync-contract.md) — the seam reads entitlement to choose behavior.
- [Free/Pro Boundary](./06-free-pro-boundary.md) — the list of what Pro unlocks.
- Monetization stance in [Product Strategy](../product-foundation/02-product-strategy.md) and [Company Vision](../product-foundation/01-company-vision.md).

## Cross-References
Read this before designing any paywall, upgrade flow, or feature check. The rule "never monetize attention, data, or confusion" from [Company Vision](../product-foundation/01-company-vision.md) is a hard constraint on every decision here.

## Status
Draft — target billing model. No billing exists in the shipped extension.

## Version
0.1

## Last Review
2026-07-14

---

## Reality Note
Klice Start has no payments, no Pro tier, and no revenue today. This is target-state. The **value constraints** — no ads, no data resale, no gating of core local value, honest cancellation — are permanent stances from the product foundation, not aspirations that billing may bend.

---

## Billing model: merchant of record
Klice Start bills through a **merchant-of-record (MoR)** provider (candidates: Polar or Lemon Squeezy), not a raw payment processor. This is a locked decision. The MoR is the legal seller of record and absorbs global VAT/sales-tax calculation, collection, and remittance.

**Why this is the right call for Klice Start specifically:**
- Klice Start is a small team selling a subscription to a global audience of individuals. Handling worldwide tax compliance directly is disproportionate overhead for the stage.
- It keeps the team's attention on product quality — the actual growth lever per [Company Vision](../product-foundation/01-company-vision.md) — rather than tax operations.
- The trade-off (a higher percentage fee than raw Stripe) is accepted deliberately: it buys compliance and focus, and it is revisitable later if scale justifies bringing tax in-house.

## What Pro is
Pro is a **subscription** that unlocks cross-device and server-backed capability — sync, cloud backup, AI organization, semantic search, universal-link thumbnails (the D2 server render from [Screenshot Capture Reality](./00-screenshot-capture-reality.md)), and premium image/theme banks. The precise boundary lives in [Free/Pro Boundary](./06-free-pro-boundary.md). Pro never removes an ad (there are none) and never unlocks something the free user was artificially crippled out of — it funds capabilities that genuinely cost money to run (servers, rendering, model inference).

## The entitlement, not the payment, is what the product reads
The core architectural decision: **the product never checks payment state; it checks an entitlement.** An entitlement is a durable fact attached to an account — "this account is Pro until date X" — derived from billing events but decoupled from them.

Flow of truth:
1. The user subscribes/cancels/renews at the MoR.
2. The MoR notifies the backend of the lifecycle event (subscription created, renewed, cancelled, refunded, payment failed).
3. The backend translates that event into an **entitlement on the account** ([Auth & Account Model](./04-auth-account-model.md)).
4. The entitlement is surfaced as part of session state.
5. The [Storage Seam](./03-storage-seam-sync-contract.md) and feature checks read the entitlement — never the billing provider directly.

This decoupling means: the payment provider can change, go down, or be swapped, and the product's gating logic does not change. Entitlement is the stable contract; billing is a source that writes to it.

## Subscription lifecycle → entitlement state

| Billing event | Entitlement result |
| --- | --- |
| Subscription created / active | Account is Pro. |
| Renewal succeeds | Pro extended. |
| Payment fails (grace period) | Pro **retained** through a defined grace window; the user is not instantly demoted for a transient card failure. |
| Cancellation | Pro retained until the end of the paid period, then reverts to Free. Never cut off mid-period. |
| Refund / chargeback | Pro revoked per policy. |
| Provider event lost/delayed | Entitlement fails **safe** — see below. |

## Failure and edge behavior
- **Webhook lost or delayed:** the backend reconciles against the provider's authoritative state rather than trusting event delivery alone. A missed "renewed" event must never demote a paying user.
- **Entitlement unreadable (backend/session issue):** the product fails toward the **user's benefit** for continuity — a paying user is never locked out of their own synced data because an entitlement check hiccuped. Degrade like any sync interruption ([03](./03-storage-seam-sync-contract.md)): local data remains fully available.
- **Downgrade from Pro to Free:** the user's data is **never deleted or held hostage.** Pro-only *capabilities* stop (sync pauses, AI unavailable), but the setup that already exists locally remains the user's. Backup export remains possible so a downgrading user can always retrieve their own setup. Holding data hostage to force payment is exactly the extraction pattern [Company Vision](../product-foundation/01-company-vision.md) forbids.

## Gate enforcement: server-authoritative, client-honest
- **Server-side capabilities** (sync, AI, D2 render) are enforced **at the server** — the client cannot obtain them without a valid entitlement, so there is nothing to bypass. This is the real gate.
- **Client-side affordances** (showing/hiding Pro UI, upgrade prompts) reflect entitlement for honesty and clarity, but are never the security boundary. A tampered client gains nothing because the server refuses the work.
- Upgrade prompts follow the brand stance: no fear, no fake scarcity, no shame ([Brand Strategy](../product-foundation/deferred/06-brand-strategy.md) once activated). The prompt shows what Pro genuinely does, at the moment it is genuinely relevant.

## Constraints handed downstream

To **[Free/Pro Boundary](./06-free-pro-boundary.md)**:
- Every Pro capability must be enforceable server-side. A "Pro feature" that runs entirely on the client and can only be gated by hiding UI is not a defensible boundary and must be reconsidered.

To **[Auth & Account Model](./04-auth-account-model.md)**:
- Entitlement is stored on the account and surfaced in session state; billing writes it, session carries it.

To **[Storage Seam & Sync Contract](./03-storage-seam-sync-contract.md)**:
- Read entitlement from session state; treat "entitlement unknown" as a continuity-preserving degrade, not a lockout.

## Open questions
- **Provider choice (Polar vs Lemon Squeezy)** — deferred to an execution comparison; both are MoR and fit this model, so the choice does not change the architecture.
- **Grace-period length** and dunning cadence — policy calibration, not architecture.
- **Lifetime/one-time pricing or trials** — whether the model ever includes anything beyond subscription is an open product decision; the entitlement abstraction already accommodates it.
