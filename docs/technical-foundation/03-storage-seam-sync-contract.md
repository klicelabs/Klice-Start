# 03 — Storage Seam & Sync Contract

## Objective
Define the single interface through which all persistence flows, and the contract by which local state becomes multi-device state without rewriting the application. This document turns the existing `Storage` object in `js/db.js` into the formal seam that a sync backend implements behind, and specifies how conflicts, offline edits, and image origin are resolved.

## Scope
The `Storage` method surface as a stable contract, the local adapter (today) vs sync adapter (target), the sync strategy and conflict resolution model, offline-first behavior, and how the [Screenshot Capture Reality](./00-screenshot-capture-reality.md) freshness rule (D3) is enforced at the sync layer.

## Out of Scope
SQL schema (see [Data Model](./02-data-model.md)), auth sessions (see [Auth & Account Model](./04-auth-account-model.md)), billing gates (see [Billing & Entitlements](./05-billing-entitlements.md)), and concrete client code. This document defines the contract, not the implementation.

## Owners
Founders, Engineering Leadership, Head of Product.

## Dependencies
- [System Architecture](./01-system-architecture.md) establishes the seam as the extension↔backend boundary.
- [Data Model](./02-data-model.md) defines the entities this contract moves.
- [Screenshot Capture Reality](./00-screenshot-capture-reality.md) D3 defines image precedence, which the conflict rule here must honor.

## Cross-References
Read this before touching `js/db.js`, before adding any `Storage` method, and before designing sync. The project rule that `app.js`/`background.js`/`popup.js` never bypass `Storage` (see [CLAUDE.md](../../CLAUDE.md)) is the precondition that makes this contract possible.

## Status
Draft — target sync contract. The local adapter half is shipped today; the sync adapter half is the target.

## Version
0.1

## Last Review
2026-07-14

---

## Reality Note
The `Storage` seam **exists today** and is real: `js/db.js` already exposes the method surface below, and the rest of the extension already routes every read and write through it. That half is not aspirational. What is target-state is the *sync adapter* — the implementation that fulfills the same contract against Supabase instead of `chrome.storage.local` + IndexedDB. This document describes both halves so the contract stays stable across the swap. The platform capture limits from [00](./00-screenshot-capture-reality.md) remain fixed.

---

## Why the seam exists
The original extension design (see [CLAUDE.md](../../CLAUDE.md) and the storage-seam decision) made one deliberate bet: the entire rest of the codebase talks to persistence through a single object, `Storage`, and never touches `chrome.storage.local` or IndexedDB directly. That discipline is the reason the SaaS pivot swaps a file's internals rather than rewriting the application. If any surface reaches around the seam, the seam stops being a seam. Guarding it is a non-negotiable, not a style preference.

## The contract surface
`Storage` exposes a fixed set of asynchronous methods. This surface is the contract. Adapters may change what happens behind each method; they may not change what each method means.

| Method | Meaning (contract) | Must remain true across adapters |
| --- | --- | --- |
| `getState()` | Return the normalized lightweight state (folders, cards, activeFolderId, settings). | Always returns a valid, normalized state — never null, never a partial. |
| `setState(state)` | Persist the lightweight state. | Durable before it resolves; observable by other contexts. |
| `saveThumbnail(dataUrl)` | Store an image blob, return an opaque id. | The id is stable and resolvable by `getThumbnail`. |
| `getThumbnail(id)` | Resolve an image id to its data, or null. | Null is a valid, unremarkable answer (per [00](./00-screenshot-capture-reality.md) D4). |
| `deleteThumbnail(id)` | Remove an image blob. | Idempotent; deleting a missing id is not an error. |
| `saveBackgroundImage(dataUrl)` | Store a background image, return an opaque id. | Same guarantees as `saveThumbnail`. |
| `getBackgroundImage(id)` | Resolve a background image id, or null. | Same as `getThumbnail`. |
| `clearImages()` | Remove all stored images. | Affects images only; never touches lightweight state. |
| `uid()` | Generate a unique id. | Collision-resistant across devices (see below). |
| `normalizeState(raw)` | Deep-merge saved state over defaults. | Forward-compatible: missing keys filled, valid keys preserved. |

**Rule:** adding a feature may add a method to this surface, but must not change the meaning of an existing one. The test suite's `normalizeState` assertions guard the merge semantics; new methods need equivalent guards.

