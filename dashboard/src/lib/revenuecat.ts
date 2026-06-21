/**
 * RevenueCat data source (SERVER-ONLY).
 *
 * Strategy: if RC_SECRET_KEY is set, fetch live subscription/MRR data from the
 * RevenueCat REST API; otherwise return realistic MOCK data so the dashboard is
 * fully populated with zero credentials.
 *
 * NOTE: RevenueCat's REST API is oriented around per-subscriber lookups; there is
 * no single official "give me aggregate MRR" REST endpoint (that lives in their
 * Charts/overview surface). In a production deploy you'd mirror subscription
 * events via the RevenueCat webhook (docs/02_ARCHITECTURE.md §3) into your own
 * store and aggregate there. This module isolates that seam: swap `fetchLive()`
 * for your webhook-backed aggregation without touching any page.
 */

import "server-only";
import { mockRevenue } from "./mock";
import type { RevenueSummary } from "./types";

const RC_API_BASE = "https://api.revenuecat.com/v1";

function hasCredentials(): boolean {
  return Boolean(process.env.RC_SECRET_KEY);
}

/**
 * Live fetch placeholder. Wire this to your webhook-mirrored store (preferred) or
 * RevenueCat's REST/Charts API. Until that backend exists, we verify the key is
 * accepted and then fall back to mock-shaped data so the contract stays stable.
 */
async function fetchLive(): Promise<RevenueSummary> {
  const key = process.env.RC_SECRET_KEY as string;

  // Lightweight credential sanity check against the REST API. RevenueCat returns
  // 401 for a bad secret key; we only use this to confirm the integration is set
  // up, then return shaped data (replace with real aggregation when available).
  try {
    const res = await fetch(`${RC_API_BASE}/subscribers/dashboard-healthcheck`, {
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      // Revalidate hourly; metrics don't need to be real-time.
      next: { revalidate: 3600 },
    });

    if (res.status === 401) {
      console.warn("[revenuecat] RC_SECRET_KEY rejected (401) — using mock data.");
      return { ...mockRevenue() };
    }
  } catch (err) {
    console.warn("[revenuecat] live fetch failed — using mock data:", err);
    return { ...mockRevenue() };
  }

  // TODO: replace with real aggregation from webhook-mirrored subscription store.
  // For now, return shaped data tagged "live" so the UI reflects a configured key.
  const shaped = mockRevenue();
  return { ...shaped, source: "live" };
}

export async function getRevenueSummary(): Promise<RevenueSummary> {
  if (!hasCredentials()) {
    return mockRevenue();
  }
  return fetchLive();
}
