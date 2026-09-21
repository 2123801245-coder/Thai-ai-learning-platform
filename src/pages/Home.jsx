import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Sparkles,
  Flame,
  BookOpen,
  Target,
  CalendarDays,
  ChevronRight,
  Zap,
  Volume2,
  Feather,
  Bell,
  Check,
  X,
  Play,
  Video,
  Clock3,
  Crown,
  AlarmClock,
  Mic,
  BarChart3,
  MessageCircle,
  Languages,
  Compass,
  Trophy,
  RefreshCw,
} from "lucide-react";

import { BangkokSkyline } from "@/components/common/ThaiDecor";

import { useLocation, useNavigate } from "react-router-dom";

// AbilitySection 已随板块迁移到 /universe（LearningUniverse）
import VipPanel from "@/components/common/VipPanel";
import {
  ThaiCorner,
  ThaiSectionDivider,
} from "@/components/common/ThaiDecor";
import {
  AIOrb,
  AnimatedNumber,
  StaggerGroup,
  StaggerItem,
} from "@/components/ui/premium";
import DailyMissionCard from "@/components/dashboard/DailyMissionCard";
import AIRecommendationCard from "@/components/dashboard/AIRecommendationCard";

/* =========================================================
   ThaiAI World · 沉浸式世界的四层空间
   （英雄守护者 / 学习星系 / 技能树 / 数字博物馆 + AI 教室）
========================================================= */
import AITeacherSpace from "@/components/world/AITeacherSpace";
import LearningGalaxy from "@/components/world/LearningGalaxy";
// SkillTree / DigitalMuseum / SharePostcard 已随板块迁移到 /universe（LearningUniverse）
import {
  buildIdentity,
  buildPlanets,
  buildWorldTheme,
  currentPlanet,
} from "@/lib/worldData";
import { generateLearningPath } from "@/lib/learningPath";
import { useMediaProgress } from "@/lib/mediaProgress";
import { useTodayActivity } from "@/lib/useTodayActivity";
import GuardianScene from "@/components/world/GuardianScene";
import UniverseRow from "@/components/home/UniverseRow";
import ContinueLearning from "@/components/home/ContinueLearning";
import LevelCard from "@/components/home/LevelCard";
import TodayRecap from "@/components/home/TodayRecap";
import { useLearningProgress } from "@/hooks/useLearningProgress";
import { courses, getCourseLessons, getLessonHref } from "@/data/courses";
import { getCourseStats, getCourseProgress } from "@/lib/courseProgress";
import { useAuth } from "@/lib/AuthContext";
import { API_BASE_URL } from "@/lib/api";
import { speakThai } from "@/lib/thaiSpeech";
import { useFeatureFlag } from "@/lib/features";
import { adminGenerateCodes } from "@/api/auth";
import {
  getLevelMeta,
  goalEmoji,
  goalTitle,
  hasPlacementProfile,
  directionTitles,
  mediaTitles,
} from "@/lib/placement";
import { useUserProfile } from "@/lib/userProfile";
import { THAI_TIPS } from "@/data/dailyContent";
import { useDailyContent } from "@/lib/dailyContent";
import {
  buildDailyTasks,
  getProfileBookHint,
  recommendCourses,
} from "@/lib/profileDriven";


const TOTAL_WORDS = 500;

const QUICK_PLANS = [
  { label: "月度", days: 30, price: 49 },
  { label: "季度", days: 90, price: 128 },
  { label: "年度", days: 365, price: 399 },
];



/* =========================================================
   今日一句泰语 / 泰语小知识

   内容池（含每条内容的等级与兴趣标签）已移到 src/data/dailyContent.js，
   按人挑选的逻辑在 src/lib/dailyContent.js：
   等级 ±1 收敛 + 兴趣命中加权 + 当天稳定 + 近三天不重复。
========================================================= */

/* =========================================================
   谚语主题筛选元数据（图标 + 专属主题色，Tailwind 类必须静态）
========================================================= */

const THEME_META = {
  "全部": {
    icon: "✨",
    active:
      "border-yellow-300/40 bg-yellow-300/15 text-yellow-200 shadow-[0_0_12px_rgba(250,204,21,0.15)]",
  },
  "时机": {
    icon: "⏳",
    active:
      "border-amber-300/40 bg-amber-300/15 text-amber-200 shadow-[0_0_12px_rgba(252,211,77,0.18)]",
  },
  "耐心": {
    icon: "🛠️",
    active:
      "border-orange-300/40 bg-orange-300/15 text-orange-200 shadow-[0_0_12px_rgba(251,146,60,0.18)]",
  },
  "言行": {
    icon: "🗣️",
    active:
      "border-rose-300/40 bg-rose-300/15 text-rose-200 shadow-[0_0_12px_rgba(251,113,133,0.18)]",
  },
  "教育": {
    icon: "🎓",
    active:
      "border-violet-300/40 bg-violet-300/15 text-violet-200 shadow-[0_0_12px_rgba(167,139,250,0.18)]",
  },
  "励志": {
    icon: "🌟",
    active:
      "border-lime-300/40 bg-lime-300/15 text-lime-200 shadow-[0_0_12px_rgba(163,230,53,0.18)]",
  },
  "真相": {
    icon: "🌊",
    active:
      "border-sky-300/40 bg-sky-300/15 text-sky-200 shadow-[0_0_12px_rgba(56,189,248,0.18)]",
  },
  "谦虚": {
    icon: "🌾",
    active:
      "border-[#CB8DFF]/30 bg-[#CB8DFF]/10 text-[#CB8DFF] shadow-[0_0_12px_rgba(203,141,255,0.15)]",
  },
  "交友": {
    icon: "🤝",
    active:
      "border-pink-300/40 bg-pink-300/15 text-pink-200 shadow-[0_0_12px_rgba(244,114,182,0.18)]",
  },
  "处世": {
    icon: "🐊",
    active:
      "border-teal-300/40 bg-teal-300/15 text-teal-200 shadow-[0_0_12px_rgba(45,212,191,0.18)]",
  },
};

