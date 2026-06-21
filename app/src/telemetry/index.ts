/**
 * Telemetry facade — the ONLY module the rest of the app imports for monitoring.
 *
 * It routes a single typed API to two backends:
 *   - PostHog  → product analytics (track/screen/identify/flags)   [./posthog]
 *   - Sentry   → crash & error reporting (captureError)            [./sentry]
 *
 * Design rules honored here:
 *   - Typed events only: `track` is constrained by the taxonomy in ./events.
 *   - Safe before init: every function may be called before `initTelemetry()`. Calls made
 *     beforehand are buffered (analytics) or no-op (the SDK wrappers already no-op), so
 *     screens/services never have to know whether telemetry is "ready".
 *   - Zero-config: with no env keys the entire stack is a no-op with dev console logging.
 */

import * as posthog from './posthog';
import * as sentry from './sentry';
import type { EventProps, TrackEvent, TrackFn } from './events';

export type { TrackEvent, TrackFn, EventProps } from './events';

let initialized = false;

/** Buffered analytics calls made before initTelemetry() resolves. Flushed on init, FIFO. */
type Queued =
  | { kind: 'track'; event: TrackEvent; props?: Record<string, unknown> }
  | { kind: 'screen'; name: string; props?: Record<string, unknown> }
  | { kind: 'identify'; id: string; traits?: Record<string, unknown> };
const queue: Queued[] = [];
const MAX_QUEUE = 100; // guard against unbounded growth if init never runs

function enqueue(item: Queued): void {
  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push(item);
}

/**
 * Initialize PostHog + Sentry from EXPO_PUBLIC_* env. Call once, early (App.tsx on mount).
 * Reads keys lazily here so the SDK wrappers stay env-agnostic and unit-testable. After the
 * backends are up, any calls buffered before init are replayed in order.
 */
export function initTelemetry(): void {
  if (initialized) return;
  initialized = true;

  posthog.init(process.env.EXPO_PUBLIC_POSTHOG_KEY, process.env.EXPO_PUBLIC_POSTHOG_HOST);
  sentry.init(process.env.EXPO_PUBLIC_SENTRY_DSN);

  // Replay anything captured before init.
  for (const item of queue.splice(0)) {
    if (item.kind === 'track') posthog.capture(item.event, item.props);
    else if (item.kind === 'screen') posthog.screen(item.name, item.props);
    else posthog.identify(item.id, item.traits);
  }
}

/**
 * Record a product-analytics event. Strongly typed against the taxonomy in ./events —
 * the event name and its props are checked at compile time. Buffered if called before init.
 */
export const track: TrackFn = ((
  event: TrackEvent,
  props?: Record<string, unknown>,
): void => {
  if (!initialized) { enqueue({ kind: 'track', event, props }); return; }
  posthog.capture(event, props);
}) as TrackFn;

/** Record a screen view (PostHog `screen`). Prefer the useScreenTracking hook for navigation. */
export function screen(name: string, props?: Record<string, unknown>): void {
  if (!initialized) { enqueue({ kind: 'screen', name, props }); return; }
  posthog.screen(name, props);
}

/**
 * Associate analytics + errors with a stable, anonymous user id (e.g. a per-install UUID —
 * never PII). Routes to PostHog.identify and Sentry.setUser. Buffered if called before init.
 */
export function identify(id: string, traits?: Record<string, unknown>): void {
  sentry.setUser(id);
  if (!initialized) { enqueue({ kind: 'identify', id, traits }); return; }
  posthog.identify(id, traits);
}

/**
 * Update properties on the current user without changing identity (e.g. { isPro: true }).
 * Implemented as a PostHog identify with no id change is not possible here, so we attach
 * traits via a `$set` capture, the documented PostHog pattern for person properties.
 */
export function setUserProps(props: Record<string, unknown>): void {
  if (!initialized) { enqueue({ kind: 'track', event: 'app_open' as TrackEvent, props: { $set: props } }); return; }
  posthog.capture('$set', { $set: props });
}

/** Forward a caught error to Sentry (and leave a breadcrumb). Safe before init (no-op). */
export function captureError(e: unknown, ctx?: Record<string, unknown>): void {
  sentry.addBreadcrumb({ category: 'app', message: 'captureError', data: ctx });
  sentry.captureException(e, ctx);
}

/** Read a PostHog boolean feature flag with a safe default. Always returns synchronously. */
export function flag(key: string, fallback = false): boolean {
  return posthog.isFeatureEnabled(key, fallback);
}

/** Re-fetch remote feature flags (e.g. after identify, or on app foreground). */
export async function reloadFlags(): Promise<void> {
  await posthog.reloadFlags();
}

/** Flush buffered analytics to the network (e.g. before backgrounding). */
export async function flush(): Promise<void> {
  await posthog.flush();
}

/** Clear the current user identity and reset analytics (sign-out). */
export function reset(): void {
  posthog.reset();
  sentry.setUser(null);
}
