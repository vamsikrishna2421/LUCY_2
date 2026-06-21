"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Overview", icon: "◉" },
  { href: "/funnel", label: "Activation Funnel", icon: "⫶" },
  { href: "/retention", label: "Retention", icon: "▦" },
  { href: "/features", label: "Features", icon: "✦" },
  { href: "/revenue", label: "Revenue", icon: "$" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 flex-shrink-0 flex-col border-r border-border bg-sheet">
      <div className="flex items-center gap-2.5 px-5 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-h3 font-bold text-text-on-accent shadow-glow">
          L
        </div>
        <div className="leading-tight">
          <div className="text-body font-semibold text-text-primary">LUCY</div>
          <div className="text-caption uppercase tracking-wider text-text-muted">
            Growth
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-callout transition-colors duration-fast ${
                active
                  ? "bg-accent-soft text-accent-glow"
                  : "text-text-secondary hover:bg-surface-alt hover:text-text-primary"
              }`}
            >
              <span
                className={`w-4 text-center ${active ? "text-accent" : "text-text-muted"}`}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 text-caption text-text-faint">
        LUCY 2.0 · Admin
      </div>
    </aside>
  );
}
