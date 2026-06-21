/**
 * PostHog wrapper — product analytics, funnels, retention, and feature flags.
 *
 * The `posthog-react-native` SDK is LAZY-REQUIRED (only loaded inside init, after we've
 * confirmed a key exists) so the native module never has to resolve in dev/CI builds that
 * ship without it. With no `EXPO_PUBLIC_POSTHOG_KEY` the whole module is a pure no-op that
 * logs to the dev console — the app runs identically with or without credentials.
 *
 * This module is intentionally low-level (raw event strings). Always go through ../index,
 * which adds the typed event taxonomy on top.
 */

const DEBUG_TAG = '[telemetry]';

/** Minimal surface of the PostHog instance we rely on (keeps us off the SDK's types). */
interface PostHogLike {
  capture(event: string, properties?: Record<string, unknown>): void;
  identify(distinctId: string, properties?: Record<string, unknown>): void;
  screen(name: string, properties?: Record<string, unknown>): void;
  reset(): void;
  flush(): Promise<void> | void;
  reloadFeatureFlags(): Promise<void> | void;
  isFeatureEnabled(key: string): boolean | undefined;
}

let client: PostHogLike | null = null;
/** True once `init` ran with a real key and the SDK loaded — gates every call below. */
let enabled = false;

function debug(...args: unknown[]): void {
  if (__DEV__) console.debug(DEBUG_TAG, ...args);
}

/**
 * Initialize PostHog. No-op (with a dev log) when no key is configured or the SDK isn't
 * installed. Safe to call more than once; only the first successful init takes effect.
 */
export function init(key: string | undefined, host?: string): void {
  if (enabled) return;
  if (!key) {
    debug('PostHog disabled (no EXPO_PUBLIC_POSTHOG_KEY) — analytics are no-ops');
    return;
  }
  try {
    // Lazy require: pulled in only when we actually have a key.
    const mod = require('posthog-react-native') as {
      default?: new (key: string, opts?: Record<string, unknown>) => PostHogLike;
      PostHog?: new (key: string, opts?: Record<string, unknown>) => PostHogLike;
    };
    const PostHog = mod.default ?? mod.PostHog;
    if (!PostHog) {
      debug('posthog-react-native loaded but no constructor export found — staying no-op');
      return;
    }
    client = new PostHog(key, host ? { host } : undefined);
    enabled = true;
    debug('PostHog initialized', host ? `(host: ${host})` : '');
  } catch (e) {
    // SDK not installed or native module missing — degrade to no-op, never crash.
    debug('PostHog init failed, staying no-op:', (e as Error)?.message ?? e);
  }
}

export function capture(event: string, props?: Record<string, unknown>): void {
  if (!enabled || !client) { debug('capture (noop):', event, props ?? {}); return; }
  try { client.capture(event, props); } catch (e) { debug('capture failed:', (e as Error)?.message); }
}

export function identify(id: string, traits?: Record<string, unknown>): void {
  if (!enabled || !client) { debug('identify (noop):', id, traits ?? {}); return; }
  try { client.identify(id, traits); } catch (e) { debug('identify failed:', (e as Error)?.message); }
}

export function screen(name: string, props?: Record<string, unknown>): void {
  if (!enabled || !client) { debug('screen (noop):', name, props ?? {}); return; }
  try { client.screen(name, props); } catch (e) { debug('screen failed:', (e as Error)?.message); }
}

export function reset(): void {
  if (!enabled || !client) { debug('reset (noop)'); return; }
  try { client.reset(); } catch (e) { debug('reset failed:', (e as Error)?.message); }
}

export async function flush(): Promise<void> {
  if (!enabled || !client) { debug('flush (noop)'); return; }
  try { await client.flush(); } catch (e) { debug('flush failed:', (e as Error)?.message); }
}

/**
 * Read a boolean feature flag, returning `fallback` whenever PostHog is disabled, the flag
 * is unknown, or anything throws. Callers therefore always get a safe, deterministic value.
 */
export function isFeatureEnabled(key: string, fallback = false): boolean {
  if (!enabled || !client) { debug('flag (noop):', key, '→', fallback); return fallback; }
  try {
    const v = client.isFeatureEnabled(key);
    return typeof v === 'boolean' ? v : fallback;
  } catch (e) {
    debug('flag failed:', (e as Error)?.message);
    return fallback;
  }
}

export async function reloadFlags(): Promise<void> {
  if (!enabled || !client) { debug('reloadFlags (noop)'); return; }
  try { await client.reloadFeatureFlags(); } catch (e) { debug('reloadFlags failed:', (e as Error)?.message); }
}

/** Test/diagnostic helper: whether a live PostHog client is active. */
export function isEnabled(): boolean { return enabled; }