/* =========================================================
   Home
========================================================= */

function LegacyHome() {
  const { user, token } = useAuth();
  const isVipUser = !!user?.isVip;
  const isAdmin = Boolean(user?.isAdmin || user?.is_admin || user?.role === "admin");
  const navigate = useNavigate();
  const location = useLocation();
  const aiTeacher = useFeatureFlag("aiTeacher");

  const { progress, loading } = useLearningProgress();

  /* 学习画像（AI 入学测试产物）：驱动推荐课程排序与 ProfileCard */
  const { profile } = useUserProfile();

  const [isSpeaking, setIsSpeaking] = useState(false);

  /* =====================================================
     ThaiAI World：世界层的真实数据
     -----------------------------------------------------
     英雄 HUD / 学习星系由现有画像与学习记录推导（见 src/lib/worldData.js），
     技能树/博物馆等深层板块已搬到学习宇宙页（/universe）。
  ===================================================== */

  /*
   * 老链接 /#universe 的兼容滚动：学习宇宙已改独立页，这里只在有人还
   * 带着旧锚点进来时，把首页滚到星系板块（id="universe"）兜底。
   */
  useEffect(() => {
    if (location.hash !== "#universe") return undefined;

    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      const node = document.getElementById("universe");
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "start" });
        clearInterval(timer);
        return;
      }
      if (attempts >= 12) clearInterval(timer);
    }, 250);

    return () => clearInterval(timer);
  }, [location.hash]);

  const hasTest = hasPlacementProfile(profile);

  /* 学习路线（星系的数据源）：没做入学测试就没有路线，世界仍完整可见 */
  const worldPath = useMemo(
    () => (hasTest ? generateLearningPath(profile) : null),
    [profile, hasTest]
  );

  /*
   * 世界主题：画像 → 配色 / 命名 / 卫星分布 / 博物馆主展厅。
   * 这是「同一个 URL，不同账号看到不同世界」的单一开关。
   */
  const worldTheme = useMemo(() => buildWorldTheme(profile), [profile]);

  const worldPlanets = useMemo(
    () => buildPlanets(worldPath, profile),
    [worldPath, profile]
  );
  const focusPlanet = useMemo(() => currentPlanet(worldPlanets), [worldPlanets]);

  /* 技能树 / 博物馆 / 能力评估已搬到学习宇宙页（/universe），数据在那边装配 */

  /* 博物馆的进度来自真实的媒体学习记录（订阅式，学完自动更新） */
  const mediaProgress = useMediaProgress();

  /*
   * 「今天发生了什么」。
   * 星系长期只有「累计进度」一个时间尺度，用户今天练完回来看到的是同一张
   * 图。这一层把今天的真实时间戳信号（词汇/口语/媒体/课程）归到星球上，
   * 让今天练过的星球当场扩环、尘埃被吹开，并且在你正看着的时候发生的事
   * 会炸一下（burst）。
   */
  const todayActivity = useTodayActivity({
    planets: worldPlanets,
    path: worldPath,
    progress,
    mediaState: mediaProgress.state,
  });
  const livePlanets = todayActivity.planets;

  /* 身份 HUD：等级/称号/XP 与 AIProfileCard 同源，未测等级不编造 */
  const worldIdentity = useMemo(() => {
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

  /* =====================================================
     继续学习（有学习进度的课程）
  ===================================================== */

  const continueCourses = useMemo(() => {
    const published = courses.filter(
      (course) => course.status !== "coming"
    );

    return published
        .map((course) => {
          const lessons = getCourseLessons(course.id);
        return {
          course,
          lessons,
          stats: getCourseStats(course.id, lessons),
          entry: getCourseProgress(course.id),
        };
      })
      .filter((item) => item.stats.progressPercent > 0)
      .sort((a, b) =>
        (b.entry?.updatedAt || "").localeCompare(
          a.entry?.updatedAt || ""
        )
      )
      .slice(0, 3);
  }, []);

  /* =====================================================
     推荐课程
  ===================================================== */

  // 按学习画像排序：可立即学的优先，其次画像匹配度 + 等级契合度
  const recommendedCourses = useMemo(
    () => recommendCourses(profile, courses, 3),
    [profile]
  );

  /* =====================================================
     从上次位置继续学习
  ===================================================== */

  const resumeCourse = (item) => {
    /* ContinueLearning 的「全部课程」出口 */
    if (item?.__all) {
      navigate("/course");
      return;
    }

    const last = item.lessons.find(
      (lesson) => lesson.id === item.entry?.lastLessonId
    );

    if (isVipUser || last.free || !item.course.isVip) {
      navigate(getLessonHref(item.course.id, last));
    } else {
      navigate(`/course/${item.course.id}`);
    }
  };

  /* =====================================================
     消息中心
  ===================================================== */

  const [showNotifications, setShowNotifications] = useState(false);
  const [showVipPanel, setShowVipPanel] = useState(false);
  const [quickCodeDays, setQuickCodeDays] = useState(null);
  const [quickCodeBusy, setQuickCodeBusy] = useState(false);
  const [quickCodeMessage, setQuickCodeMessage] = useState("");

  const quickGenerateCode = async (days) => {
    setQuickCodeBusy(true);
    setQuickCodeDays(days);
    setQuickCodeMessage("");
    try {
      const response = await adminGenerateCodes({ count: 1, days, prefix: "THAI-VIP" });
      const code = response.data?.codes?.[0];
      if (!code) throw new Error("生成失败");
      await navigator.clipboard?.writeText(code);
      setQuickCodeMessage(`已生成 ${days} 天激活码并复制：${code}`);
    } catch (error) {
      setQuickCodeMessage(error?.response?.data?.message || "生成失败，请稍后重试");
    } finally {
      setQuickCodeBusy(false);
      setQuickCodeDays(null);
    }
  };

  /* =====================================================
     消息中心（真实：后端 notifications API）
  ===================================================== */

  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(true);

  const formatNotifTime = (createdAt) => {
    if (!createdAt) return "";

    const t = new Date(
      String(createdAt).replace(" ", "T") + "Z"
    );
    if (Number.isNaN(t.getTime())) return "";

    const diff = Date.now() - t.getTime();

    if (diff < 60 * 1000) return "刚刚";
    if (diff < 60 * 60 * 1000) {
      return `${Math.floor(diff / 60000)} 分钟前`;
    }
    if (diff < 24 * 60 * 60 * 1000) return "今天";
    if (diff < 48 * 60 * 60 * 1000) return "昨天";
    return `${t.getMonth() + 1}月${t.getDate()}日`;
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/notifications`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) return;

      const data = await res.json();

      setNotifications(
        (data.list || []).map((n) => ({
          ...n,
          unread: !n.isRead,
          time: formatNotifTime(n.createdAt),
        }))
      );
    } catch {
      // 网络异常时静默，保留现有列表
    } finally {
      setNotifLoading(false);
    }
  };

  // 挂载 + 60s 轮询

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 60000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 打开面板时刷新一次

  useEffect(() => {
    if (showNotifications) fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNotifications]);

  const unreadCount = notifications.filter(
    (item) => item.unread
  ).length;

  const markAllRead = async () => {
    setNotifications((current) =>
      current.map((item) => ({
        ...item,
        unread: false,
      }))
    );

    try {
      await fetch(
        `${API_BASE_URL}/notifications/read-all`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    } catch {
      // 忽略
    }
  };

  const markRead = async (id) => {
    setNotifications((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              unread: false,
            }
          : item
      )
    );

    try {
      await fetch(
        `${API_BASE_URL}/notifications/${id}/read`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    } catch {
      // 忽略
    }
  };

  const handleNotificationClick = (item) => {
    if (
      item.action === "vip" ||
      item.action === "news-quota-exhausted" ||
      item.action === "speaking-quota-exhausted" ||
      item.action === "ai-teacher-quota-exhausted"
    ) {
      setShowNotifications(false);
      markRead(item.id);
      setShowVipPanel(true);
      return;
    }

    markRead(item.id);

    if (item.link) {
      setShowNotifications(false);
      navigate(item.link);
    }
  };

  /* VIP 到期提醒：到期前 3 天在首页横幅（消息中心由后端同步推送） */

  const vipDaysLeft = useMemo(() => {
    if (!user?.vipExpiresAt) return null;

    const text =
      String(user.vipExpiresAt).replace(" ", "T") + "Z";
    const expiry = new Date(text);
    if (Number.isNaN(expiry.getTime())) return null;

    return Math.ceil(
      (expiry.getTime() - Date.now()) / 86400000
    );
  }, [user?.vipExpiresAt]);

  const vipExpiryReminder =
    isVipUser &&
    vipDaysLeft !== null &&
    vipDaysLeft >= 1 &&
    vipDaysLeft <= 3;

  const vipExpiryDate = useMemo(() => {
    if (!user?.vipExpiresAt) return "";

    const text =
      String(user.vipExpiresAt).replace(" ", "T") + "Z";
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return "";

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [user?.vipExpiresAt]);

  const streak = progress?.learning_streak || 0;

  /* =====================================================
     日期与时段问候（参考图右上角挂件）
  ===================================================== */

  const now = new Date();
  const WEEK_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
  const dateText = `${now.getMonth() + 1}月${now.getDate()}日 星期${WEEK_LABELS[now.getDay()]}`;
  const hour = now.getHours();
  // 边界取 12:00：11 点仍然属于早上（原来的 11 点分界会让上午显示「下午好」）
  const isMorning = hour >= 5 && hour < 12;
  const isAfternoon = hour >= 12 && hour < 18;
  const timeGreeting = isMorning ? "早上好" : isAfternoon ? "下午好" : "晚上好";
  const timeGreetingEmoji = isMorning ? "🌅" : isAfternoon ? "☀️" : "🌙";

  const totalVocabulary = Math.min(
    progress?.total_vocabulary || 0,
    TOTAL_WORDS
  );

  const accuracy = progress?.accuracy_rate || 0;

  const weeklyWords = useMemo(() => {
    const history = progress?.daily_history || [];

    return history
      .slice(-7)
      .reduce((sum, item) => {
        return sum + (Number(item.words) || 0);
      }, 0);
  }, [progress]);

  const vocabularyPercent = Math.min(
    Math.round((totalVocabulary / TOTAL_WORDS) * 100),
    100
  );

  /* =====================================================
     今日一句
  ===================================================== */

  const daily = useDailyContent(profile);
  const todaySentence = daily.sentence;

  /* =====================================================
     播放今日一句
  ===================================================== */

  const speakCancelRef = useRef(null);

  const handleSpeakThai = () => {
    if (!todaySentence?.thai) return;

    if (isSpeaking) {
      speakCancelRef.current?.();
      setIsSpeaking(false);
      return;
    }

    speakCancelRef.current = speakThai(todaySentence.thai, {
      rate: 0.78,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });

    setIsSpeaking(true);
  };

  return (
    <div
      className="apple-home-shell home-theme-root relative min-h-screen w-full text-white"
      style={{ background: 'var(--tp-bg, #0c1719)' }}
    >
      <div className="home-theme-backdrop pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <motion.div
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 0.32, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="home-theme-image absolute inset-[-3%] bg-cover bg-center"
          style={{ backgroundImage: 'url(/site-bg-night.jpg)' }}
        />
        <div className="home-theme-vignette absolute inset-0" />
        <div className="home-theme-particles absolute inset-0" />
      </div>

      {/* =====================================================
          右上角消息按钮
      ===================================================== */}

      <div className="fixed right-6 top-5 z-[100]">

        <motion.button
          type="button"
          onClick={() =>
            setShowNotifications((value) => !value)
          }
          whileHover={{
            scale: 1.05,
          }}
          whileTap={{
            scale: 0.95,
          }}
          className="
            relative
            flex
            h-12
            w-12
            items-center
            justify-center
            rounded-2xl
            border
            border-white/15
            bg-black/45
            shadow-xl
            shadow-black/20
            backdrop-blur-2xl
            transition-all
            hover:border-[#CB8DFF]/30
            hover:bg-white/[0.08]
          "
          aria-label="消息中心"
        >

          <Bell
            className={`h-5 w-5 transition-colors ${
              unreadCount > 0
                ? "text-yellow-300"
                : "text-white/70"
            }`}
          />

          {unreadCount > 0 && (
            <>
              <span
                className="
                  absolute
                  right-2
                  top-2
                  h-2.5
                  w-2.5
                  rounded-full
                  bg-red-400
                  shadow-[0_0_10px_rgba(248,113,113,0.8)]
                "
              />

              <span
                className="
                  absolute
                  right-[7px]
                  top-[7px]
                  h-3.5
                  w-3.5
                  animate-ping
                  rounded-full
                  bg-red-400/40
                "
              />
            </>
          )}
        </motion.button>

        {/* =================================================
            消息面板
        ================================================= */}

        <AnimatePresence>
          {showNotifications && (
            <motion.div
              initial={{
                opacity: 0,
                y: -8,
                scale: 0.97,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                y: -8,
                scale: 0.97,
              }}
              transition={{
                duration: 0.18,
              }}
              className="
                absolute
                right-0
                top-14
                w-[340px]
                overflow-hidden
                rounded-2xl
                border
                border-white/10
                bg-black/70
                shadow-2xl
                shadow-black/40
                backdrop-blur-2xl
              "
            >

              {/* 面板顶部 */}

              <div
                className="
                  flex
                  items-center
                  justify-between
                  border-b
                  border-white/[0.08]
                  px-5
                  py-4
                "
              >

                <div className="flex items-center gap-3">

                  <div
                    className="
                      flex
                      h-9
                      w-9
                      items-center
                      justify-center
                      rounded-xl
                      bg-[#CB8DFF]/10
                    "
                  >
                    <Bell className="h-4 w-4 text-[#CB8DFF]" />
                  </div>

                  <div>
                    <div className="font-semibold text-white">
                      消息中心
                    </div>

                    <div className="mt-0.5 text-[11px] text-white/35">
                      {unreadCount > 0
                        ? `${unreadCount} 条未读消息`
                        : "暂无未读消息"}
                    </div>
                  </div>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowNotifications(false)
                  }
                  className="
                    rounded-lg
                    p-1.5
                    text-white/30
                    transition
                    hover:bg-white/[0.06]
                    hover:text-white/70
                  "
                >
                  <X className="h-4 w-4" />
                </button>

              </div>

              {/* 消息列表 */}

              <div className="max-h-[360px] overflow-y-auto">

                {notifLoading ? (
                  <div className="px-5 py-10 text-center">

                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#CB8DFF]" />

                    <div className="mt-3 text-sm text-white/60">
                      加载中…
                    </div>

                  </div>
                ) : notifications.length === 0 ? (
                  <div className="px-5 py-10 text-center">

                    <div className="text-3xl">
                      ✨
                    </div>

                    <div className="mt-3 text-sm text-white/60">
                      暂时没有消息
                    </div>

                  </div>
                ) : (
                  notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNotificationClick(item)}
                      className={`
                        group
                        flex
                        w-full
                        gap-3
                        border-b
                        border-white/[0.05]
                        px-5
                        py-4
                        text-left
                        transition
                        hover:bg-white/[0.04]
                        ${
                          item.unread
                            ? "bg-[#CB8DFF]/[0.025]"
                            : ""
                        }
                      `}
                    >

                      <div
                        className="
                          flex
                          h-10
                          w-10
                          shrink-0
                          items-center
                          justify-center
                          rounded-xl
                          border
                          border-white/[0.06]
                          bg-white/[0.035]
                          text-lg
                        "
                      >
                        {item.icon}
                      </div>

                      <div className="min-w-0 flex-1">

                        <div className="flex items-center justify-between gap-2">

                          <span className="truncate text-sm font-medium text-white/85">
                            {item.title}
                          </span>

                          {item.unread && (
                            <span
                              className="
                                h-2
                                w-2
                                shrink-0
                                rounded-full
                                bg-[#CB8DFF]
                              "
                            />
                          )}

                        </div>

                        <div className="mt-1 text-xs leading-5 text-white/40">
                          {item.content}
                        </div>

                        <div className="mt-2 text-[10px] text-white/25">
                          {item.type} · {item.time}
                        </div>

                      </div>

                    </button>
                  ))
                )}

              </div>

              {/* 面板底部 */}

              <div
                className="
                  flex
                  items-center
                  justify-between
                  border-t
                  border-white/[0.07]
                  px-5
                  py-3
                "
              >

                <button
                  type="button"
                  onClick={markAllRead}
                  className="
                    flex
                    items-center
                    gap-1.5
                    text-xs
                    text-[#CB8DFF]/70
                    transition
                    hover:text-[#CB8DFF]
                  "
                >
                  <Check className="h-3.5 w-3.5" />
                  全部已读
                </button>

                <span className="text-[10px] text-white/20">
                  学习助手
                </span>

              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* =====================================================
          主体
      ===================================================== */}

      {/*
       * 满屏英雄区（桌面 ≥1100px）：佛像场景脱离居中容器与 MainLayout 内边距，
       * 铺满整个内容区并撑到 100svh（高度由 GuardianScene 自己管）。
       * 窄屏不动：仍然是流内的一张圆角场景卡。
       */}
      <div className="relative min-[1100px]:-mx-8 min-[1100px]:-mt-9">
        {/* =====================================================
            ThaiAI World · 英雄区（全屏电影感场景）

            首页第一眼看的不再是课程列表，而是「我的泰语世界」：
            中央 AI 泰语守护者（3D，懒加载），环绕身份 HUD。
            日期与时段问候挂件从卡片行搬进场景右上角（原样保留）。
        ===================================================== */}

        {/*
         * 首页骨架（佛像向右扩展版）：佛像场景独占全宽，右侧的等级 /
         * 今日任务 / 老师推荐变成悬浮在场景右缘的透明玻璃柱（脸部留空）。
         * 继续学习条保持流内，跟随场景之下。
         *
         * 内容全是真实数据：英雄区的三个数字、星球的真实阶段与今日活动；
         * 三张透明卡的数据源分别是 getLevelInfo、useDailyMissions、
         * recommendCourses —— 只改了视觉层级，数据与交互不动。
         */}
        <div className="relative">
          {/*
           * 连续场景（设计说明的关键一笔）：真实佛像照片不是一张卡片里的
           * 配图，而是一整块场景 —— 「สวัสดี 欢迎回来」、五个图片星球与底部
           * 小贴士都站在同一张照片里。拆成三张卡（英雄卡 / 星球卡 / 贴士卡）
           * 会把这页读成「打开三个面板」。
           *
           * 交互（光晕 / 涟漪 / 与老师说话）全在 GuardianScene 里。
           */}
          <GuardianScene
              identity={worldIdentity}
              onStartConversation={() => navigate("/conversation")}
              onPlacement={() => navigate("/placement-test")}
              dateWidget={
                <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/45 px-3 py-2 backdrop-blur-xl sm:gap-3 sm:px-4">
                  <span className="text-[13px] font-semibold text-white/85 sm:text-sm">
                    {dateText}
                  </span>
                  <span className="h-4 w-px bg-white/15" />
                  <span className="flex items-center gap-1.5 text-[11px] text-yellow-200/80 sm:text-xs">
                    <span>{timeGreetingEmoji}</span>
                    {timeGreeting}，继续加油!
                  </span>
                </div>
              }
            >
              {/* 星球星与小贴士：xl 下给右侧透明柱让位（柱宽 300 + 偏移 20 + 呼吸 20） */}
              <div className="min-w-0 xl:pr-[340px]">
                <UniverseRow
                  bare
                  planets={livePlanets}
                  onSelect={(planet) => navigate(planet?.to || "/plan")}
                />

                {/* 小贴士（设计稿底部那条）。窄屏右侧留出语音核心的位置 */}
                <div className="relative mx-4 mb-4 flex items-start gap-2 rounded-2xl border border-white/[0.08] bg-black/55 py-2.5 pl-4 pr-24 backdrop-blur-xl sm:mx-5 sm:pr-4 lg:mx-6">
                  <span className="text-[12px] leading-none">💡</span>
                  <p className="text-[11px] leading-relaxed text-white/45">
                    小贴士：每天坚持学习，你的星球会变得更加美丽！
                  </p>
                </div>
              </div>
          </GuardianScene>

          {/*
           * 透明玻璃柱（桌面 ≥1280px）：四张卡悬浮在佛像场景右缘，
           * 背景是半透明玻璃（佛像光透过来），脸部区域留空不遮。
           * 窄屏与中屏：回落为流内堆叠（1280-1479px 落在场景下方，
           * 手机在场景内部由 GuardianScene 自己的断点处理）。
           */}
          <aside
            className={
              "glass-column mx-auto mt-4 w-full max-w-[520px] min-w-0 lg:mt-5 " +
              "xl:pointer-events-none xl:absolute xl:inset-y-4 xl:right-5 xl:z-20 xl:mx-0 xl:mt-0 xl:flex xl:w-[300px] xl:max-w-none xl:flex-col xl:justify-center xl:gap-3"
            }
          >
            {/*
             * 柱本身不拦截指针（xl:pointer-events-none）：卡与卡之间的空隙
             * 可以点到佛像（佛像就是老师，点它进对话室）；每张卡自己恢复
             * pointer-events，保证按钮全部可点。
             */}
            <div className="xl:pointer-events-auto">
              <LevelCard identity={worldIdentity} transparent />
            </div>
            <div className="xl:pointer-events-auto">
              <DailyMissionCard transparent />
            </div>
            <div className="xl:pointer-events-auto">
              <AIRecommendationCard transparent />
            </div>
            <div className="xl:pointer-events-auto">
              <ContinueLearning
                items={continueCourses}
                onResume={resumeCourse}
                transparent
              />
            </div>
          </aside>
        </div>
      </div>

      {/* 其余板块：回到居中的 1500px 容器 */}
      <div className="relative z-10 mx-auto max-w-[1500px] px-0 py-0 sm:py-0 lg:px-0">
        {/*
         * 这里原来摆着一尊程序化几何体守护者（WorldHero）。设计说明里明确
         * 不要几何体佛像：首页的佛像就是上面那张真实照片，而它同时也是 AI
         * 老师（点它进对话室）。所以这一整块撤掉了，不再有第二尊。
         */}

        {/* 快捷入口：一条横向浮层（原来 MobileQuickActions 只有手机端可见） */}
        <QuickActionBar aiTeacher={aiTeacher} />

        {isAdmin && (
          <motion.section
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="apple-surface mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-yellow-300/15 bg-black/60 px-4 py-3 shadow-lg shadow-black/20 backdrop-blur-xl"
          >
            <div className="mr-auto flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-300" />
              <div>
                <div className="text-xs font-semibold text-white/85">管理员快捷发码</div>
                <div className="text-[10px] text-white/35">人工收款后无需进入管理页，点击套餐即可生成并复制</div>
              </div>
            </div>
            {QUICK_PLANS.map((plan) => (
              <button
                key={plan.days}
                type="button"
                disabled={quickCodeBusy}
                onClick={() => quickGenerateCode(plan.days)}
                className="rounded-xl border border-yellow-300/20 bg-yellow-300/[0.08] px-3 py-2 text-[11px] font-semibold text-yellow-100 transition hover:-translate-y-0.5 hover:bg-yellow-300/[0.15] disabled:opacity-40"
              >
                {quickCodeBusy && quickCodeDays === plan.days ? "生成中…" : `${plan.label} ¥${plan.price}`}
              </button>
            ))}
            {quickCodeMessage && <span className="basis-full text-[11px] text-white/60">{quickCodeMessage}</span>}
          </motion.section>          )}

        {/* =====================================================
            AI 泰语教室（声波 + 情绪 + 今日安排）

            原来散成三张仪表盘卡的内容在这里合流：
              ① AI Greeting / 个人等级  → 已上升为英雄区 HUD
              ② 今日任务（DailyMissionCard，画像定制 + 真实记录自动点亮）
              ③ AI 推荐（AIRecommendationCard，按目标推荐 + 原因）
            两个组件均为原样复用，点击直达练习页的能力一点没少。
        ===================================================== */}

        <AITeacherSpace
          identity={worldIdentity}
          progress={progress}
          guidance={
            <TodayRecap today={todayActivity} onOpenPlan={() => navigate("/plan")} />
          }
        />

        {/* =====================================================
            学习星系（取代课程卡片列表）
            五颗星球 = 学习路线五大块，当前阶段发光；下方是真实阶段明细
        ===================================================== */}

        <LearningGalaxy
          planets={livePlanets}
          path={worldPath}
          theme={worldTheme}
          today={todayActivity}
        />

        {/* =====================================================
            泰语技能树 / 数字博物馆 / 成就卡 / 能力评估
            → 已整体搬到学习宇宙（/universe）。首页留佛像 + 星系，
            深层世界探索归宇宙页，两边共用同一份数据源。
        ===================================================== */}

        {/* =====================================================
            VIP 到期提醒横幅（续费提醒，点击直达激活面板）
        ===================================================== */}

        {vipExpiryReminder && (
          <motion.button
            type="button"
            onClick={() => setShowVipPanel(true)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            whileHover={{ y: -2 }}
            className="
              mb-6
              mt-5
              flex
              w-full
              flex-wrap
              items-center
              gap-3
              sm:flex-nowrap
              sm:gap-4
              rounded-[22px]
              border
              border-yellow-300/25
              bg-gradient-to-r
              from-yellow-300/[0.12]
              via-amber-400/[0.08]
              to-yellow-300/[0.04]
              px-5
              py-4
              text-left
              shadow-[0_8px_30px_rgba(250,204,21,0.08)]
              transition-all
              hover:border-yellow-300/40
              hover:from-yellow-300/[0.16]
              hover:to-amber-400/[0.07]
            "
          >

            <div
              className="
                flex
                h-11
                w-11
                shrink-0
                items-center
                justify-center
                rounded-2xl
                border
                border-yellow-300/25
                bg-yellow-300/[0.10]
              "
            >
              <AlarmClock className="h-5 w-5 text-yellow-300" />
            </div>

            <div className="min-w-0 flex-1">

              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">

                <span className="text-sm font-bold text-yellow-200">
                  VIP 即将到期
                </span>

                <span
                  className="
                    rounded-full
                    border
                    border-yellow-300/25
                    bg-yellow-300/10
                    px-2
                    py-0.5
                    text-[10px]
                    font-semibold
                    text-yellow-200
                  "
                >
                  还剩 {vipDaysLeft} 天
                </span>

              </div>

              <p className="mt-0.5 truncate text-xs text-yellow-200/60">
                {vipExpiryDate
                  ? `您的 VIP 会员将于 ${vipExpiryDate} 到期，续费后可继续享受全部进阶内容`
                  : "您的 VIP 会员即将到期，续费后可继续享受全部进阶内容"}
              </p>

            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-yellow-300 to-amber-400 px-3 py-2 text-xs font-bold text-[#172018] transition-transform hover:scale-[1.03] sm:px-4">
              <Crown className="h-3.5 w-3.5" />
              立即续费
            </div>

          </motion.button>
        )}

        {/*
         * 原来这里内嵌一整个「AI 泰语老师」聊天板块。它和 /conversation
         * （AI 对话室）是同一件事的两个入口，而首页那尊佛像本身就是老师
         * （点它进对话室），所以这一块撤掉了 —— 对话能力一点没少，只是不再
         * 在首页重复开一个聊天窗。
         * 组件本体（components/AITeacher.jsx 与它专用的 ai/ThaiContextTools.jsx）
         * 已一并删除，不再是「只是没挂上」的悬空代码。
         * 功能开关 aiTeacher 仍保留：快捷入口条与侧边栏的对话室入口都用它。
         */}

        {/* =====================================================
            今日一句 + 泰语小知识
        ===================================================== */}

        <ThaiSectionDivider className="mt-10 mb-6" />

        <div className="mobile-scroll-x flex gap-4 overflow-x-auto pb-2 lg:grid lg:grid-cols-2">

          <motion.div
            initial={{
              opacity: 0,
              y: 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.4,
              duration: 0.6,
            }}
            className="min-w-[calc(100vw-2rem)] snap-start lg:min-w-0 lg:col-span-1"
          >
            <TodaySentenceCard
              sentence={todaySentence}
              reason={daily.reason.sentence}
              onNext={() => daily.reroll("sentence")}
              isSpeaking={isSpeaking}
              onSpeak={handleSpeakThai}
            />
          </motion.div>

          <motion.div
            initial={{
              opacity: 0,
              y: 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.5,
              duration: 0.6,
            }}
            className="min-w-[calc(100vw-2rem)] snap-start lg:min-w-0 lg:col-span-1"
          >
            <ThaiTipCard daily={daily} />
          </motion.div>

        </div>

      </div>

      {/* =====================================================
          VIP 激活面板（续费提醒点击直达）
      ===================================================== */}

      <VipPanel
        open={showVipPanel}
        onClose={() => setShowVipPanel(false)}
      />

    </div>
  );
}

/* =========================================================
   主页主题入口
   默认保留原主页；数字佛像主题改为参考图式沉浸式滚动主页
========================================================= */

export default function Home() {
  return <LegacyHome />;
}

/* =========================================================
   恢复：快捷入口 / 今日一句 / 泰语小知识
   （这三个组件的 JSX 引用还在，定义在上一轮死代码清理中被连带删掉了，
   导致首页 ReferenceError 白屏。按**当前** dailyContent 数据形状重建，
   并支持调用处新传的 reason / onNext props。）
========================================================= */

function QuickActionBar({ aiTeacher }) {
  const navigate = useNavigate();

  const actions = [
    { label: "课程", detail: "继续学", path: "/course", icon: BookOpen, tone: "emerald" },
    { label: "词汇", detail: "记单词", path: "/vocabulary", icon: Languages, tone: "teal" },
    { label: "口语", detail: "练发音", path: "/speaking", icon: Mic, tone: "gold" },
    ...(aiTeacher
      ? [{ label: "对话", detail: "和老师聊", path: "/conversation", icon: MessageCircle, tone: "blue" }]
      : [{ label: "计划", detail: "今日任务", path: "/plan", icon: Target, tone: "blue" }]),
  ];

  const toneClasses = {
    emerald: "border-emerald-300/15 bg-emerald-400/[0.08] text-emerald-200",
    teal: "border-teal-300/15 bg-teal-400/[0.08] text-teal-200",
    gold: "border-yellow-300/15 bg-yellow-300/[0.08] text-yellow-200",
    blue: "border-sky-300/15 bg-sky-400/[0.08] text-sky-200",
  };

  return (
    <section className="mb-5" aria-label="学习快捷入口">
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <p className="text-sm font-bold text-white">现在开始</p>
          <p className="mt-1 text-[11px] text-white/35">选择一个入口，马上进入学习</p>
        </div>
        <Zap className="h-4 w-4 text-yellow-300/70" />
      </div>

      <div className="grid grid-cols-4 gap-2">
        {actions.map(({ label, detail, path, icon: Icon, tone }) => (
          <button
            key={path}
            type="button"
            onClick={() => navigate(path)}
            className="group flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.035] px-1.5 py-3 text-center transition active:scale-[0.97]"
          >
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${toneClasses[tone]}`}>
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="w-full truncate text-xs font-semibold text-white/85">{label}</span>
            <span className="w-full truncate text-[9px] text-white/30">{detail}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function TodaySentenceCard({
  sentence,
  reason,
  onNext,
  isSpeaking,
  onSpeak,
}) {
  if (!sentence) return null;
  return (
    <div className="group relative h-full overflow-hidden rounded-[26px] border border-white/[0.08] bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-yellow-300/[0.04] shadow-2xl shadow-black/20 backdrop-blur-2xl">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-white/[0.04] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-yellow-300/[0.05] blur-3xl" />
      <BangkokSkyline
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full opacity-[0.14]"
        opacity={0.7}
      />

      <div className="relative flex h-full flex-col rounded-[25px] bg-[#071817]/75 px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-yellow-300/15 bg-yellow-300/[0.08]">
              <Feather className="h-5 w-5 text-yellow-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">今日一句</h2>
              <p className="mt-0.5 text-xs text-white/30">{sentence.category}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSpeak?.(sentence.thai)}
            disabled={isSpeaking}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.04] text-white/70 transition hover:border-white/25 hover:text-white disabled:opacity-50"
            aria-label="朗读今日一句"
          >
            <Volume2 className={`h-4 w-4 ${isSpeaking ? "animate-pulse" : ""}`} />
          </button>
        </div>

        {reason ? (
          <p className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-emerald-200/70">
            💡 为什么给你看这句：{reason}
          </p>
        ) : null}

        <div className="mt-5 flex-1 space-y-1.5 text-center">
          {sentence.thai.split("\n").map((line, index) => (
            <p key={index} className="font-viaoda text-2xl leading-snug text-white sm:text-[26px]">
              {line}
            </p>
          ))}
        </div>

        {sentence.pronunciation ? (
          <p className="mt-3 text-center text-[13px] italic leading-relaxed text-emerald-200/60">
            {sentence.pronunciation}
          </p>
        ) : null}

        <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
          <div className="flex-1 space-y-1">
            {sentence.chinese.split("\n").map((line, index) => (
              <p key={index} className="text-center text-sm leading-6 text-white/50">
                {line}
              </p>
            ))}
          </div>
          {onNext ? (
            <button
              type="button"
              onClick={onNext}
              className="ml-4 flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-white/60 transition hover:border-white/25 hover:text-white"
              aria-label="换一句"
            >
              <RefreshCw className="h-3 w-3" />
              换一句
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ThaiTipCard({ daily }) {
  const navigate = useNavigate();

  /* 画像驱动版：优先用 daily（按等级/兴趣挑选），降级到按日期轮换的静态池 */
  const tip = daily?.tip || THAI_TIPS[new Date().getDate() % THAI_TIPS.length];
  const tipReason = daily?.reason?.tip || "";
  const reroll = () => daily?.reroll?.("tip");

  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = () => {
    if (!tip?.thai) return;
    setIsSpeaking(true);
    speakThai(tip.thai, {
      rate: 0.78,
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  return (
    <div className="relative h-full overflow-hidden rounded-[26px] border border-emerald-300/[0.08] bg-gradient-to-br from-emerald-400/[0.06] via-white/[0.02] to-transparent shadow-2xl shadow-black/20 backdrop-blur-2xl">
      <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-emerald-400/[0.07] blur-3xl" />

      <div className="relative flex h-full flex-col rounded-[25px] bg-[#071817]/75 px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300/15 bg-emerald-400/[0.08]">
              <span className="text-lg">{tip?.type || "💡"}</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">泰语小知识</h2>
              <p className="mt-0.5 text-xs text-white/30">{tip?.category}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {tip?.thai ? (
              <button
                type="button"
                onClick={speak}
                disabled={isSpeaking}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.04] text-white/70 transition hover:border-white/25 hover:text-white disabled:opacity-50"
                aria-label="朗读例句"
              >
                <Volume2 className={`h-4 w-4 ${isSpeaking ? "animate-pulse" : ""}`} />
              </button>
            ) : null}
            {reroll ? (
              <button
                type="button"
                onClick={reroll}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.04] text-white/70 transition hover:border-white/25 hover:text-white"
                aria-label="换一条小知识"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        {tipReason ? (
          <p className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-emerald-200/70">
            💡 为什么给你看这条：{tipReason}
          </p>
        ) : null}

        <h3 className="mt-4 text-[15px] font-bold leading-snug text-white">{tip?.title}</h3>
        <p className="mt-2 flex-1 text-[12.5px] leading-relaxed text-white/60">{tip?.content}</p>

        {tip?.thai ? (
          <div className="mt-4 rounded-2xl border border-white/[0.06] bg-black/30 px-4 py-3 text-center">
            <p className="font-viaoda text-[16px] leading-relaxed text-white/90">{tip.thai}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-white/45">{tip.chinese}</p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => navigate("/vocabulary")}
          className="mt-4 flex items-center justify-center gap-1.5 rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.08] py-2.5 text-[12px] font-bold text-emerald-200 transition hover:bg-emerald-400/[0.16]"
        >
          去词汇星球巩固 <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
