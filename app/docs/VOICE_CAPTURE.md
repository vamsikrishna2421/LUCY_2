# Voice capture & managed AI — behavior contract

Documents how voice input is captured and how AI requests are routed, after the 2026-06-23 fixes.

## Voice typing vs Listen mode (must stay distinct)

- **Voice typing** = the bottom-center **Hold-to-talk** mic. One press-and-hold is **ONE dictation →
  ONE `voice` capture**. The whole clip is transcribed and handed to the LLM as a single memory; the
  LLM decides how to structure it (it can still extract multiple tasks/expenses *inside* that one
  capture). It is **not** chopped into ~30-second/sentence pieces, and it does **not** go through the
  voice command interpreter. Spoken **commands** ("schedule a walk at 6") live in **"Hey Lucy"** (the
  conversation), not the hold-to-talk mic.
- **Listen mode** = the separate continuous transcription path that keeps its **~30-second batch**
  cadence. The two paths must not share the same splitting behavior.

### Invariant
A capture with `source === 'voice'` is **never split or segmented**:
- `enqueueTranscript` only runs the thought/journal splitters for `source === 'text'`.
- `processQueue` skips `segmentAndIngestDayJournal` and the multi-date journal ingest for
  `source === 'voice'`.
Only typed text day-logs are segmented into per-event captures.

### Code touchpoints
- `App.tsx` `finishVoiceCapture` → `enqueueTranscript(text, 'voice')` (no command router).
- `src/processing/extract.ts` `processQueue` → the two `capture.source !== 'voice'` guards.

> **2026-06-23 bug (fixed):** a ~2-3 min hold-to-talk clip exploded into ~25 sentence-level `text`
> captures because hold-to-talk routed through `runVoiceCommand` → re-tagged `text` → `thoughtSplitter`
> + `segmentAndIngestDayJournal`.

## Managed AI routing

Signed-in users run AI through the managed backend (`/api/ai` on Vercel) on LUCY's key, not their own.

- Central seam: `src/ai/openai.ts` `promptAI` → `proxyPrompt` when `proxyAvailable()` (signed in +
  backend URL configured in `src/ai/proxy.ts`). Otherwise the legacy BYO/on-device path.
- Vision (`promptClaudeVision`) and all 5 vision callers (smart photo, receipt OCR, doc-vault, LUCY
  Lens, food photo) route through the proxy in managed mode.
- **Resilience / no crash:** `promptAI` does **not** run a second on-device pass on proxy error (that
  crashed with `undefined is not a function` under load). Extraction resilience is handled by
  `provider.ts` `AIProvider.analyze` → `localAnalyze` on failure. `jsonrepair` is a static import.
- **No queue freeze:** `proxy.ts` `callProxy` has a **45s AbortController timeout** so a hung request
  can't stall the single-flight processing queue.
- Settings → AI & intelligence shows **"✓ Managed by LUCY"** when managed; the BYOK key field is then
  optional.
