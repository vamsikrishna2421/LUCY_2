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
| 2 IA / flows | orchestrator+UX | 🔜 |
| 3 Design system (code) | design agent | ✅ `app/src/ui/` (34 primitives + motion/layout/theme) |
| 4 Build | engineers | ⏳ billing+telemetry **integrated into App.tsx, 0 tsc errors**; dashboard running; screen redesign (F) next |
| 5 QA (parity + constraints) | QA agent | 🔜 |

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
