/**
 * Realistic mock datasets so `npm run dev` shows a fully populated, good-looking
 * dashboard with ZERO credentials. Numbers tell a coherent early-growth story for
 * LUCY 2.0: ~5.4k MAU, healthy trial funnel, plan mix skewed to annual.
 *
 * Pricing anchors (docs/01_PRODUCT_DIRECTION.md §4):
 *   monthly $9.99 · annual $79.99 ($6.67/mo) · lifetime $199 one-time.
 */

import type { AnalyticsSummary, RevenueSummary } from "./types";

const now = () => new Date().toISOString();

export function mockRevenue(): RevenueSummary {
  const plans = [
    {
      plan: "monthly" as const,
      label: "Pro Monthly",
      subscribers: 612,
      mrr: 612 * 9.99,
      revenue30d: 612 * 9.99,
    },
    {
      plan: "annual" as const,
      label: "Pro Annual",
      subscribers: 884,
      // Annual normalized to monthly: $79.99 / 12.
      mrr: 884 * (79.99 / 12),
      // ~7% of the annual base renewed/booked this month.
      revenue30d: Math.round(884 * 0.07) * 79.99,
    },
    {
      plan: "lifetime" as const,
      label: "Lifetime",
      subscribers: 143,
      // Lifetime amortized over 24 months for an MRR-equivalent view.
      mrr: 143 * (199 / 24),
      // 9 new lifetime buyers in the last 30 days.
      revenue30d: 9 * 199,
    },
  ];

  const mrr = Math.round(plans.reduce((sum, p) => sum + p.mrr, 0));

  // 12 months of MRR trending up with mild noise.
  const mrrSeries = [
    { month: "Jul", mrr: 3120 },
    { month: "Aug", mrr: 3680 },
    { month: "Sep", mrr: 4290 },
    { month: "Oct", mrr: 5010 },
    { month: "Nov", mrr: 5640 },
    { month: "Dec", mrr: 6480 },
    { month: "Jan", mrr: 7220 },
    { month: "Feb", mrr: 8050 },
    { month: "Mar", mrr: 8770 },
    { month: "Apr", mrr: 9540 },
    { month: "May", mrr: 10310 },
    { month: "Jun", mrr },
  ];

  const activeSubscriptions = plans
    .filter((p) => p.plan !== "lifetime")
    .reduce((s, p) => s + p.subscribers, 0);

  return {
    source: "mock",
    generatedAt: now(),
    mrr,
    mrrChangePct: 0.081,
    activeSubscriptions,
    trialsActive: 327,
    trialConversionPct: 0.412,
    churnPct: 0.038,
    // ARPU across paying base (incl. amortized lifetime), monthly.
    arpu: Math.round((mrr / (activeSubscriptions + 143)) * 100) / 100,
    // LTV ≈ ARPU / churn (simple geometric estimate).
    ltv: Math.round((mrr / (activeSubscriptions + 143) / 0.038) * 100) / 100,
    mrrSeries,
    plans,
  };
}

export function mockAnalytics(): AnalyticsSummary {
  // Activation funnel — event names mirror the telemetry taxonomy
  // (docs/02_ARCHITECTURE.md §4: app/src/telemetry/events.ts).
  const funnel = [
    { event: "app_open", label: "App Open", users: 4820 },
    { event: "onboarding_completed", label: "Onboarding Done", users: 3910 },
    { event: "capture_saved", label: "First Capture", users: 3140 },
    { event: "recall_answered", label: "First Recall", users: 2280 },
    { event: "paywall_viewed", label: "Paywall Viewed", users: 1490 },
    { event: "purchase_completed", label: "Purchased", users: 614 },
  ];

  const retention = [
    { cohort: "May 12", size: 410, d1: 0.52, d7: 0.34, d30: 0.21 },
    { cohort: "May 19", size: 462, d1: 0.55, d7: 0.36, d30: 0.23 },
    { cohort: "May 26", size: 521, d1: 0.57, d7: 0.38, d30: 0.24 },
    { cohort: "Jun 02", size: 548, d1: 0.59, d7: 0.41, d30: 0.26 },
    { cohort: "Jun 09", size: 603, d1: 0.61, d7: 0.43, d30: 0.0 },
    { cohort: "Jun 16", size: 657, d1: 0.63, d7: 0.0, d30: 0.0 },
  ];

  const features = [
    { event: "capture_saved", label: "Capture Saved", count: 48210, trend: 0.14 },
    { event: "recall_answered", label: "Recall Answered", count: 31980, trend: 0.09 },
    { event: "voice_capture_started", label: "Voice Capture", count: 22140, trend: 0.22 },
    { event: "photo_capture_saved", label: "Photo Capture", count: 14860, trend: 0.18 },
    { event: "autopilot_triggered", label: "Autopilot Run", count: 9720, trend: 0.31 },
    { event: "reminder_scheduled", label: "Reminder Set", count: 8430, trend: 0.05 },
    { event: "brain_searched", label: "Brain Search", count: 7610, trend: 0.11 },
    { event: "wrapped_shared", label: "Wrapped Shared", count: 3120, trend: 0.47 },
    { event: "paywall_viewed", label: "Paywall Viewed", count: 2980, trend: -0.04 },
    { event: "health_logged", label: "Health Logged", count: 2410, trend: 0.16 },
  ];

  return {
    source: "mock",
    generatedAt: now(),
    active: { dau: 1840, wau: 4120, mau: 5410, stickiness: 1840 / 5410 },
    activation: { activationPct: 0.486 },
    funnel,
    retention,
    features,
  };
}
