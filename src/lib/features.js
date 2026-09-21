// =========================================================
// 功能开关（Feature Flags）—— 动态版
//
// 管理员可在「设置中心」可视化开关（持久化到后端 settings 表），
// 无需改代码。App 启动时从 GET /api/features 加载。
//
// 用法：
//   const aiTeacher = useFeatureFlag("aiTeacher");
// =========================================================

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api";

/* 默认值（后端未配置时与此一致） */
const DEFAULT_FLAGS = {
  aiTeacher: true,
};

let flags = { ...DEFAULT_FLAGS };

const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getFlag(name) {
  return flags[name] ?? DEFAULT_FLAGS[name] ?? false;
}

export function setFlags(next) {
  flags = {
    ...DEFAULT_FLAGS,
    ...next,
  };
  emit();
}

export function setFlag(name, value) {
  flags = {
    ...flags,
    [name]: value,
  };
  emit();
}

function subscribe(listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/* =========================================================
   React Hook：组件内订阅功能开关
========================================================= */

export function useFeatureFlag(name) {
  const [value, setValue] = useState(() =>
    getFlag(name)
  );

  useEffect(() => {
    const update = () => setValue(getFlag(name));

    update();
    return subscribe(update);
  }, [name]);

  return value;
}

/* =========================================================
   批量订阅：一次拿到多个开关（导航这类「一起决定显隐」的地方用）
   ---------------------------------------------------------
   useFeatureFlag 只能拿一个；导航树要同时判 aiTeacher 等若干个，
   若逐项调用会注册 N 个订阅、N 次 setState。这里返回稳定快照。
========================================================= */

export function useFeatureFlags(names = []) {
  const key = names.join("|");

  const [snapshot, setSnapshot] = useState(() =>
    names.reduce((acc, name) => {
      acc[name] = getFlag(name);
      return acc;
    }, {})
  );

  useEffect(() => {
    const list = key ? key.split("|") : [];

    const update = () => {
      setSnapshot((prev) => {
        let changed = false;
        const next = { ...prev };
        list.forEach((name) => {
          const value = getFlag(name);
          if (next[name] !== value) {
            next[name] = value;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    };

    update();
    return subscribe(update);
  }, [key]);

  return snapshot;
}

/* =========================================================
   实时同步：SSE 订阅开关变更（多端自动刷新）
   EventSource 断线后由浏览器自动重连。
========================================================= */

let streamStarted = false;

export function subscribeFeaturesStream() {
  if (streamStarted || typeof EventSource === "undefined") {
    return;
  }

  streamStarted = true;

  const source = new EventSource(
    `${API_BASE_URL}/features/stream`
  );

  source.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data && typeof data === "object") {
        setFlags(data);
      }
    } catch (e) {
      // ignore
    }
  };
}

/* =========================================================
   从后端加载（App 启动时调用一次）
========================================================= */

let loadPromise = null;

export function loadFeatureFlags() {
  if (loadPromise) return loadPromise;

  loadPromise = fetch(`${API_BASE_URL}/features`)
    .then((response) => {
      if (!response.ok) throw new Error("加载功能开关失败");
      return response.json();
    })
    .then((data) => {
      if (data && typeof data === "object") {
        setFlags(data);
      }
    })
    .catch((error) => {
      console.warn("功能开关加载失败，使用默认值:", error);
    });

  return loadPromise;
}

/* =========================================================
   更新开关（管理员，设置页调用）
========================================================= */

export async function updateFeatureFlag(name, value) {
  const token = localStorage.getItem("token");

  const response = await fetch(
    `${API_BASE_URL}/admin/features`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        [name]: value,
      }),
    }
  );

  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => ({}));
    throw new Error(
      data.error || "更新功能开关失败"
    );
  }

  const data = await response.json();
  setFlags(data);
  return data;
}
