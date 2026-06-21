import { signedPercent } from "@/lib/format";

/** Compact up/down trend indicator for table cells. */
export function TrendPill({ value }: { value: number }) {
  const positive = value >= 0;
  const color = positive ? "text-success" : "text-danger";
  const arrow = positive ? "▲" : "▼";
  return (
    <span className={`inline-flex items-center gap-1 text-footnote font-medium ${color}`}>
      <span className="text-[9px]">{arrow}</span>
      {signedPercent(Math.abs(value))}
    </span>
  );
}
