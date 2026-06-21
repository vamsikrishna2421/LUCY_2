import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

const DEVICE_LOCALES: Record<string, string> = {
  en: 'en-US',
  te: 'te-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  mr: 'mr-IN',
  bn: 'bn-IN',
  gu: 'gu-IN',
  pa: 'pa-IN',
  ur: 'ur-IN',
};

/** The user's *preferred* locale from their profile languages (may not be supported by the recognizer). */
export function getDeviceSpeechLocale(languages: string[]): string {
  const selected = [...new Set(languages.map((language) => language.trim().toLowerCase()).filter(Boolean))];
  const primary = selected.find((language) => language !== 'en') ?? selected[0] ?? 'en';
  return DEVICE_LOCALES[primary] ?? `${primary}-IN`;
}

// ── Supported-locale resolution ──────────────────────────────────────────────────
// Several languages people select (Telugu te-IN, Tamil, Kannada, Malayalam, Marathi…) have NO speech
// model on iOS, so starting the recognizer with that locale fails with `language-not-supported` — which
// wedged the "Hey Lucy" wake word in "Starting…" and broke conversation / Listen entirely. We resolve
// the desired locale against what the device ACTUALLY supports and fall back gracefully.

let supportedCache: { locales: string[]; installed: string[] } | null = null;

async function fetchSupportedLocales(): Promise<{ locales: string[]; installed: string[] }> {
  if (supportedCache) return supportedCache;
  try {
    const r = await ExpoSpeechRecognitionModule.getSupportedLocales({});
    supportedCache = { locales: (r?.locales ?? []) as string[], installed: (r?.installedLocales ?? []) as string[] };
  } catch {
    supportedCache = { locales: [], installed: [] };
  }
  return supportedCache;
}

const eqLocale = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();
const baseLang = (s: string): string => s.split('-')[0]?.toLowerCase() ?? s.toLowerCase();

/**
 * Locale for dictation / conversation / Listen. Prefer a supported locale matching one of the user's
 * languages (their non-English language first, preserving the old behaviour); otherwise fall back to
 * regional English (en-IN → hi-IN → en-US → en-GB → any English) so transcription still works even when
 * the user's language (e.g. Telugu) has no speech model on this device.
 */
export async function resolveSupportedSpeechLocale(languages: string[]): Promise<string> {
  const preferred = getDeviceSpeechLocale(languages);
  const { locales } = await fetchSupportedLocales();
  if (locales.length === 0) return preferred; // device didn't enumerate locales — best effort
  const exact = locales.find((l) => eqLocale(l, preferred));
  if (exact) return exact;
  const langs = [...new Set(languages.map((l) => l.trim().toLowerCase()).filter(Boolean))];
  for (const lang of [...langs.filter((l) => l !== 'en'), ...langs.filter((l) => l === 'en')]) {
    const m = locales.find((l) => baseLang(l) === lang);
    if (m) return m;
  }
  for (const p of ['en-IN', 'hi-IN', 'en-US', 'en-GB']) {
    const m = locales.find((l) => eqLocale(l, p));
    if (m) return m;
  }
  return locales.find((l) => baseLang(l) === 'en') ?? locales[0] ?? 'en-US';
}

/**
 * Locale for the "Hey Lucy" wake word. The wake phrase is English, so always resolve to a supported
 * ENGLISH locale — regional to the user where possible (Indian users → en-IN handles the accent best).
 * Using the user's non-English language here is what produced the long "Starting…" hang + mishearings.
 */
export async function resolveWakeWordLocale(languages: string[]): Promise<string> {
  const region = getDeviceSpeechLocale(languages).split('-')[1]; // 'IN', 'US', …
  const candidates = [region ? `en-${region}` : '', 'en-IN', 'en-US', 'en-GB'].filter(Boolean);
  const { locales } = await fetchSupportedLocales();
  if (locales.length === 0) return candidates[0] || 'en-US';
  for (const c of candidates) { const m = locales.find((l) => eqLocale(l, c)); if (m) return m; }
  return locales.find((l) => baseLang(l) === 'en') ?? locales[0] ?? 'en-US';
}
