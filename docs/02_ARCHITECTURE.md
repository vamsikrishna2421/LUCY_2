# LUCY 2.0 — Architecture

## 1. Repo layout (monorepo)
```
lucy/                         # repo root → github.com/vamsikrishna2421/LUCY_2
├─ app/                       # LUCY 2.0 mobile app (Expo/RN) — fork of 1.0, logic frozen
│  ├─ src/
│  │  ├─ ai|db|processing|scheduling|audio|voice|server|types|utils|config/   # FROZEN logic (reused 1:1)
│  │  ├─ ui/                  # NEW design system (tokens, primitives, components)
│  │  ├─ screens/             # redesigned screens (bind to frozen logic)
│  │  ├─ components/          # 1.0 components (migrated to ui/ progressively)
│  │  ├─ billing/             # NEW monetization (RevenueCat, entitlements, paywall)
│  │  ├─ gating/              # NEW feature gates (free vs pro)
│  │  └─ telemetry/           # NEW monitoring (Sentry + PostHog + event taxonomy)
│  └─ App.tsx                 # redesigned root/nav (decomposed)
├─ dashboard/                 # NEW Next.js metrics/admin dashboard (MRR, retention, funnels)
├─ docs/                      # governance: inventory, catalog, direction, architecture, design system
├─ PROJECT_STATE.md           # orchestrator living doc
└─ NEEDS_FROM_YOU.md          # parked items needing the owner (never blocks)
```

## 2. The UI/Logic seam (parity guarantee)
**Frozen (do not edit except adjudicated real bugs):** `ai, db, processing, scheduling, audio, voice,
server, types, utils, config`. These are the proven 44k-LOC brain.

**Replaceable (redesign freely):** `screens, components, App.tsx`, plus new `ui, billing, gating, telemetry`.

**Presentation Interface Contract:** screens/components consume logic only through its existing exported
functions and through thin React hooks/services in the UI layer. No screen imports reach into logic internals
or mutate logic modules. If a redesign appears to need a logic change → stop, log it as a suspected real bug
in PROJECT_STATE, keep going around it.

## 3. Monetization architecture
```
RevenueCat SDK (react-native-purchases)
   └─ billing/purchases.ts        # init, getOfferings, purchase, restore
   └─ billing/EntitlementProvider # React context: { isPro, tier, offerings, loading }
        └─ gating/useEntitlement() # hook → boolean/limits
        └─ gating/Gate.tsx          # <Gate feature="..."> wraps premium UI, shows Paywall on lock
   └─ billing/Paywall.tsx          # the paywall screen (built on ui/)
```
- Free-tier limits centralized in `gating/limits.ts` (e.g., capturesPerDay).
- Entitlement id: `pro`. Offerings configured in RevenueCat dashboard (see NEEDS_FROM_YOU).
- Optional backend: RevenueCat **webhook** → `dashboard` API route to mirror subscription events for metrics.

## 4. Monitoring architecture
```
telemetry/sentry.ts    # @sentry/react-native init (DSN from env), error capture
telemetry/posthog.ts   # posthog-react-native init (key from env), identify, capture, flags
telemetry/events.ts    # the ONLY event taxonomy (typed event names + props)
telemetry/index.ts     # track(), screen(), identify(), setUserProps() facade
```
Wiring points: ErrorBoundary→Sentry; navigation→screen(); capture/recall/paywall/subscribe→track();
app open/identify→PostHog. Feature flags read from PostHog with safe defaults.

## 5. Dashboard architecture (`dashboard/`)
- **Next.js (App Router) + TypeScript + Tailwind.** Auth-gated (single admin password / NextAuth later).
- Data sources: **RevenueCat REST API** (subscriptions, MRR) + **PostHog API** (DAU/retention/funnels).
- Pages: Overview (MRR, active subs, trials, churn, DAU/WAU/MAU), Funnel (activation), Retention cohorts,
  Features (top events), Revenue (by plan). Server-side fetch + cached.
- Deploy target: Vercel (see NEEDS_FROM_YOU for env keys).

## 6. Config & secrets
- App reads `EXPO_PUBLIC_*` env (RevenueCat keys, Sentry DSN, PostHog key) — all in `.env` (git-ignored).
  `.env.example` documents every var. Safe defaults: telemetry/billing **no-op** when keys absent, so the
  app always runs in dev without credentials.
- Dashboard reads server-side env (RevenueCat secret API key, PostHog project key) — never shipped to client.

## 7. Build & release
- Mobile: **EAS Build** (iOS + Android) — config carried from 1.0 `eas.json` + `app.json`, updated for 2.0.
- CI: GitHub Actions — typecheck + tests on PR; EAS build on tag.
- OTA: `expo-updates` (carried from 1.0).

## 8. Quality gates (QA owns)
Every release: Feature Catalog row-by-row completeness · behavioral parity vs 1.0 tests · five-constraint
audit per surface · iOS + Android · monetization purchase/restore flow · telemetry events firing.
