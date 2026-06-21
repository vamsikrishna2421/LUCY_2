/**
 * Simple cookie-based admin gate (SERVER-ONLY).
 *
 * If DASHBOARD_PASSWORD is unset, the dashboard is open (dev). When set, a valid
 * session cookie is required; the cookie value is a salted hash of the password
 * so the plaintext is never stored client-side. This is intentionally minimal —
 * swap for NextAuth when multi-user is needed (docs/02_ARCHITECTURE.md §5).
 */

import "server-only";
import { createHash } from "crypto";

export const SESSION_COOKIE = "lucy_dash_session";

export function authEnabled(): boolean {
  return Boolean(process.env.DASHBOARD_PASSWORD);
}

/** Deterministic token derived from the configured password. */
export function expectedToken(): string {
  const secret = process.env.DASHBOARD_PASSWORD || "";
  return createHash("sha256").update(`lucy::${secret}`).digest("hex");
}

export function isValidToken(token: string | undefined): boolean {
  if (!authEnabled()) return true;
  return Boolean(token) && token === expectedToken();
}
