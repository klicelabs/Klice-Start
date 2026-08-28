# 02 — Data Model

## Objective
Define the logical data model for Klice Start as a synced product: the entities, what they mean, how they relate, and how today's local `state` shape maps onto durable multi-device storage — without silently overwriting the local-first design or the screenshot truth from [00](./00-screenshot-capture-reality.md).

## Scope
Logical entities (users, folders, cards, widgets, setups, images), their relationships, the mapping from the current local `state` to backend tables, image origin/freshness modeling required by D3, ownership/tenancy, and identity semantics. This is a **logical** model: decisions and contracts, not DDL, column types, or index strategy.

## Out of Scope
Physical schema (SQL types, indexes, migrations), sync/merge mechanics (see [Storage Seam & Sync Contract](./03-storage-seam-sync-contract.md)), auth provider detail (see [Auth & Account Model](./04-auth-account-model.md)), and entitlement storage (see [Billing & Entitlements](./05-billing-entitlements.md)).

## Owners
Founders, Engineering Leadership, Head of Product.

## Dependencies
- [Screenshot Capture Reality](./00-screenshot-capture-reality.md) — D3 (client owns freshness, server owns existence) and D4 (absence is valid) are hard constraints on the image model.
- [System Architecture](./01-system-architecture.md) — local-first and the `Storage` seam define what "the model" even is on each side.
- The current local shape in the extension's persistence layer (`folders[]`, `cards[]`, `activeFolderId`, `settings{}`).

## Cross-References
Read this before designing tables, the sync contract, or the Free/Pro boundary. The sync contract ([03](./03-storage-seam-sync-contract.md)) operates on the entities defined here.

## Status
Draft — proposed model for acceptance.

## Version
0.1

## Last Review
2026-07-14

---

## Reality Note
This describes a **target SaaS data model**, not the shipped storage. Today the extension persists a single `state` object to `chrome.storage.local` and image data URLs to IndexedDB — no server tables, no user rows, no tenancy (see [CLAUDE.md](../../CLAUDE.md)). The entities below describe where the model is going; the "local shape" sections describe what exists now and must keep working offline.

---

## Modeling Principles
1. **The local shape is the source of the model, not the other way around.** The backend mirrors the structure the extension already uses, so that sync is a projection of local state — not a foreign schema the client must translate into.
2. **Everything the user arranges is owned data.** Folders, cards, widgets, appearance — all belong to the user and must be portable ([Ownership](../product-foundation/09-product-glossary.md), export/import).
3. **Image bytes and image references are separate concerns.** A card references an image; it never embeds one. This is what lets the same card show a local capture on one device and a server render on another (D3).
4. **Absence is representable everywhere.** Per D4, "no image," "no widgets," "fresh setup" are all valid, first-class states — never null-as-error.

## Entities

### User
Identity and ownership root. Exists only once a user creates an account; a local-only user has no `User` row and needs none. Owns exactly one Setup (initially). Carries entitlement state by reference (see [05](./05-billing-entitlements.md)), not inline billing data.

### Setup
The user's total arrangement: the set of folders, cards, widgets, and appearance settings that make up their Klice Start space. This is the unit that [Sync](../product-foundation/09-product-glossary.md) keeps consistent across devices and that [Backup](../product-foundation/09-product-glossary.md) protects. Locally, the Setup *is* the `state` object.

### Folder
A named, ordered group that contains cards and — per the product vision — other folders (nested folders). Belongs to a Setup. Has an order relative to its siblings.

### Card
A saved website. Carries its title, URL, favicon reference, an image reference (see below), and an order within its parent folder. Belongs to exactly one folder. A card with no image is valid and normal (D4).

### Widget
A movable block providing lightweight daily utility (clock, weather, pomodoro, etc.), positioned within the setup's layout. Belongs to a Setup. Modeled as its own entity so the bento-grid layout can evolve without touching cards.

### Image
The heavy, separately stored bytes for a screenshot or background, plus the metadata D3 requires:
- **origin** — locally captured vs server-rendered. Local capture is proof the user saw the page.
- **captured/rendered timestamp** — freshness, used to arbitrate which image wins.
Images are referenced by cards and by appearance settings; they are never inlined into the Setup structure.

## The Image Model (D3 made concrete)
D3 requires that a card's image reference express *origin* and *freshness* so the sync layer never lets a server render silently overwrite a fresher local capture. Therefore:

