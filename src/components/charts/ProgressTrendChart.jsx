// =========================================================
// 学习趋势图（懒加载）：recharts 只在图表实际渲染时才下载，
// 首屏依赖链不包含 recharts（约 393KB）。
// =========================================================

import React, { Suspense, lazy } from "react";

const RechartsBundle = lazy(() =>
  import("@/components/charts/rechartsBundle")
);

/* 加载占位：与图表同高的柔和骨架，避免布局跳动 */

function ChartSkeleton() {
  return (
    <div className="flex h-36 w-full items-center justify-center">
      <div className="flex w-full flex-col gap-2 px-2">
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

export default function ProgressTrendChart({ data }) {
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
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <AreaChart
              data={data}
              margin={{
                top: 5,
                right: 4,
                bottom: 0,
                left: -18,
              }}
            >
              <defs>
                <linearGradient
                  id="progressWordsFinal"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="#facc15"
                    stopOpacity={0.22}
                  />
                  <stop
                    offset="100%"
                    stopColor="#facc15"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient
                  id="progressAccuracyFinal"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="#6ee7b7"
                    stopOpacity={0.18}
                  />
                  <stop
                    offset="100%"
                    stopColor="#6ee7b7"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 5"
                stroke="rgba(255,255,255,0.055)"
                vertical={false}
              />
              <XAxis
                dataKey="day"
                tick={{
                  fontSize: 9,
                  fill: "rgba(255,255,255,0.28)",
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{
                  fontSize: 8,
                  fill: "rgba(255,255,255,0.20)",
                }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                cursor={{
                  stroke: "rgba(255,255,255,0.08)",
                }}
                contentStyle={{
                  borderRadius: "14px",
                  border:
                    "1px solid rgba(255,255,255,0.08)",
                  background:
                    "rgba(7,24,23,0.96)",
                  boxShadow:
                    "0 15px 40px rgba(0,0,0,.35)",
                  fontSize: "10px",
                  color: "white",
                }}
              />
              <Area
                type="monotone"
                dataKey="words"
                name="学习词数"
                stroke="#facc15"
                strokeWidth={2}
                fill="url(#progressWordsFinal)"
                dot={{
                  fill: "#facc15",
                  r: 2,
                }}
                activeDot={{
                  r: 4,
                }}
              />
              <Area
                type="monotone"
                dataKey="accuracy"
                name="正确率"
                stroke="#6ee7b7"
                strokeWidth={2}
                fill="url(#progressAccuracyFinal)"
                dot={{
                  fill: "#6ee7b7",
                  r: 2,
                }}
                activeDot={{
                  r: 4,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      />
    </Suspense>
  );
}
