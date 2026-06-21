# LUCY 2.0 — Project State (orchestrator living doc)

_Last updated: 2026-06-21 (night build kickoff)._ Owner is away (multi-day autonomous build). Anything
needing the owner lives in `NEEDS_FROM_YOU.md` and never blocks.

## Mission
Build the best monetizable version of LUCY: fork 1.0's frozen logic, redesign the UI to the five
constraints, add a real monetization stack (RevenueCat) and a real monitoring stack (Sentry + PostHog +
metrics dashboard) that 1.0 lacked. Ship something **real and runnable**, not vaporware.

## Decisions log
- **D1** Fork 1.0 → `app/`, freeze logic, redesign presentation. (Most reliable path to a real product.)
- **D2** Monetization = RevenueCat freemium (Free / Pro mo+yr / Lifetime), entitlement `pro`, `<Gate>` API.
- **D3** Monitoring = Sentry (crash) + PostHog (analytics/flags) + Next.js dashboard.
- **D4** Telemetry/billing **no-op without keys** so the app always runs in dev.
- **D5** Repo = monorepo (`app/`, `dashboard/`, `docs/`).

## Phase status
| Phase | Owner | Status |
|-------|-------|--------|
| 0.1 File-tree inventory | orchestrator | ✅ `docs/00_FILE_TREE_INVENTORY.md` |
| 0.2 Feature Catalog | BA agent | ✅ LOCKED `docs/10_FEATURE_CATALOG.md` — 470 rows; 5 rulings parked in NEEDS_FROM_YOU §G |
| 1 Seam report + interface contract | architect | ✅ `docs/04_SEAM_REPORT.md` — redesign safe, zero logic edits |
| 2 IA / flows | orchestrator+UX | ✅ flows preserved per parity (same start/end states); nav model unchanged — see docs/04 + redesigned screens |
| 3 Design system (code) | design agent | ✅ `app/src/ui/` (34 primitives + motion/layout/theme) |
| 4 Build | engineers | ✅ ALL screens on ui/ (Capture, Ask, Settings, Galaxy, Connectors, Story, Notifications + Dashboard: Timeline/FocusNow/Library/Health) — Dashboard.tsx 4058→538; monetization+monitoring+web-dashboard integrated; 0 tsc, 16/16 render |
| 5 QA (parity + constraints) | orchestrator | ✅ `docs/13_QA_REPORT.md` — parity (logic 1:1, 26/26 tests), 5 constraints, iOS+Android; verdict: complete + better than 1.0 |

## Workstreams (parallel)
- **A — Feature Catalog** (BA): exhaustive parity contract from 1.0 source.
- **B — Design system** (code): tokens + primitives in `app/src/ui/`.
- **C — Monetization**: `app/src/billing/` + `app/src/gating/` + Paywall.
- **D — Monitoring**: `app/src/telemetry/` + Sentry/PostHog + event taxonomy.
- **E — Dashboard**: `dashboard/` Next.js metrics app.
- **F — Screen redesign** (orchestrator-led after B lands): core loop first.

## Environment
- `app/` deps installed (npm, exit 0). `.env.local` (1.0 keys) present & git-ignored.
- Git: local repo → remote `origin = github.com/vamsikrishna2421/LUCY_2` (was empty).

## Risks / watch
- Coherence of parallel agent output → mitigated by token contract + file ownership + central integration.
- Native-dep installs (RevenueCat/Sentry) may need a dev build (not Expo Go) → note in NEEDS_FROM_YOU.
- Don't break frozen logic — redesign binds, never edits.

## Progress journal
- 2026-06-21: workspace forked, deps installed, foundation docs written (inventory, direction,
  architecture, design system), git wired to LUCY_2. Foundation committed + pushed (8db2486).
- 2026-06-21: launched 5 background workstream agents — cataloguer (Feature Catalog), designsys
  (app/src/ui primitives), monetization (billing+gating), monitoring (telemetry), dashboard
  (Next.js metrics). Each owns a disjoint dir; orchestrator integrates centrally. Added CI workflow.
- Next (on agent completion): install native deps centrally, wire providers into App.tsx, then begin
  Phase 1 seam read + Phase 2 IA, then Workstream F core-loop screen redesign.
- 2026-06-21 (cont.): Phase 1 seam report done (docs/04). Owner provided: Anthropic test key (stored in
  app/.env.local, git-ignored), EAS creds cached in PowerShell, Apple Developer creds (stored in
  .secrets/, git-ignored). Build config set for 2.0: v2.0.0 / iOS build 2.0.0 / versionCode 105 /
  runtime 6 / EAS autoIncrement — builds on top of existing app (bundle com.anonymous.lucy, ASC 6774077314).
- Agents B/C/D (designsys, monetization, monitoring) COMPLETE — app/src/{ui,billing,gating,telemetry}
  delivered (53 files). Agents A (cataloguer), E (dashboard), G (evaluator: Haiku vs Sonnet) RUNNING.
- Model eval framed (docs/11): cost objective = least $/mo + most accurate at 600 extractions/mo;
  Haiku ~$2.70 vs Sonnet ~$8.10 per user/mo; live accuracy benchmark in progress.
- Installing native deps (react-native-purchases, @sentry/react-native, posthog-react-native) for integration.
- 2026-06-21 (cont.): native deps installed + providers wired into App.tsx (ThemeProvider, ToastProvider,
  EntitlementProvider, PaywallController, telemetry init, ErrorBoundary→Sentry). 0 tsc errors. Web dashboard
  committed. Feature Catalog locked (470 rows). Model eval done (Haiku default). Frozen-logic parity baseline
  26/26. Owner provided Anthropic test key + Apple creds + EAS cached; budget cap ~$10 on the key (UI work
  uses $0). Build config set for TestFlight-on-existing-app (v2.0.0 / build 2.0.0 / vc105).
- 2026-06-21 (cont.): Capture+Ask redesigned (Workstream F core loop). Visual preview generated
  (preview/png + html, headless Edge from real tokens) and committed for owner review.
- 2026-06-21 (cont.): 5 more screens redesigned (Settings decomposed, Galaxy, Connectors, Story,
  Notifications) + iOS/Android audit fixes (keyboard, Android back, LucyOrb Android gradient bug, dynamic-type
  cap) + render-test harness (16/16). Galaxy Alert.prompt→sheet adjudicated as real bug (Android), applied.
  Dashboard (4058 ln, the home screen) dispatched to screens2 for a dedicated single-pass redesign.
- 2026-06-21 (cont.): Dashboard fully redesigned (Timeline/FocusNow/Library/Health + shell), 4058→538 ln.
  Phase 5 QA report (docs/13). Visual previews rendered (preview/png: home, capture, ask, paywall, design-system).
- 2026-06-21 (cont.): TestFlight RELEASE. iOS build 2.0.2 succeeded on EAS (reused 1.0 creds, no 2FA; fixed
  Sentry map-upload via SENTRY_DISABLE_AUTO_UPLOAD; stripped secret EXPO_PUBLIC keys so nothing inlines) and
  SUBMITTED to TestFlight (ASC app 6774077314) on owner's "submit".
- 2026-06-21 (cont.): Owner's 2 real-bug fixes APPLIED (Free Up Space: embedded confirm/Toast + batched
  hardDeleteCaptures fixes the dead delete; +Select-all chip) — frozen db/captures.ts touched as sanctioned
  real-bug exception. typecheck 0. Android build (android-release apk) triggered.
