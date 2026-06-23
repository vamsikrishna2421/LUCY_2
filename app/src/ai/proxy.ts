/**
 * Managed AI proxy client — routes the app's AI through the LUCY backend (/api/ai) using the signed-in
 * user's Supabase JWT, so the app runs on the MANAGED key instead of each user's own key.
 *
 * DORMANT BY DEFAULT: until a backend base URL is configured (DEFAULT_BACKEND_URL below, or the
 * `backend_base_url` DB setting), `proxyAvailable()` returns false and the app keeps using its
 * existing on-device / BYO-key path. This makes the managed layer safe to ship ahead of the Vercel
 * deploy — flip it on later by setting the URL (no code change needed if you use the DB setting).
 */
import { supabase } from '../auth/supabase';
import { getDatabase } from '../db';
import { getSetting } from '../db/settings';

/** Set to the deployed backend origin (e.g. https://lucy-xxx.vercel.app) to enable managed AID,
 *  or leave empty and set the `backend_base_url` DB setting at runtime. */
const DEFAULT_BACKEND_URL = 'https://dashboard-beryl-xi-25.vercel.app';

let cachedUrl: string | null = null;

export async function getBackendUrl(): Promise<string> {
  if (cachedUrl !== null) return cachedUrl;
  let url = DEFAULT_BACKEND_URL;
  try {
    const db = await getDatabase();
    url = (await getSetting(db, 'backend_base_url'))?.trim() || DEFAULT_BACKEND_URL;
  } catch { /* fall back to default */ }
  cachedUrl = url.replace(/\/+$/, '');
  return cachedUrl;
}

/** Call after changing the backend URL setting so the next AI call picks it up. */
export function clearBackendUrlCache(): void { cachedUrl = null; }

async function getAccessToken(): Promise<string | null> {
  try { const { data } = await supabase.auth.getSession(); return data.session?.access_token ?? null; }
  catch { return null; }
}

/** User's processing preference: 'hybrid' (managed cloud + on-device fallback) or 'on_device' (fully
 *  local, never calls the managed backend). Stored in settings; defaults to hybrid. */
export type ProcessingMode = 'hybrid' | 'on_device';
export async function getProcessingMode(): Promise<ProcessingMode> {
  try {
    const db = await getDatabase();
    return (await getSetting(db, 'ai_processing_mode')) === 'on_device' ? 'on_device' : 'hybrid';
  } catch { return 'hybrid'; }
}

/** Use the managed proxy when: a backend URL is configured, the user hasn't chosen fully-on-device,
 *  AND there's a signed-in session. */
export async function proxyAvailable(): Promise<boolean> {
  const url = await getBackendUrl();
  if (!url) return false;
  if ((await getProcessingMode()) === 'on_device') return false; // user opted into fully-local processing
  return Boolean(await getAccessToken());
}

/** Over-budget (429) — must be surfaced to the user, never silently swallowed. */
export class ProxyLimitError extends Error {
  constructor(message: string) { super(message); this.name = 'ProxyLimitError'; }
}

// Quota-reached notifier — the app subscribes to show an upgrade-nudge banner when the managed budget
// is hit (we still gracefully fall back to on-device so the capture is organized).
export interface QuotaInfo { message: string; resetHours?: number | null }
const quotaListeners = new Set<(info: QuotaInfo) => void>();
export function onQuotaReached(fn: (info: QuotaInfo) => void): () => void {
  quotaListeners.add(fn);
  return () => { quotaListeners.delete(fn); };
}

interface ProxyBody {
  system?: string;
  input: string;
  task?: string;
  image?: { data: string; mediaType: string };
  maxTokens?: number;
}

async function callProxy(body: ProxyBody): Promise<string> {
  const url = await getBackendUrl();
  const token = await getAccessToken();
  if (!url || !token) throw new Error('Managed AI not available.');
  // Hard timeout so a hung request can never freeze the processing queue (the single-flight drainer
  // awaits this). On abort the call throws → extraction falls back to on-device; capture retries.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  let res: Response;
  try {
    res = await fetch(`${url}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  const raw = await res.text();
  type ProxyResp = { text?: string; message?: string; error?: string };
  let json: ProxyResp | null = null;
  try { json = JSON.parse(raw) as ProxyResp; } catch { /* non-JSON error page */ }
  if (res.status === 429) {
    const message = json?.message ?? "You've reached your usage limit.";
    const info: QuotaInfo = { message, resetHours: (json as { resetHours?: number | null } | null)?.resetHours ?? null };
    quotaListeners.forEach((l) => { try { l(info); } catch { /* ignore */ } });
    throw new ProxyLimitError(message);
  }
  if (!res.ok) throw new Error(json?.message ?? json?.error ?? `AI request failed (${res.status}).`);
  return json?.text ?? '';
}

export async function proxyPrompt(system: string, input: string, task = 'chat'): Promise<string> {
  return callProxy({ system, input, task });
}

export async function proxyVision(system: string, base64Image: string, mediaType = 'image/jpeg'): Promise<string> {
  return callProxy({
    system,
    input: 'Transcribe and describe this image per the instructions.',
    task: 'vision',
    image: { data: base64Image, mediaType },
    maxTokens: 1200,
  });
}
