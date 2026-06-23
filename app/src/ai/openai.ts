import { jsonrepair } from 'jsonrepair';
import { config } from '../config';
import { getPreferredModel, modelForTask, type AiTask } from './modelPreference';
import type { ExtractionResult } from '../types/extraction';

/** Routes to Claude or OpenAI depending on the active model. Use this everywhere instead of promptOpenAI directly.
 *  `task` selects the cost tier (cheap for routine work, mid for insight, user's pick for chat). */
export async function promptAI(system: string, input: string, apiKey: string, task: AiTask = 'chat'): Promise<string> {
  const model = modelForTask(task, config.openAIModel);
  // Managed proxy first (signed in + backend URL configured) — runs on the MANAGED key via the
  // backend, not the user's own key. Dormant until a backend URL is set (see proxy.ts).
  const { proxyAvailable, proxyPrompt } = await import('./proxy');
  if (await proxyAvailable()) {
    // Managed mode: return the proxy result. On error it propagates — extraction callers fall back to
    // the proper on-device path (provider.ts → localAnalyze) and ProxyLimitError surfaces the limit.
    // We deliberately do NOT run a second on-device pass here (it mismatched the device extraction
    // path and crashed under load).
    return proxyPrompt(system, input, task);
  }
  // Legacy BYO / on-device path — count toward the local hourly cost guard (managed mode meters
  // server-side, so we skip the local guard for proxied calls above).
  void import('./rateLimit').then((m) => m.recordAiCall()).catch(() => {});
  if (model.startsWith('claude-')) {
    const { promptClaude } = await import('./claude');
    return promptClaude(system, input, model);
  }
  return promptOpenAI(system, input, apiKey, model);
}
import { extractionSchemaPrompt, extractionSystemPrompt, localReferenceTimestamp } from './prompts';

function textFromResponse(result: {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
}): string {
  return result.output_text
    ?? result.output?.flatMap((item) => item.content ?? [])
      .filter((content) => content.type === 'output_text')
      .map((content) => content.text ?? '')
      .join('\n')
    ?? '';
}

export async function promptOpenAI(
  system: string,
  input: string,
  apiKey: string,
  model = getPreferredModel(config.openAIModel),
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      // reasoning param is only valid for o-series models (o1, o3, o4-mini…).
      // Standard GPT models (gpt-4o, gpt-4o-mini, gpt-4.1…) reject it with a 400.
      ...(model.startsWith('o') ? { reasoning: { effort: 'low' } } : {}),
      max_output_tokens: 1800,
      instructions: system,
      input,
    }),
  });
  const rawText = await response.text();

  // Guard: if server returned HTML instead of JSON (proxy error, rate limit page, etc.)
  if (rawText.trimStart().startsWith('<')) {
    throw new Error(`OpenAI returned an error page (status ${response.status}). Check your API key and internet connection.`);
  }

  if (!response.ok) {
    let detail = rawText.slice(0, 200);
    try { detail = (JSON.parse(rawText) as { error?: { message?: string } }).error?.message ?? detail; } catch { /* use raw */ }
    throw new Error(`OpenAI error ${response.status}: ${detail}`);
  }

  try {
    return textFromResponse(JSON.parse(rawText) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    });
  } catch {
    throw new Error(`Could not parse OpenAI response. The API may be temporarily unavailable.`);
  }
}

export async function analyzeWithOpenAI(
  transcript: string,
  apiKey: string,
  userContextPrefix = '',
): Promise<ExtractionResult> {
  const raw = await promptAI(
    `${userContextPrefix}${extractionSystemPrompt}\nReference local timestamp: ${localReferenceTimestamp()}\n${extractionSchemaPrompt}`,
    transcript,
    apiKey,
    'extraction',
  );
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('The AI model did not return structured JSON.');
  }
  // Parse leniently — an on-device fallback can emit slightly malformed JSON, exactly like the
  // dedicated device path which also uses jsonrepair. (Static import — a dynamic import here risked
  // an undefined namespace under Metro/Hermes.)
  return JSON.parse(jsonrepair(raw.slice(start, end + 1))) as ExtractionResult;
}
