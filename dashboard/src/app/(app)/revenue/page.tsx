import { Topbar } from "@/components/Topbar";
import { MetricCard } from "@/components/MetricCard";
import { ChartCard } from "@/components/ChartCard";
import { RevenueByPlanBar } from "@/components/charts/RevenueByPlanBar";
import { DataTable, type Column } from "@/components/DataTable";
import { getRevenueSummary } from "@/lib/revenuecat";
import { compactNumber, currency } from "@/lib/format";
import type { PlanBreakdown } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RevenuePage() {
  const rev = await getRevenueSummary();

  const columns: Column<PlanBreakdown>[] = [
    {
      key: "label",
      header: "Plan",
      render: (r) => <span className="font-medium text-text-primary">{r.label}</span>,
    },
    {
      key: "subscribers",
      header: "Subscribers",
      align: "right",
      render: (r) => compactNumber(r.subscribers),
    },
    {
      key: "mrr",
      header: "MRR (normalized)",
      align: "right",
      render: (r) => currency(Math.round(r.mrr)),
    },
    {
      key: "revenue30d",
      header: "Revenue (30d)",
      align: "right",
      render: (r) => currency(Math.round(r.revenue30d)),
    },
    {
      key: "share",
      header: "MRR share",
      align: "right",
      render: (r) => {
        const total = rev.plans.reduce((s, p) => s + p.mrr, 0) || 1;
        return `${Math.round((r.mrr / total) * 100)}%`;
      },
    },
  ];

  const totalRevenue30d = rev.plans.reduce((s, p) => s + p.revenue30d, 0);

  return (
    <>
      <Topbar
        title="Revenue"
        subtitle="By plan · ARPU · LTV"
        source={rev.source}
      />
      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="MRR"
            value={currency(rev.mrr)}
            delta={rev.mrrChangePct}
            hint="normalized"
          />
          <MetricCard
            label="Revenue (30d)"
            value={currency(Math.round(totalRevenue30d))}
            hint="gross booked"
          />
          <MetricCard
            label="ARPU"
            value={currency(rev.arpu)}
            hint="per paying user / mo"
          />
          <MetricCard
            label="LTV (est.)"
            value={currency(rev.ltv)}
            hint="ARPU ÷ churn"
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <ChartCard title="Revenue by plan" subtitle="Gross booked, last 30 days">
              <RevenueByPlanBar data={rev.plans} />
            </ChartCard>
          </div>
          <div className="lg:col-span-2">
            <ChartCard title="Plan economics" subtitle="Monthly · Annual · Lifetime" bodyHeight="h-auto">
              <DataTable columns={columns} rows={rev.plans} rowKey={(r) => r.plan} />
            </ChartCard>
          </div>
        </div>
      </div>
    </>
  );
}
