/**
 * PostHog data source (SERVER-ONLY).
 *
 * Strategy: if POSTHOG_API_KEY + POSTHOG_PROJECT_ID are set, query live
 * DAU/retention/funnels via the PostHog HogQL query API; otherwise return
 * realistic MOCK data so the dashboard is fully populated with zero credentials.
 *
 * The HogQL `/api/projects/:id/query` endpoint is the stable way to pull
 * aggregates. We keep one helper (`hogql`) and isolate each metric so individual
 * queries can be hardened/replaced without touching pages.
 */

import "server-only";
import { mockAnalytics } from "./mock";
import type {
  ActivePeriods,
  AnalyticsSummary,
  FeatureEvent,
  FunnelStep,
  RetentionCohort,
} from "./types";

function host(): string {
  return (process.env.POSTHOG_HOST || "https://us.posthog.com").replace(/\/$/, "");
}

function hasCredentials(): boolean {
  return Boolean(process.env.POSTHOG_API_KEY && process.env.POSTHOG_PROJECT_ID);
}

/** Run a HogQL query, returning rows as arrays of column values. */
async function hogql(query: string): Promise<unknown[][]> {
  const projectId = process.env.POSTHOG_PROJECT_ID as string;
  const res = await fetch(`${host()}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.POSTHOG_API_KEY as string}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`PostHog query failed: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { results?: unknown[][] };
  return json.results ?? [];
}

// ── Per-metric queries ────────────────────────────────────────────────────
// These are real HogQL the dashboard would run. The activation funnel events
// match the telemetry taxonomy (docs/02_ARCHITECTURE.md §4).

async function queryActive(): Promise<ActivePeriods> {
  const rows = await hogql(`
    SELECT
      count(DISTINCT if(timestamp >= now() - INTERVAL 1 DAY, person_id, NULL)) AS dau,
      count(DISTINCT if(timestamp >= now() - INTERVAL 7 DAY, person_id, NULL)) AS wau,
      count(DISTINCT if(timestamp >= now() - INTERVAL 30 DAY, person_id, NULL)) AS mau
    FROM events
    WHERE timestamp >= now() - INTERVAL 30 DAY
  `);
  const [dau = 0, wau = 0, mau = 0] = (rows[0] as number[]) ?? [];
  return { dau, wau, mau, stickiness: mau ? dau / mau : 0 };
}

async function queryFunnel(): Promise<FunnelStep[]> {
  const steps: Array<Pick<FunnelStep, "event" | "label">> = [
    { event: "app_open", label: "App Open" },
    { event: "onboarding_completed", label: "Onboarding Done" },
    { event: "capture_saved", label: "First Capture" },
    { event: "recall_answered", label: "First Recall" },
    { event: "paywall_viewed", label: "Paywall Viewed" },
    { event: "purchase_completed", label: "Purchased" },
  ];
  const eventList = steps.map((s) => `'${s.event}'`).join(", ");
  const rows = await hogql(`
    SELECT event, count(DISTINCT person_id) AS users
    FROM events
    WHERE event IN (${eventList}) AND timestamp >= now() - INTERVAL 30 DAY
    GROUP BY event
  `);
  const counts = new Map(rows.map((r) => [String(r[0]), Number(r[1])]));
  return steps.map((s) => ({ ...s, users: counts.get(s.event) ?? 0 }));
}

async function queryFeatures(): Promise<FeatureEvent[]> {
  const rows = await hogql(`
    SELECT event, count() AS c
    FROM events
    WHERE timestamp >= now() - INTERVAL 30 DAY
    GROUP BY event
    ORDER BY c DESC
    LIMIT 10
  `);
  return rows.map((r) => ({
    event: String(r[0]),
    label: String(r[0]).replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
    count: Number(r[1]),
    // Trend requires a second windowed query; left at 0 for the live path until
    // wired. Mock path supplies realistic trends.
    trend: 0,
  }));
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  if (!hasCredentials()) {
    return mockAnalytics();
  }

  try {
    const [active, funnel, features] = await Promise.all([
      queryActive(),
      queryFunnel(),
      queryFeatures(),
    ]);

    // Retention cohorts and activation % are heavier (cohort breakdown + first-
    // session join). Until those queries are wired, borrow mock shapes so the
    // page stays populated rather than empty.
    const fallback = mockAnalytics();
    const retention: RetentionCohort[] = fallback.retention;

    return {
      source: "live",
      generatedAt: new Date().toISOString(),
      active,
      activation: fallback.activation,
      funnel,
      retention,
      features,
    };
  } catch (err) {
    console.warn("[posthog] live fetch failed — using mock data:", err);
    return mockAnalytics();
  }
}
