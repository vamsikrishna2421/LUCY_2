import { Topbar } from "@/components/Topbar";
import { MetricCard } from "@/components/MetricCard";
import { ChartCard } from "@/components/ChartCard";
import { MrrLineChart } from "@/components/charts/MrrLineChart";
import { PlanDonut } from "@/components/charts/PlanDonut";
import { getRevenueSummary } from "@/lib/revenuecat";
import { getAnalyticsSummary } from "@/lib/posthog";
import { compactNumber, currency, percent } from "@/lib/format";

// Render per-request: data sources read runtime env (RC/PostHog keys), so the
// page must not bake a "mock vs live" decision at build time. Sources cache
// their own fetches (next.revalidate) so this stays cheap.
export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [rev, analytics] = await Promise.all([
    getRevenueSummary(),
    getAnalyticsSummary(),
  ]);

  // Combined source badge: "live" only if both sources are live.
  const source = rev.source === "live" && analytics.source === "live" ? "live" : "mock";

  return (
    <>
      <Topbar
        title="Overview"
        subtitle="Growth & revenue at a glance"
        source={source}
      />
      <div className="flex-1 overflow-y-auto p-8">
        {/* Primary KPI row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="MRR"
            value={currency(rev.mrr)}
            delta={rev.mrrChangePct}
            hint="vs last month"
          />
          <MetricCard
            label="Active Subscriptions"
            value={compactNumber(rev.activeSubscriptions)}
            hint="monthly + annual"
          />
          <MetricCard
            label="Trials Active"
            value={compactNumber(rev.trialsActive)}
            hint="in 7-day trial"
          />
          <MetricCard
            label="Trial → Paid"
            value={percent(rev.trialConversionPct)}
            hint="last 30 days"
          />
        </div>

        {/* Secondary KPI row */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Churn"
            value={percent(rev.churnPct)}
            delta={rev.churnPct - 0.042}
            invertDelta
            hint="monthly"
          />
          <MetricCard
            label="DAU / WAU / MAU"
            value={`${compactNumber(analytics.active.dau)} / ${compactNumber(
              analytics.active.wau,
            )} / ${compactNumber(analytics.active.mau)}`}
            hint={`${percent(analytics.active.stickiness)} stickiness`}
          />
          <MetricCard
            label="Activation"
            value={percent(analytics.activation.activationPct)}
            hint="first capture + recall"
          />
          <MetricCard
            label="ARPU"
            value={currency(rev.arpu)}
            hint="per paying user / mo"
          />
        </div>

        {/* Charts */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ChartCard title="MRR over time" subtitle="Trailing 12 months">
              <MrrLineChart data={rev.mrrSeries} />
            </ChartCard>
          </div>
          <ChartCard title="Subscriptions by plan" subtitle="Active subscriber mix">
            <PlanDonut data={rev.plans} />
          </ChartCard>
        </div>
      </div>
    </>
  );
}
