# LUCY 2.0 — Model Evaluation: Haiku 4.5 vs Sonnet 4.6 (cost × accuracy)

> Objective (owner-set): **least monthly cost + most accurate** for the capture→extraction path.
> Reference load (owner-set, max case): **20 notes/day × ~1000 chars ≈ 600 extractions/month/user.**
> Test key only (`app/.env.local`, git-ignored); not for production builds.

## 1. Authoritative pricing (per 1M tokens; from claude-api skill, not memory)
| Model | ID | Input | Output | Context |
|-------|----|-------|--------|---------|
| Claude Haiku 4.5 | `claude-haiku-4-5` | $1.00 | $5.00 | 200K |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | $3.00 | $15.00 | 1M |

## 2. Cost model at the reference load
Assumptions (to be replaced by measured `usage` from the eval): per extraction ≈ **2,000 input tokens**
(app/system + extraction schema prompt + ~300-token note) + **~500 output tokens** (the JSON). 600 calls/month.

| Model | Input/mo | Output/mo | **$/user/mo** | COGS vs $9.99 Pro |
|-------|----------|-----------|---------------|-------------------|
| **Haiku 4.5** | 1.2M → $1.20 | 0.3M → $1.50 | **≈ $2.70** | ~27% |
| **Sonnet 4.6** | 1.2M → $3.60 | 0.3M → $4.50 | **≈ $8.10** | ~81% |

**Levers that cut cost further (apply regardless of model):**
- **Prompt caching** of the stable system+schema prefix (~1.25× write, ~0.1× read). Helps only when captures
  fall within the 5-min cache TTL of each other (bursts). Sporadic captures won't benefit — don't assume it.
- **BYOK (bring-your-own-key)** — 1.0 already supports it; COGS → $0 for us, user pays their own API. Best for
  margin; worst for friction. Recommended as the default for the cloud tier, with a managed option as upsell.
- **On-device model** (executorch) — $0 marginal cost, the Free-tier default; quality is lower (this eval's baseline).

## 3. Accuracy methodology (live eval)
Harness: `app/tests/kaggle-eleanor.claude-redacted.ts` + `outcome-catalog.validation.ts` over the restored
Eleanor dataset (`app/benchmarks/kaggle-eleanor/raw/`). Run both models via `ELEANOR_CLAUDE_MODELS=claude-haiku-4-5,claude-sonnet-4-6`.
Score: extraction correctness on the injection probes (entities/tasks/dates/money/health recalled correctly),
plus measured input/output tokens per call (to replace the §2 estimates with real COGS).

**Run:**
```bash
cd app
ELEANOR_CLAUDE_MODELS=claude-haiku-4-5,claude-sonnet-4-6 npm run bench:kaggle-eleanor:claude
```

## 4. Decision framework (filled by the evaluator agent)
- If **Haiku accuracy ≥ Sonnet − small margin** → **Haiku everywhere** on the extraction path (cheapest, sufficient).
- If Haiku misses a **specific category** (e.g. dates, multi-entity run-ons) → **route only those to Sonnet**
  (hybrid: Haiku default + Sonnet fallback on low-confidence/complex notes) — keeps blended COGS near Haiku.
- Summary/insight/Wrapped (low frequency, high-value, user-visible prose) → **Sonnet** is affordable there.
- 1.0 baseline config already does exactly this split (`claudeExtractionModel = claude-haiku-4-5`,
  `claudeSummaryModel = claude-sonnet-4-6`) — the eval validates or adjusts it.

## 5. Results
_⏳ To be completed by the `evaluator` agent: per-model accuracy %, measured tokens/call, recomputed $/user/mo,
and the final routing recommendation._
