/**
 * Shared metric types for the LUCY 2.0 dashboard.
 * Both real (RevenueCat/PostHog) and mock sources return these shapes so pages
 * are source-agnostic.
 */

export type DataSource = "live" | "mock";

export interface SourceMeta {
  /** Where the numbers came from — drives the "MOCK" badge in the UI. */
  source: DataSource;
  /** ISO timestamp the data was assembled. */
  generatedAt: string;
}

// ── Revenue (RevenueCat) ──────────────────────────────────────────────────
export type PlanId = "monthly" | "annual" | "lifetime";

export interface PlanBreakdown {
  plan: PlanId;
  label: string;
  subscribers: number;
  /** Normalized monthly recurring revenue contribution (USD). */
  mrr: number;
  /** Gross revenue booked in the trailing 30 days (USD). */
  revenue30d: number;
}

export interface MrrPoint {
  /** Month label, e.g. "Jan". */
  month: string;
  mrr: number;
}

export interface RevenueSummary extends SourceMeta {
  mrr: number;
  mrrChangePct: number;
  activeSubscriptions: number;
  trialsActive: number;
  trialConversionPct: number;
  churnPct: number;
  arpu: number;
  ltv: number;
  mrrSeries: MrrPoint[];
  plans: PlanBreakdown[];
}

// ── Product analytics (PostHog) ───────────────────────────────────────────
export interface ActivePeriods {
  dau: number;
  wau: number;
  mau: number;
  /** DAU/MAU stickiness, 0..1. */
  stickiness: number;
}

export interface ActivationSummary {
  /** % of new users who completed first capture + first recall in session 1. */
  activationPct: number;
}

export interface FunnelStep {
  event: string;
  label: string;
  users: number;
}

export interface RetentionCohort {
  /** Cohort label, e.g. "Jun 02". */
  cohort: string;
  size: number;
  /** Retention fractions 0..1 keyed by day offset. */
  d1: number;
  d7: number;
  d30: number;
}

export interface FeatureEvent {
  event: string;
  label: string;
  count: number;
  /** WoW trend as a fraction, e.g. 0.12 = +12%. */
  trend: number;
}

export interface AnalyticsSummary extends SourceMeta {
  active: ActivePeriods;
  activation: ActivationSummary;
  funnel: FunnelStep[];
  retention: RetentionCohort[];
  features: FeatureEvent[];
}
