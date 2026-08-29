// =========================================================
// recharts 懒加载包装：把命名导出包装成默认导出组件，
// 供 React.lazy 页面内按需加载（图表只在渲染时下载）。
// 被 lazy import 后，recharts 会进入独立的懒 chunk，
// 不再进首屏依赖链。
// =========================================================

import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function RechartsBundle({ render }) {
  return render({
    AreaChart,
    Area,
    ResponsiveContainer,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
  });
}
