# 09 — Product Glossary

## Objective
Define Klice Start's official product vocabulary so that product, design, engineering, marketing, support, and documentation use the same language and do not invent competing meanings over time.

## Scope
Canonical product terms, definitions, aliases to avoid, cross-document relationships, and flagged ambiguities.

## Out of Scope
Implementation classes, database fields, API names, and technical architecture.

## Owners
Head of Product, Design Lead, Documentation Owner.

## Dependencies
[Product Strategy](./02-product-strategy.md), [Product Requirements](./08-product-requirements.md), [Brand Strategy](./deferred/06-brand-strategy.md).

## Cross-References
Use this document before naming product surfaces, writing UI copy, creating docs, or discussing requirements. When a term is ambiguous in a meeting, the canonical definition here resolves it.

## Status
Approved foundation.

## Version
2.0

## Last Review
2026-07-14

---

## Core Product Terms

| Term | Definition | Aliases To Avoid |
| --- | --- | --- |
| Klice Start | The product and brand: a personal browser dashboard for the new tab. | Discagem, speed dial app |
| Browser Home | The conceptual space Klice Start creates inside the browser. | New tab replacement, start page |
| Personal Browser Dashboard | The category Klice Start intends to define. | Bookmark manager, productivity dashboard |
| Dashboard | The user's main Klice Start surface containing cards, folders, widgets, and personal setup. | Homepage, panel |
| Home | The user's default starting place in Klice Start. | Start screen, initial page |
| Setup | A user's personalized arrangement of cards, folders, widgets, and appearance. | Theme, layout, configuration |

## Organization Terms

| Term | Definition | Aliases To Avoid |
| --- | --- | --- |
| Card | A saved website represented visually, ideally with a real screenshot. | Tile, shortcut, bookmark item |
| Folder | A visual group of cards or other folders. | Tab, collection, group |
| Workspace | A future higher-level context for a user's setup or project-based environment. | Account, team, profile |
| Widget | A movable block that provides lightweight daily utility. | Applet, module, gadget |
| Nested Folder | A folder inside another folder. | Sub-tab, child collection |
| Favorite | A browser-saved link imported into or represented by Klice Start. | Bookmark, shortcut |

## Value Terms

| Term | Definition | Aliases To Avoid |
| --- | --- | --- |
| Premium | A level of intentional quality perceived through speed, craft, clarity, restraint, and reliability. | Expensive, luxury |
| Local First | A product stance where core value works on the user's device before cloud services are required. | Offline-only, no backend |
| Sync | The paid continuity capability that keeps a user's Klice Start space consistent across devices. | Backup, cloud save |
| Backup | A recovery capability that protects the user's setup from loss. | Sync, export |
| AI Organization | Optional intelligence that suggests structure for saved resources while preserving user control. | Auto-organizer, AI mode |
| Delight | A small moment of quality that increases trust or attachment without demanding attention. | Surprise, gimmick |
| Taste | Disciplined restraint in service of clarity, beauty, and user control; a trained instinct, not personal preference. | Style, aesthetic, personal preference |
| Craft | The accumulation of small decisions that remove doubt; visible in correct behavior across edge cases. | Polish, finishing touches |
| Orientation | The user's ability to understand where they are and where to go next within their own space. | Navigation, wayfinding |
| Calm | The felt quality of a surface that does not compete for attention; created by space, rhythm, and restraint. | Minimalism, emptiness |
| Continuity | The experience of the same Klice Start space across devices and time, enabled by sync. | Mirroring, syncing |
| Ownership | The user's felt sense that their space, data, and defaults are theirs. | Customization, personalization |

## AI Terms

| Term | Definition | Aliases To Avoid |
| --- | --- | --- |
| AI Suggestion | A proposed change to cards or folders that the user can accept or dismiss; never applied silently. | AI action, auto-organize |
| Semantic Search | Retrieval of saved resources by meaning or intent rather than exact title or URL. | AI search, smart search |
| Assistant Layer | The role of AI in Klice Start: it strengthens the product; it never becomes the product. | AI mode, AI feature |

## Product State Terms

| Term | Definition | Aliases To Avoid |
| --- | --- | --- |
| Empty State | The designed experience when a surface has no user content yet. | Blank state, no data screen |
| Loading State | The designed experience while content or work is being prepared. | Spinner, wait screen |
| Error State | The designed recovery experience when something fails. | Alert, failure message |
| Focus State | The visible indication of keyboard or assistive navigation position. | Outline, selected state |

## Relationships
- A **Dashboard** contains **Cards**, **Folders**, and **Widgets**.
- A **Folder** can contain many **Cards** and may contain **Nested Folders**.
- A **Setup** describes the user's total arrangement and appearance.
- **Sync** keeps a **Setup** consistent across devices.
- **Backup** protects a **Setup** from loss but is not the same as **Sync**.
- **AI Organization** proposes changes to **Cards** and **Folders**, but the user remains in control.
- **Premium** describes quality, not price.
- **Taste**, **Craft**, and **Calm** are value terms that describe how the product should feel — not features to be toggled.

## Flagged Ambiguities
Ambiguities record where language has historically caused confusion, so the team does not relitigate the same ambiguity.

- **"Discagem"** was the original project name, but **Klice Start** is now the canonical product and brand name.
- **"Speed dial"** describes a legacy pattern, not the category Klice Start wants to own. Never used as a self-description.
- **"Sync"** and **"Backup"** must remain distinct: sync is continuity, backup is recovery. Conflating them confuses paid value.
- **"Premium"** must never be used as a synonym for expensive.
- **"Dashboard"** should refer to the product surface, not generic analytics or business reporting.
- **"Minimalism"** is an aesthetic; **Calm** is a felt quality. Klice Start pursues calm, which may or may not look minimalist in a given surface.
- **"Customization"** is a capability; **Ownership** is a feeling. Klice Start offers customization in service of ownership, not as an end in itself.
- **"Polish"** implies something added at the end; **Craft** is embedded throughout. Avoid "polish" when describing Klice Start's approach — it misrepresents when quality enters the product.
- **"Personalization"** refers to making something personal; **Ownership** refers to it being the user's. Klice Start prioritizes ownership; personalization is one means toward it, not the goal.