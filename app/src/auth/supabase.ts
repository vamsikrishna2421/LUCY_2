/**
 * Supabase client for the LUCY app (SaaS auth).
 *
 * OTA-friendly by design — no new native modules:
 *  - @supabase/supabase-js + react-native-url-polyfill are pure JS (ship via `eas update`).
 *  - Session persistence rides the app's EXISTING encrypted SQLite (SQLCipher) via the settings
 *    table, instead of @react-native-async-storage (native) or expo-secure-store (2KB Android cap
 *    that truncates Supabase sessions). No size limit, encrypted at rest.
 *  - OAuth uses the system browser via Linking + the app's `lucy://` deep link (see AuthProvider),
 *    instead of expo-web-browser. flowType 'implicit' returns tokens in the redirect fragment, so
 *    no PKCE/Web-Crypto polyfill is needed.
 *
 * Only the PUBLIC anon key is embedded here — it is designed to be shipped in clients; row-level
 * security enforces per-user access. The service_role key NEVER appears in the app.
 */
import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getDatabase } from '../db';
import { getSetting, setSetting, deleteSetting } from '../db/settings';

export const SUPABASE_URL = 'https://ezyhsiwlmvrmzwogpbrn.supabase.co';
// Public anon key (safe to embed; RLS protects data). Not the service_role key.
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6eWhzaXdsbXZybXp3b2dwYnJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwODA0NDAsImV4cCI6MjA5NzY1NjQ0MH0.J4WZvs0GYWP-bIg8oWdbSrKn-LTc37ZSemFuLQpBmfA';

/** Deep link Supabase redirects back to after OAuth. MUST be in Supabase → Auth → URL Configuration
 *  → Redirect URLs, and the app scheme is `lucy` (app.json). */
export const OAUTH_REDIRECT = 'lucy://auth-callback';

/** Session store backed by the app's encrypted SQLite settings table (no native AsyncStorage). */
const sqliteStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try { return (await getSetting(await getDatabase(), key)) ?? null; } catch { return null; }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try { await setSetting(await getDatabase(), key, value); } catch { /* non-critical */ }
  },
  removeItem: async (key: string): Promise<void> => {
    try { await deleteSetting(await getDatabase(), key); } catch { /* non-critical */ }
  },
};

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: sqliteStorage,
    autoRefreshToken: true,
    persistSession: true,
    // We never run on a URL-bearing web context here; the app parses the OAuth redirect itself.
    detectSessionInUrl: false,
    // Implicit flow → tokens arrive in the redirect fragment (no PKCE / Web-Crypto needed in RN).
    flowType: 'implicit',
  },
});
