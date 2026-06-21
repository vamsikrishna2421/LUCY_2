"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FunnelStep } from "@/lib/types";
import { compactNumber } from "@/lib/format";

// Amber gradient deepening down the funnel.
const COLORS = ["#FFA05C", "#FF8C42", "#F08039", "#E8722A", "#D9651F", "#B85419"];

export function FunnelBar({ data }: { data: FunnelStep[] }) {
  const top = data[0]?.users || 1;
  const chartData = data.map((s, i) => ({
    ...s,
    pct: s.users / top,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 56, bottom: 4, left: 8 }}
        barCategoryGap={10}
      >
        <XAxis type="number" hide domain={[0, top]} />
        <YAxis
          type="category"
          dataKey="label"
          stroke="#C4A882"
          tickLine={false}
          axisLine={false}
          width={120}
          fontSize={13}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,140,66,0.06)" }}
          contentStyle={{
            background: "#1F1A14",
            border: "1px solid #2D2218",
            borderRadius: 12,
            color: "#F5EFE6",
          }}
          formatter={(v: number) => [compactNumber(v), "Users"]}
        />
        <Bar dataKey="users" radius={[0, 6, 6, 0]}>
          {chartData.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
          <LabelList
            dataKey="users"
            position="right"
            formatter={(v: number) => compactNumber(v)}
            fill="#F5EFE6"
            fontSize={12}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
