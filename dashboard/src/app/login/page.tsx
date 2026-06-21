import { login } from "./actions";
import { authEnabled } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Sign in · LUCY Dashboard" };

// Auth state depends on runtime env (DASHBOARD_PASSWORD) and cookies, so this
// page must be evaluated per-request, never statically prerendered at build time.
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  // If auth is disabled, there's nothing to log into.
  if (!authEnabled()) redirect("/");

  const { error, next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-e3">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-h3 font-bold text-text-on-accent shadow-glow">
            L
          </div>
          <div className="leading-tight">
            <div className="text-h3 font-semibold text-text-primary">LUCY Growth</div>
            <div className="text-caption uppercase tracking-wider text-text-muted">
              Admin access
            </div>
          </div>
        </div>

        <form action={login} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next ?? "/"} />
          <label className="flex flex-col gap-1.5">
            <span className="text-footnote text-text-secondary">Password</span>
            <input
              type="password"
              name="password"
              autoFocus
              required
              className="rounded-md border border-border bg-bg px-3 py-2.5 text-body text-text-primary outline-none transition-colors duration-fast focus:border-accent"
              placeholder="••••••••"
            />
          </label>

          {error ? (
            <p className="text-footnote text-danger">Incorrect password. Try again.</p>
          ) : null}

          <button
            type="submit"
            className="mt-1 rounded-md bg-accent px-4 py-2.5 text-body font-medium text-text-on-accent transition-colors duration-fast hover:bg-accent-glow"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
