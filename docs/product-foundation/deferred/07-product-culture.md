# 07 — Product Culture

> **Deferred.** Ativar quando existir superfície pública / primeiro hire.

## Objective
Define how the team builds Perch and protects quality under pressure. Culture is what the team does by default when no one is checking.

## Scope
The team's stance on bugs, feedback, debt, performance, accessibility, privacy, AI, quality, decisions, saying no, feature creep, and protecting simplicity.

## Out of Scope
Org chart, engineering process, sprint rituals, hiring plan, and technical architecture.

## Owners
Founders, Product Leadership, Design Leadership, Engineering Leadership.

## Dependencies
[Product Principles](../03-product-principles.md), [Experience Principles](../04-experience-principles.md), [Product Requirements](../08-product-requirements.md).

## Cross-References
- AI stance: this document reflects the cultural attitude toward AI. The canonical AI experience principles live in [Experience Principles](../04-experience-principles.md).
- Use this document when product pressure conflicts with quality, speed, or focus.

## Status
Approved foundation.

## Version
2.0

## Last Review
2026-07-14

---

## How we build products
We build from the user's daily moment outward. Perch is a high-frequency surface, so small defects compound quickly and small improvements compound meaningfully.

This is not a platitude about caring. It is a factual claim about a product opened dozens of times a day: a regression is felt dozens of times a day, and a craft improvement is felt dozens of times a day. The economics of quality are different on a high-frequency surface — quality pays compounding interest, and debt compounds compounding penalties. The team treats each accordingly.

## How we treat bugs
Bugs in the new tab experience are product defects, not only engineering issues.

A bug affecting loading, screenshots, saved content, drag, search, privacy, or data trust is high priority because it damages the product promise — not because it is technically severe. A flicker on render is low severity in most products and high severity in one opened a hundred times a week. Bug triage must weight frequency, not only blast radius.

## How we treat feedback
Feedback is evidence, not instruction. We listen carefully, identify the underlying problem, and decide through strategy and principles.

The user's proposed solution is often not the right solution. Our job is to extract the problem behind the request and route it through [Product Principles](../03-product-principles.md). A feature request that the team implements verbatim is delegation, not design. Feedback that changes direction is documented; feedback that does not is acknowledged and explained.

## How we treat debt
Debt is acceptable only when it is visible, intentional, and does not degrade the user experience. Invisible debt that slows future quality must be paid before expansion.

The test: would a teammate discovering this debt tomorrow be surprised by it? If yes, it is invisible debt and it is a defect. Visible, intentional debt with a plan is a tool; invisible debt and chronic neglect are a betrayal of the team's future.

## How we treat performance
Performance is a core product feature. The new tab must feel immediate. Anything that delays orientation or interaction must justify its existence.

Performance is not a non-functional requirement. On a surface opened this often, latency is felt as disrespect — the product is making the user wait for its own reasons. A feature that adds 100ms to first paint must defend that cost; the default assumption is that it is too expensive until proven otherwise.

## How we treat accessibility
Accessibility is part of quality. A feature that cannot be used with keyboard, focus states, readable contrast, and understandable labels is not finished — it is feature debt pretending to be a feature.

Accessibility is not a compliance line item. It is the principle that a screen reader user, a keyboard-only user, and a mouse user all encounter the same quality product. If the quality is only visible to one of them, the quality is an illusion.

## How we treat privacy
Privacy is a product decision, not a legal posture. The default is local, transparent, and user-owned. Cloud and AI must explain themselves before they are trusted.

Privacy decisions are made in product reviews, not deferred to privacy review at the end. When a feature is conceived, the first privacy question is not "is this compliant?" but "would the user be comfortable if they could see everything this does?" If the answer is no, the feature is redesigned, not the disclosure.

## How we treat AI
AI is an assistant layer, not the product identity. It removes effort, explains itself, preserves control, and never blocks the core workflow. The cultural stance is skepticism by default: AI earns its place by demonstrating it strengthens the user's relationship with their own environment — not by demonstrating capability for its own sake.

The canonical AI experience principles live in [Experience Principles](../04-experience-principles.md). The cultural rule here: if removing the AI would make Perch feel less like Perch, the AI has failed. If removing it would make Perch feel more like Perch, the AI should never have shipped.

## How we treat quality
Quality is judged by repeated use, not launch screenshots. A feature is only high quality when default, empty, loading, error, edge, responsive, accessible, and reduced-motion states are handled.

The operational checklist for this judgment is the Design Quality Bar in [Product Requirements](../08-product-requirements.md). The cultural principle behind it: a feature is not done when it works in the happy path; it is done when it behaves correctly in every state the user can reach. Anything less is a feature pretending to be finished.

## How we take decisions
Decisions are written when they affect strategy, brand, pricing, privacy, or product surface area. The goal is not bureaucracy; the goal is organizational memory.

A decision that exists only in a meeting is a decision the team will relitigate. A decision that is written and referenced is a decision that compounds. The team errs toward writing decisions down, even when it feels slow, because the cost of re-deciding is always higher than the cost of recording.

## How we say no
Saying no is a product skill. We say no when a feature makes Perch noisier, slower, more dependent, less private, harder to understand, or less distinctive.

A no is not a rejection of the person who proposed the feature. It is a defense of the product. The team practices saying no with a stated principle, because a no without a reason leaves a vacancy the next request fills.

## How we avoid feature creep
Feature creep often arrives disguised as completeness. Perch does not need to do everything a browser, OS, dashboard, or productivity suite can do. It needs to be the best browser home.

The cultural rule: a feature must defend its place against the question "would Perch be better without this?" If the team cannot confidently answer no, the feature is a candidate for removal. Completeness is a competitor's frame; Perch competes on being excellent at what it chooses to do.

## How we protect simplicity
Simplicity is protected by defaults, progressive disclosure, principled refusal, and strong ownership. Every new feature must pay rent in clarity, habit, or strategic advantage.

Simplicity is not the team's starting state; it is the team's ongoing output. It is protected actively, by every refusal and every default choice. The day the team stops protecting simplicity is the day the product begins to die by a thousand reasonable additions.