/**
 * GET /api/me — the authenticated app user's plan + usage status.
 * The mobile app calls this (with its Supabase JWT) to drive gating and show remaining quota.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/authVerify';
import { resolveEntitlement, tokenUsage, windowStartISO } from '@/lib/usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { user, error } = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: error ?? 'Unauthorized' }, { status: 401 });

  const ent = await resolveEntitlement(user.id);
  const [monthlyUsed, windowUsed] = await Promise.all([
    tokenUsage(user.id, ent.periodStart),
    tokenUsage(user.id, windowStartISO(ent.windowHours)),
  ]);

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    plan: { id: ent.planId, status: ent.status },
    usage: {
      monthly: { used: monthlyUsed, budget: ent.monthlyBudget, remaining: Math.max(0, ent.monthlyBudget - monthlyUsed) },
      window: { used: windowUsed, budget: ent.windowBudget, hours: ent.windowHours, remaining: Math.max(0, ent.windowBudget - windowUsed) },
      periodStart: ent.periodStart,
    },
  });
}
