// src/lib/explorerProgress.js
//
// =========================================================
// 泰国探索者 · 城市探索进度
// =========================================================
//
// 不新建存储：把每座城市的「探索」写成 mediaProgress 的一条学习记录
// （lessonId = explorer:<cityId>，type = "explorer"），于是：
//
//   - 首页的能力雷达 / 今日活动 / 学习宇宙的展厅统计**自动**跟着变
//     （它们订阅的都是 mediaProgress 的同一个事件）；
//   - 「学习记录」时间线里能看到「在清迈听了「อากาศเย็นกำลังดี」」这种行；
//   - 多标签页同步、刷新不丢、未登录可用，全部沿用既有实现。
//
// 什么算「探索过」：在这座城市里**真的做过一件事**——听了句子、进了场景对话。
// 只是点一下城市不算（否则进度条会变成「点过哪些名字」）。
// =========================================================

import { addMinutes, readMediaState, recordStudy, useMediaProgress } from "@/lib/mediaProgress";

export const EXPLORER_CITY_PREFIX = "explorer:";
export const EXPLORER_RECORD_TYPE = "explorer";

export const cityLessonId = (cityId) => `${EXPLORER_CITY_PREFIX}${cityId}`;

/**
 * 记一次城市探索动作。
 * @param {string} cityId 城市 id（cityAtlas）
 * @param {{title?:string, action:string, minutes?:number}} entry
 */
export function markCityExplored(cityId, { title = "", action = "", minutes = 0 } = {}) {
  if (!cityId) return;
  const lessonId = cityLessonId(cityId);
  recordStudy({ lessonId, title, type: EXPLORER_RECORD_TYPE, action });
  if (minutes > 0) addMinutes(lessonId, minutes);
}

/**
 * 从 mediaProgress 的 state 推导探索进度（纯函数，可在 node 里断言）。
 *
 * @returns {{
 *   total:number, explored:number, percent:number,
 *   byCity:Record<string,{visits:number,lastAt:string|null,lastAction:string}>,
 *   exploredIds:string[], nextId:string|null
 * }}
 */
export function buildExplorerProgress(cities = [], state = readMediaState()) {
  const total = cities.length;
  const byCity = {};

  for (const record of state?.records || []) {
    const id = String(record?.lessonId || "").slice(EXPLORER_CITY_PREFIX.length);
    if (!String(record?.lessonId || "").startsWith(EXPLORER_CITY_PREFIX)) continue;
    if (!cities.some((c) => c.id === id)) continue; // 城市下线后的历史记录不计数
    const current = byCity[id] || { visits: 0, lastAt: null, lastAction: "" };
    byCity[id] = {
      visits: current.visits + 1,
      // records 是时间倒序，第一次遇到的就是最近一次
      lastAt: current.lastAt || record.at || null,
      lastAction: current.lastAction || record.action || "",
    };
  }

  const exploredIds = cities.filter((c) => byCity[c.id]).map((c) => c.id);
  const explored = exploredIds.length;
  const nextId = cities.find((c) => !byCity[c.id])?.id || null;

  return {
    total,
    explored,
    percent: total ? Math.round((explored / total) * 100) : 0,
    byCity,
    exploredIds,
    nextId,
  };
}

/** 订阅式 hook：媒体进度一变（包括别的标签页写入），地图上的进度立刻更新 */
export function useExplorerProgress(cities = []) {
  const { state } = useMediaProgress();
  return buildExplorerProgress(cities, state);
}
