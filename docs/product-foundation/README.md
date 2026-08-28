# Klice Start Product Foundation

## Objective
This directory is the canonical product foundation for Klice Start. It turns the company's strategy into a durable operating system for product, design, engineering, marketing, and founders — so the team can make consistent decisions for years without depending on implicit knowledge.

## Current Stage
This foundation describes the product Klice Start intends to become, not the organization that exists today. As of the last review, Klice Start is a single-device, local-only Manifest V3 extension loaded via "Load unpacked" — no backend, no sync, no accounts, no AI. The roles named across these documents (Head of Design, Growth Lead, Brand Lead) are role responsibilities, not filled positions. Read the foundation as a durable target: sections describing sync, AI, community, and category leadership are directional bets, not shipped reality. Where a document asserts market or category outcomes, treat them as hypotheses (see [Product Strategy](./02-product-strategy.md) Open Questions), not settled facts.

## Scope
Product, business, experience, brand, quality, culture, and strategic requirements.

## Out of Scope
Architecture, database, APIs, frameworks, infrastructure, implementation, DevOps, CI/CD, vendor selection, and technical specifications. Those belong to the next project phase.

## Owners
Founders, Product Leadership, Design Leadership.

## Dependencies
- Product decisions must reference the relevant document below.
- Requirements must reference strategy and principles before entering execution planning.
- Brand and experience decisions must remain consistent with company vision.

## Cross-References
1. [Company Vision](./01-company-vision.md)
2. [Product Strategy](./02-product-strategy.md)
3. [Product Principles](./03-product-principles.md)
4. [Experience Principles](./04-experience-principles.md)
5. [Design Manifesto](./05-design-manifesto.md)
6. [Brand Strategy](./deferred/06-brand-strategy.md) — **Deferred**
7. [Product Culture](./deferred/07-product-culture.md) — **Deferred**
8. [Product Requirements](./08-product-requirements.md)
9. [Product Glossary](./09-product-glossary.md)

### Deferred documents
Brand Strategy and Product Culture live in [`./deferred/`](./deferred/). They are written and preserved, but not active foundation today: they govern a public surface and a team that do not yet exist. Activate them when there is a public surface (landing page, store listing) or the first hire. Until then, do not treat them as binding for day-to-day decisions.

## Status
Foundation v2.0.

## Version
2.0

## Last Review
2026-07-14

## Structural Decisions

### Origins
The previous single `PLAN.md` mixed vision, strategy, culture, principles, requirements, risks, monetization, and future vision. It is now split by responsibility to reduce duplication and make governance easier. `PLAN.md` is reduced to an index and points here.

### Document responsibilities
- **Company Vision** owns why Klice Start exists, values, long-term ambition, and success definition.
- **Product Strategy** owns market logic, category, ICP, positioning, Blue Ocean, moat, North Star, monetization, growth, analytics, risks, and open questions.
- **Product Principles** owns the decision operating system: non-negotiables, the Product Decision Framework, Feature Evaluation Framework, Trade-off Framework, Innovation Framework, and refusal criteria.
- **Experience Principles** owns the desired felt experience, the experience maturity model, quality signals, experience anti-patterns, and the canonical AI experience philosophy.
- **Design Manifesto** owns the philosophy of premium software, taste, craft, and the recognition of quality.
- **Brand Strategy** (Deferred) owns personality, voice and tone, writing, communication, marketing, community, and the recognition signals.
- **Product Culture** (Deferred) owns the team's stance on bugs, feedback, debt, performance, accessibility, privacy, AI, quality, decisions, saying no, and feature creep.
- **Product Requirements** owns the feature taxonomy (Core / Important / Future / Nice to Have / Anti-Requirements) and the Design Quality Bar.
- **Product Glossary** owns the official product vocabulary and flagged ambiguities.

### v2.0 consolidation decisions
Three cross-cutting concepts were previously duplicated across documents. In v2.0 each has a single canonical home and is referenced, not restated, elsewhere.

1. **AI Principles.** Canonical home: [Experience Principles](./04-experience-principles.md#ai-experience-principles). [Product Culture](./deferred/07-product-culture.md) and [Product Requirements](./08-product-requirements.md) reference it instead of restating the nine principles.
2. **Design Quality Bar.** Canonical home: [Product Requirements](./08-product-requirements.md#design-quality-bar). [Product Principles](./03-product-principles.md) keeps the quality principle and points to the operational checklist; [Product Culture](./deferred/07-product-culture.md) references it.
3. **Quality / taste philosophy.** Canonical home: [Design Manifesto](./05-design-manifesto.md). Where other documents need the concept, they reference rather than redefine "taste" and "craft".

### Language and voice
All documents are written as internal product documentation: clear, direct, professional, and durable. Not marketing, not blog, not book. Each document carries a standard metadata header (Objective, Scope, Out of Scope, Owners, Dependencies, Cross-References, Status, Version, Last Review) so the suite can evolve professionally.

## How to use this foundation
- Before adding or rejecting a feature: consult [Product Principles](./03-product-principles.md).
- Before designing or evaluating a surface: consult [Experience Principles](./04-experience-principles.md) and [Design Manifesto](./05-design-manifesto.md).
- Before writing any user-facing copy: consult [Product Glossary](./09-product-glossary.md) (and [Brand Strategy](./deferred/06-brand-strategy.md) once activated).
- Before planning a phase: consult [Product Strategy](./02-product-strategy.md).
- When fundraising or storytelling: consult [Company Vision](./01-company-vision.md).
- When product pressure conflicts with quality: consult [Product Culture](./deferred/07-product-culture.md).
- Before calling any interface "done": consult the [Design Quality Bar](./08-product-requirements.md#design-quality-bar).