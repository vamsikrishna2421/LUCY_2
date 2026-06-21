import { Topbar } from "@/components/Topbar";
import { DataTable, type Column } from "@/components/DataTable";
import { TrendPill } from "@/components/charts/TrendPill";
import { getAnalyticsSummary } from "@/lib/posthog";
import { compactNumber } from "@/lib/format";
import type { FeatureEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FeaturesPage() {
  const analytics = await getAnalyticsSummary();
  const features = [...analytics.features].sort((a, b) => b.count - a.count);
  const max = features[0]?.count || 1;

  const columns: Column<FeatureEvent>[] = [
    {
      key: "label",
      header: "Feature",
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-medium text-text-primary">{r.label}</span>
          <code className="text-caption text-text-muted">{r.event}</code>
        </div>
      ),
    },
    {
      key: "count",
      header: "Events (30d)",
      align: "right",
      render: (r) => (
        <span className="tabular-nums text-text-secondary">
          {compactNumber(r.count)}
        </span>
      ),
    },
    {
      key: "share",
      header: "Share",
      className: "w-48",
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-surface-alt">
            <div
              className="h-full rounded-pill bg-accent"
              style={{ width: `${Math.max((r.count / max) * 100, 2)}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      key: "trend",
      header: "WoW",
      align: "right",
      render: (r) => <TrendPill value={r.trend} />,
    },
  ];

  return (
    <>
      <Topbar
        title="Features"
        subtitle="Top tracked events from the telemetry taxonomy"
        source={analytics.source}
      />
      <div className="flex-1 overflow-y-auto p-8">
        <DataTable columns={columns} rows={features} rowKey={(r) => r.event} />
        <p className="mt-3 text-footnote text-text-faint">
          Counts are total event volume over the last 30 days. WoW is the
          week-over-week change in volume.
        </p>
      </div>
    </>
  );
}
