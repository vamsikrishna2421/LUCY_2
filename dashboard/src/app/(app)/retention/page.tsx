import { Topbar } from "@/components/Topbar";
import { MetricCard } from "@/components/MetricCard";
import { RetentionHeatmap } from "@/components/RetentionHeatmap";
import { getAnalyticsSummary } from "@/lib/posthog";
import { percent } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Average a retention day across cohorts that have matured enough to report it. */
function avg(values: number[]): number {
  const valid = values.filter((v) => v > 0);
  if (valid.length === 0) return 0;
  return valid.reduce((s, v) => s + v, 0) / valid.length;
}

export default async function RetentionPage() {
  const analytics = await getAnalyticsSummary();
  const cohorts = analytics.retention;

  const d1 = avg(cohorts.map((c) => c.d1));
  const d7 = avg(cohorts.map((c) => c.d7));
  const d30 = avg(cohorts.map((c) => c.d30));

  return (
    <>
      <Topbar
        title="Retention"
        subtitle="Weekly new-user cohorts · D1 / D7 / D30"
        source={analytics.source}
      />
      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard label="Avg D1 retention" value={percent(d1)} hint="across cohorts" />
          <MetricCard label="Avg D7 retention" value={percent(d7)} hint="across cohorts" />
          <MetricCard label="Avg D30 retention" value={percent(d30)} hint="across cohorts" />
        </div>

        <div className="mt-6">
          <h3 className="mb-3 text-h3 font-semibold text-text-primary">
            Cohort retention
          </h3>
          <RetentionHeatmap data={cohorts} />
          <p className="mt-3 text-footnote text-text-faint">
            Cells show the share of each cohort active on day N. Blank cells are
            cohorts too recent to have reached that day.
          </p>
        </div>
      </div>
    </>
  );
}
