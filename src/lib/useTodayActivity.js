// src/lib/useTodayActivity.js
//
// =========================================================
// 今日活动 · 订阅层
// =========================================================
//
// 为什么和 todayActivity.js 分开：那一层是**纯映射**（能直接在 node 里跑
// 断言），而这一层要读 localStorage（courseProgress 会连带把 axios 那条链
// 拉进产物）。混在一起的话，「今天到底算得对不对」就只能靠肉眼看浏览器。
//
// 职责：
//   1. 订阅四类进度事件 + storage（别的标签页）+ 30 秒兜底刷新；
//   2. 事件一来就重算今天，并把「刚刚变多」的星球标成爆发（burst）；
//   3. 爆发 2.6 秒后自动收回成持续脉冲——冲击波是「刚发生」，脉冲是「今天」。
//
// 挂载时的第一遍**不算爆发**：那时用户还没看见任何东西，给一次冲击波
// 等于在庆祝一件他不知道的事。
// =========================================================

import { useEffect, useMemo, useRef, useState } from "react";

import { buildToday, diffToday, todayCounts } from "@/lib/todayActivity";
import { readAllCourseProgress } from "@/lib/courseProgress";
import { getSpeakingHistory } from "@/lib/speakingHistory";
import { subscribeProgressEvents } from "@/lib/progressEvents";

/** 同页若有模块忘了广播，最多 30 秒也会自己追上 */
const SAFETY_REFRESH_MS = 30000;
/** 一次性冲击波的存活时间（毫秒） */
const BURST_MS = 2600;
/**
 * 水合期：这段时间内的读数不算「刚发生」（只记基线）。
 * 首屏时 localStorage 里的进度是异步读上来的，前几帧一切都是 0，
 * 数据到位后看起来就像「突然多了一批活动」——我在预览里真的看到了这个
 * 假冲击波：刚打开首页、什么都没做，基础基石就先炸了一下。
 */
const SETTLE_MS = 3000;

/**
 * @param {object} input
 *   planets     buildPlanets() 的结果（返回带 today 字段的新数组）
 *   path        学习路线
 *   progress    useLearningProgress 的 progress
 *   mediaState  mediaProgress 的 state
 * @returns buildToday() 的全部字段，外加 burst: { planetId, all, seq } | null
 */
export function useTodayActivity({
  planets = [],
  path = null,
  progress = null,
  mediaState = null,
} = {}) {
  /* 两个非响应式来源：随事件重读 */
  const [tick, setTick] = useState(0);

  const courseProgress = useMemo(() => readAllCourseProgress(), [tick]);
  const speakingRecords = useMemo(() => getSpeakingHistory(), [tick]);

  const today = useMemo(
    () =>
      buildToday(planets, {
        path,
        progress,
        courseProgress,
        mediaState,
        speakingRecords,
      }),
    [planets, path, progress, mediaState, courseProgress, speakingRecords]
  );

  const [burst, setBurst] = useState(null);
  const previousRef = useRef(null);
  const seqRef = useRef(0);
  const mountedAtRef = useRef(Date.now());

  /* 永远给定时器一个“最新读数”的入口 */
  const latestRef = useRef(today);
  useEffect(() => {
    latestRef.current = today;
  }, [today]);

  /*
   * 水合期一结束就把基线重记一次（ready: true）。
   *
   * 不这么做的话会漏掉**第一件真事**：如果水合期的最后一次读数（ready:
   * false）之后用户才真的练了一下，那次比较会拿「水合期的读数」当基线，
   * 于是被当成「数据刚到」而被静默。重记基线让「刚刚发生」从第一件真事开始
   * 就算数，而不是第二件。
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      previousRef.current = { counts: todayCounts(latestRef.current), ready: true };
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const previous = previousRef.current;
    const settled = Date.now() - mountedAtRef.current >= SETTLE_MS;
    const next = { counts: todayCounts(today), ready: settled };
    previousRef.current = next;

    /* 水合期内只记基线：首屏「0 → 有数据」不是用户此刻做了什么 */
    if (!settled) return undefined;

    const grown = diffToday(previous, next);
    if (!grown.length) return undefined;

    seqRef.current += 1;
    setBurst({ planetId: grown[0], all: grown, seq: seqRef.current });
    const timer = setTimeout(() => setBurst(null), BURST_MS);
    return () => clearTimeout(timer);
  }, [today]);

  useEffect(() => {
    const refresh = () => setTick((value) => value + 1);
    const unsubscribe = subscribeProgressEvents(refresh);
    const timer = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) refresh();
    }, SAFETY_REFRESH_MS);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  return { ...today, burst };
}

export default useTodayActivity;
