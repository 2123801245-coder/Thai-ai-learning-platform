// src/hooks/useAnimationFrames.js
//
// 这个运行环境到底会不会推进动画？
//
// 为什么需要探测：framer-motion 的时间轴完全架在 requestAnimationFrame 上。
// 而部分内嵌 webview（以及"标签页从未被合成"的场景）里 rAF 一次都不回调 ——
// 那种环境下动画不是"慢"，而是**永远停在起始值**：
//   · 入场元素停在 opacity: 0  → 页面整块看不见；
//   · 景深罩停在 opacity: 0.82 + blur → 页面永远糊着；
//   · AnimatePresence 等不到 exit 完成 → 路由切换卡住不换页。
//
// 与其等着用户遇到这三种状态，不如先问一句：等两帧，等不到就不做动画
// （等同"没有过渡"，界面照常可用）。探测结果按实例缓存，只做一次。

import { useEffect, useState } from "react";

export function useAnimationFrames() {
  const [alive, setAlive] = useState(false);

  useEffect(() => {
    let frames = 0;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      frames += 1;
      if (frames >= 2) {
        setAlive(true);
        return;
      }
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);

    /* 200ms 还凑不满两帧，就当作"这个环境不推进动画" */
    const timer = setTimeout(() => {
      if (frames < 2) stopped = true;
    }, 200);

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  return alive;
}

export default useAnimationFrames;
