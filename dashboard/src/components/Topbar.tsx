import { Badge } from "./Badge";
import type { DataSource } from "@/lib/types";

interface TopbarProps {
  title: string;
  subtitle?: string;
  /** Drives the live/mock indicator. */
  source?: DataSource;
}

export function Topbar({ title, subtitle, source }: TopbarProps) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-bg/80 px-8 py-5 backdrop-blur">
      <div>
        <h1 className="text-h2 font-semibold text-text-primary">{title}</h1>
        {subtitle ? (
          <p className="mt-0.5 text-footnote text-text-muted">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        {source ? (
          <Badge tone={source === "live" ? "success" : "accent"}>
            {source === "live" ? "Live data" : "Mock data"}
          </Badge>
        ) : null}
      </div>
    </header>
  );
}
