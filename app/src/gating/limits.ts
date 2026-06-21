/**
 * LUCY 2.0 — Feature gating limits (SOURCE OF TRUTH for free vs. pro).
 *
 * Every gate decision (`useEntitlement().can()` / `.limit()` / `<Gate>`) reads from here. There are no
 * ad-hoc limit numbers scattered across screens — change a number here and the whole app follows.
 *
 * The model (see docs/01_PRODUCT_DIRECTION.md §4): Free is a genuinely useful on-device tier with daily
 * capture/autopilot caps; Pro (`pro` entitlement) unlocks unlimited usage, cloud models, and the advanced
 * domains. Booleans = capability flags; numbers = quotas (`UNLIMITED` for "no cap").
 */

/** Sentinel for "no cap". Compare with `=== UNLIMITED` or via the helpers below. */
export const UNLIMITED = Infinity;

/**
 * The premium capabilities a `<Gate>` / `can()` can guard. String union (not a numeric enum) so it
 * serializes cleanly into telemetry events and reads well at call sites: `can('cloudModels')`.
 */
export type Feature =
  | 'unlimitedCaptures' // remove the daily capture cap
  | 'multipleAutopilots' // run more than one autopilot at once
  | 'cloudModels' // premium cloud models (Claude / GPT) vs. on-device only
  | 'lanCompanion' // desktop/LAN companion pairing
  | 'meetingMode' // live meeting capture + summary
  | 'advancedHealth' // Dr. Lucy advanced health insights
  | 'advancedMoney' // advanced money goals + analysis
  | 'priorityProcessing'; // priority extraction queue

/** Numeric quotas keyed by name (the `key` argument to `limit()` / `remaining()`). */
export interface QuotaLimits {
  /** Captures allowed per calendar day. */
  capturesPerDay: number;
  /** Autopilots that may be active simultaneously. */
  activeAutopilots: number;
}

/** Boolean capability flags keyed by {@link Feature}. */
export type FeatureFlags = Record<Feature, boolean>;

/** The full limit set for a tier: quotas + capability flags. */
export interface TierLimits extends QuotaLimits, FeatureFlags {}

/** Any quota key — used to type `limit()` / `remaining()` arguments. */
export type LimitKey = keyof QuotaLimits;

// ── Free tier ────────────────────────────────────────────────────────────────
// A real, usable on-device tier. Caps are generous enough to demo value, tight enough to convert.
export const FREE_LIMITS: TierLimits = {
  // quotas
  capturesPerDay: 15,
  activeAutopilots: 1,
  // capabilities
  unlimitedCaptures: false,
  multipleAutopilots: false,
  cloudModels: false,
  lanCompanion: false,
  meetingMode: false,
  advancedHealth: false,
  advancedMoney: false,
  priorityProcessing: false,
};

// ── Pro tier ─────────────────────────────────────────────────────────────────
// Everything unlimited / unlocked.
export const PRO_LIMITS: TierLimits = {
  // quotas
  capturesPerDay: UNLIMITED,
  activeAutopilots: UNLIMITED,
  // capabilities
  unlimitedCaptures: true,
  multipleAutopilots: true,
  cloudModels: true,
  lanCompanion: true,
  meetingMode: true,
  advancedHealth: true,
  advancedMoney: true,
  priorityProcessing: true,
};

/** Resolve the limit set for a given pro state. */
export function limitsForPro(isPro: boolean): TierLimits {
  return isPro ? PRO_LIMITS : FREE_LIMITS;
}

/** Human-readable copy for each feature — reused by `<Gate>` lock overlays and the paywall. */
export const FEATURE_LABELS: Record<Feature, string> = {
  unlimitedCaptures: 'Unlimited captures',
  multipleAutopilots: 'All autopilots',
  cloudModels: 'Premium cloud models',
  lanCompanion: 'LAN companion',
  meetingMode: 'Meeting mode',
  advancedHealth: 'Advanced Health',
  advancedMoney: 'Advanced Money',
  priorityProcessing: 'Priority processing',
};

/** True when a quota value means "no cap". */
export function isUnlimited(value: number): boolean {
  return !Number.isFinite(value);
}

/**
 * Remaining allowance for a quota given how many are already used. `UNLIMITED` quotas always return
 * {@link UNLIMITED}; otherwise the floor is 0 (never negative).
 */
export function remainingForLimit(limit: number, usedCount: number): number {
  if (isUnlimited(limit)) return UNLIMITED;
  return Math.max(0, limit - usedCount);
}
