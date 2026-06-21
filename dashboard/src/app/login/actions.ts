"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, authEnabled, expectedToken } from "@/lib/auth";

/** Validate the submitted password and set the session cookie. */
export async function login(formData: FormData): Promise<void> {
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/") || "/";

  // No password configured → nothing to gate.
  if (!authEnabled()) redirect("/");

  if (password !== process.env.DASHBOARD_PASSWORD) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, expectedToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  redirect(next.startsWith("/") ? next : "/");
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
