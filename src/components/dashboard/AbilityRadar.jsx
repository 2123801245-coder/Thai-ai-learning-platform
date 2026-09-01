import React, { Suspense, lazy } from "react";

const RechartsBundle = lazy(() =>
  import("@/components/charts/rechartsBundle")
);

/* 雷达图加载骨架（与图表等高的柔和占位） */
function ChartSkeleton() {
  return (
    <div className="flex h-56 w-full items-center justify-center">
      <div className="h-24 w-24 animate-spin rounded-full border-2 border-emerald-300/10 border-t-emerald-300/60" />
    </div>
  );
}

export default function AbilityRadar({ data = [] }) {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <RechartsBundle
        render={({
          RadarChart,
          Radar,
          PolarGrid,
          PolarAngleAxis,
          PolarRadiusAxis,
          ResponsiveContainer,
          Tooltip,
        }) => (
          <ResponsiveContainer width="100%" height={230}>
            <RadarChart data={data} outerRadius="72%">
              <PolarGrid stroke="rgba(255,255,255,0.10)" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{
                  fontSize: 11,
                  fill: "rgba(255,255,255,0.55)",
                }}
              />
              <PolarRadiusAxis
                domain={[0, 100]}
                tick={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ stroke: "rgba(255,255,255,0.12)" }}
                contentStyle={{
                  borderRadius: "14px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(7,24,23,0.96)",
                  fontSize: "10px",
                  color: "white",
                }}
                formatter={(val) => [`${val} 分`, "能力值"]}
              />
              <Radar
                name="能力值"
                dataKey="score"
                stroke="#e7b44c"
                strokeWidth={2}
                fill="#10b981"
                fillOpacity={0.28}
                dot={{ fill: "#e7b44c", r: 2.5 }}
              />
            </RadarChart>
          </ResponsiveContainer>
        )}
      />
    </Suspense>
  );
}