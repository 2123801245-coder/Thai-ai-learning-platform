// src/hooks/useWorldData.js
//
// =========================================================
// ThaiAI World 数据层（Home 与 /universe 学习宇宙页共用）
// =========================================================
//
// 原来 Home.jsx 里装配一份「世界数据」（画像 → 路线 → 星球 → 技能树 →
// 博物馆 → 今日活动）， LearningGalaxy / SkillTree / DigitalMuseum /
// SharePostcard 全都吃它。板块搬到 /universe 后，两个页面要**同一份**
// 数据（否则首页星球发光状态和宇宙页对不上），所以抽成共享 hook：
//
//   Home 用   planets + today（星球行 + 今日活动）+ identity
//   Universe 用 planets + skillTree + museumRooms + theme + today
//
// 数据源不变：画像（useUserProfile）+ 学习进度（useLearningProgress）+
// 媒体学习记录（useMediaProgress）。不新增任何存储。

import { useMemo } from "react";
import {
  buildIdentity,
  buildMuseumRooms,
  buildPlanets,
  buildSkillTree,
  buildWorldTheme,
  skillTreeSummary,
} from "@/lib/worldData";
import { generateLearningPath } from "@/lib/learningPath";
import { estimateAbilities } from "@/lib/abilityModel";
import { hasPlacementProfile } from "@/lib/placement";
import { useLearningProgress } from "@/hooks/useLearningProgress";
import { useUserProfile } from "@/lib/userProfile";
import { useMediaProgress } from "@/lib/mediaProgress";
import { useTodayActivity } from "@/lib/useTodayActivity";
import { useAuth } from "@/lib/AuthContext";

export function useWorldData() {
  const { user } = useAuth();
  const { progress, loading } = useLearningProgress();
  const { profile } = useUserProfile();

  const hasTest = hasPlacementProfile(profile);

  /* 学习路线（星系数据源）：没做入学测试就没有路线，世界仍完整可见 */
  const path = useMemo(
    () => (hasTest ? generateLearningPath(profile) : null),
    [profile, hasTest]
  );

  const theme = useMemo(() => buildWorldTheme(profile), [profile]);

  const planets = useMemo(() => buildPlanets(path, profile), [path, profile]);

  const abilities = useMemo(() => estimateAbilities(progress, planets), [progress, planets]);

  const skillTree = useMemo(
    () => buildSkillTree(abilities, planets),
    [abilities, planets]
  );
  const skillSummary = useMemo(() => skillTreeSummary(skillTree), [skillTree]);

  /* 博物馆的进度来自真实的媒体学习记录（订阅式，学完自动更新） */
  const mediaProgress = useMediaProgress();

  const today = useTodayActivity({
    planets,
    path,
    progress,
    mediaState: mediaProgress.state,
  });

  const museumRooms = useMemo(
    () => buildMuseumRooms(mediaProgress.state, profile),
    [mediaProgress.state, profile]
  );

  /* 身份 HUD：等级/称号/XP，未测等级不编造 */
  const identity = useMemo(() => {
    let fallback = null;
    try {
      fallback = JSON.parse(
        localStorage.getItem("thai_ai_learning_progress") || "null"
      );
    } catch {
      fallback = null;
    }
    return buildIdentity({
      user,
      profile,
      progress,
      hasTest,
      localProgressFallback: fallback,
    });
  }, [user, profile, progress, hasTest]);

  return {
    user,
    profile,
    progress,
    loading,
    hasTest,
    path,
    theme,
    planets,
    abilities,
    skillTree,
    skillSummary,
    museumRooms,
    today,
    mediaState: mediaProgress.state,
    identity,
  };
}

export default useWorldData;
