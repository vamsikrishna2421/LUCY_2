"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MrrPoint } from "@/lib/types";
import { currency } from "@/lib/format";

const AXIS = "#8A7560";
const GRID = "#1E1710";

export function MrrLineChart({ data }: { data: MrrPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF8C42" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#FF8C42" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="month"
          stroke={AXIS}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          fontSize={12}
        />
        <YAxis
          stroke={AXIS}
          tickLine={false}
          axisLine={false}
          fontSize={12}
          tickFormatter={(v: number) => currency(v, { compact: true })}
        />
        <Tooltip
          contentStyle={{
            background: "#1F1A14",
            border: "1px solid #2D2218",
            borderRadius: 12,
            color: "#F5EFE6",
          }}
          labelStyle={{ color: "#C4A882" }}
          formatter={(v: number) => [currency(v), "MRR"]}
        />
        <Area
          type="monotone"
          dataKey="mrr"
          stroke="#FF8C42"
          strokeWidth={2}
          fill="url(#mrrFill)"
          dot={false}
          activeDot={{ r: 4, fill: "#FFA05C", stroke: "#0C0B09" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
