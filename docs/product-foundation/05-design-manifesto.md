# 05 — Design Manifesto

## Objective
Define Klice Start's design philosophy and what premium software means for the company. This is not a design system. It is a manifesto that should govern every future designer's instincts.

## Scope
The philosophy of premium software, space, motion, consistency, simplicity, typography, hierarchy, visual rhythm, microinteractions, craft, taste, and the recognition of quality.

## Out of Scope
Component library, design tokens, implementation specs, accessibility checklists (see the Design Quality Bar in [Product Requirements](./08-product-requirements.md)), and brand asset production.

## Owners
Head of Design, Founders, Product Design.

## Dependencies
[Experience Principles](./04-experience-principles.md), [Brand Strategy](./deferred/06-brand-strategy.md), [Product Principles](./03-product-principles.md).

## Cross-References
Use this document before creating a design system or evaluating major interface direction. It is the philosophy the design system must serve, not the other way around.

## Status
Approved foundation.

## Version
2.0

## Last Review
2026-07-14

---

## Premium Software Manifesto
Premium software is not expensive software. It is software where intention is visible.

Every pixel, every animation, every transition, every empty state, every error, and every feedback moment should feel considered. Nothing should be present because nobody decided to remove it. Nothing should be absent because nobody decided to add it.

Klice Start earns premium perception through restraint, speed, hierarchy, consistency, and care — not through ornament, density, or the implication of capability. The standard is not "does it look good in a screenshot." The standard is "does it still feel good after the thousandth open."

Premium is the felt residue of a thousand decisions that trusted the user's attention.

## Why space matters
Space is not decoration. It is how the interface gives the user room to think.

Klice Start uses space to create calm, hierarchy, and confidence. Crowded interfaces imply the user must process everything at once; generous space implies the product trusts the user to choose what matters next. Space is the most underused tool in software because it looks like "nothing" in a design review — but in repeated use, it is the difference between a surface that exhausts and one that accommodates.

If a screen feels busy, the answer is rarely "redesign it." The answer is usually "remove what is competing for attention and let the remaining content breathe."

## Why motion matters
Motion must explain continuity. It should help the user understand where something came from, where it went, and what changed.

Motion that competes for attention is not craft — it is noise wearing the costume of polish. The test for any motion is purpose: if it is removed, does the user lose understanding? If yes, the motion earned its place. If no, the motion is decoration and should be cut or made subtler.

On a high-frequency surface, motion has an additional constraint: it must tolerate repetition. An animation that delights on first view and irritates on the hundredth has failed. Design motion for the thousandth time, not the first.

## Why consistency matters
Consistency creates trust. Users should not have to relearn Klice Start in different parts of the product.

Consistency does not mean sameness. It means every variation belongs to the same logic. A drawer and a modal can behave differently, but the easing, the timing, the way they acknowledge a press, and the way they recover from cancellation should obey one coherent model. When users learn one part of Klice Start, they should predict the rest.

Inconsistency is not a styling problem; it is a trust problem. Every time the product behaves differently from how the user predicted, it loses a small amount of credibility that compounds across a session.

## Why simplicity matters
Simplicity is the result of absorbed complexity, not the absence of capability.

Klice Start should make powerful organization feel obvious, not limited. The work of simplicity is done by the product, not asked of the user: complexity is absorbed once, in design, so it never has to be re-absorbed by every user every time. A feature that requires the user to read documentation to understand it is not simple — it is complexity relocated.

The hardest simplicity is refusing to add a feature that would make the product "more complete" at the cost of making it harder to understand. Simplicity is protected by refusal, see [Product Principles](./03-product-principles.md).

## Why typography matters
Typography is interface infrastructure. It controls density, confidence, and scan speed.

Klice Start uses type to clarify, not decorate. Hierarchy is established through size, weight, and spacing — not through ornament or color tricks. The user's content comes first typographically; controls, labels, and configuration recede. When typography is right, the user is never aware of it. When it is wrong, every screen feels slightly off and the cause is hard to name.

## Why hierarchy matters
Hierarchy decides what the eye understands first. In Klice Start, the user's content comes first, controls come second, and configuration comes last.

A screen with weak hierarchy forces the user to scan and decide where to look. A screen with strong hierarchy lets the eye arrive. The test: without reading any label, can a new user identify the most important thing on the screen? If the answer is no, hierarchy has not been earned yet.

## Why visual rhythm matters
Rhythm makes a product feel composed. Spacing, sizing, alignment, and motion should create a repeatable cadence that survives growth.

Rhythm is what makes a product feel designed rather than assembled. When elements align to a consistent grid of spacing, the surface reads as intentional even if the user cannot articulate why. When rhythm breaks — a margin that is 11px instead of 12, a corner radius that drifts from 18 to 16 — the product feels slightly handmade in the worst sense. The invisible correctness of rhythm is the accumulation that produces the felt sense that "this was made by people who care."

## Why microinteractions matter
Microinteractions are promises. Hover, press, drag, save, undo, error, and success states teach the user whether the product is alive and reliable.

A button that does not respond to press feels disconnected from the user — as if the interface did not hear them. A drag that stutters breaks the metaphoric contract that "I am holding this object." These are not details; they are the moments where the product proves it is listening. Most users never consciously notice a good microinteraction. That is the goal — the absence of doubt.

Microinteractions compound. A single missing `:active` state is invisible; a hundred of them across a product is the difference between software that feels alive and software that feels assembled.

## Why craft matters
Craft is the accumulation of small decisions that remove doubt. It is visible when the product behaves correctly in edge cases, not only in ideal screenshots.

Craft is not polish added at the end. It is the discipline of treating the edge case — the empty folder, the failed screenshot, the drag over an invalid target, the tab opened ten thousand times — as a first-class design problem. A product is judged by its worst common moment, not its best rare one.

## How we define taste
Taste is the ability to choose what not to show, what not to build, and when enough is enough.

Klice Start defines taste as disciplined restraint in service of clarity, beauty, and user control. Taste is not personal preference and it is not a style — it is a trained instinct for the decision that serves the user's relationship with their own environment. Taste is learned by surrounding oneself with great work, asking why it feels right, and practicing the refusal of what does not.

Taste is also a product capability: it is the layer competitors cannot copy with a single redesign, because it is distributed across hundreds of decisions that only compound when made consistently over time. That is why taste is listed as a value in [Company Vision](./01-company-vision.md), not a footnote in design.

## How we recognize quality
Quality is what remains when nothing calls attention to itself: the product is understood without explanation, edge cases are designed rather than tolerated, and the user feels ownership rather than manipulation. It is a thousand unheard details all singing in tune.

That recognition becomes a pass/fail gate in the [Design Quality Bar](./08-product-requirements.md#design-quality-bar). This section is the instinct; the Bar is the checklist that instinct produces. A surface that looks finished in a screenshot but fails the Bar is not finished.