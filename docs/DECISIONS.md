# Decisions (pending only)

Locked context: local-only MV3, no backend/accounts/billing. Supabase (Postgres + Drizzle) scaffolded, unused. Past verdicts live in `perf/diagnosis.md` §8.

### D1 — Backend for Pro
**Status:** pending
**Question:** Where do sync, accounts, and Pro entitlements live?
**Options:** Supabase (scaffolded) / Cloudflare (Workers + D1 + R2) / `apps/web` self-hosted Next.
**Recommendation:** Supabase — schema/orm direction already set, Realtime fits cross-tab sync evolution. Decide before any Pro surface.

### D2 — AI: BYOK vs hosted
**Status:** pending
**Question:** Who pays for and holds AI keys?
**Options:** BYOK (user key, zero marginal cost, privacy-aligned) / hosted proxy (frictionless, billed).
**Recommendation:** BYOK first — matches "cloud optional" and zero-cost local posture; hosted only if a killer AI moment demands it.

### D3 — Billing
**Status:** pending
**Question:** Merchant of record?
**Options:** Polar / Lemon Squeezy / Stripe / license key.
**Recommendation:** Polar or Lemon Squeezy (MoR, not raw Stripe) — minimal tax/VAT surface for a solo/small team. No choice needed until I1.

### D4 — Bundle budget
**Status:** pending
**Question:** Numeric JS limit for the newtab chunk?
**Options:** 350 KB / 500 KB / no cap with long-task budget instead.
**Recommendation:** Cap by long task, not bytes: cold-load dominant task ≤200 ms on reference hardware; measure per release with `bench-cold-load.mjs`. Bytes follow.

### D5 — i18n: implement or EN-only launch
**Status:** pending
**Question:** Ship other locales at launch?
**Options:** EN-only / full i18n infra now.
**Recommendation:** EN-only launch — manifest declares `default_locale: en` but no `_locales/` exists; adding locales is pure cost pre-launch. Revisit with first non-EN user evidence.
