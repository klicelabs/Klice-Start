# 08 — Product Requirements

## Objective
Define Perch's product requirements at the level of user problem, objective, value, impact, and success criteria. This document owns the Design Quality Bar that gates every interface for readiness.

## Scope
Core, Important, Future, Nice to Have, Anti-Requirements, and the Design Quality Bar.

## Out of Scope
Architecture, data model, API design, database, framework, implementation, DevOps, CI/CD, and vendor selection. Choices about how much AI belongs in a given feature are governed by the AI experience principles in [Experience Principles](./04-experience-principles.md).

## Owners
Head of Product, Product Design, Founders.

## Dependencies
[Product Strategy](./02-product-strategy.md), [Product Principles](./03-product-principles.md), [Experience Principles](./04-experience-principles.md).

## Cross-References
- Use [Product Principles](./03-product-principles.md) to evaluate whether a requirement should be promoted, delayed, or rejected.
- AI behavior in any requirement below must conform to the [AI Experience Principles](./04-experience-principles.md#ai-experience-principles).
- The Design Quality Bar here is the operational checklist referenced by [Product Principles](./03-product-principles.md) and [Product Culture](./deferred/07-product-culture.md).

## Status
Approved foundation.

## Version
2.0

## Last Review
2026-07-14

---

## Requirement Format
Every feature in this document is defined by:

- **Problem** — the user's situation the feature resolves.
- **Objective** — what the feature does, at the product level.
- **Value** — what the user gains.
- **Impact** — why it matters to the product and business.
- **Success criteria** — how we know it worked, in user terms.

No implementation. No stack. No data model. A requirement that references a technical choice is in the wrong document.

## Core
Core requirements define the product. Without all of them, Perch is not Perch.

### C1 — Beautiful New Tab Dashboard
- **Problem:** the browser new tab is empty, noisy, or visually neglected.
- **Objective:** make the first screen of a browser session useful and beautiful by default.
- **Value:** daily orientation and emotional attachment.
- **Impact:** establishes category and first impression.
- **Success criteria:** users understand the screen without instruction and describe it as an immediate improvement within the first session.

### C2 — Cards With Real Website Screenshots
- **Problem:** favicons and text lists are weak recognition tools.
- **Objective:** make saved sites visually recognizable.
- **Value:** faster recall and a richer personal space.
- **Impact:** primary visual differentiator and the basis of the share loop.
- **Success criteria:** users identify saved sites at a glance and screenshots remain reliable across captures.

### C3 — Visual Nested Folders
- **Problem:** flat bookmark structures break down as collections grow.
- **Objective:** let users organize resources in a visual hierarchy.
- **Value:** scalable organization without losing beauty.
- **Impact:** moves Perch beyond speed dial products and into the dashboard category.
- **Success criteria:** users create, navigate, and understand nested groups without confusion or lost content.

### C4 — Fluid Direct Manipulation
- **Problem:** organizing links often feels like configuration work.
- **Objective:** make arranging cards, folders, and widgets feel natural.
- **Value:** organization becomes satisfying instead of tedious.
- **Impact:** defines perceived product craft and differentiates Perch from form-based tools.
- **Success criteria:** drag, drop, reorder, and grouping feel immediate, predictable, and stable across thousands of operations.

### C5 — Save Current Page With Low Friction
- **Problem:** saving resources interrupts the browsing flow.
- **Objective:** let users save the current page quickly with useful metadata.
- **Value:** Perch stays current with minimal effort.
- **Impact:** increases habit and content density.
- **Success criteria:** saving a page feels obvious and fast, is recoverable if mistaken, and never requires more than a few seconds.

### C6 — Search Saved Resources
- **Problem:** even organized users forget where something lives.
- **Objective:** find saved resources across folders.
- **Value:** reduces memory burden.
- **Impact:** makes larger collections practical and reduces reliance on perfect organization.
- **Success criteria:** users retrieve known items quickly by title or URL, without browsing.

### C7 — Import Existing Favorites
- **Problem:** starting from zero delays value.
- **Objective:** populate Perch from existing browser favorites.
- **Value:** immediate utility.
- **Impact:** improves activation and shortens time-to-first-meaningful-setup.
- **Success criteria:** a new user gets a usable starting dashboard in the first session, with screenshots filling in over subsequent visits.

### C8 — Personal Visual Customization
- **Problem:** a personal browser home must feel owned.
- **Objective:** provide tasteful backgrounds and appearance controls.
- **Value:** self-expression without visual chaos.
- **Impact:** strengthens sharing and retention; drives the growth loop.
- **Success criteria:** users make the product feel personal while preserving readability; customization does not degrade the default.

## Important
Important requirements unlock paid value and durable retention. They are not required for the first beautiful launch, but the product is incomplete without them.

### I1 — Cross-Device Sync
- **Problem:** a personal browser home loses value when it exists on one machine only.
- **Objective:** keep the same Perch space across devices.
- **Value:** continuity and trust.
- **Impact:** strongest paid conversion trigger.
- **Success criteria:** users see sync as a natural reason to pay and feel Perch as the same home across devices.

### I2 — Cloud Backup
- **Problem:** users fear losing a carefully built setup.
- **Objective:** provide recovery and peace of mind.
- **Value:** protection of personal organization.
- **Impact:** increases paid retention.
- **Success criteria:** users trust Perch with long-term setup ownership and can restore after data loss.

### I3 — Bento Widgets
- **Problem:** links alone do not cover the daily browser-home moment.
- **Objective:** add useful, restrained information blocks.
- **Value:** more reasons to return without adding noise.
- **Impact:** strengthens habit.
- **Success criteria:** widgets support orientation and focus without crowding the screen or competing with cards.

### I4 — AI Organization
- **Problem:** organizing saved resources takes effort.
- **Objective:** suggest groups, names, cleanup, and structure.
- **Value:** reduces maintenance burden.
- **Impact:** creates a memorable Pro moment.
- **Success criteria:** users accept suggestions because they feel accurate, understandable, and reversible — and can dismiss or undo any suggestion.

### I5 — Semantic Search
- **Problem:** users often remember intent, not title or URL.
- **Objective:** find saved resources by meaning.
- **Value:** retrieval becomes more natural.
- **Impact:** supports larger collections and paid value.
- **Success criteria:** users find resources with vague or conceptual queries and trust the results.

## Future
Future requirements are directionally intended, not committed. They are listed so the team can evaluate whether adjacent work strengthens or contradicts them.

- Companion mobile or PWA experience.
- Shared setups and community gallery.
- Third-party widgets or marketplace.
- Project/session contexts.
- AI page summaries at save time.
- Advanced setup templates.

## Nice To Have
Nice to Have items may improve the experience but are never Blocking. They are pursued only when they require low effort and create no maintenance burden.

- Advanced keyboard shortcuts.
- Command palette.
- Additional clock and date modes.
- Optional subtle sounds or haptics where platform-appropriate.
- Multiple search providers.

## Anti-Requirements
Anti-requirements are things the product will explicitly not do. They are as binding as the Core requirements.

| Anti-requirement | Why |
| --- | --- |
| News feeds. | Competes with user content for attention; contradicts calm. |
| Ads or sponsored tiles. | Monetizes attention; violates brand promise and trust. |
| Mandatory account for core local value. | Locks the user out of their own space for the product's benefit. |
| Dark patterns. | Conversion by extraction is retention lost to distrust. |
| Browser-specific lock-in. | Cross-browser presence is a strategic position, not a cost. |
| AI that acts without consent. | User control before automation is non-negotiable. |
| Features that slow the new tab. | Performance is sacred on a high-frequency surface. |
| Configuration-heavy onboarding. | The default must be excellent before any flow exists. |

## Design Quality Bar
This is the canonical operational checklist that gates every interface for readiness. No interface can be considered done until each item is handled. This bar is referenced by [Product Principles](./03-product-principles.md) (quality framework) and [Product Culture](./deferred/07-product-culture.md) (how we treat quality).

| Item | What it means |
| --- | --- |
| Empty state | The surface guides the user when it has no content yet; it does not apologize or blank. |
| Loading state | The user sees that work is happening and is not abandoned. |
| Error state | Errors preserve confidence and show a clear recovery path. |
| Keyboard navigation | Every action reachable by mouse is reachable by keyboard. |
| Accessibility | Accessible names, semantics, readable contrast, and understandable labels. |
| Responsive behavior | The surface adapts across viewport sizes without breaking. |
| Motion consistency | Every animation obeys the same easing, timing, and logic. |
| Typography consistency | Hierarchy is established through a consistent typographic system. |
| Hierarchy | The eye arrives at the most important element without reading labels. |
| Performance | The surface feels immediate; no step makes the user wait without feedback. |
| Feedback | Every action is acknowledged; the user never guesses whether the product heard. |
| Reduced motion | `prefers-reduced-motion` is respected; motion is reduced, not removed blindly. |
| Focus states | Keyboard and assistive navigation position is visibly indicated. |

A surface that fails any item is not done, regardless of how it looks in a screenshot. This bar is not aspirational; it is the definition of finished.

## AI Principles
AI behavior across all requirements is governed by the [AI Experience Principles](./04-experience-principles.md#ai-experience-principles) in Experience Principles. They are not restated here to avoid duplication. The governing rule for any AI-related requirement: AI strengthens Perch and never becomes Perch. Every AI feature must conform to all nine principles in that document before it can be considered done.