## Two adapters, one contract

### Local adapter (today)
`getState`/`setState` map to `chrome.storage.local`; the image methods map to IndexedDB. This is what ships now and what the free, single-device tier keeps using. It has no network dependency and must continue to work with sync disabled or absent.

### Sync adapter (target)
The same ten-method surface, fulfilled against the backend defined in [System Architecture](./01-system-architecture.md):
- Lightweight state reads/writes reconcile against the server's per-entity rows ([Data Model](./02-data-model.md)), not a single blob.
- Image methods store to and resolve from cloud object storage, with the local store acting as a cache.
- The adapter is selected by account and entitlement state ([Auth](./04-auth-account-model.md), [Billing](./05-billing-entitlements.md)), not hard-coded.

**Contract consequence:** because both adapters honor `getState` returning a whole normalized state, `app.js` cannot tell which adapter is active. That indistinguishability is the definition of a successful seam.

## Sync strategy

### Granularity
Sync operates on **entities** (individual folders, cards, widgets, settings groups), not on the whole-state blob. Whole-blob sync would make every edit conflict with every other edit and would push large payloads for tiny changes. Entity-level sync is what makes concurrent multi-device editing tractable and is why [Data Model](./02-data-model.md) stores rows, not documents.

### Direction and cadence
- **Local-first.** Every edit applies to local state immediately and is durable locally before any network call. The UI never waits on the network to feel responsive — this upholds the performance stance in [Company Vision](../product-foundation/01-company-vision.md).
- **Push after commit.** Local commits enqueue a sync operation; the queue drains opportunistically and survives offline.
- **Pull on open and on realtime signal.** Remote changes reconcile into live state the way the existing `chrome.storage.onChanged` reconciliation already does for cross-context writes (see [CLAUDE.md](../../CLAUDE.md)).

### Conflict resolution
The default model is **last-write-wins per entity field**, with three deliberate exceptions:

1. **Ordering fields** (a card's `order`, folder position) resolve by intent, not raw timestamp, to avoid two devices fighting over positions. Reordering is treated as a move operation, not a blind field overwrite.
2. **Deletions** are tombstoned, not silently dropped, so an offline device that edits a since-deleted card learns the card is gone rather than resurrecting it.
3. **Image references** follow [00](./00-screenshot-capture-reality.md) **D3**: a locally captured screenshot (proof the user saw the page) always wins over a server-rendered thumbnail, regardless of which is chronologically newer. This is the one place last-write-wins is explicitly overridden by origin.

CRDTs are noted as a possible future upgrade for ordering, but are **not** required for the MVP sync tier and are out of scope here. The open question is recorded below.

### Identity across devices
`uid()` must generate ids that do not collide when two offline devices create entities independently. The contract requirement is client-generated, collision-resistant ids — the server accepts client ids rather than assigning its own, so an entity has one identity from birth, before it has ever synced. This is what lets an offline-created card keep its identity when it finally reaches the server.

## Offline-first behavior
- The sync adapter must fully function with no network: reads hit local cache, writes commit locally and queue.
- Reconnection drains the queue and pulls remote changes; conflicts resolve per the rules above.
- Loss of the backend (outage, cancelled subscription) degrades to local-adapter behavior for the data already on device — the user never loses access to their own setup because sync is unavailable. This is the ownership guarantee from [Company Vision](../product-foundation/01-company-vision.md) expressed at the sync layer.

## Constraints handed downstream

To **[Data Model](./02-data-model.md)**:
- Entities need per-row identity, an updated-at for last-write-wins, and tombstone support for deletions.
- Image references need the origin + freshness fields D3 requires (already specified in 02).

To **[Auth & Account Model](./04-auth-account-model.md)**:
- The adapter choice is a function of session + entitlement; auth must expose that state to the seam cleanly.

To **[Billing & Entitlements](./05-billing-entitlements.md)**:
- Losing Pro must degrade to the local adapter gracefully (data retained, sync paused), never destroy local data.

## Open questions
- **CRDT vs operational transform for ordering** if last-write-wins-by-intent proves insufficient under heavy concurrent reordering. Not an MVP blocker.
- **Tombstone retention window** — how long deleted-entity markers persist before garbage collection without risking resurrection from a long-offline device.
- **Image cache eviction** on the client when local storage pressure is high but the server copy exists.
