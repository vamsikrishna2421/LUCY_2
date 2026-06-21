# Needs From You (parked — does not block the build)

Everything here has a working placeholder/no-op so development continues without it. Attach these when you're
back; nothing below is blocking. Grouped by when you'll need it.

## A. To run premium features on a real device (monetization)
- [ ] **RevenueCat account** + project → iOS & Android **public SDK keys** (`EXPO_PUBLIC_RC_IOS_KEY`,
      `EXPO_PUBLIC_RC_ANDROID_KEY`). Until set, billing runs in **mock mode** (all gates testable).
- [ ] In RevenueCat: create entitlement **`pro`** and an offering with products
      `lucy_pro_monthly` ($9.99), `lucy_pro_annual` ($79.99), `lucy_lifetime` ($199). (Prices final at your call.)
- [ ] **App Store Connect** subscriptions + **Google Play** subscriptions created and linked to RevenueCat.

## B. Monitoring keys (analytics + crash)
- [ ] **Sentry** project → DSN (`EXPO_PUBLIC_SENTRY_DSN`). Until set, Sentry is a no-op.
- [ ] **PostHog** project → API key + host (`EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST`).
      Until set, analytics is a no-op (events logged to console in dev).

## C. Cloud-AI tier (Pro models)
- [ ] Decide cloud-model billing: **BYOK** (user pastes their own OpenAI/Claude key — already supported in 1.0)
      vs **managed** (you front the cost, gated to Pro). 1.0 keys in `app/.env.local` are dev-only.

## D. Metrics dashboard (`dashboard/`)
- [ ] **RevenueCat secret API key** (server-side, for MRR/subscriptions).
- [ ] **PostHog personal API key** (server-side, for DAU/retention/funnels).
- [ ] Dashboard admin password (`DASHBOARD_PASSWORD`) + deploy target (Vercel recommended).

## E. Store / release
- [ ] Apple Developer Program + Google Play Developer accounts (for EAS submit).
- [ ] Final **app name / bundle id** confirmation for 2.0 (currently inherits 1.0 ids from `app.json`).
- [ ] App Store / Play listing assets (we'll generate screenshots from the redesign).

## F. Decisions we made for you (override anytime)
- Pricing tiers (see `docs/01_PRODUCT_DIRECTION.md`).
- Dark theme primary; light theme deferred.
- PostHog over Amplitude (open-source, flags + replay included).
- Next.js + Vercel for the dashboard.

_Status: all of the above are stubbed; the app and dashboard build and run without them._

## G. Bug/not-bug rulings (from the Feature Catalog — interim default = preserve 1.0; override anytime)
The catalog (`docs/10_FEATURE_CATALOG.md`, 470 rows) surfaced 5 behaviors where 1.0 is ambiguous or
contradicts its own docs. Logic is frozen, so the build **preserves current 1.0 behavior** for all 5 until you
rule. Recommendation per item:

1. **LAN companion server has NO auth** (SRV-004) — ships with `ServerState.pin = null` + a "security comes
   later" comment, yet the inventory + in-app manual claim it's "PIN-gated."
   **Recommendation: REAL BUG → fix in 2.0** (require a PIN before the LAN server exposes memory). Security gap
   on a feature that already promises protection. _Interim: unchanged._ Needs your OK to change logic.
2. **Self-improving brain disabled by default** (PROC-138) — `proposeMemoryUpdates` gated off
   (`AUTO_MEMORY_UPDATES_ENABLED=false`); apply-path + table live but dormant.
   **Recommendation: preserve disabled**; optionally expose in 2.0 behind an opt-in review card. _Interim: preserved._
3. **`config.remoteProvider` pinned 'openai' but real default model is Claude Sonnet** (CFG-002 vs AI-046) —
   routing keys off the selected model, not `remoteProvider`. **Recommendation: keep model-based routing; do NOT
   "simplify" to trust `remoteProvider`** (would misroute Claude users to OpenAI). _Interim: preserved (guardrail)._
4. **Two automation paths both wired** (PROC-102/103) — legacy regex action path + newer LLM
   `detected_action`/`pending_actions` flow. **Recommendation: preserve both**; verify the legacy path is dead
   before removing. _Interim: preserved._
5. **MusicDetector is a stub** (AUD-019) — ShazamKit removed (returns null), but ACR keys, `db/musicCaptures` +
   dedup, and passive-music knobs remain dormant. **Recommendation: preserve dormant** or drop for cleanliness —
   your call. _Interim: preserved._

6. **Latent "note on completion" modal** (Capture) — 1.0 defined a "Mark as done" modal
   (`archiveTodo` with `done: <note>`) that was UNREACHABLE (never triggered). The redesign did not invent a
   trigger (that would add behavior 1.0 never shipped). **Recommendation: leave dormant** unless you want the
   note-on-completion feature wired. _Interim: not wired (matches reachable 1.0)._
7. **`getRemoteAccessState` imported but never called in Capture 1.0** — the redesign preserves this (doesn't
   call it). **Recommendation: confirm it's a dead import** (no behavior change). _Interim: not called._

Only #1 (security) is one I'd push to fix proactively. None block the redesign.
