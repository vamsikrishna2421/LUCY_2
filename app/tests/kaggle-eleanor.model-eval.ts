/**
 * Standalone Haiku-vs-Sonnet model evaluation for the capture→extraction path.
 *
 * Why this exists separately from tests/kaggle-eleanor.claude-redacted.ts:
 *   - That harness imports src/ai/claude, which transitively pulls in expo-secure-store,
 *     expo-sqlite, and react-native — none of which tsx/esbuild can transform outside Metro
 *     (react-native/index.js fails with `Unexpected "typeof"`). So `bench:kaggle-eleanor:claude`
 *     cannot run in a plain Node/tsx process in this environment.
 *   - That harness also discards `message.usage`, so it can't report measured tokens/call.
 *
 * This script imports ONLY pure, RN-free modules (src/processing/redaction.ts and
 * src/ai/prompts.ts — both have zero imports) and makes the Anthropic HTTPS call inline,
 * capturing real `usage`. It does NOT modify any frozen src/** logic.
 *
 * It measures two things per model, in one pass:
 *   1. Accuracy: oracle-memory recall on the injection probes (same scoring as the redacted
 *      harness) — the doc §3 methodology.
 *   2. Cost: measured input/output tokens for the REAL extraction path (extractionSystemPrompt
 *      + schema + a representative Eleanor note), to replace the doc §2 token estimates.
 *
 * Run:
 *   ELEANOR_CLAUDE_MODELS=claude-haiku-4-5,claude-sonnet-4-6 ELEANOR_LIMIT=30 \
 *     node --env-file=.env.local --import tsx tests/kaggle-eleanor.model-eval.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { applyRemoteRedactionMap, redactForRemote } from '../src/processing/redaction';
import {
  extractionSchemaPrompt,
  extractionSystemPrompt,
  localReferenceTimestamp,
} from '../src/ai/prompts';

type InjectionProbe = {
  date: string;
  injected_note: string;
  response_expected_content: string;
  testing_prompt: string;
};

type DailyCorpus = {
  GENERAL_PROFILE: Record<string, unknown>;
  DAILY_RECORDS: Record<string, string>;
};

type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

type ClaudeReply = { text: string; usage: Usage };

const rawDir = path.resolve(process.cwd(), 'benchmarks', 'kaggle-eleanor', 'raw');
const injectionPath = path.join(rawDir, 'Eleanor_Vance_manual_injections_info.json');
const dailyPath = path.join(rawDir, 'Eleanor_Vance_Daily_Records_Dec-1-2020_to_Nov-30-2024.json');
const outputDir = path.resolve(process.cwd(), 'benchmarks', 'kaggle-eleanor', 'results');

const probeLimit = Number.parseInt(process.env.ELEANOR_LIMIT ?? '30', 10);
const extractionSampleSize = Number.parseInt(process.env.ELEANOR_EXTRACTION_SAMPLES ?? '8', 10);
const includeHealth = process.env.ELEANOR_REMOTE_INCLUDE_HEALTH === 'true';
const models = (process.env.ELEANOR_CLAUDE_MODELS ?? 'claude-haiku-4-5,claude-sonnet-4-6')
  .split(',')
  .map((m: string) => m.trim())
  .filter(Boolean);

const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY?.trim();
if (!apiKey) {
  throw new Error('EXPO_PUBLIC_ANTHROPIC_API_KEY missing. Run via: node --env-file=.env.local ...');
}

const healthSignal = /health|pain|anxiety|panic|allerg|medicat|doctor|physio|cholesterol|mercury|pharmacy/i;
const stopWords = new Set([
  'a', 'an', 'and', 'are', 'at', 'be', 'for', 'from', 'has', 'in', 'is', 'it',
  'of', 'on', 'or', 'the', 'to', 'was', 'with',
]);

// --- Probe categorisation (for per-category accuracy reporting) -----------------------------
const dateSignal = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|expires?|december|march|july)\b|\d{1,2}(st|nd|rd|th)?\b/i;
const moneySignal = /\$|\bcoupon\b|\bdiscount\b|\bphone\b|\b\d{3}[- ]\d{3}[- ]\d{4}\b|\bfee\b|\bprice\b|\bcheap\b|\bsave\b|@/i;
function categorise(probe: InjectionProbe): string {
  const blob = `${probe.injected_note} ${probe.response_expected_content}`;
  if (healthSignal.test(blob)) return 'health';
  if (dateSignal.test(blob)) return 'dates';
  if (moneySignal.test(blob)) return 'money/contact';
  return 'general';
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9[\]_]+/g, ' ').trim();
}

// Same scoring as tests/kaggle-eleanor.claude-redacted.ts (substring OR >=75% token coverage).
function scoreAnswer(expected: string, answer: string): { passed: boolean; coverage: number } {
  const ne = normalize(expected);
  const na = normalize(answer);
  if (na.includes(ne)) return { passed: true, coverage: 1 };
  const tokens = [...new Set(ne.split(' ').filter((t) => t.length > 1 && !stopWords.has(t)))];
  const coverage = tokens.length ? tokens.filter((t) => na.includes(t)).length / tokens.length : 0;
  return { passed: coverage >= 0.75, coverage };
}

async function callClaude(model: string, system: string, input: string, maxTokens: number): Promise<ClaudeReply> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey as string,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: input }],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Claude request failed (${response.status}) for ${model}: ${detail}`);
  }
  const body = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
    usage: Usage;
  };
  const text = body.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n');
  return { text, usage: body.usage };
}

function pickExtractionSamples(records: Array<[string, string]>, n: number): Array<[string, string]> {
  // Even spread across the 4-year corpus so we sample varied content shapes, not just December.
  const step = Math.max(1, Math.floor(records.length / n));
  const picked: Array<[string, string]> = [];
  for (let i = 0; i < records.length && picked.length < n; i += step) picked.push(records[i]);
  return picked;
}

async function main(): Promise<void> {
  if (!fs.existsSync(injectionPath) || !fs.existsSync(dailyPath)) {
    throw new Error('Eleanor raw files missing. Run npm run test:kaggle-eleanor first.');
  }
  const probesAll = Object.values(
    JSON.parse(fs.readFileSync(injectionPath, 'utf8')) as Record<string, InjectionProbe>,
  );
  const eligible = probesAll.filter(
    (p) => includeHealth || !healthSignal.test(`${p.injected_note} ${p.testing_prompt} ${p.response_expected_content}`),
  );
  const probes = eligible.slice(0, Number.isFinite(probeLimit) ? probeLimit : eligible.length);

  const daily = JSON.parse(fs.readFileSync(dailyPath, 'utf8')) as DailyCorpus;
  const extractionSamples = pickExtractionSamples(Object.entries(daily.DAILY_RECORDS), extractionSampleSize);

  // Pre-redact probes once (shared across models) — mirrors the redacted harness fallback redaction.
  const preparedProbes = probes.map((probe) => {
    const raw = `Remembered note: ${probe.injected_note}\nQuestion: ${probe.testing_prompt}`;
    const fb = redactForRemote(raw);
    return {
      probe,
      outbound: fb.text,
      expected: applyRemoteRedactionMap(probe.response_expected_content, fb.replacements),
      category: categorise(probe),
    };
  });

  console.log(
    `Model eval: ${probes.length}/${probesAll.length} probes (health ${includeHealth ? 'included' : 'excluded'}), `
    + `${extractionSamples.length} extraction samples, models: ${models.join(', ')}.`,
  );

  const summaries: any[] = [];
  for (const model of models) {
    console.log(`\n=== ${model} ===`);

    // --- 1) Accuracy: oracle-memory recall on probes ---
    const probeResults: Array<{ index: number; passed: boolean; coverage: number; category: string; usage: Usage }> = [];
    for (let i = 0; i < preparedProbes.length; i += 1) {
      const p = preparedProbes[i];
      const reply = await callClaude(
        model,
        'You are evaluating memory retrieval using synthetic benchmark records. Answer using only the remembered note. Return only the short answer, without explanation. Preserve placeholders such as [LOCAL_SECRET_1] and [CREDENTIAL_1] verbatim.',
        p.outbound,
        300,
      );
      const score = scoreAnswer(p.expected, reply.text);
      probeResults.push({ index: i + 1, passed: score.passed, coverage: score.coverage, category: p.category, usage: reply.usage });
      if ((i + 1) % 10 === 0 || i + 1 === preparedProbes.length) {
        console.log(`  recall ${i + 1}/${preparedProbes.length}`);
      }
    }

    // --- 2) Cost: measured tokens on the REAL extraction path ---
    const extractionSystem = `${extractionSystemPrompt}\nReference local timestamp: ${localReferenceTimestamp()}\n${extractionSchemaPrompt}`;
    const extractionResults: Array<{ date: string; chars: number; usage: Usage; jsonOk: boolean }> = [];
    for (let i = 0; i < extractionSamples.length; i += 1) {
      const [date, text] = extractionSamples[i];
      const reply = await callClaude(model, extractionSystem, text, 1800);
      const start = reply.text.indexOf('{');
      const end = reply.text.lastIndexOf('}');
      let jsonOk = false;
      if (start !== -1 && end !== -1) {
        try { JSON.parse(reply.text.slice(start, end + 1)); jsonOk = true; } catch { jsonOk = false; }
      }
      extractionResults.push({ date, chars: text.length, usage: reply.usage, jsonOk });
      console.log(`  extract ${i + 1}/${extractionSamples.length} (${date}, ${text.length} chars, json ${jsonOk ? 'ok' : 'FAIL'})`);
    }

    // --- Aggregate ---
    const passed = probeResults.filter((r) => r.passed).length;
    const byCategory: Record<string, { passed: number; total: number }> = {};
    for (const r of probeResults) {
      byCategory[r.category] ??= { passed: 0, total: 0 };
      byCategory[r.category].total += 1;
      if (r.passed) byCategory[r.category].passed += 1;
    }
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const extrIn = avg(extractionResults.map((r) => r.usage.input_tokens));
    const extrOut = avg(extractionResults.map((r) => r.usage.output_tokens));

    summaries.push({
      model,
      probes: { passed, total: probeResults.length, accuracyPct: (passed / probeResults.length) * 100, byCategory },
      extraction: {
        samples: extractionResults.length,
        avgInputTokens: extrIn,
        avgOutputTokens: extrOut,
        jsonValidRate: extractionResults.filter((r) => r.jsonOk).length / extractionResults.length,
        avgInputChars: avg(extractionResults.map((r) => r.chars)),
      },
      probeResults,
      extractionResults,
    });
  }

  // --- Cost model (per doc §1 pricing) ---
  const PRICING: Record<string, { in: number; out: number }> = {
    'claude-haiku-4-5': { in: 1.0, out: 5.0 },
    'claude-sonnet-4-6': { in: 3.0, out: 15.0 },
  };
  const CALLS_PER_MONTH = 600;

  console.log('\n================ SUMMARY ================');
  for (const s of summaries) {
    const price = PRICING[s.model];
    const costPerUserMonth = price
      ? (s.extraction.avgInputTokens * CALLS_PER_MONTH / 1e6) * price.in
        + (s.extraction.avgOutputTokens * CALLS_PER_MONTH / 1e6) * price.out
      : null;
    console.log(`\n${s.model}`);
    console.log(`  Probe accuracy: ${s.probes.passed}/${s.probes.total} = ${s.probes.accuracyPct.toFixed(1)}%`);
    for (const [cat, v] of Object.entries(s.probes.byCategory) as Array<[string, { passed: number; total: number }]>) {
      console.log(`    ${cat}: ${v.passed}/${v.total}`);
    }
    console.log(`  Extraction avg tokens: in=${s.extraction.avgInputTokens.toFixed(0)} out=${s.extraction.avgOutputTokens.toFixed(0)} (json valid ${(s.extraction.jsonValidRate * 100).toFixed(0)}%)`);
    if (costPerUserMonth != null) {
      console.log(`  Recomputed $/user/mo @ ${CALLS_PER_MONTH} calls: $${costPerUserMonth.toFixed(2)}`);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    methodology: 'standalone-model-eval: oracle-memory recall + measured extraction-path tokens',
    probeLimit: probes.length,
    extractionSamples: extractionSamples.length,
    healthIncluded: includeHealth,
    pricing: PRICING,
    callsPerMonth: CALLS_PER_MONTH,
    models: summaries,
  };
  fs.mkdirSync(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, `model-eval-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nWritten to ${path.relative(process.cwd(), reportPath)}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