- A card holds an **image reference**, not image bytes.
- That reference resolves to an Image carrying `origin` (local | server) and a freshness timestamp.
- **A card may legitimately reference no image** (D4) — favicon or placeholder is shown.
- When two devices offer images for the same card, resolution follows D3: **a local capture (user actually visited) outranks a server render**; between two of the same origin, the fresher timestamp wins.
- Server-rendered universal-link thumbnails (D2) enter as Images with `origin = server` and flow to clients through sync like any other image; they never suppress a local capture.

The exact reconciliation algorithm is [03](./03-storage-seam-sync-contract.md)'s job; the model's job is only to **carry enough information for that arbitration to be possible** — which is why origin and freshness are mandatory fields, not optional metadata.

## Mapping: Local Shape → Backend Entities

| Local (`state`, today) | Backend entity | Notes |
| --- | --- | --- |
| the whole `state` object | Setup (owned by User) | The Setup is the sync unit. |
| `folders[]` | Folder rows under a Setup | Order preserved; nesting added as a parent reference. |
| `cards[]` | Card rows under Folders | `folderId` becomes a real relationship; `order` preserved. |
| `card.thumbId` → IndexedDB blob | Card image reference → Image | Local blob stays in IndexedDB as cache; reference gains origin/freshness. |
| `settings{}` (incl. background, clock, search) | Setup appearance settings | Travels with the Setup so a synced device looks identical. |
| `activeFolderId` | **device-local, not synced** | Which folder is open is a per-device view state, not shared truth (see below). |
| background image blob (IndexedDB) | Image (`origin` = local upload) | Same reference model as card images. |

## Synced vs Device-Local State
Not everything in the local `state` should sync. The model distinguishes:
- **Synced (shared truth):** folders, cards, widgets, appearance settings, uploaded background images — the Setup.
- **Device-local (per-device view):** `activeFolderId` and any transient UI position. Syncing "which folder is open" across devices would fight the user, not help them.

This split must be explicit in the model so the sync contract knows what it is and is not responsible for. Getting it wrong produces the classic bug where opening a tab on your laptop changes what your desktop shows.

## Ownership & Tenancy
- Every Setup, Folder, Card, Widget, and Image belongs to exactly one User (once accounts exist).
- Row-level ownership is enforced at the backend (Supabase RLS is the natural mechanism; specified in [04](./04-auth-account-model.md)).
- A local-only user owns their data implicitly — it lives only on their device and is theirs by possession. Creating an account claims that local data into a User; it must never require discarding it.

## Identity of Records
- Records use stable, client-generatable IDs so the extension can create a folder or card **offline** and have it sync later without an ID collision or a round-trip to the server for an identifier. The current local ID generator already produces such IDs; the model keeps that property rather than depending on server-assigned keys.
- This is a prerequisite for offline-first: if creating a card required a server ID, the core loop would depend on the network, violating [01](./01-system-architecture.md).

## Constraints Handed Downstream
To **[Storage Seam & Sync Contract](./03-storage-seam-sync-contract.md)**:
- Sync operates on the Setup and its child entities; `activeFolderId` and view state are excluded.
- Image reconciliation must honor D3 origin/freshness precedence.
- Client-generated IDs must be treated as authoritative, not reassigned on upload.

To **[Auth & Account Model](./04-auth-account-model.md)**:
- "Claim local data into a new account" is a required flow, not an edge case.
- Ownership must be row-level and enforced server-side.

To **[Billing & Entitlements](./05-billing-entitlements.md)**:
- Entitlement is referenced from User, stored separately from billing-provider records.

## Open Questions
- **Q1 — Nested folder depth.** Is nesting arbitrary-depth or capped? Affects folder self-reference and the "folder card" preview (up to 4 mini-thumbnails). A product decision with a modeling consequence.
- **Q2 — Multiple setups per user.** The [Workspace](../product-foundation/09-product-glossary.md) term anticipates project-based environments. Does the model allow many Setups per User now, or assume one until Workspaces ship? Recommend modeling the User→Setup relationship as one-to-many from the start to avoid a painful migration, even if the UI exposes only one.
- **Q3 — Widget instance data.** Do widgets store per-instance config (e.g., a pomodoro's last state) in the synced Setup or device-locally? Leaning device-local for transient state, synced for configuration — to be resolved with the widget UX.
