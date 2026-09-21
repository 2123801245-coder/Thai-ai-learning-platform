// src/hooks/useAsyncData.js
//
// =========================================================
// 轻量异步取数 · useAsyncData
// =========================================================
//
// 解决的问题
// ----------
// 同一个接口被多个页面各自 fetch 一遍、各自写 loading/error/卸载保护。
// 审计确认：`${API_BASE_URL}/news/daily` 在 4 个页面（ThaiCorpus /
// NewsListening / NewsArticle / CultureUniverse）各拉一次，没有共享层。
//
// 这一层**不做缓存**（缓存策略不该由一个通用 hook 偷偷决定），只负责
// 每页都要写对的三件小事：
//
//   ① 卸载后不再 setState（避免 React 警告与内存泄漏）
//   ② loading / error 状态统一
//   ③ 依赖变化时自动重取 + 手动 refetch
//
// 用法：
//   const { data, loading, error, refetch } = useAsyncData(getPlanOverview, []);

import { useCallback, useEffect, useRef, useState } from "react";

export function useAsyncData(fetcher, deps = [], { initial = null, enabled = true } = {}) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);

  /* 卸载保护：异步回来时组件可能已经不在树上了 */
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (!aliveRef.current) return;
      /* axios 响应与裸值都接受：页面不需要统一包一层 .data */
      setData(result?.data !== undefined ? result.data : result);
    } catch (err) {
      if (!aliveRef.current) return;
      setError(err);
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [enabled, ...deps]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load };
}

export default useAsyncData;
