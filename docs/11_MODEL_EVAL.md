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

**Run:** 2026-06-21. `claude-haiku-4-5` vs `claude-sonnet-4-6`. **N = 30 injection probes** per model
(first 30 of the 50, health-shaped excluded — 20/50 are health-flagged and stay local-only per the privacy
lane) **+ 8 extraction samples** per model (real `extractionSystemPrompt` + schema run against representative
Eleanor daily records spread evenly across the 4-year corpus). **76 Claude API calls total** (under the ~100 cap).
Token usage captured from live API `usage`. Raw report: `app/benchmarks/kaggle-eleanor/results/model-eval-2026-06-21*.json`.

> **Harness note.** The doc's referenced script `npm run bench:kaggle-eleanor:claude` **cannot run in this
> environment**: it imports `src/ai/claude`, which transitively pulls in `expo-secure-store` / `expo-sqlite` /
> `react-native`, and `tsx`/esbuild fails on RN's Flow-typed `index.js` (`Unexpected "typeof"`). It also discards
> `message.usage`, so it can't report tokens. Accuracy + measured tokens were produced by a standalone, eval-only
> harness — `app/tests/kaggle-eleanor.model-eval.ts` — that imports only the pure, RN-free modules
> (`src/processing/redaction.ts`, `src/ai/prompts.ts`) and makes the Anthropic call inline. No frozen `src/**`
> logic was modified. It uses the **same accuracy scorer** as `kaggle-eleanor.claude-redacted.ts` (exact substring
> OR ≥75% token coverage) and the **same extraction system prompt** the app ships, so the numbers track production.

### 5.1 Accuracy (oracle-memory recall on injection probes)

| Model | Probes passed | Accuracy | dates | money/contact | general |
|-------|---------------|----------|-------|---------------|---------|
| **Haiku 4.5** | 26 / 30 | **86.7%** | 10 / 12 | 2 / 2 | 14 / 16 |
| **Sonnet 4.6** | 27 / 30 | **90.0%** | 11 / 12 | 2 / 2 | 14 / 16 |

**The gap is 3.3 points (one probe), and it is in dates/numbers.** Money/contact (phone numbers, emails, coupon
codes) and general recall are **tied**. Per-probe detail:
- **Shared miss (both models): #8 "watches that start with Christopher"** — an awkwardly-phrased expected string
  that the strict substring/coverage scorer penalizes; not a real recall failure for either model.
- **Haiku-only misses: #27 "limit salt intake to 2000mg" and #28 "electronics recycling on 3rd Street"** — both
  numeric/locational precision. Sonnet recalls these. (#27 is health-adjacent and slipped past the health filter;
  in production it would route local-only anyway.)
- **Sonnet-only misses: #22 "free for kids under 12 on Wednesdays", #29 "Emily's wine is Pinot Noir"** — Sonnet
  is not strictly dominant; it trades two of Haiku's wins for two of its own.

Net: Haiku's only **systematic** soft spot vs Sonnet is multi-fact numeric/date precision, and even there it is
10/12 vs 11/12. This matches the doc's §4 hypothesis.

### 5.2 Measured tokens per call (extraction path — replaces §2 estimates)

| Model | Avg input tok | Avg output tok | JSON valid | (§2 estimate was) |
|-------|---------------|----------------|------------|-------------------|
| **Haiku 4.5** | **2,914** | **818** | 8/8 (100%) | 2,000 in / 500 out |
| **Sonnet 4.6** | **2,915** | **951** | 8/8 (100%) | 2,000 in / 500 out |

- **Input is ~2,900 tokens, not 2,000** — the `extractionSystemPrompt` + schema prefix alone is ~2,850 tokens;
  the ~300-char note adds little. Input is **near-identical across models** (Haiku and Sonnet share a tokenizer),
  so the cost difference is driven almost entirely by the per-token price, not token count.
- **Output ran 818 (Haiku) / 951 (Sonnet)**, above the 500 estimate — the extraction JSON has many fields and
  Eleanor's daily records are dense (tasks + journal + notes), so real captures emit more than a one-liner. Sonnet
  is ~16% more verbose.
