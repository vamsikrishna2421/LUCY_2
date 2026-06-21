/**
 * Sentry wrapper — crash & error monitoring.
 *
 * `@sentry/react-native` is LAZY-REQUIRED inside init so the native module is only resolved
 * when a DSN is present. With no `EXPO_PUBLIC_SENTRY_DSN` every function here is a no-op that
 * logs to the dev console — errors still surface locally via the existing dev_log path in
 * ErrorBoundary; Sentry simply adds remote reporting once a DSN is configured.
 *
 * Go through ../index (captureError) rather than calling this directly.
 */

const DEBUG_TAG = '[telemetry]';

/** Minimal surface of the Sentry SDK we depend on. */
interface SentryLike {
  init(options: Record<string, unknown>): void;
  captureException(e: unknown, hint?: { extra?: Record<string, unknown> }): void;
  captureMessage(message: string): void;
  setUser(user: { id: string } | null): void;
  addBreadcrumb(breadcrumb: Record<string, unknown>): void;
}

let client: SentryLike | null = null;
let enabled = false;

function debug(...args: unknown[]): void {
  if (__DEV__) console.debug(DEBUG_TAG, ...args);
}

/**
 * Initialize Sentry. No-op (with a dev log) when no DSN is configured or the SDK isn't
 * installed. Idempotent — only the first successful init takes effect.
 */
export function init(dsn: string | undefined): void {
  if (enabled) return;
  if (!dsn) {
    debug('Sentry disabled (no EXPO_PUBLIC_SENTRY_DSN) — error reporting is no-op');
    return;
  }
  try {
    const Sentry = require('@sentry/react-native') as SentryLike;
    Sentry.init({
      dsn,
      // Keep noise low by default; tune sampling from the Sentry project once live.
      enableAutoSessionTracking: true,
      tracesSampleRate: 0.2,
    });
    client = Sentry;
    enabled = true;
    debug('Sentry initialized');
  } catch (e) {
    debug('Sentry init failed, staying no-op:', (e as Error)?.message ?? e);
  }
}

/** Report an exception, optionally with extra context (a flat key/value bag). */
export function captureException(e: unknown, ctx?: Record<string, unknown>): void {
  if (!enabled || !client) { debug('captureException (noop):', (e as Error)?.message ?? e, ctx ?? {}); return; }
  try {
    client.captureException(e, ctx ? { extra: ctx } : undefined);
  } catch (err) {
    debug('captureException failed:', (err as Error)?.message);
  }
}

export function captureMessage(m: string): void {
  if (!enabled || !client) { debug('captureMessage (noop):', m); return; }
  try { client.captureMessage(m); } catch (e) { debug('captureMessage failed:', (e as Error)?.message); }
}

/** Associate subsequent events with a user id, or pass null to clear (sign-out/reset). */
export function setUser(id: string | null): void {
  if (!enabled || !client) { debug('setUser (noop):', id); return; }
  try { client.setUser(id ? { id } : null); } catch (e) { debug('setUser failed:', (e as Error)?.message); }
}

/** Drop a breadcrumb onto the trail attached to the next captured error. */
export function addBreadcrumb(breadcrumb: { category?: string; message?: string; data?: Record<string, unknown> }): void {
  if (!enabled || !client) { debug('addBreadcrumb (noop):', breadcrumb); return; }
  try { client.addBreadcrumb(breadcrumb); } catch (e) { debug('addBreadcrumb failed:', (e as Error)?.message); }
}

/** Test/diagnostic helper: whether a live Sentry client is active. */
export function isEnabled(): boolean { return enabled; }
