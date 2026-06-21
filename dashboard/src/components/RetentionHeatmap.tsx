import type { RetentionCohort } from "@/lib/types";
import { compactNumber, percent } from "@/lib/format";

/** Map a 0..1 retention value to an amber cell background + readable text. */
function cell(value: number): { style: React.CSSProperties; text: string } {
  if (value <= 0) {
    return { style: { background: "#131108", color: "#5C4A38" }, text: "—" };
  }
  // Amber #FF8C42 at an opacity scaled by retention (floor so low values show).
  const alpha = 0.12 + Math.min(value, 1) * 0.78;
  const text = value >= 0.5 ? "#1A0E03" : "#F5EFE6";
  return {
    style: { background: `rgba(255,140,66,${alpha.toFixed(2)})`, color: text },
    text: percent(value, 0),
  };
}

const DAYS: Array<{ key: keyof Pick<RetentionCohort, "d1" | "d7" | "d30">; label: string }> = [
  { key: "d1", label: "D1" },
  { key: "d7", label: "D7" },
  { key: "d30", label: "D30" },
];

export function RetentionHeatmap({ data }: { data: RetentionCohort[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-e1">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border bg-surface-alt">
            <th className="px-4 py-3 text-left text-caption font-medium uppercase tracking-wide text-text-muted">
              Cohort
            </th>
            <th className="px-4 py-3 text-right text-caption font-medium uppercase tracking-wide text-text-muted">
              Users
            </th>
            {DAYS.map((d) => (
              <th
                key={d.key}
                className="px-4 py-3 text-center text-caption font-medium uppercase tracking-wide text-text-muted"
              >
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((cohort) => (
            <tr key={cohort.cohort} className="border-b border-divider last:border-0">
              <td className="px-4 py-3 text-callout font-medium text-text-primary">
                {cohort.cohort}
              </td>
              <td className="px-4 py-3 text-right text-callout text-text-secondary">
                {compactNumber(cohort.size)}
              </td>
              {DAYS.map((d) => {
                const c = cell(cohort[d.key]);
                return (
                  <td key={d.key} className="px-1.5 py-1.5 text-center">
                    <div
                      className="rounded-md py-2 text-footnote font-semibold"
                      style={c.style}
                    >
                      {c.text}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
