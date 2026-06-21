import type { ReactNode } from "react";
import { signedPercent } from "@/lib/format";

interface MetricCardProps {
  label: string;
  value: string;
  /** Optional WoW/MoM delta as a fraction (0.08 = +8%). */
  delta?: number;
  /** If true, a negative delta is "good" (e.g. churn). */
  invertDelta?: boolean;
  hint?: string;
  icon?: ReactNode;
}

/** Single KPI tile — the styling language echoes the app's MetricStat. */
export function MetricCard({
  label,
  value,
  delta,
  invertDelta = false,
  hint,
  icon,
}: MetricCardProps) {
  const positive = delta === undefined ? null : invertDelta ? delta < 0 : delta > 0;
  const deltaColor =
    positive === null
      ? "text-text-muted"
      : positive
        ? "text-success"
        : "text-danger";

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-e1 transition-colors duration-base hover:border-accent-line">
      <div className="flex items-start justify-between">
        <span className="text-footnote font-medium uppercase tracking-wide text-text-muted">
          {label}
        </span>
        {icon ? <span className="text-accent">{icon}</span> : null}
      </div>
      <div className="mt-3 text-h1 font-bold text-text-primary">{value}</div>
      <div className="mt-1 flex items-center gap-2">
        {delta !== undefined ? (
          <span className={`text-footnote font-medium ${deltaColor}`}>
            {signedPercent(delta)}
          </span>
        ) : null}
        {hint ? <span className="text-footnote text-text-faint">{hint}</span> : null}
      </div>
    </div>
  );
}
