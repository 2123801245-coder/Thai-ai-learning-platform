// =========================================================
// 口语评分趋势图（懒加载）：展示四维评分变化曲线
// =========================================================

import React, { Suspense, lazy } from "react";

const RechartsBundle = lazy(() =>
  import("@/components/charts/rechartsBundle")
);

function ChartSkeleton() {
  return (
    <div className="flex h-52 w-full items-center justify-center">
      <div className="flex w-full flex-col gap-2 px-4">
        <div className="h-px w-full bg-white/[0.04]" />
        <div className="h-1 w-full rounded-full bg-white/[0.045] animate-pulse" />
        <div className="h-1 w-5/6 rounded-full bg-white/[0.035] animate-pulse" />
        <div className="h-1 w-4/6 rounded-full bg-white/[0.03] animate-pulse" />
        <div className="h-1 w-5/6 rounded-full bg-white/[0.035] animate-pulse" />
        <div className="h-1 w-full rounded-full bg-white/[0.045] animate-pulse" />
      </div>
    </div>
  );
}

const DIMENSION_COLORS = {
  accuracy: { stroke: "#34d399", fill: "#34d399", label: "发音" },
  tone: { stroke: "#fbbf24", fill: "#fbbf24", label: "声调" },
  fluency: { stroke: "#60a5fa", fill: "#60a5fa", label: "流利度" },
  completeness: { stroke: "#c084fc", fill: "#c084fc", label: "完整度" },
};

export default function SpeakingTrendChart({ data, dimensions = ["accuracy", "tone", "fluency", "completeness"] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.025]">
        <p className="text-sm text-white/30">暂无练习记录，开始录音后这里会显示趋势</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<ChartSkeleton />}>
      <RechartsBundle
        render={({
          AreaChart,
          Area,
          ResponsiveContainer,
          XAxis,
          YAxis,
          Tooltip,
          CartesianGrid,
        }) => (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, bottom: 0, left: -20 }}
            >
              <defs>
                {dimensions.map((dim) => (
                  <linearGradient key={dim} id={`trend-${dim}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={DIMENSION_COLORS[dim].fill} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={DIMENSION_COLORS[dim].fill} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />

              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.25)" }}
                axisLine={false}
                tickLine={false}
              />

              <Tooltip
                contentStyle={{
                  background: "rgba(6,19,18,0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  padding: "8px 12px",
                  fontSize: 11,
                }}
                itemStyle={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}
                labelStyle={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginBottom: 4 }}
              />

              {dimensions.map((dim) => (
                <Area
                  key={dim}
                  type="monotone"
                  dataKey={dim}
                  stroke={DIMENSION_COLORS[dim].stroke}
                  strokeWidth={2}
                  fill={`url(#trend-${dim})`}
                  dot={{ r: 3, fill: DIMENSION_COLORS[dim].stroke, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      />
    </Suspense>
  );
}
