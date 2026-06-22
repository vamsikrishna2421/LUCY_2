# LUCY → Production SaaS — Plan, Architecture & Setup

Turning LUCY from an on-device / bring-your-own-key app into a real SaaS: sign-up, paid
subscriptions, a **managed** AI key serving all users, and an admin analytics dashboard.

**Locked decisions:** Stripe web checkout · Supabase (Postgres + Auth) + Vercel · Email + Google sign-in.

> **All app-side changes ship via OTA (`eas update`)** — no Expo *build* quota needed. Only the
> already-distributed APK (vc109) is required; it self-updates.

---

## Architecture

```
 Mobile app (OTA)                Backend (Next.js API on Vercel)            Supabase (Postgres + Auth)
 ─────────────────              ──────────────────────────────            ──────────────────────────
 • Sign in / up  ───────────▶   /auth (Supabase: email + Google)  ◀────▶  auth.users, profiles
 • Subscription gate ◀──────▶   /api/me  (plan + usage status)     ◀────▶  subscriptions, plans
 • AI call (was on-device   ─▶  /api/ai  → checks sub + token       ───▶   usage_events  (meter)
   key) now goes to backend       budget → calls Anthropic/OpenAI
                                   with YOUR managed key → logs tokens
 Web signup+checkout page  ───▶  /api/stripe/checkout  → Stripe Checkout
                                /api/stripe/webhook    ◀── Stripe ──▶ subscriptions (synced)
 Admin dashboard (Vercel)  ◀──  /admin  → admin_usage_* + admin_user_stats views
```

The app **stops using each user's own key**. Every AI request goes to `/api/ai`, which authenticates
the user (Supabase JWT), checks their plan + remaining token budget, calls the model with **your one
managed key**, records `input/output tokens + cost` in `usage_events`, and returns the result.

---

## Phases & status

| # | Phase | What | Status |
|---|-------|------|--------|
| 1 | Foundation | DB schema (`backend/supabase/schema.sql`) + this doc | ✅ done |
| 2 | Backend API | Next.js routes in `dashboard/`: Supabase auth verify, `/api/ai` proxy+meter, `/api/stripe/checkout` + `/webhook`, `/api/me` | ⏳ next (I build with placeholder env) |
| 3 | App integration (OTA) | Auth screens (email+Google), session storage, route `app/src/ai` calls through `/api/ai`, subscription gate (reuse `gating/`) | after Phase 2 |
| 4 | Admin dashboard | Extend `dashboard/`: users, active users, tokens/hour+day, cost, notes, revenue, per-user drill-down | after Phase 2 |
| 5 | Web signup + checkout + deploy | Public sign-up + Stripe Checkout page; deploy to Vercel; onboard testers | after 2–4 |

I can write Phases 2–4 code now using placeholder env vars; it goes live once your accounts (below) exist.

---

## ✅ Accounts to create (critical path — only you can do these)

Do these in parallel while I build. Drop the keys into `backend/.env` (template below) or send them to me.

1. **Supabase** — supabase.com → New project (pick a region near your users).
   - SQL Editor → paste & run `backend/supabase/schema.sql`.
   - Settings → API → copy **Project URL**, **anon public key**, **service_role key** (service_role is secret — backend only).
   - Authentication → Providers → enable **Email**; enable **Google** (needs the Google OAuth client from step 5).
   - After your account exists, set yourself admin: `update profiles set is_admin=true where email='you@…';`

2. **Stripe** — stripe.com → start in **Test mode**.
   - Products → create 4 products (Monthly / Quarterly / 6 Months / Annual) each with a recurring **Price**; copy each **price_id** into the `plans.stripe_price_id` column.
   - Developers → API keys → copy **Publishable** + **Secret** keys.
   - Developers → Webhooks → add endpoint `https://<your-vercel-app>/api/stripe/webhook` → copy the **Signing secret**.

3. **Vercel** — vercel.com → import the GitHub repo (`LUCY_2`), root = `dashboard/`. (Deploy in Phase 5; set env vars there too.)

4. **Managed AI key** — a **properly funded** Anthropic (and/or OpenAI) key dedicated to serving users — separate from your $10 test key. This is what all users' AI runs on; set a billing cap on it.

5. **Google OAuth** (for Google sign-in) — Google Cloud Console → APIs & Services → Credentials → OAuth client (Web) → authorized redirect: `https://<your-supabase-ref>.supabase.co/auth/v1/callback` → copy **Client ID + Secret** into Supabase (step 1).

---

## Environment variables (`backend/.env` — git-ignored)

```
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # secret — server only

# Managed AI (the key that serves all users)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=                   # optional

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PUBLISHABLE_KEY=

# App ↔ backend
PUBLIC_APP_URL=                   # the web signup/checkout origin
```
The mobile app only ever needs the **public** Supabase URL + anon key + the backend base URL — never the
service_role or AI keys (those live only on the server).

---

## Cost control (non-negotiable — it's your money now)

- Every `/api/ai` call checks `period_token_usage()` vs the plan's `monthly_token_budget` / `daily_token_budget`
  **before** calling the model; over budget → a friendly "limit reached" instead of an uncapped bill.
- Default model = Haiku (cheapest that passed our eval). Budgets in the schema are starter values — **tune
  prices so each plan's price comfortably exceeds its worst-case token cost** before going live.
- The dashboard surfaces tokens/cost per hour/day/user so you spot a runaway user immediately.

## Privacy & legal (before charging real money)

- Managed proxy means note text passes through your server to the AI (normal for SaaS, but a change from
  today's on-device privacy). You'll need a short **Privacy Policy + Terms** and an in-app disclosure.
- Keep storing originals encrypted on-device; only send what a request needs.

## Revert

Stable pre-SaaS checkpoint: tag **`v2.0.0-stable`** / branch **`stable-pre-saas`**. `git reset --hard v2.0.0-stable` to roll back.
