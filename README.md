# LUCY 2.0

Private, on-device-first AI second brain + proactive life manager. A monetizable rebuild of LUCY 1.0:
the proven logic is frozen and reused; the UI is redesigned to five strict constraints; and a real
monetization (RevenueCat) and monitoring (Sentry + PostHog + dashboard) stack is added.

## Repo layout
| Path | What |
|------|------|
| `app/` | LUCY 2.0 mobile app (Expo / React Native / TypeScript). Fork of 1.0; logic frozen, UI redesigned. |
| `dashboard/` | Next.js metrics & admin dashboard (MRR, retention, funnels). |
| `docs/` | Governance: file-tree inventory, feature catalog (parity), product direction, architecture, design system. |
| `PROJECT_STATE.md` | Orchestrator living doc — status, decisions, workstreams. |
| `NEEDS_FROM_YOU.md` | Items needing the owner (all stubbed; never blocks the build). |

## Run the app
```bash
cd app
npm install
npx expo start            # dev; press i / a, or scan with a dev build
```
> RevenueCat/Sentry/PostHog require a **dev build** (not Expo Go). Without keys they run as safe no-ops,
> so `expo start` works for UI dev immediately. See `.env.example`.

## Run the dashboard
```bash
cd dashboard
npm install
npm run dev               # http://localhost:3000
```

## Principles
- **Logic frozen** — `app/src/{ai,db,processing,scheduling,audio,voice,server,types,utils,config}` reused 1:1.
- **Nothing lost** — parity tracked row-by-row in `docs/10_FEATURE_CATALOG.md`.
- **Five constraints** — self-evidence > calm > legible interaction > premium motion > instant render.

See `docs/` for the full spec.
