/**
 * POST /api/ai — the managed AI proxy (the cost-control heart of the SaaS).
 *
 * Flow: verify the app user's JWT → check their plan's monthly/daily token budget → call Anthropic
 * with the MANAGED key (task-tiered model) → record input/output tokens + cost in usage_events →
 * return the text. Mirrors the app's `promptClaude(system, input, task)` contract so the app
 * integration is a clean swap (the app stops using each user's own key).
 *
 * Body: { input: string, system?: string, task?: string, maxTokens?: number }
 */
import { NextResponse, type NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getUserFromRequest } from '@/lib/authVerify';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveEntitlement, tokenUsage, startOfTodayISO, modelForTask, costUsd } from '@/lib/usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_OUTPUT_TOKENS = 4096;
const MAX_INPUT_CHARS = 200_000; // generous; the app chunks large captures before sending.

export async function POST(req: NextRequest) {
  const { user, error } = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: error ?? 'Unauthorized' }, { status: 401 });

  let body: { input?: unknown; system?: unknown; task?: unknown; maxTokens?: unknown; image?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }); }

  const input = typeof body.input === 'string' ? body.input : '';
  if (!input.trim()) return NextResponse.json({ error: 'Missing "input".' }, { status: 400 });
  if (input.length > MAX_INPUT_CHARS) return NextResponse.json({ error: 'Input too large.' }, { status: 413 });
  const task = typeof body.task === 'string' ? body.task : 'chat';
  const system = typeof body.system === 'string' ? body.system : undefined;
  const maxTokens = Math.min(MAX_OUTPUT_TOKENS, Math.max(256, Number(body.maxTokens) || 1800));
  const imageObj = body.image && typeof body.image === 'object' ? (body.image as { data?: unknown; mediaType?: unknown }) : null;
  const imageData = imageObj && typeof imageObj.data === 'string' ? imageObj.data : null;
  const rawMedia = imageObj && typeof imageObj.mediaType === 'string' ? imageObj.mediaType : 'image/jpeg';
  const imageMedia = (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(rawMedia) ? rawMedia : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  if (imageData && imageData.length > 7_000_000) return NextResponse.json({ error: 'Image too large.' }, { status: 413 });

  // ── Budget gate (pre-check) — never spend when over budget ──
  const ent = await resolveEntitlement(user.id);
  const [monthlyUsed, dailyUsed] = await Promise.all([
    tokenUsage(user.id, ent.periodStart),
    tokenUsage(user.id, startOfTodayISO()),
  ]);
  if (monthlyUsed >= ent.monthlyBudget) {
    return NextResponse.json({ error: 'monthly_limit', message: "You've reached this month's usage limit." }, { status: 429 });
  }
  if (dailyUsed >= ent.dailyBudget) {
    return NextResponse.json({ error: 'daily_limit', message: "You've reached today's usage limit — it resets tomorrow." }, { status: 429 });
  }
  // Clamp output to the smaller of the requested cap and remaining budget, so a near-limit call
  // can't overshoot the plan/free cap by a full max_tokens generation.
  const remainingTokens = Math.max(0, Math.min(ent.monthlyBudget - monthlyUsed, ent.dailyBudget - dailyUsed));
  const effMaxTokens = Math.max(64, Math.min(maxTokens, remainingTokens || maxTokens));

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'server_misconfigured', message: 'AI is not configured yet.' }, { status: 503 });

  const model = modelForTask(task);
  const client = new Anthropic({ apiKey });

  let text = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let ok = true;
  let errMsg: string | null = null;
  try {
    const resp = await client.messages.create({
      model,
      max_tokens: effMaxTokens,
      ...(system ? { system } : {}),
      messages: [{
        role: 'user',
        content: imageData
          ? [
              { type: 'image', source: { type: 'base64', media_type: imageMedia, data: imageData } },
              { type: 'text', text: input },
            ]
          : input,
      }],
    });
    text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    inputTokens = resp.usage.input_tokens ?? 0;
    outputTokens = resp.usage.output_tokens ?? 0;
  } catch (e) {
    ok = false;
    errMsg = e instanceof Anthropic.APIError ? `Anthropic error ${e.status}` : (e instanceof Error ? e.message : 'AI request failed');
  }

  // Meter every attempt (success or failure) — best-effort; never let logging break the response.
  try {
    await supabaseAdmin().from('usage_events').insert({
      user_id: user.id,
      kind: task,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd(model, inputTokens, outputTokens),
      ok,
      meta: errMsg ? { error: errMsg } : null,
    });
  } catch { /* metering must not affect the user's request */ }

  if (!ok) return NextResponse.json({ error: 'ai_failed', message: errMsg ?? 'AI request failed.' }, { status: 502 });
  return NextResponse.json({ text, model, usage: { input_tokens: inputTokens, output_tokens: outputTokens } });
}
