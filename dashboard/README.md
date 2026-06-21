# LUCY 2.0 — Growth & Revenue Dashboard

Next.js (App Router) + TypeScript + Tailwind admin dashboard for LUCY 2.0. Tracks
the north-star metrics that 1.0 lacked: **MRR, subscriptions, trial conversion,
churn, DAU/WAU/MAU, activation, retention cohorts, the activation funnel, and top
features**. Pulls from **RevenueCat** (revenue) + **PostHog** (product analytics),
and falls back to realistic **mock data** so it runs fully populated with zero
credentials.

## Quick start (mock data, no credentials)

```bash
cd dashboard
npm install
npm run dev
```

Open http://localhost:3000 — every page is populated from `lib/mock.ts`. A
**"Mock data"** badge in the top bar shows when numbers are mocked vs **"Live
data"** when a real source is configured.

## Pages

| Route        | What it shows |
|--------------|---------------|
| `/`          | Overview — MRR, Active Subs, Trials, Trial→Paid, Churn, DAU/WAU/MAU, Activation, ARPU + MRR line chart + plan donut |
| `/funnel`    | Activation funnel (`app_open → onboarding_completed → capture_saved → recall_answered → paywall_viewed → purchase_completed`) as a bar funnel + step breakdown |
| `/retention` | D1/D7/D30 retention cohort heatmap |
| `/features`  | Top tracked events with 30-day counts + WoW trend |
| `/revenue`   | Revenue by plan (monthly/annual/lifetime), ARPU, LTV |

## Going live

Copy `.env.example` to `.env.local` and fill in any subset — each source is
independent, and any missing source stays on mock.

```bash
cp .env.example .env.local
```

| Var                  | Purpose |
|----------------------|---------|
| `RC_SECRET_KEY`      | RevenueCat secret API key (server-only) → revenue metrics |
| `RC_PROJECT_ID`      | RevenueCat project id (optional, for v2 endpoints) |
| `POSTHOG_API_KEY`    | PostHog **personal** API key (read scope) → analytics |
| `POSTHOG_PROJECT_ID` | PostHog numeric project id (required with the API key) |
| `POSTHOG_HOST`       | `https://us.posthog.com` (default) or `https://eu.posthog.com` |
| `DASHBOARD_PASSWORD` | Single admin password. **Unset = open (dev).** Set = login required. |

### Notes on the live data path

- **PostHog** queries run via the HogQL `/query/` API (`lib/posthog.ts`). DAU/WAU/
  MAU, funnel, and top-features queries are wired; retention cohorts and activation
  % currently borrow mock shapes until those (heavier) queries are wired — the page
  stays populated rather than empty, and the badge still reads "Live" when a key is
  present.
- **RevenueCat** has no single REST endpoint for aggregate MRR; the production
  pattern is to mirror subscription events via the RevenueCat **webhook** into your
  own store and aggregate there (see `docs/02_ARCHITECTURE.md` §3). `lib/revenuecat.ts`
  isolates that seam in `fetchLive()` — swap it for your webhook-backed aggregation
  without touching any page. The key is sanity-checked against the REST API and the
  dashboard tags data "Live" when present.

## Auth

`middleware.ts` gates every route. With `DASHBOARD_PASSWORD` set, unauthenticated
requests redirect to `/login`; on success a signed, http-only session cookie (7-day)
is set. With the var unset, the dashboard is open (dev). Swap for NextAuth when
multi-user access is needed.

## Scripts

```bash
npm run dev        # local dev server
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
```

## Structure

```
dashboard/
├─ src/
│  ├─ app/
│  │  ├─ (app)/            # auth-gated dashboard (shared sidebar layout)
│  │  │  ├─ page.tsx        # Overview
│  │  │  ├─ funnel/         # Activation funnel
│  │  │  ├─ retention/      # Retention cohorts
│  │  │  ├─ features/       # Top events
│  │  │  └─ revenue/        # Revenue by plan
│  │  ├─ login/             # password gate (page + server actions)
│  │  ├─ layout.tsx         # root layout + globals
│  │  └─ globals.css
│  ├─ components/           # MetricCard, ChartCard, DataTable, Sidebar, Topbar, charts/
│  ├─ lib/                  # revenuecat.ts, posthog.ts, mock.ts, types.ts, format.ts, auth.ts
│  └─ middleware.ts         # auth gate
├─ tailwind.config.ts       # LUCY dark + amber theme (echoes app/src/ui/theme/tokens.ts)
└─ .env.example
```

Theme values mirror the app token source of truth (`app/src/ui/theme/tokens.ts`):
bg `#0C0B09`, surface `#161310`, accent `#FF8C42`, text `#F5EFE6`.

## Deploy

Vercel (root directory `dashboard/`). Set the env vars above in the project
settings. See `docs/02_ARCHITECTURE.md` §5.
