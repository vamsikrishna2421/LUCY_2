/**
 * Entitlement + metering helpers (SERVER ONLY) shared by /api/ai and /api/me.
 *
 * Budgets are MANAGED IN SUPABASE — change limits with SQL, no code deploy:
 *   • public.plans: per-plan `monthly_token_budget`, `window_token_budget`, `window_hours`
 *     (the `free` row = no-subscription allowance; paid rows = subscriber limits).
 *   • public.profiles: `override_window_token_budget` / `override_monthly_token_budget` /
 *     `override_window_hours` = per-user override (owner testing / comps). NULL = no override.
 *
 * Priority: per-user override → active subscription's plan → (expired subscription → free, flagged
 * 'expired' for a renew prompt) → free. Throttling uses a rolling window (window_hours) plus a hard
 * monthly ceiling. The code FALLBACK is used only if the DB is unreachable, so the proxy never hard-fails.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabaseAdmin';

// ── Task → managed model (task-tiered) ───────────────────────────────────────
const TASK_MODEL: Record<string, string> = {
  extraction: 'claude-haiku-4-5',
  summary: 'claude-haiku-4-5',
  segment: 'claude-haiku-4-5',
  meal: 'claude-haiku-4-5',
  organize: 'claude-haiku-4-5',
  ask: 'claude-sonnet-4-6',
  insight: 'claude-sonnet-4-6',
  chat: 'claude-sonnet-4-6',
  vision: 'claude-sonnet-4-6',
};
export const DEFAULT_MODEL = 'claude-sonnet-4-6';
export function modelForTask(task: string | undefined): string {
  return (task ? TASK_MODEL[task] : undefined) ?? DEFAULT_MODEL;
}

// ── Cost per token ($ / token). Haiku 4.5 $1/$5 · Sonnet 4.6 $3/$15 · Opus 4.8 $5/$25 ──
const RATES: Record<string, { in: number; out: number }> = {
  'claude-haiku-4-5': { in: 1 / 1e6, out: 5 / 1e6 },
  'claude-sonnet-4-6': { in: 3 / 1e6, out: 15 / 1e6 },
  'claude-opus-4-8': { in: 5 / 1e6, out: 25 / 1e6 },
};
export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const r = RATES[model] ?? RATES[DEFAULT_MODEL];
  return inputTokens * r.in + outputTokens * r.out;
}

// Safety net ONLY (DB unreachable / 'free' row missing). Real values live in Supabase.
const FALLBACK = { monthlyBudget: 500_000, windowBudget: 10_000, windowHours: 5 };

export interface Entitlement {
  planId: string;
  status: string;          // override | active | trialing | expired | free
  monthlyBudget: number;
  windowBudget: number;    // tokens allowed within the rolling window
  windowHours: number;     // length of the throttle window
  periodStart: string;     // ISO — start of the current monthly window
}

interface PlanBudget { monthly_token_budget: number; window_token_budget: number | null; window_hours: number | null }
interface SubRow {
  plan_id: string | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  plans: PlanBudget | PlanBudget[] | null;
}
interface ProfileOverride {
  override_window_token_budget: number | null;
  override_monthly_token_budget: number | null;
  override_window_hours: number | null;
}

async function freeEntitlement(db: SupabaseClient, periodStart: string, status: 'free' | 'expired' = 'free'): Promise<Entitlement> {
  const { data } = await db.from('plans').select('monthly_token_budget, window_token_budget, window_hours').eq('id', 'free').maybeSingle();
  const f = data as PlanBudget | null;
  return {
    planId: 'free',
    status,
    monthlyBudget: Number(f?.monthly_token_budget ?? FALLBACK.monthlyBudget),
    windowBudget: Number(f?.window_token_budget ?? FALLBACK.windowBudget),
    windowHours: Number(f?.window_hours ?? FALLBACK.windowHours),
    periodStart,
  };
}

export async function resolveEntitlement(userId: string): Promise<Entitlement> {
  const db = supabaseAdmin();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

  // 1) Per-user override (Supabase profiles) — highest priority.
  const { data: profData } = await db
    .from('profiles')
    .select('override_window_token_budget, override_monthly_token_budget, override_window_hours')
    .eq('id', userId)
    .maybeSingle();
  const prof = profData as ProfileOverride | null;
  if (prof && prof.override_window_token_budget != null) {
    return {
      planId: 'override',
      status: 'override',
      monthlyBudget: Number(prof.override_monthly_token_budget ?? prof.override_window_token_budget),
      windowBudget: Number(prof.override_window_token_budget),
      windowHours: Number(prof.override_window_hours) || FALLBACK.windowHours,
      periodStart: thirtyDaysAgo,
    };
  }

  // 2) Latest subscription. Active = active/trialing AND not past current_period_end.
  const { data: subData } = await db
    .from('subscriptions')
    .select('plan_id, status, current_period_start, current_period_end, plans(monthly_token_budget, window_token_budget, window_hours)')
    .eq('user_id', userId)
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle();
  const sub = subData as SubRow | null;
  if (sub) {
    const plan = sub.plans ? (Array.isArray(sub.plans) ? sub.plans[0] : sub.plans) : null;
    const notExpired = !sub.current_period_end || new Date(sub.current_period_end).getTime() > Date.now();
    const active = ['active', 'trialing'].includes(sub.status) && notExpired;
    if (active && plan && plan.window_token_budget != null) {
      return {
        planId: sub.plan_id ?? 'unknown',
        status: sub.status,
        monthlyBudget: Number(plan.monthly_token_budget),
        windowBudget: Number(plan.window_token_budget),
        windowHours: Number(plan.window_hours) || FALLBACK.windowHours,
        periodStart: sub.current_period_start ?? thirtyDaysAgo,
      };
    }
    // Subscription exists but is expired/lapsed → reset the user to free. The first time we detect it,
    // downgrade the record (status → 'expired') so it's not re-evaluated as active. They drop to the
    // free 10k/5h budget, flagged 'expired' so the app offers "renew" instead of "upgrade".
    if (['active', 'trialing'].includes(sub.status)) {
      void db.from('subscriptions').update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('user_id', userId).eq('status', sub.status);
    }
    return freeEntitlement(db, thirtyDaysAgo, 'expired');
  }

  // 3) Never subscribed → free.
  return freeEntitlement(db, thirtyDaysAgo);
}

/** Sum of input+output tokens for a user since the given ISO timestamp (via the DB helper). */
export async function tokenUsage(userId: string, sinceISO: string): Promise<number> {
  const { data, error } = await supabaseAdmin().rpc('period_token_usage', { p_user: userId, p_since: sinceISO });
  if (error) return 0;
  return Number(data ?? 0);
}

/** Start of the rolling throttle window (now − hours). */
export function windowStartISO(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}
