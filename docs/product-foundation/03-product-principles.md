# 03 — Product Principles

## Objective
Define how Klice Start makes product decisions, prioritizes, refuses features, resolves trade-offs, and protects quality. This is the decision operating system for the product.

## Scope
Non-negotiable principles, the Product Decision Framework, the Feature Evaluation Framework, the Trade-off Framework, the Innovation Framework, refusal criteria, and the long-term decision lens.

## Out of Scope
Roadmap dates, technical design, delivery process, and implementation details. The operational quality checklist (Design Quality Bar) lives in [Product Requirements](./08-product-requirements.md).

## Owners
Head of Product, Head of Design, Founders.

## Dependencies
[Company Vision](./01-company-vision.md), [Product Strategy](./02-product-strategy.md), [Experience Principles](./04-experience-principles.md).

## Cross-References
Use with [Product Requirements](./08-product-requirements.md) before adding or promoting any feature. Use with [Product Culture](./deferred/07-product-culture.md) when product pressure conflicts with quality.

## Status
Approved foundation.

## Version
2.0

## Last Review
2026-07-14

---

## How to use this document
Principles are not slogans; they are precedence rules. When two valid paths conflict, the framework below decides which wins — and records why. A decision that contradicts a principle is allowed only with written rationale and a sunset, never by default.

## Non-Negotiable Principles
These cannot be traded for growth, speed, or convenience. Violating one requires a written decision record and a reversal plan.

1. **Beautiful by default.** The first screen a user sees must be excellent without configuration.
2. **Performance is sacred.** The new tab must feel instant; anything that delays it must justify its existence.
3. **Privacy by default.** Local is the default; cloud and AI explain themselves before they are trusted.
4. **User control before automation.** Automation asks; it never silently acts.
5. **Direct manipulation before configuration.** Drag, drop, and touch before forms and settings.
6. **Simplicity before flexibility.** Powerful should feel obvious, not configurable.
7. **Consistency before novelty.** Every variation belongs to the same logic, not a new one.
8. **Accessibility by design.** Keyboard, focus, contrast, and semantics are finish criteria, not polish.
9. **Cloud optional, not mandatory.** Core value works on one device before any cloud feature exists.
10. **Motion must explain, not decorate.** Motion shows continuity and cause; competing for attention disqualifies it.

## Product Decision Framework
When two paths conflict, the higher rule wins. The ordering is the product's hierarchy of values — not a list of preferences.

| Rank | Rule | Beats | Because |
| --- | --- | --- | --- |
| 1 | Privacy beats convenience. | Convenience | Convenience that erodes trust is a one-way door. |
| 2 | Performance beats visual flourish. | Flourish | A slow beautiful product is worse than a fast calm one on a high-frequency surface. |
| 3 | User control beats automation. | Automation | The user's space is theirs; automation is a guest, never the host. |
| 4 | Simplicity beats flexibility. | Flexibility | Flexibility spreads complexity across all users; simplicity absorbs it once. |
| 5 | Consistency beats novelty. | Novelty | Relearning the product costs trust the novelty cannot repay. |
| 6 | Clarity beats cleverness. | Cleverness | Cleverness demands attention; clarity returns it. |
| 7 | Long-term trust beats short-term conversion. | Conversion | Conversion gained by extraction is retention lost to distrust. |
| 8 | Quality beats shipping volume. | Volume | We ship fewer things that last, not more things that churn. |

**How to apply:** when a discussion stalls, name the two paths in conflict, locate the first matching rank, and let that rank decide. If the team disagrees with the rank, the resolution is to amend this table with written rationale — not to override it silently.

## Feature Evaluation Framework
Every proposed feature must answer the nine questions below. This is not a scoring rubric with weights; it is a gate. A feature must improve the product in at least several of these dimensions, and may not regress the non-negotiables.

| Question | Standard the feature must meet |
| --- | --- |
| Does it improve beauty? | The product feels more premium, not busier. |
| Does it improve organization? | Users find or structure things with less effort. |
| Does it improve performance? | It must not slow the new tab. |
| Does it improve privacy? | It preserves or clarifies user ownership. |
| Does it improve habit? | It makes Klice Start more worth returning to. |
| Does it improve ownership? | Users feel the space is more theirs. |
| Does it improve delight? | It adds quality without demanding attention. |
| Does it improve retention? | It strengthens durable value, not novelty. |
| Does it improve clarity? | It reduces cognitive load. |

**Decision rule:** if a feature answers "no" to most questions, it does not belong in Klice Start. If it answers "yes" to several but "no" to performance or privacy, it is rejected regardless of other gains — those are non-negotiable, see above.

## Trade-off Framework
Trade-offs are recurring choices the product will face. Recording the stance removes re-litigating the same decision.

| Choose | Over | Because |
| --- | --- | --- |
| Fewer features with higher finish | Broad coverage | Finish is the product's competitive surface; coverage is not. |
| Excellent defaults | Expansive setup flows | Defaults are experienced by everyone; flows only by those who opt in. |
| Contextual controls | Permanent controls | Controls that appear when needed reduce chrome and cognitive load. |
| Invisible complexity | Exposed complexity | Absorbing complexity is the product's job, not the user's. |
| Honest limitations | Fragile promises | A known limit builds more trust than an unreliable capability. |
| Durable product memory | Growth hacks | Memory compounds; hacks decay. |

## Innovation Framework
Innovation is not the presence of new things; it is the removal of old limits. A change qualifies as innovation only if it does at least one of the following:

- Makes the product feel more natural (reduces learned friction).
- Removes a recurring user burden.
- Strengthens the category position.
- Creates a visible quality leap.
- Protects privacy or ownership.

**Rejected by default:** innovation that exists mainly to signal novelty, to dominate release notes, or to differentiate on a dimension the user does not feel. Innovation must be felt as a reduction in burden or an increase in quality — not as a checkbox.

## How We Say No
Refusal is a product skill, not a negative output. We say no when a feature:

- Adds noise to the new tab.
- Requires a mandatory account for core local value.
- Creates dependency without enough trust.
- Makes the interface harder to understand.
- Competes with the user's content for attention.
- Serves acquisition at the cost of product quality.
- Expands the product beyond the browser home without a clear strategic reason.

A "no" with a stated principle is more valuable than a "yes" that dilutes the product. Saying no is how simplicity is protected.

## Long-Term Decision Lens
Every material decision is filtered through three horizons (see [Company Vision](./01-company-vision.md) for the framework). The product principle is simple: **when a decision improves the short frame but erodes the long frame, the long frame wins.** A feature that lifts a quarterly metric but reduces perceived quality, privacy, or calm is a strategic loss even if it ships.

The practical test before promoting any feature: would we be proud of this decision in three years? If the answer is uncertain, the decision is deferred, not defaulted to "yes."