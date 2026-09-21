// src/lib/userProfile.js
//
// =========================================================
// 用户学习画像：后端为准 + localStorage 兜底
// =========================================================
//
// 与 courseProgress.js 同一套思路：
//   1. localStorage 存一份（刷新即显、离线可用，UI 不闪）；
//   2. 登录时从 GET /api/profile 水合（服务端为准，覆盖本地）；
//   3. 测试完成 POST /api/profile 落库，成功后回写本地缓存。
//
// 缓存按用户 id 隔离，避免换账号后串号：
//   { userId: 12, profile: {...} }
//
// 后端不可用时（离线 / 服务未起）不会丢数据：
// 完成测试仍会写本地缓存，登录后再次保存即补写后端。
// =========================================================

import { useEffect, useState } from "react";

import api from "@/api/auth";
import { hasPlacementProfile, normalizeProfile } from "@/lib/placement";

const STORAGE_KEY = "thai_ai_user_profile_v1";
const CHANGE_EVENT = "thai-ai-user-profile-change";

export const USER_PROFILE_CHANGE_EVENT = CHANGE_EVENT;

/* =========================================================
   当前登录用户 id（与缓存做归属校验）
========================================================= */

let hydratedPromise = null; // 进行中的水合
let hydratedForToken = null; // 已水合的 token

function currentUserId() {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    return JSON.parse(raw)?.id ?? null;
  } catch (error) {
    return null;
  }
}

/* =========================================================
   读取 / 写入本地缓存
========================================================= */

export function getCachedProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const profile = normalizeProfile(parsed?.profile);

    if (!profile) return null;

    // 归属校验：缓存属于别人时视为没有（避免串号）
    const userId = currentUserId();

    if (userId && parsed?.userId && String(parsed.userId) !== String(userId)) {
      return null;
    }

    return profile;
  } catch (error) {
    console.error("读取本地学习画像失败:", error);
    return null;
  }
}

function writeCachedProfile(profile) {
  try {
    if (!profile) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ userId: currentUserId(), profile })
      );
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    }
  } catch (error) {
    console.error("保存本地学习画像失败:", error);
  }
}

export function clearCachedProfile() {
  writeCachedProfile(null);
}

/* =========================================================
   是否已有画像（首页据此决定显示画像卡还是测试引导）
========================================================= */

export function hasProfile() {
  return hasPlacementProfile(getCachedProfile());
}

/**
 * 把入学测评画像合并进 AI 老师的请求画像（同步、零请求）。
 *
 * 后端才是权威：即使前端漏传，后端也会从 user_profiles 表读画像。
 * 这里同步带上是为了（1）省一次查询（2）未登录时本机画像也可用。
 *
 * base: { name, level, streak, mastered }（可空）
 * 返回叠加了 thaiLevel / learningGoal / professionalDirection /
 * mediaInterest / learningStyle / targetScenario 的画像
 */
export function mergePlacementProfile(base = {}) {
  const placement = getCachedProfile();
  if (!placement) return base;

  return {
    ...base,
    thaiLevel: placement.thaiLevel,
    learningGoal: placement.learningGoal,
    professionalDirection: placement.professionalDirection,
    mediaInterest: placement.mediaInterest,
    learningStyle: placement.learningStyle,
    targetScenario: placement.targetScenario,
    testScore: placement.testScore,
  };
}

/* =========================================================
   从后端水合（登录 + 后端可用时；同一 token 只做一次）
========================================================= */

export function ensureProfileHydrated({ force = false } = {}) {
  if (hydratedPromise) return hydratedPromise;

  const token = localStorage.getItem("token");
  if (!token) return null;

  if (!force && hydratedForToken === token) return null;

  hydratedPromise = api
    .get("/profile")
    .then((res) => {
      const profile = normalizeProfile(res.data?.profile);

      hydratedForToken = token;

      // 后端没有画像时不要清掉本地（可能是刚做完测试但没登录写入成功）
      if (profile) {
        writeCachedProfile(profile);
      }

      return profile;
    })
    .catch((error) => {
      console.error("从服务器加载学习画像失败，使用本地缓存:", error);
      return null;
    })
    .finally(() => {
      hydratedPromise = null;
    });

  return hydratedPromise;
}

/* =========================================================
   保存画像（测试完成时调用）
   —— 先本地落盘保证不丢，再同步后端；后端失败会抛出以便 UI 提示
========================================================= */

export async function saveProfile(payload) {
  const normalized = normalizeProfile(payload);

  writeCachedProfile(normalized);

  const res = await api.post("/profile", {
    thaiLevel: normalized.thaiLevel,
    learningGoal: normalized.learningGoal,
    professionalDirection: normalized.professionalDirection,
    mediaInterest: normalized.mediaInterest,
    learningStyle: normalized.learningStyle,
    targetScenario: normalized.targetScenario,
    testScore: normalized.testScore,
    testDetail: normalized.testDetail,
  });

  const saved = normalizeProfile(res.data?.profile) || normalized;

  writeCachedProfile(saved);

  return saved;
}

/* =========================================================
   清除画像（重新测试 / 换目标时使用）
========================================================= */

export async function resetProfile() {
  clearCachedProfile();

  try {
    await api.delete("/profile");
  } catch (error) {
    console.error("清除服务器学习画像失败:", error);
  }
}

/* =========================================================
   React Hook：订阅画像变化（首页卡片 / 结果页共用）
========================================================= */

export function useUserProfile() {
  const [profile, setProfile] = useState(() => getCachedProfile());
  const [loading, setLoading] = useState(() => !getCachedProfile());

  useEffect(() => {
    let active = true;

    const refresh = () => {
      if (!active) return;
      setProfile(getCachedProfile());
    };

    window.addEventListener(CHANGE_EVENT, refresh);

    ensureProfileHydrated()?.then(() => {
      if (active) {
        setProfile(getCachedProfile());
        setLoading(false);
      }
    });

    if (!localStorage.getItem("token")) {
      setLoading(false);
    }

    // 水合可能不返回 Promise（已水合过）→ 兜底关闭 loading
    const timer = setTimeout(() => active && setLoading(false), 1200);

    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener(CHANGE_EVENT, refresh);
    };
  }, []);

  return { profile, loading, refresh: () => setProfile(getCachedProfile()) };
}
