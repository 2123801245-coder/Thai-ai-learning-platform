// src/lib/professionalTracks.js
//
// =========================================================
// 专业路线选择：本地缓存 + 后端同步
// =========================================================
//
// 选择结构：{ tracks: ["business", "news"], updatedAt }
//   - 多选（用户可以同时攻两个方向）
//   - localStorage 即时生效；登录后 POST /api/professional/sync 落库
//   - 路线引擎（learningPath.js）读取选中方向，把对应内容织入学习路线
//
// 与入学画像的关系：Hub 里选方向会同步写回 user_profiles
// .professional_direction（后端 sync 接口做），画像始终只有一份。
// =========================================================

import { useEffect, useState } from "react";

import api from "@/api/auth";
import { PROFESSIONAL_TRACKS } from "@/data/professionalTracks";

const STORAGE_KEY = "thai_ai_professional_tracks_v1";
const CHANGE_EVENT = "thai-ai-professional-tracks-change";

const VALID_IDS = PROFESSIONAL_TRACKS.map((track) => track.id);
const MAX_TRACKS = 3; // 最多同时主攻 3 个方向（防止路线被塞爆）

function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tracks: [], updatedAt: null };

    const parsed = JSON.parse(raw);
    const tracks = Array.isArray(parsed?.tracks)
      ? parsed.tracks.filter((id) => VALID_IDS.includes(id))
      : [];

    return { tracks, updatedAt: parsed?.updatedAt || null };
  } catch {
    return { tracks: [], updatedAt: null };
  }
}

function writeLocal(tracks) {
  const data = {
    tracks: tracks.slice(0, MAX_TRACKS),
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* 隐私模式等：内存态仍可用 */
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }

  return data;
}

export function getSelectedTracks() {
  return readLocal().tracks;
}

export function hasTrackSelection() {
  return readLocal().tracks.length > 0;
}

/** 选中 / 取消一个方向（立即写本地；登录时由 syncToServer 补落库） */
export function toggleTrack(trackId) {
  if (!VALID_IDS.includes(trackId)) return { tracks: [], added: false };

  const current = readLocal().tracks;
  let next;
  let added;

  if (current.includes(trackId)) {
    next = current.filter((id) => id !== trackId);
    added = false;
  } else {
    next = [...current, trackId].slice(-MAX_TRACKS);
    added = true;
  }

  writeLocal(next);
  return { tracks: next, added };
}

/** 直接替换整组选择（Hub 的「完成选择」按钮用） */
export function setSelectedTracks(trackIds) {
  const tracks = (Array.isArray(trackIds) ? trackIds : []).filter((id) =>
    VALID_IDS.includes(id)
  );
  writeLocal(tracks);
  return tracks;
}

/**
 * 登录后与后端同步：
 *   1. GET 拉回云端选择，与本地合并（云端优先，本地补空）
 *   2. 有任何差异 → POST 落库（后端同时回写 user_profiles.professional_direction）
 */
export async function syncTracksWithServer() {
  if (!localStorage.getItem("token")) return readLocal().tracks;

  let serverTracks = [];
  try {
    const res = await api.get("/professional/sync");
    serverTracks = (res.data?.tracks || []).filter((id) =>
      VALID_IDS.includes(id)
    );
  } catch {
    return readLocal().tracks; // 后端不可用：静默用本地
  }

  const localTracks = readLocal().tracks;
  const merged = [...new Set([...serverTracks, ...localTracks])].slice(
    0,
    MAX_TRACKS
  );

  const differs =
    merged.length !== serverTracks.length ||
    merged.some((id) => !serverTracks.includes(id));

  if (differs) {
    try {
      await api.post("/professional/sync", { tracks: merged });
    } catch {
      /* 落库失败：本地已生效，下次登录重试 */
    }
  }

  writeLocal(merged);
  return merged;
}

/** React Hook：页面订阅选择变化 */
export function useProfessionalTracks() {
  const [tracks, setTracks] = useState(() => readLocal().tracks);

  useEffect(() => {
    const refresh = () => setTracks(readLocal().tracks);

    window.addEventListener(CHANGE_EVENT, refresh);
    return () => window.removeEventListener(CHANGE_EVENT, refresh);
  }, []);

  return tracks;
}
