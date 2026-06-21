# LUCY 2.0 — Product Direction (decided)

> Decided autonomously by the team per the owner's mandate: "the best version of LUCY anyone can build,"
> monetizable, with monetization + monitoring that 1.0 lacked. No open questions — anything requiring the
> owner is parked in `NEEDS_FROM_YOU.md` and does not block the build.

## 1. What LUCY is
A **private, on-device-first AI second brain + proactive life manager.** You capture life by voice, text,
or photo; LUCY extracts and organizes it automatically; then it recalls, connects, and acts — scheduling,
health, money, relationships, commitments — proactively, while keeping data on the device.

**Why it wins (differentiation):**
- **Privacy-first / on-device** extraction & storage (vs. cloud-only ChatGPT/Notion/Rewind).
- **Proactive autopilots** (trip, move/lease, money goals, commitments, Dr. Lucy) — it acts, not just stores.
- **Cross-domain memory** — one brain over notes, people, health, money, calendar.
- **Calm, self-evident UX** (the five design constraints) — a daily companion, not a tool you fight.

## 2. Who it's for
Busy professionals, founders, students — people who think out loud and need capture without manual filing.

## 3. The core loop (must be self-evident, zero onboarding)
**Capture → LUCY organizes → Recall / Act.** First-run success = first capture + first successful recall.

## 4. Monetization model (freemium subscription via RevenueCat)
| Tier | Price (proposed) | Includes |
|------|------------------|----------|
| **Free** | $0 | On-device model only; up to 15 captures/day; basic recall; 1 active autopilot; manual reminders. |
| **Pro Monthly** | **$9.99/mo** | Unlimited captures; premium cloud models (Claude/GPT); all autopilots; advanced Health + Money; LAN companion; meeting mode; priority processing. |
| **Pro Annual** | **$79.99/yr** (33% off) | Everything in Pro; best value (anchor plan). |
| **Lifetime** | **$199 one-time** | Everything, forever (whales / launch promo). |

- **7-day free trial** on Pro (no card friction where the store allows).
- **Entitlement** `pro` gates premium features through one `useEntitlement()` + `<Gate>` API.
- Pricing is a starting point; final prices set in App Store Connect / Play / RevenueCat (see NEEDS_FROM_YOU).

## 5. Growth loops
- **LUCY Wrapped** quarterly share (already in 1.0) → viral surface; add share-to-unlock + referral.
- **Referral**: give Pro days for invites (RevenueCat offerings / promo codes).
- **ASO**: privacy-first second brain positioning; screenshots of the calm redesign.

## 6. Monitoring & observability (NEW in 2.0 — absent in 1.0)
- **Sentry** — crash & error monitoring (wired into ErrorBoundary + global handler).
- **PostHog** — product analytics, funnels, retention cohorts, feature flags, optional session replay.
- **Revenue/metrics dashboard** (Next.js) — MRR, active subscriptions, trial conversion, churn, DAU/WAU/MAU,
  activation funnel, top features. Pulls RevenueCat + PostHog.
- **Event taxonomy** is defined once in `app/src/telemetry/events.ts` (no ad-hoc events).

## 7. North-star metrics
Activation (first capture + first recall within session 1) · D1/D7/D30 retention ·
Free→Paid conversion · Trial→Paid · MRR · Churn · Captures/active-user/week.

## 8. Non-negotiables carried from the master prompt
- **Logic frozen & reused** from 1.0 (parity contract = `docs/10_FEATURE_CATALOG.md`).
- **Nothing lost** — every 1.0 capability preserved or formally adjudicated.
- **Five design constraints** govern every surface: self-evidence > calm > legible > premium motion > instant render.
