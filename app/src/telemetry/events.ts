/**
 * THE event taxonomy for LUCY 2.0 — the single source of truth for product analytics.
 *
 * Every analytics event in the app must be declared here. No ad-hoc event strings:
 * `track()` (see ./index) only accepts the names below, and the compiler enforces the
 * props shape per event. Adding analytics = adding a row to `EventProps`, nothing else.
 *
 * Conventions:
 *  - Event names are snake_case, past-tense or noun_verb (e.g. `capture_saved`, `paywall_viewed`).
 *  - Prop values stay primitive (string | number | boolean) so PostHog can index them and the
 *    metrics dashboard can group by them. No nested objects, no PII (no raw capture text, etc).
 *  - Enumerated props use string-literal unions so dashboards see a stable, finite set of values.
 */

/** How a capture entered the app. Mirrors the three capture surfaces (see processing/extract). */
export type CaptureSource = 'text' | 'voice' | 'photo';

/** Privacy classification applied to a captured item (mirrors config defaultsXPrivacy). */
export type PrivacyLevel = 'private' | 'normal' | 'public';

/** Proactive autopilot families (trip, move/lease, money goals, commitments, Dr. Lucy). */
export type AutopilotKind =
  | 'trip'
  | 'move'
  | 'money'
  | 'commitment'
  | 'dr_lucy'
  | 'other';

/** Subscription plans offered through RevenueCat. Keep in sync with billing offerings. */
export type PlanId = 'monthly' | 'annual' | 'lifetime';

/**
 * Map of event name → its required props object.
 * An event with no props maps to `Record<string, never>` (i.e. `{}` — call `track(name)`).
 */
export interface EventProps {
  // ── Lifecycle ──────────────────────────────────────────────────────────────
  app_open: Record<string, never>;
  app_foreground: Record<string, never>;
  screen_view: { name: string };

  // ── Onboarding / activation funnel ───────────────────────────────────────────
  onboarding_started: Record<string, never>;
  onboarding_completed: Record<string, never>;

  // ── Core loop: capture → organize → recall ───────────────────────────────────
  capture_started: { source: CaptureSource };
  capture_saved: { source: CaptureSource; privacyLevel: PrivacyLevel };
  extraction_completed: { source?: CaptureSource; itemCount?: number };
  recall_query: Record<string, never>;
  recall_answered: { hadResults?: boolean };

  // ── Proactive autopilots & scheduling ────────────────────────────────────────
  autopilot_offered: { kind: AutopilotKind };
  autopilot_accepted: { kind: AutopilotKind };
  reminder_created: Record<string, never>;
  schedule_suggested: Record<string, never>;

  // ── Monetization funnel ──────────────────────────────────────────────────────
  paywall_viewed: { source: string };
  paywall_plan_selected: { planId: PlanId };
  purchase_started: { planId?: PlanId };
  purchase_completed: { planId: PlanId; price?: number };
  purchase_restored: Record<string, never>;
  purchase_failed: { reason: string };

  // ── Settings, gating & errors ────────────────────────────────────────────────
  settings_changed: { key: string };
  feature_gated: { feature: string };
  error_shown: { context: string };

  // ── Growth ───────────────────────────────────────────────────────────────────
  share_wrapped: Record<string, never>;
}

/** Union of every valid event name. */
export type TrackEvent = keyof EventProps;

/**
 * Typed `track` signature — re-used by the facade and any wrapper.
 *
 * Events whose props type is empty (`Record<string, never>`) make `props` optional;
 * events with required props make it mandatory. This is what lets callers write
 * `track('app_open')` but forces `track('capture_saved', { source, privacyLevel })`.
 */
export type TrackFn = <E extends TrackEvent>(
  event: E,
  ...args: HasRequiredProps<EventProps[E]> extends true
    ? [props: EventProps[E]]
    : [props?: EventProps[E]]
) => void;

/**
 * True when `T` has at least one required property. We can't use `keyof T extends never`
 * because `Record<string, never>` has `keyof = string`; instead we ask whether the empty
 * object is assignable to `T` — if it is, there are no required props, so `props` is optional.
 */
type HasRequiredProps<T> = Record<string, never> extends T ? false : true;
