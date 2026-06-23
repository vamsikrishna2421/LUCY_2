import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge middleware auth gate. Runs before every dashboard route.
 *
 * - If DASHBOARD_PASSWORD is unset → allow everything (dev mode).
 * - Otherwise require a valid session cookie; redirect to /login if missing.
 *
 * The cookie token is a SHA-256 of `lucy::<password>` (see lib/auth.ts). We
 * recompute it here with Web Crypto so the check stays on the Edge runtime.
 */

const SESSION_COOKIE = "lucy_dash_session";

async function expectedToken(secret: string): Promise<string> {
  const data = new TextEncoder().encode(`lucy::${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;

  // Dev mode: no password configured → open.
  if (!password) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // Always allow the login page and its POST action through.
  if (pathname === "/login") return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const valid = token && token === (await expectedToken(password));

  if (!valid) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Gate the dashboard UI, but NOT /api/* — the API routes are called by the mobile app with a
  // Supabase JWT (Bearer) and do their own auth; the cookie gate must not redirect them to /login.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
