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
const DEFAULT_BACKEND_URL = '';

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

/** Use the managed proxy when there is BOTH a configured backend URL AND a signed-in session. */
export async function proxyAvailable(): Promise<boolean> {
  const url = await getBackendUrl();
  if (!url) return false;
  return Boolean(await getAccessToken());
}

/** Over-budget (429) — must be surfaced to the user, never silently swallowed. */
export class ProxyLimitError extends Error {
  constructor(message: string) { super(message); this.name = 'ProxyLimitError'; }
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
  const res = await fetch(`${url}/api/ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  type ProxyResp = { text?: string; message?: string; error?: string };
  let json: ProxyResp | null = null;
  try { json = JSON.parse(raw) as ProxyResp; } catch { /* non-JSON error page */ }
  if (res.status === 429) throw new ProxyLimitError(json?.message ?? "You've reached your usage limit.");
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
