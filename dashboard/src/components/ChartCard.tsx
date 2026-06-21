import type { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  /** Tailwind height for the chart body, e.g. "h-72". */
  bodyHeight?: string;
}

/** Framed container for a chart or visualization. */
export function ChartCard({
  title,
  subtitle,
  action,
  children,
  bodyHeight = "h-72",
}: ChartCardProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-e1">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-h3 font-semibold text-text-primary">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 text-footnote text-text-muted">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div className={bodyHeight}>{children}</div>
    </div>
  );
}
