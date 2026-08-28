# 04 — Experience Principles

## Objective
Define how Klice Start should feel, respond, surprise, age, and communicate quality. This document owns the canonical AI Experience Principles referenced across the foundation.

## Scope
Experience qualities, interaction feel, emotional tone, pacing, feedback, durability, experience anti-patterns, and the AI experience philosophy.

## Out of Scope
Component specifications, color tokens, layout specs, technical animation implementation, and design system rules. Those belong to future design system documentation.

## Owners
Head of Design, Product Design, Head of Product.

## Dependencies
[Product Principles](./03-product-principles.md), [Design Manifesto](./05-design-manifesto.md), [Brand Strategy](./deferred/06-brand-strategy.md).

## Cross-References
- AI experience principles defined here are the canonical source. [Product Culture](./deferred/07-product-culture.md) and [Product Requirements](./08-product-requirements.md) reference this document rather than restating them.
- Use this document when evaluating prototypes, interaction models, onboarding, and perceived quality.

## Status
Approved foundation.

## Version
2.0

## Last Review
2026-07-14

---

## Desired Feeling
Klice Start should feel like coming home: calm, personal, fast, controlled, and quietly premium.

It should not feel like a dashboard trying to impress the user. It should feel like the user's own space has been treated with care. The difference is the source of the quality: a dashboard performs; a home accommodates. Every experience decision should be testable against this distinction — does this serve the user, or does it serve the product's need to be noticed?

## Experience Maturity Model
A new tab is opened dozens of times a day. The experience must mature across exposure, not just across onboarding. Each stage has a specific goal; falling short at any stage breaks the relationship at the stage that follows.

| Stage | Timeframe | Goal | Failure mode |
| --- | --- | --- | --- |
| First five seconds | On first open | The product is immediately understandable and beautiful without configuration. The user feels the browser has improved before learning any feature. | A blank state, a settings prompt, or visual noise. |
| First thirty seconds | First interaction | One memorable moment of quality: a beautiful default, a natural drag, an elegant folder, a fast save, a clean import. | No single moment worth remembering. |
| First week | Habit forming | Familiar without becoming boring. Each return reinforces orientation, speed, and ownership. | Novelty that fades; a feature that is noticed once and ignored after. |
| Repeated use | Thousands of visits | The interface tolerates heavy repetition without feeling loud, trendy, or exhausting. | Accumulating visual fatigue; a detail that becomes annoying at volume. |

The repeated-use stage is the hardest and the least visible in screenshots. A transition that delights on first view can irritate on the thousandth. Every motion and ornament must be evaluated at volume, not only at first impression.

## Response
Every interaction should respond immediately. Even when work continues in the background, the user should never feel ignored.

The standard is not "the action completes instantly" — it is "the product acknowledges the action instantly." A delayed save that shows immediate feedback is felt as faster than a slightly faster save that shows nothing until it finishes. Perceived performance is a respect signal, not only a performance metric.

## Surprise
Surprise should be rare, useful, and quiet. It appears through craft, not spectacle: a transition that makes spatial sense, an empty state that guides, an AI suggestion that respects control, a setup that looks better than expected.

Surprise that demands attention to be understood is decoration. Surprise that the user notices once and then stops noticing — because it became the expected behavior — is craft. The latter is the target.

## Aging
Aging is a design constraint, not a hope — the operational form of the repeated-use stage above. It argues against trending visual effects, against color palettes that fatigue, against motion that demands attention every time; and for restraint, stable rhythm, and details that recede once learned.

## Quality Signals
Users should perceive quality without being able to name every component of it. These are the signals that compound into the felt sense of "this is well made":

- Instant loading.
- Stable layout (no content jumps on render).
- Clean hierarchy (the eye knows where to look first).
- Consistent motion (every animation obeys the same logic).
- Thoughtful empty states (they guide, not blank).
- Reliable screenshots (the primary visual promise).
- Predictable drag and drop (no surprises, no broken drops).
- Clear recovery from errors (errors preserve confidence).
- Respectful defaults (the product trusts the user's first choice).
- No unnecessary interruption (the product never interrupts a flow to promote itself).

## AI Experience Principles
This is the canonical AI experience philosophy. Other documents reference this section rather than restating it.

AI in Klice Start is an assistant layer. It strengthens the product; it never becomes the product. The principles below govern how AI behaves in the experience.

| Principle | What it requires |
| --- | --- |
| AI never replaces user control. | The user's arrangement is the source of truth. AI proposes; the user disposes. |
| AI is optional. | Every AI feature has a non-AI path. No user is forced into AI to reach core value. |
| AI is transparent. | The user can always tell what AI did, what it used, and how to undo it. |
| AI explains what it is doing. | Suggestions show their reasoning in plain language, not black-box confidence. |
| AI enhances existing workflows. | AI reduces maintenance burden; it does not introduce new mandatory surfaces. |
| AI is predictable. | AI does not surprise the user with unrequested changes. The user's space does not change shape without consent. |
| AI never blocks core workflows. | If AI fails, is disabled, or is unavailable, the core product is fully usable. |
| AI respects privacy. | AI features clarify what data they use and where it is processed. Local-first applies to AI too. |
| AI strengthens Klice Start; it does not become Klice Start. | The product's identity is ownership and calm. AI that overshadows that identity has failed regardless of capability. |

The design test: remove the AI. Does Klice Start still feel like Klice Start? If the answer is no, the AI has overwritten the product. If the answer is yes, the AI is in its correct place.

## Experience Anti-Patterns
These are explicitly rejected experience patterns. They are not preferences; they are failure modes.

- Tours that delay value.
- Popups that ask before earning trust.
- Decorative motion without meaning.
- Dense settings on first run.
- Feeds, recommendations, and sponsored content.
- AI that acts without consent.
- Visual effects that hide hierarchy.
- Interruption of the user's flow to surface the product's own needs.
- Empty states that blame the user for having nothing yet.
- Error states that make the failure feel final rather than recoverable.