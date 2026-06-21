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
