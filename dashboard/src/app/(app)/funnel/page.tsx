import { Topbar } from "@/components/Topbar";
import { ChartCard } from "@/components/ChartCard";
import { FunnelBar } from "@/components/charts/FunnelBar";
import { DataTable, type Column } from "@/components/DataTable";
import { getAnalyticsSummary } from "@/lib/posthog";
import { compactNumber, percent } from "@/lib/format";
import type { FunnelStep } from "@/lib/types";

export const dynamic = "force-dynamic";

interface FunnelRow extends FunnelStep {
  fromTop: number;
  fromPrev: number;
}

export default async function FunnelPage() {
  const analytics = await getAnalyticsSummary();
  const steps = analytics.funnel;
  const top = steps[0]?.users || 1;

  const rows: FunnelRow[] = steps.map((s, i) => ({
    ...s,
    fromTop: s.users / top,
    fromPrev: i === 0 ? 1 : s.users / (steps[i - 1].users || 1),
  }));

  const columns: Column<FunnelRow>[] = [
    { key: "label", header: "Step", render: (r) => (
      <span className="font-medium text-text-primary">{r.label}</span>
    ) },
    { key: "event", header: "Event", render: (r) => (
      <code className="text-footnote text-text-muted">{r.event}</code>
    ) },
    { key: "users", header: "Users", align: "right", render: (r) => compactNumber(r.users) },
    { key: "fromPrev", header: "Step conv.", align: "right", render: (r) => (
      <span className={r.fromPrev < 0.6 && r.fromPrev < 1 ? "text-warning" : ""}>
        {percent(r.fromPrev)}
      </span>
    ) },
    { key: "fromTop", header: "From top", align: "right", render: (r) => percent(r.fromTop) },
  ];

  const overall = steps.length
    ? steps[steps.length - 1].users / top
    : 0;

  return (
    <>
      <Topbar
        title="Activation Funnel"
        subtitle="app_open → onboarding → capture → recall → paywall → purchase"
        source={analytics.source}
      />
      <div className="flex-1 overflow-y-auto p-8">
        <ChartCard
          title="Activation funnel"
          subtitle={`Overall conversion ${percent(overall)} · last 30 days`}
          bodyHeight="h-80"
        >
          <FunnelBar data={steps} />
        </ChartCard>

        <div className="mt-6">
          <h3 className="mb-3 text-h3 font-semibold text-text-primary">
            Step breakdown
          </h3>
          <DataTable columns={columns} rows={rows} rowKey={(r) => r.event} />
        </div>
      </div>
    </>
  );
}
