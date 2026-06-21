import { Sidebar } from "@/components/Sidebar";
import { authEnabled } from "@/lib/auth";
import { logout } from "../login/actions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="relative flex min-w-0 flex-1 flex-col">
        {authEnabled() ? (
          <form action={logout} className="absolute right-8 top-[1.6rem] z-10">
            <button
              type="submit"
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-footnote text-text-secondary transition-colors duration-fast hover:border-accent-line hover:text-text-primary"
            >
              Sign out
            </button>
          </form>
        ) : null}
        {children}
      </div>
    </div>
  );
}