- **Both models returned 100% parseable JSON** on the extraction path — Haiku is not at a structured-output
  disadvantage here.

### 5.3 Recomputed cost at the reference load (600 extractions/user/mo, measured tokens)

| Model | Input/mo | Output/mo | **$/user/mo** | per call | COGS vs $9.99 Pro |
|-------|----------|-----------|---------------|----------|-------------------|
| **Haiku 4.5** | 1.75M → $1.75 | 0.49M → $2.45 | **≈ $4.20** | $0.0070 | **~42%** |
| **Sonnet 4.6** | 1.75M → $5.25 | 0.57M → $8.56 | **≈ $13.81** | $0.0230 | **~138% — underwater** |

- **Sonnet costs 3.29× Haiku** ($13.81 vs $4.20) and **exceeds the entire $9.99 Pro price on COGS alone** —
  not viable as the default extraction model for a managed/subsidized tier.
- These are **~1.5× higher than the §2 estimates** ($2.70 / $8.10) because the real prompt is larger and outputs
  longer. The §2 row should be treated as a floor; §5.3 is the measured figure.
- **Prompt caching lever (Haiku):** the ~2,850-token system+schema prefix is stable. If captures arrive in bursts
  within the 5-min cache TTL (system billed at ~0.1× on reads), Haiku drops to **≈ $2.66/user/mo** (~27% COGS).
  Sporadic single captures won't benefit — don't bank on it for the average user, but it's free upside for bursty ones.

### 5.4 Recommendation — **hybrid: Haiku default + Sonnet fallback, Sonnet for summaries**

1. **Keep Haiku 4.5 as the default extraction model** (`claudeExtractionModel = claude-haiku-4-5`). At 86.7% vs
   90.0% it is within a 3.3-point margin (one probe), ties Sonnet on money/contact and general recall, returns
   100% valid JSON, and costs **3.3× less** — the only model whose COGS (~42%, or ~27% with caching) fits under the
   $9.99 Pro tier. This validates the 1.0 baseline split.
2. **Route to Sonnet 4.6 only on the narrow slice where Haiku is weak: complex, multi-fact, date/number-heavy
   notes, or low-confidence extractions.** That is the only category with a measured gap. Because such notes are a
   minority of captures, blended COGS stays close to Haiku's. Do **not** make Sonnet the default — it is underwater.
3. **Summary / insight / Wrapped → Sonnet 4.6** (`claudeSummaryModel = claude-sonnet-4-6`, unchanged). These are
   low-frequency, high-value, user-visible prose where Sonnet's edge matters and the per-call cost is immaterial.
4. **Apply prompt caching to the extraction system+schema prefix regardless of model** — it's a stable ~2,850-token
   prefix and free margin on bursty capture sessions.

**Bottom line for the owner's objective (least cost + most accurate):** Haiku-everywhere on extraction is the
cost-optimal choice and loses almost nothing on accuracy; the hybrid adds Sonnet only where it measurably helps
(numeric/date-dense notes) and on user-visible summaries, keeping blended COGS near Haiku's ~$4/user/mo while
closing the one real accuracy gap. **Sonnet-as-default is ruled out** — at $13.81/user/mo it costs more than the
subscription it would support.

> **Caveats.** N = 30 probes (representative subset of the 50; health-shaped excluded per the privacy lane) —
> a 1-probe swing moves accuracy by 3.3 points, so treat 86.7% vs 90.0% as "within noise on a small set,
> gap isolated to numeric/date precision," not a precise delta. Extraction-cost tokens are from 8 dense Eleanor
> records (likely an upper bound on output for typical short captures). Accuracy here is oracle-memory **recall**
> (answering from a remembered note), the doc's chosen proxy; it is not a full field-by-field extraction-correctness
> audit. To tighten: raise N to all 50 (incl. health, with `ELEANOR_REMOTE_INCLUDE_HEALTH=true`) and add an
> extraction-field scorer against `tests/outcome-catalog.ts` expectations.
