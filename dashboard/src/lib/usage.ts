/**
 * Entitlement + metering helpers (SERVER ONLY) shared by /api/ai and /api/me.
 *
 * Cost control lives here: task→managed-model mapping (task-tiered: cheap Haiku for routine work,
 * Sonnet for reasoning), per-model cost rates, and the per-user token budgets. Users without a paid
 * subscription get a modest FREE allowance (beta — no paywall yet); paid plans override it once
 * Stripe is wired.
 */
import 'server-only';
import { supabaseAdmin } from './supabaseAdmin';

// ── Task → managed model (user-selected: task-tiered) ────────────────────────
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

// ── Cost per token ($ / token = per-1M ÷ 1e6). Haiku 4.5 $1/$5 · Sonnet 4.6 $3/$15 · Opus 4.8 $5/$25 ──
const RATES: Record<string, { in: number; out: number }> = {
  'claude-haiku-4-5': { in: 1 / 1e6, out: 5 / 1e6 },
  'claude-sonnet-4-6': { in: 3 / 1e6, out: 15 / 1e6 },
  'claude-opus-4-8': { in: 5 / 1e6, out: 25 / 1e6 },
};
export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const r = RATES[model] ?? RATES[DEFAULT_MODEL];
  return inputTokens * r.in + outputTokens * r.out;
}

// ── Free allowance for users without an active paid subscription (beta) ──────
// Beta/testing allowance (no paywall yet). Raised for owner testing — tighten before public launch.
export const FREE_TIER = { planId: 'free', monthlyTokenBudget: 2_000_000, dailyTokenBudget: 200_000 };

export interface Entitlement {
  planId: string;
  status: string;          // active | trialing | free
  monthlyBudget: number;
  dailyBudget: number;
  periodStart: string;     // ISO — start of the current monthly window
}

interface SubRow {
  plan_id: string | null;
  status: string;
  current_period_start: string | null;
  plans: { monthly_token_budget: number; daily_token_budget: number } | { monthly_token_budget: number; daily_token_budget: number }[] | null;
}

export async function resolveEntitlement(userId: string): Promise<Entitlement> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await supabaseAdmin()
    .from('subscriptions')
    .select('plan_id, status, current_period_start, plans(monthly_token_budget, daily_token_budget)')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sub = data as SubRow | null;
  const plan = sub?.plans ? (Array.isArray(sub.plans) ? sub.plans[0] : sub.plans) : null;
  if (sub && plan) {
    return {
      planId: sub.plan_id ?? 'unknown',
      status: sub.status,
      monthlyBudget: Number(plan.monthly_token_budget),
      dailyBudget: Number(plan.daily_token_budget),
      periodStart: sub.current_period_start ?? thirtyDaysAgo,
    };
  }
  return {
    planId: FREE_TIER.planId,
    status: 'free',
    monthlyBudget: FREE_TIER.monthlyTokenBudget,
    dailyBudget: FREE_TIER.dailyTokenBudget,
    periodStart: thirtyDaysAgo,
  };
}

/** Sum of input+output tokens for a user since the given ISO timestamp (via the DB helper). */
export async function tokenUsage(userId: string, sinceISO: string): Promise<number> {
  const { data, error } = await supabaseAdmin().rpc('period_token_usage', { p_user: userId, p_since: sinceISO });
  if (error) return 0;
  return Number(data ?? 0);
}

export function startOfTodayISO(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}
