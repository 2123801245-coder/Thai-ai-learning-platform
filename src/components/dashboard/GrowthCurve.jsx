import React, { Suspense, lazy } from "react";

const RechartsBundle = lazy(() =>
  import("@/components/charts/rechartsBundle")
);

function ChartSkeleton() {
  return (
    <div className="flex h-40 w-full items-center justify-center">
      <div className="flex w-full flex-col gap-2 px-2">
        <div className="h-px w-full bg-white/[0.04]" />
        <div className="h-1 w-full rounded-full bg-white/[0.045] animate-pulse" />
        <div className="h-1 w-5/6 rounded-full bg-white/[0.035] animate-pulse" />
        <div className="h-1 w-4/6 rounded-full bg-white/[0.03] animate-pulse" />
        <div className="h-1 w-5/6 rounded-full bg-white/[0.035] animate-pulse" />
      </div>
    </div>
  );
}

/* 成长曲线：按每日累计学词映射的水平分 + A1/A2/B1/B2 参考线 */
export default function GrowthCurve({ series = [] }) {
  if (!series.length) return null;
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
          ReferenceLine,
        }) => (
          <ResponsiveContainer width="100%" height={168}>
            <AreaChart
              data={series}
              margin={{ top: 12, right: 6, bottom: 0, left: -22 }}
            >
              <defs>
                <linearGradient id="abilityGrowth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6ee7b7" stopOpacity={0.26} />
                  <stop offset="100%" stopColor="#6ee7b7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 5" stroke="rgba(255,255,255,0.055)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.28)" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 8, fill: "rgba(255,255,255,0.20)" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                cursor={{ stroke: "rgba(255,255,255,0.08)" }}
                contentStyle={{
                  borderRadius: "14px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(7,24,23,0.96)",
                  fontSize: "10px",
                  color: "white",
                }}
                formatter={(val, _, payload) => [`${val} 分 · ${payload?.[0]?.payload?.cefr}`, "水平"]}
              />
              <ReferenceLine y={15} stroke="rgba(255,255,255,0.14)" strokeDasharray="3 4" />
              <ReferenceLine y={40} stroke="rgba(255,255,255,0.14)" strokeDasharray="3 4" />
              <ReferenceLine y={90} stroke="rgba(255,255,255,0.14)" strokeDasharray="3 4" />
              <Area type="monotone" dataKey="score" name="能力水平" stroke="#6ee7b7" strokeWidth={2} fill="url(#abilityGrowth)" dot={{ fill: "#e7b44c", r: 2 }} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      />
    </Suspense>
  );
}