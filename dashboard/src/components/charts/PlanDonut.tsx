"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { PlanBreakdown } from "@/lib/types";
import { compactNumber } from "@/lib/format";

// Amber-family + complements, ordered to read clearly on dark.
const COLORS = ["#FF8C42", "#F5C451", "#A78BFA"];

export function PlanDonut({ data }: { data: PlanBreakdown[] }) {
  const chartData = data.map((p) => ({ name: p.label, value: p.subscribers }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          innerRadius="58%"
          outerRadius="82%"
          paddingAngle={3}
          stroke="#0C0B09"
          strokeWidth={2}
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "#1F1A14",
            border: "1px solid #2D2218",
            borderRadius: 12,
            color: "#F5EFE6",
          }}
          formatter={(v: number, name: string) => [compactNumber(v), name]}
        />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          formatter={(value: string) => (
            <span style={{ color: "#C4A882", fontSize: 13 }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
