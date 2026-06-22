-- ============================================================================
-- LUCY SaaS — Supabase Postgres schema
-- Auth (email + Google) is handled by Supabase Auth (auth.users). This schema adds
-- the SaaS layer: profiles, plans, subscriptions, and the usage metering that powers
-- both per-user cost control and the admin analytics dashboard.
--
-- Apply: Supabase Dashboard → SQL Editor → paste & run. Safe to re-run (idempotent).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── Profiles: 1:1 with auth.users, auto-created on signup ────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  full_name     text,
  avatar_url    text,
  is_admin      boolean not null default false,   -- you: flip true for your own account
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz
);

-- Auto-insert a profile row whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Plans: the subscription catalog (seed below; wire stripe_price_id after Stripe setup) ──
create table if not exists public.plans (
  id                   text primary key,            -- 'monthly' | 'quarterly' | 'semiannual' | 'annual'
  name                 text not null,
  price_cents          integer not null,            -- shown price
  currency             text not null default 'usd',
  interval             text not null,               -- 'month' | 'year'
  interval_count       integer not null default 1,  -- quarterly = month x3, semiannual = month x6
  stripe_price_id      text,                        -- fill in after creating Stripe Prices
  monthly_token_budget bigint not null,             -- HARD cap per 30 days (cost control)
  daily_token_budget   bigint not null,             -- soft/hard daily cap (anti-spike)
  is_active            boolean not null default true,
  sort_order           integer not null default 0
);

-- Starter pricing — TUNE before launch. Token budgets must keep your AI cost < price.
-- (Heavy usage ≈ $4/user/mo at Haiku rates per our model eval; price well above that.)
insert into public.plans (id, name, price_cents, interval, interval_count, monthly_token_budget, daily_token_budget, sort_order) values
  ('monthly',    'Monthly',    999,  'month', 1, 3000000, 200000, 1),
  ('quarterly',  'Quarterly',  2499, 'month', 3, 3000000, 200000, 2),
  ('semiannual', '6 Months',   4499, 'month', 6, 3000000, 200000, 3),
  ('annual',     'Annual',     7999, 'year',  1, 3000000, 200000, 4)
on conflict (id) do update set
  name = excluded.name, price_cents = excluded.price_cents, interval = excluded.interval,
  interval_count = excluded.interval_count, sort_order = excluded.sort_order;

-- ── Subscriptions: one current subscription per user (synced from Stripe webhooks) ──
create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  plan_id                text references public.plans(id),
  status                 text not null default 'inactive', -- active|trialing|past_due|canceled|inactive
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create unique index if not exists subscriptions_user_active_idx
  on public.subscriptions(user_id) where status in ('active','trialing');
create index if not exists subscriptions_customer_idx on public.subscriptions(stripe_customer_id);

-- ── Usage events: ONE row per AI call — the metering + analytics backbone ─────
create table if not exists public.usage_events (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  kind          text not null,                 -- 'extract' | 'ask' | 'meal' | 'organize' | ...
  model         text,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd      numeric(12,6) not null default 0,
  ok            boolean not null default true,
  meta          jsonb
);
create index if not exists usage_events_user_time_idx on public.usage_events(user_id, created_at desc);
create index if not exists usage_events_time_idx on public.usage_events(created_at desc);

-- Optional lightweight content counters (notes captured etc.) for the dashboard,
-- reported by the app so you can track engagement without syncing note contents.
create table if not exists public.activity_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  kind       text not null,    -- 'note_captured' | 'task_created' | 'app_open' | ...
  count      integer not null default 1
);
create index if not exists activity_events_user_time_idx on public.activity_events(user_id, created_at desc);

-- ── Current period usage helper (for the AI proxy's budget check) ────────────
create or replace function public.period_token_usage(p_user uuid, p_since timestamptz)
returns bigint language sql stable as $$
  select coalesce(sum(input_tokens + output_tokens), 0)
  from public.usage_events
  where user_id = p_user and created_at >= p_since;
$$;

-- ── Admin analytics views (the backend reads these with the service role) ─────
create or replace view public.admin_usage_hourly as
  select date_trunc('hour', created_at) as hour,
         count(*) as calls,
         count(distinct user_id) as active_users,
         sum(input_tokens + output_tokens) as tokens,
         sum(cost_usd) as cost_usd
  from public.usage_events group by 1 order by 1 desc;

create or replace view public.admin_usage_daily as
  select date_trunc('day', created_at) as day,
         count(*) as calls,
         count(distinct user_id) as active_users,
         sum(input_tokens + output_tokens) as tokens,
         sum(cost_usd) as cost_usd
  from public.usage_events group by 1 order by 1 desc;

create or replace view public.admin_user_stats as
  select p.id, p.email, p.full_name, p.created_at, p.last_seen_at,
         s.plan_id, s.status as sub_status, s.current_period_end,
         coalesce(u.tokens_30d, 0)   as tokens_30d,
         coalesce(u.cost_30d, 0)     as cost_30d,
         coalesce(a.notes_30d, 0)    as notes_30d
  from public.profiles p
  left join public.subscriptions s on s.user_id = p.id and s.status in ('active','trialing')
  left join (select user_id, sum(input_tokens+output_tokens) tokens_30d, sum(cost_usd) cost_30d
             from public.usage_events where created_at > now() - interval '30 days' group by user_id) u on u.user_id = p.id
  left join (select user_id, sum(count) notes_30d
             from public.activity_events where kind = 'note_captured' and created_at > now() - interval '30 days' group by user_id) a on a.user_id = p.id;

-- ── Row-Level Security: users touch only their own rows; the backend uses the
--    service_role key (which bypasses RLS) for the proxy + admin reads. ────────
alter table public.profiles        enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.usage_events    enable row level security;
alter table public.activity_events enable row level security;
alter table public.plans           enable row level security;

drop policy if exists "own profile"        on public.profiles;
drop policy if exists "own subscription"   on public.subscriptions;
drop policy if exists "own usage"          on public.usage_events;
drop policy if exists "own activity"       on public.activity_events;
drop policy if exists "plans are readable" on public.plans;

create policy "own profile"        on public.profiles        for select using (auth.uid() = id);
create policy "own subscription"   on public.subscriptions   for select using (auth.uid() = user_id);
create policy "own usage"          on public.usage_events    for select using (auth.uid() = user_id);
create policy "own activity"       on public.activity_events for select using (auth.uid() = user_id);
create policy "plans are readable" on public.plans           for select using (true);
-- Writes to usage/subscriptions happen ONLY via the backend (service_role) — no client write policies.
