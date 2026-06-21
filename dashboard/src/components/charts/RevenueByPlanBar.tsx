"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PlanBreakdown } from "@/lib/types";
import { currency } from "@/lib/format";

const COLORS = ["#FF8C42", "#F5C451", "#A78BFA"];

export function RevenueByPlanBar({ data }: { data: PlanBreakdown[] }) {
  const chartData = data.map((p) => ({ name: p.label, revenue: p.revenue30d }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid stroke="#1E1710" vertical={false} />
        <XAxis
          dataKey="name"
          stroke="#8A7560"
          tickLine={false}
          axisLine={{ stroke: "#1E1710" }}
          fontSize={12}
        />
        <YAxis
          stroke="#8A7560"
          tickLine={false}
          axisLine={false}
          fontSize={12}
          tickFormatter={(v: number) => currency(v, { compact: true })}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,140,66,0.06)" }}
          contentStyle={{
            background: "#1F1A14",
            border: "1px solid #2D2218",
            borderRadius: 12,
            color: "#F5EFE6",
          }}
          formatter={(v: number) => [currency(v), "Revenue (30d)"]}
        />
        <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={88}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
