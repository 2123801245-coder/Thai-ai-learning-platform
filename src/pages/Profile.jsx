
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Trophy,
  BookOpen,
  Mic,
  Brain,
  Flame,
  Target,
  ChevronRight,
  CalendarDays,
  Clock3,
  Award,
  Star,
  Camera,
  Pencil,
  Check,
  X,
  Crown,
  PlayCircle,
  ShieldCheck,
  KeyRound,
  Share2,
  Download,
  Newspaper,
  ListChecks,
  Shuffle,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useAuth } from "@/lib/AuthContext";
import { useLearningProgress } from "@/hooks/useLearningProgress";
import AbilitySection from "@/components/dashboard/AbilitySection";
import SpeakingTrendChart from "@/components/charts/SpeakingTrendChart";
import { getAllCourseSummary } from "@/lib/courseProgress";
import { getLevelInfo } from "@/lib/level";
import { lessonData } from "@/data/lessons";
import { courses } from "@/data/courses";
import { getSpeakingHistory, getDailyAverages } from "@/lib/speakingHistory";
import VipPanel from "@/components/common/VipPanel";

import {
  ThaiCorner,
  LotusLineArt,
} from "@/components/common/ThaiDecor";

import { API_BASE_URL, SERVER_BASE_URL } from "@/lib/api";
import { getNewsListeningStats } from "@/api/newsListening";
import { getVocabQuizStats } from "@/api/vocabStats";
import { getAiTeacherMemory, updateAiTeacherMemory } from "@/api/aiTeacher";

const getAvatarUrl = (avatar) => {
  if (!avatar) return "/default-avatar.png";

  if (
    avatar.startsWith("http://") ||
    avatar.startsWith("https://") ||
    avatar.startsWith("data:")
  ) {
    return avatar;
  }

  return `${SERVER_BASE_URL}${
    avatar.startsWith("/") ? avatar : `/${avatar}`
  }`;
};

/* 最近学习时间描述 */
const formatRecentTime = (iso) => {
  if (!iso) return "最近";

  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);

  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;

  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} 小时前`;

  const days = Math.round(hours / 24);
  return `${days} 天前`;
};

const AI_LEVEL_LABEL = {
  beginner: "初级初学者",
  elementary: "初级",
  intermediate: "中级",
  advanced: "高级",
};

const AI_LEVEL_OPTIONS = [
  { value: "beginner", label: "初级初学者 (beginner)" },
  { value: "elementary", label: "初级 (elementary)" },
  { value: "intermediate", label: "中级 (intermediate)" },
  { value: "advanced", label: "高级 (advanced)" },
];

const AI_GENDER_OPTIONS = [
  { value: "", label: "未知" },
  { value: "男性（用ครับ）", label: "男生（ใช้ ครับ）" },
  { value: "女性（用ค่ะ）", label: "女生（ใช้ ค่ะ）" },
];

export default function Profile() {
  const {
    user: authUser,
    updateUser,
    updateAvatar,
    updateNickname,
  } = useAuth();

  const navigate = useNavigate();

  const [user, setUser] = useState(authUser || {});
  const [avatar, setAvatar] = useState(
    getAvatarUrl(authUser?.avatar)
  );

  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState(
    authUser?.nickname || ""
  );
  const [savingNickname, setSavingNickname] = useState(false);
  const [nicknameError, setNicknameError] = useState("");
  const [vipOpen, setVipOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // ============================================================
  // 新闻听力统计（每日新闻数 / 填空正确率 / 跟读平均分）
  // ============================================================

  const [newsStats, setNewsStats] = useState(null);
  const [newsStatsLoading, setNewsStatsLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const token = localStorage.getItem("token");
    if (!token) {
      setNewsStats(null);
      setNewsStatsLoading(false);
      return;
    }
    setNewsStatsLoading(true);
    getNewsListeningStats()
      .then((r) => {
        if (alive) setNewsStats(r.data || null);
      })
      .catch(() => {
        if (alive) setNewsStats(null);
      })
      .finally(() => {
        if (alive) setNewsStatsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // ============================================================
  // 词汇测验统计（错题本 / 生词本 / 词书 · 次数 / 正确率 / 最高分）
  // ============================================================

  const [vocabStats, setVocabStats] = useState(null);
  const [vocabStatsLoading, setVocabStatsLoading] = useState(false);
  // ============================================================
  // AI 老师记住的学生画像（名字 / 水平 / 兴趣 / 常见错误…）
  // ============================================================

  const [aiMem, setAiMem] = useState(null); // { hasMemory, memory, summary }
  const [aiMemLoading, setAiMemLoading] = useState(false);
  const [aiMemEdit, setAiMemEdit] = useState(false);
  const [aiMemSaving, setAiMemSaving] = useState(false);
  const [aiMemError, setAiMemError] = useState("");
  const [aiMemForm, setAiMemForm] = useState({
    studentName: "",
    genderHint: "",
    level: "",
    interests: "",
    goals: "",
    mistakes: "",
    preferences: "",
  });

  useEffect(() => {
    let alive = true;
    const token = localStorage.getItem("token");
    if (!token) {
      setVocabStats(null);
      setVocabStatsLoading(false);
      return;
    }
    setVocabStatsLoading(true);
    getVocabQuizStats()
      .then((r) => {
        if (alive) setVocabStats(r.data || null);
      })
      .catch(() => {
        if (alive) setVocabStats(null);
      })
      .finally(() => {
        if (alive) setVocabStatsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // 拉取 AI 老师学生画像
  useEffect(() => {
    let alive = true;
    const token = localStorage.getItem("token");
    if (!token) {
      setAiMem(null);
      setAiMemLoading(false);
      return;
    }
    setAiMemLoading(true);
    getAiTeacherMemory()
      .then((r) => {
        if (alive) setAiMem(r.data || null);
      })
      .catch(() => {
        if (alive) setAiMem(null);
      })
      .finally(() => {
        if (alive) setAiMemLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const fileInputRef = useRef(null);

  // ============================================================
  // 真实学习数据（localStorage 持久化）
  // ============================================================

  const { progress: learning } =
    useLearningProgress();

  const xp = learning?.xp || 0;
  const levelInfo = getLevelInfo(xp);

  const streak =
    learning?.learning_streak || 0;

  const totalVocab =
    learning?.total_vocabulary || 0;

  const accuracy =
    learning?.accuracy_rate || 0;

  const estMinutes = Math.round(
    totalVocab * 2
  );

  const dailyPct = Math.round(
    ((learning?.today_words || 0) /
      (learning?.daily_goal || 20)) *
      100
  );

  /* 口语练习统计 */
  const speakingHistory = useMemo(() => getSpeakingHistory(), []);
  const speakingStats = useMemo(() => {
    if (speakingHistory.length === 0) return null;
    const recent = speakingHistory.slice(-20);
    const avg = Math.round(recent.reduce((s, r) => s + (r.score || 0), 0) / recent.length);
    const avgAcc = Math.round(recent.reduce((s, r) => s + (r.accuracy || 0), 0) / recent.length);
    const avgTone = Math.round(recent.reduce((s, r) => s + (r.tone || 0), 0) / recent.length);
    const avgFlu = Math.round(recent.reduce((s, r) => s + (r.fluency || 0), 0) / recent.length);
    const avgComp = Math.round(recent.reduce((s, r) => s + (r.completeness || 0), 0) / recent.length);
    return { total: speakingHistory.length, avg, avgAcc, avgTone, avgFlu, avgComp };
  }, [speakingHistory]);
  const speakingTrend = useMemo(() => getDailyAverages(30), []);

  const courseSummary = useMemo(() => {
    const { completedCount, recent } =
      getAllCourseSummary();

    const courseTitleMap = {};
    courses.forEach((c) => {
      courseTitleMap[c.id] = c.title;
    });

    const lessonTitleMap = {};
    Object.entries(lessonData).forEach(
      ([courseId, lessons]) => {
        lessons.forEach((l) => {
          lessonTitleMap[l.id] = {
            courseId,
            title: l.title,
          };
        });
      }
    );

    let totalLessons = 0;
    Object.values(lessonData).forEach(
      (lessons) => {
        totalLessons += lessons.length;
      }
    );

    const recentList = recent.map((r) => {
      const lesson =
        lessonTitleMap[r.lessonId];

      return {
        courseId: r.courseId,
        lessonId: r.lessonId,
        title: lesson?.title || "课程视频",
        courseTitle:
          courseTitleMap[
            lesson?.courseId || r.courseId
          ] || "泰语课程",
        updatedAt: r.updatedAt,
      };
    });

    return {
      completedCount,
      totalLessons,
      progressPercent:
        totalLessons > 0
          ? Math.round(
              (completedCount / totalLessons) *
                100
            )
          : 0,
      recentList,
    };
  }, []);

  // ============================================================
  // 同步 AuthContext 用户
  // ============================================================

  useEffect(() => {
    if (!authUser) return;

    setUser(authUser);

    setAvatar(getAvatarUrl(authUser.avatar));

    setNicknameInput(authUser.nickname || "");
  }, [authUser]);

  // ============================================================
  // 获取用户信息
  // ============================================================

  useEffect(() => {
    const loadUser = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          const savedUser = JSON.parse(
            localStorage.getItem("user") || "{}"
          );

          setUser(savedUser);
          setAvatar(getAvatarUrl(savedUser.avatar));
          setNicknameInput(savedUser.nickname || "");

          return;
        }

        const response = await axios.get(
          `${API_BASE_URL}/auth/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const currentUser = response.data?.user || {};

        setUser(currentUser);
        setAvatar(getAvatarUrl(currentUser.avatar));
        setNicknameInput(currentUser.nickname || "");

        localStorage.setItem(
          "user",
          JSON.stringify(currentUser)
        );

        // 同步到 AuthContext
        if (updateUser) {
          updateUser(currentUser);
        }
      } catch (error) {
        console.error("获取用户信息失败:", error);

        const savedUser = JSON.parse(
          localStorage.getItem("user") || "{}"
        );

        setUser(savedUser);
        setAvatar(getAvatarUrl(savedUser.avatar));
        setNicknameInput(savedUser.nickname || "");
      }
    };

    loadUser();
  }, []);

  // ============================================================
  // 用户信息
  // ============================================================

  const nickname =
    user.nickname ||
    user.username ||
    "学习者";

  const email =
    user.email ||
    user.phone ||
    "未绑定账号";

  // ============================================================
  // 选择头像
  // ============================================================

  const handleSelectAvatar = () => {
    if (uploading) return;

    fileInputRef.current?.click();
  };

  // ============================================================
  // 上传头像
  // ============================================================

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setAvatarError("");

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

    if (!allowedTypes.includes(file.type)) {
      setAvatarError(
        "只允许 JPG、PNG、WEBP 或 GIF 图片"
      );

      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("头像图片不能超过 5MB");

      event.target.value = "";
      return;
    }

    try {
      setUploading(true);

      const token = localStorage.getItem("token");

      if (!token) {
        setAvatarError(
          "登录状态已失效，请重新登录"
        );
        return;
      }

      const formData = new FormData();

      formData.append(
        "avatar",
        file,
        file.name
      );

      const response = await axios.post(
        `${API_BASE_URL}/auth/avatar`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const avatarPath =
        response.data?.avatar;

      if (!avatarPath) {
        throw new Error(
          "服务器没有返回头像地址"
        );
      }

      const avatarUrl =
        getAvatarUrl(avatarPath);

      // ========================================================
      // 立即更新 Profile
      // ========================================================

      setAvatar(avatarUrl);

      const updatedUser = {
        ...user,
        avatar: avatarPath,
      };

      setUser(updatedUser);

      // ========================================================
      // 同步 localStorage
      // ========================================================

      localStorage.setItem(
        "user",
        JSON.stringify(updatedUser)
      );

      // ========================================================
      // 关键：同步 AuthContext
      // 让侧边栏头像立即更新
      // ========================================================

      if (updateAvatar) {
        updateAvatar(avatarPath);
      } else if (updateUser) {
        updateUser(updatedUser);
      }

      setAvatarError("");
    } catch (error) {
      console.error(
        "Avatar upload error:",
        error
      );

      console.error(
        "服务器返回:",
        error.response?.data
      );

      const message =
        error.response?.data?.message;

      setAvatarError(
        message ||
          "头像上传失败，请稍后重试"
      );
    } finally {
      setUploading(false);

      event.target.value = "";
    }
  };

  // ============================================================
  // 开始修改昵称
  // ============================================================

  const handleStartEditNickname = () => {
    setNicknameInput(nickname);
    setNicknameError("");
    setEditingNickname(true);
  };

  // ============================================================
  // 取消修改昵称
  // ============================================================

  const handleCancelNickname = () => {
    setNicknameInput(nickname);
    setNicknameError("");
    setEditingNickname(false);
  };

  // ============================================================
  // 保存昵称
  // ============================================================

  const handleSaveNickname = async () => {
    const newNickname =
      nicknameInput.trim();

    if (!newNickname) {
      setNicknameError("昵称不能为空");
      return;
    }

    if (newNickname.length > 20) {
      setNicknameError(
        "昵称不能超过 20 个字符"
      );
      return;
    }

    if (newNickname === nickname) {
      setEditingNickname(false);
      return;
    }

    try {
      setSavingNickname(true);
      setNicknameError("");

      const token =
        localStorage.getItem("token");

      if (!token) {
        setNicknameError(
          "登录状态已失效，请重新登录"
        );
        return;
      }

      // ========================================================
      // 兼容常见用户资料更新接口
      // ========================================================

      const response = await axios.put(
        `${API_BASE_URL}/auth/profile`,
        {
          nickname: newNickname,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const serverUser =
        response.data?.user;

      const updatedUser = {
        ...user,
        ...(serverUser || {}),
        nickname:
          serverUser?.nickname ||
          newNickname,
      };

      // ========================================================
      // 更新 Profile
      // ========================================================

      setUser(updatedUser);
      setNicknameInput(updatedUser.nickname);

      // ========================================================
      // 更新 localStorage
      // ========================================================

      localStorage.setItem(
        "user",
        JSON.stringify(updatedUser)
      );

      // ========================================================
      // 关键：同步 AuthContext
      // 侧边栏昵称会一起更新
      // ========================================================

      if (updateNickname) {
        updateNickname(
          updatedUser.nickname
        );
      } else if (updateUser) {
        updateUser(updatedUser);
      }

      setEditingNickname(false);
    } catch (error) {
      console.error(
        "昵称修改失败:",
        error
      );

      console.error(
        "服务器返回:",
        error.response?.data
      );

      const message =
        error.response?.data?.message;

      setNicknameError(
        message ||
          "昵称修改失败，请稍后重试"
      );
    } finally {
      setSavingNickname(false);
    }
  };

  // ============================================================
  // 头像加载失败
  // ============================================================

  const handleAvatarError = () => {
    setAvatar("/default-avatar.png");
  };

  // ============================================================
  // AI 老师画像：打开编辑 / 保存修正
  // ============================================================

  const openAiMemEdit = () => {
    const m = aiMem?.memory || {};
    setAiMemForm({
      studentName: m.studentName || "",
      genderHint: ["男性（用ครับ）", "女性（用ค่ะ）"].includes(m.genderHint)
        ? m.genderHint
        : "",
      level: m.level || "",
      interests: (m.interests || []).join("、"),
      goals: (m.goals || []).join("、"),
      mistakes: (m.mistakes || []).join("、"),
      preferences: (m.preferences || []).join("、"),
    });
    setAiMemError("");
    setAiMemEdit(true);
  };

  const saveAiMem = async () => {
    const splitArr = (str) =>
      (str || "")
        .split(/[，,、]/)
        .map((x) => x.trim())
        .filter(Boolean);
    const payload = {
      studentName: aiMemForm.studentName.trim(),
      genderHint: aiMemForm.genderHint,
      level: aiMemForm.level,
      interests: splitArr(aiMemForm.interests),
      goals: splitArr(aiMemForm.goals),
      mistakes: splitArr(aiMemForm.mistakes),
      preferences: splitArr(aiMemForm.preferences),
    };
    setAiMemSaving(true);
    setAiMemError("");
    try {
      const res = await updateAiTeacherMemory(payload);
      setAiMem(res.data || null);
      setAiMemEdit(false);
    } catch (err) {
      setAiMemError(
        err?.response?.data?.message || "保存失败，请稍后重试"
      );
    } finally {
      setAiMemSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">

      {/* ======================================================
          页面标题
      ====================================================== */}

      <motion.div
        initial={{
          opacity: 0,
          y: -12,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        className="relative"
      >
        {/* 莲花线稿（Lotus × Achievement 记忆点） */}

        <LotusLineArt
          className="pointer-events-none absolute -right-2 top-1/2 hidden h-14 w-20 -translate-y-1/2 opacity-[0.20] sm:block"
          opacity={0.9}
        />

        <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-emerald-300/70">
          <User className="h-4 w-4" />
          STUDENT PROFILE
        </div>

        <h1 className="mt-3 text-3xl font-black text-white">
          个人中心
        </h1>

        <p className="mt-2 text-sm text-white/40">
          查看你的泰语学习成长记录
        </p>
      </motion.div>

      {/* ======================================================
          学生身份卡
      ====================================================== */}

      <motion.div
        initial={{
          opacity: 0,
          y: 15,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.035] p-6 backdrop-blur-xl"
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/[0.10] blur-3xl" />

        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-yellow-400/[0.05] blur-3xl" />

        {/* 身份卡角饰（成就感的金色收边） */}

        <ThaiCorner
          corners={["tl", "br"]}
          size={26}
          className="z-10"
        />

        <div className="relative">

          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">

            {/* 用户 */}

            <div className="flex items-center gap-5">

              <div className="relative flex-shrink-0">

                <div className="absolute inset-0 rounded-full bg-emerald-400/20 blur-xl" />

                <button
                  type="button"
                  onClick={handleSelectAvatar}
                  disabled={uploading}
                  className="group relative block h-24 w-24 overflow-hidden rounded-full"
                >
                  <img
                    src={avatar}
                    alt="学生头像"
                    className="relative h-24 w-24 rounded-full border-2 border-emerald-300/40 object-cover shadow-xl shadow-emerald-900/30"
                    onError={
                      handleAvatarError
                    }
                  />

                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition group-hover:opacity-100">
                    <Camera className="h-6 w-6 text-white" />
                  </div>

                  {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    </div>
                  )}
                </button>

                <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#081412] bg-yellow-400">
                  <Star className="h-3.5 w-3.5 fill-white text-white" />
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={
                    handleAvatarChange
                  }
                  className="hidden"
                />
              </div>

              <div className="min-w-0">

                {/* 昵称 */}

                {!editingNickname ? (
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black text-white">
                      {nickname}
                    </h2>

                    <button
                      type="button"
                      onClick={
                        handleStartEditNickname
                      }
                      className="rounded-lg p-1.5 text-white/30 transition hover:bg-white/10 hover:text-emerald-300"
                      title="修改昵称"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">

                    <input
                      value={nicknameInput}
                      onChange={(e) =>
                        setNicknameInput(
                          e.target.value
                        )
                      }
                      maxLength={20}
                      autoFocus
                      className="w-48 rounded-xl border border-emerald-300/20 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/50"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSaveNickname();
                        }

                        if (e.key === "Escape") {
                          handleCancelNickname();
                        }
                      }}
                    />

                    <button
                      type="button"
                      onClick={
                        handleSaveNickname
                      }
                      disabled={
                        savingNickname
                      }
                      className="rounded-lg bg-emerald-400/10 p-2 text-emerald-300 transition hover:bg-emerald-400/20"
                    >
                      {savingNickname ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-300/30 border-t-emerald-300" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={
                        handleCancelNickname
                      }
                      disabled={
                        savingNickname
                      }
                      className="rounded-lg bg-white/5 p-2 text-white/40 transition hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {nicknameError && (
                  <p className="mt-2 text-xs text-red-400">
                    {nicknameError}
                  </p>
                )}

                <p className="mt-1 text-sm text-emerald-300/70">
                  泰语学习者
                </p>

                <div className="mt-3 flex items-center gap-2 text-sm text-white/40">
                  <Mail className="h-4 w-4 flex-shrink-0" />

                  <span className="truncate">
                    {email}
                  </span>
                </div>

                {/* VIP 状态 */}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {user.isVip ? (
                    <span className="flex items-center gap-1.5 rounded-full border border-yellow-300/25 bg-yellow-300/[0.08] px-3 py-1 text-[10px] font-bold text-yellow-300">
                      <Crown className="h-3 w-3" />
                      VIP 会员
                    </span>
                  ) : (
                    <button
                      onClick={() => setVipOpen(true)}
                      className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-medium text-white/40 transition hover:border-yellow-300/20 hover:text-yellow-200/70"
                    >
                      <Star className="h-3 w-3 text-yellow-300/50" />
                      免费版 · 了解 VIP 权益
                    </button>
                  )}

                  {user.isVip && user.vipExpiresAt && (
                    <button
                      onClick={() => setVipOpen(true)}
                      className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] text-white/35 transition hover:border-yellow-300/20 hover:text-yellow-200/70"
                    >
                      有效期至 {user.vipExpiresAt.slice(0, 10)}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={
                    handleSelectAvatar
                  }
                  disabled={uploading}
                  className="mt-3 text-xs text-emerald-300/70 transition hover:text-emerald-300"
                >
                  {uploading
                    ? "正在上传..."
                    : "点击头像更换头像"}
                </button>

                {avatarError && (
                  <p className="mt-2 text-xs text-red-400">
                    {avatarError}
                  </p>
                )}
              </div>
            </div>

            {/* 等级 */}

            <div className="rounded-2xl border border-yellow-300/10 bg-yellow-300/[0.04] px-5 py-4">

              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-400/10">
                  <Trophy className="h-5 w-5 text-yellow-300" />
                </div>

                <div>
                  <p className="text-[11px] text-white/30">
                    当前等级
                  </p>

                  <p className="text-xl font-black text-yellow-300">
                    Lv.{levelInfo.level}
                  </p>

                  <p className="mt-0.5 text-[10px] text-white/30">
                    {levelInfo.name}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* XP */}

          <div className="mt-7 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">

            <div className="flex items-center justify-between text-xs">
              <span className="text-white/40">
                学习经验值
              </span>

              <span className="font-semibold text-emerald-300">
                {xp.toLocaleString()} XP
              </span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                initial={{
                  width: 0,
                }}
                animate={{
                  width: `${levelInfo.percent}%`,
                }}
                transition={{
                  duration: 0.8,
                  ease: "easeOut",
                }}
                className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-emerald-400"
              />
            </div>

            <div className="mt-2 flex justify-between text-[11px] text-white/25">
              <span>
                Lv.{levelInfo.level} · {levelInfo.name}
              </span>

              <span>
                {levelInfo.next != null
                  ? `距离 Lv.${levelInfo.level + 1} 还需 ${(
                      levelInfo.next - xp
                    ).toLocaleString()} XP`
                  : "已达最高等级"}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ======================================================
          学习数据
      ====================================================== */}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">

        <ProfileStat
          icon={Flame}
          label="学习天数"
          value={streak}
          description="连续学习天数"
          highlight
        />

        <ProfileStat
          icon={BookOpen}
          label="掌握词汇"
          value={totalVocab}
          description="累计学习词数"
        />

        <ProfileStat
          icon={PlayCircle}
          label="完成视频"
          value={courseSummary.completedCount}
          description={`共 ${courseSummary.totalLessons} 节课程视频`}
        />

        <ProfileStat
          icon={Clock3}
          label="学习时长"
          value={estMinutes}
          description="分钟 · 按学习词数估算"
        />
      </div>

      {/* ======================================================
          新闻听力
      ====================================================== */}

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-emerald-300/70">
              <Newspaper className="h-3.5 w-3.5" />
              NEWS LISTENING
            </div>
            <h2 className="mt-1 font-bold text-white">
              新闻听力
            </h2>
            <p className="mt-0.5 text-xs text-white/30">
              每日 ThaiPBS 时事 · 听音填空 · 跟读评分
            </p>
          </div>
          {newsStatsLoading && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-300/30 border-t-emerald-300" />
          )}
        </div>

        {newsStats ? (
          <>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <ProfileStat
                icon={Newspaper}
                label="累计新闻"
                value={newsStats.totalNews}
                description="练习过的新闻篇数"
              />
              <ProfileStat
                icon={CalendarDays}
                label="今日新闻"
                value={newsStats.todayNews}
                description={`今日练习 ${newsStats.todaySessions} 次`}
              />
              <ProfileStat
                icon={Target}
                label="填空正确率"
                value={`${newsStats.clozeAccuracy}%`}
                description="听音填空累计正确率"
              />
              <ProfileStat
                icon={Mic}
                label="跟读平均分"
                value={newsStats.repeatAvg}
                description="跟读评分累计平均分"
              />
            </div>

            <NewsTrendChart daily={newsStats.daily || []} />

            {/* 最近练习 */}

            <div className="mt-5 space-y-2">
              {newsStats.recent?.length > 0 ? (
                newsStats.recent.slice(0, 4).map((item) => (
                  <RecentLearning
                    key={item.id}
                    icon={Newspaper}
                    title={item.newsTitle || "今日新闻"}
                    description={[
                      item.clozeTotal > 0
                        ? `填空 ${item.clozeCorrect}/${item.clozeTotal}`
                        : "",
                      item.repeatAvg != null
                        ? `跟读 ${item.repeatAvg} 分`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" · ") || "新闻听力练习"}
                    time={formatRecentTime(
                      item.createdAt?.replace(" ", "T") + "Z"
                    )}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] px-4 py-6 text-center">
                  <p className="text-xs text-white/30">
                    还没有新闻听力记录，去语料库选一篇今日新闻练起来吧
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] px-4 py-6 text-center">
            <p className="text-xs text-white/30">
              登录后同步你的新闻听力练习记录
            </p>
          </div>
        )}
      </motion.div>

      {/* ======================================================
          词汇测验
      ====================================================== */}

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-yellow-300/70">
              <ListChecks className="h-3.5 w-3.5" />
              VOCAB QUIZ
            </div>
            <h2 className="mt-1 font-bold text-white">
              词汇测验
            </h2>
            <p className="mt-0.5 text-xs text-white/30">
              错题本 · 生词本 · 词书测验
            </p>
          </div>
          {vocabStatsLoading && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-yellow-300/30 border-t-yellow-300" />
          )}
        </div>

        {vocabStats ? (
          <>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <ProfileStat
                icon={ListChecks}
                label="累计测验"
                value={vocabStats.totalSessions}
                description={`其中错题本复习 ${vocabStats.wrongSessions} 次`}
              />
              <ProfileStat
                icon={CalendarDays}
                label="今日测验"
                value={vocabStats.todaySessions}
                description="今天完成的测验轮数"
              />
              <ProfileStat
                icon={TrendingUp}
                label="平均正确率"
                value={`${vocabStats.accuracy}%`}
                description={`累计答对 ${vocabStats.correctQuestions}/${vocabStats.totalQuestions} 题`}
              />
              <ProfileStat
                icon={Trophy}
                label="最佳成绩"
                value={`${vocabStats.bestAccuracy}%`}
                description={`单轮 ${vocabStats.bestScore?.correct ?? 0}/${vocabStats.bestScore?.total ?? 0}`}
              />
            </div>

            {vocabStats.byType?.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {vocabStats.byType.map((t) => (
                  <span
                    key={t.type}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/50"
                  >
                    {t.label}
                    <span className="font-bold text-yellow-300/80">{t.count}</span>
                  </span>
                ))}
              </div>
            )}

            {/* 最近测验 */}

            <div className="mt-5 space-y-2">
              {vocabStats.recent?.length > 0 ? (
                vocabStats.recent.slice(0, 4).map((item) => (
                  <RecentLearning
                    key={item.id}
                    icon={item.source === "wrong" ? Shuffle : ListChecks}
                    title={`${item.sourceLabel} · ${item.quizTypeLabel}`}
                    description={`${item.difficultyLabel} · ${item.correct}/${item.total} 题 · 正确率 ${Math.round((item.correct / item.total) * 100)}%`}
                    time={formatRecentTime(
                      item.createdAt?.replace(" ", "T") + "Z"
                    )}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] px-4 py-6 text-center">
                  <p className="text-xs text-white/30">
                    还没有词汇测验记录，去词汇板块完成一轮测验吧
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] px-4 py-6 text-center">
            <p className="text-xs text-white/30">
              登录后同步你的词汇测验记录
            </p>
          </div>
        )}
      </motion.div>

      {/* ======================================================
          AI 老师记住的学生画像（可查看 / 手动修正）
      ====================================================== */}

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="rounded-3xl border border-violet-300/15 bg-gradient-to-br from-violet-300/[0.05] to-emerald-300/[0.04] p-5 backdrop-blur-xl"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-violet-300/70">
              <Brain className="h-3.5 w-3.5" />
              AI TEACHER MEMORY
            </div>
            <h2 className="mt-1 flex items-center gap-2 font-bold text-white">
              AI 老师记住的你
            </h2>
            <p className="mt-0.5 text-xs text-white/30">
              AI 老师在对话中了解的画像：可查看，也能手动修正
            </p>
          </div>

          {aiMemLoading && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-300/30 border-t-violet-300" />
          )}

          {!aiMemLoading && aiMem?.hasMemory && !aiMemEdit && (
            <button
              type="button"
              onClick={openAiMemEdit}
              className="flex items-center gap-1.5 rounded-xl border border-violet-300/20 bg-violet-300/[0.07] px-3 py-1.5 text-xs font-semibold text-violet-200/90 transition hover:bg-violet-300/[0.14]"
            >
              <Pencil className="h-3.5 w-3.5" />
              修正画像
            </button>
          )}
        </div>

        {aiMemLoading ? (
          <div className="px-2 py-4 text-xs text-white/30">正在加载画像…</div>
        ) : aiMemEdit ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-[11px] text-white/45">
                  <User className="h-3 w-3" /> 名字
                </span>
                <input
                  value={aiMemForm.studentName}
                  onChange={(e) => setAiMemForm((f) => ({ ...f, studentName: e.target.value }))}
                  maxLength={40}
                  placeholder="比如：李明"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-violet-300/40"
                />
              </label>

              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-[11px] text-white/45">
                  <span className="inline-block h-3 w-3" /> 水平评估
                </span>
                <select
                  value={aiMemForm.level}
                  onChange={(e) => setAiMemForm((f) => ({ ...f, level: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-violet-300/40"
                >
                  <option value="">未评估</option>
                  {AI_LEVEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-[11px] text-white/45">
                  <span className="inline-block h-3 w-3" /> 性别（礼貌词）
                </span>
                <select
                  value={aiMemForm.genderHint}
                  onChange={(e) => setAiMemForm((f) => ({ ...f, genderHint: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-violet-300/40"
                >
                  {AI_GENDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-[11px] text-white/45">
                  <span className="inline-block h-3 w-3" /> 学习兴趣
                </span>
                <input
                  value={aiMemForm.interests}
                  onChange={(e) => setAiMemForm((f) => ({ ...f, interests: e.target.value }))}
                  placeholder="美食、旅游、泰剧…（用逗号分隔）"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-violet-300/40"
                />
              </label>

              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-[11px] text-white/45">
                  <span className="inline-block h-3 w-3" /> 学习目标
                </span>
                <input
                  value={aiMemForm.goals}
                  onChange={(e) => setAiMemForm((f) => ({ ...f, goals: e.target.value }))}
                  placeholder="去泰国自由行、考取证书…（用逗号分隔）"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-violet-300/40"
                />
              </label>

              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-[11px] text-white/45">
                  <span className="inline-block h-3 w-3" /> 常见错误
                </span>
                <input
                  value={aiMemForm.mistakes}
                  onChange={(e) => setAiMemForm((f) => ({ ...f, mistakes: e.target.value }))}
                  placeholder="声调不准、ครับ/ค่ะ 不分…（用逗号分隔）"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-violet-300/40"
                />
              </label>
            </div>

            {aiMemError && <p className="text-xs text-red-400">{aiMemError}</p>}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={saveAiMem}
                disabled={aiMemSaving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-400/15 px-4 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-400/25 disabled:opacity-50"
              >
                {aiMemSaving ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-200/30 border-t-violet-200" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                保存
              </button>
              <button
                type="button"
                onClick={() => { setAiMemEdit(false); setAiMemError(""); }}
                disabled={aiMemSaving}
                className="rounded-xl bg-white/5 px-4 py-2 text-xs text-white/50 transition hover:bg-white/10 hover:text-white"
              >
                取消
              </button>
            </div>
          </div>
        ) : aiMem?.hasMemory ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3">
                <User className="mt-0.5 h-4 w-4 text-violet-300/70" />
                <div>
                  <p className="text-[10px] text-white/35">名字</p>
                  <p className="mt-0.5 text-sm font-semibold text-white">{aiMem.memory.studentName || "未告知"}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3">
                <Target className="mt-0.5 h-4 w-4 text-emerald-300/70" />
                <div>
                  <p className="text-[10px] text-white/35">水平评估</p>
                  <p className="mt-0.5 text-sm font-semibold text-white">
                    {aiMem.memory.level ? AI_LEVEL_LABEL[aiMem.memory.level] || aiMem.memory.level : "待评估"}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3">
                <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center text-[10px]">♂/♀</span>
                <div>
                  <p className="text-[10px] text-white/35">性别（礼貌词）</p>
                  <p className="mt-0.5 text-sm font-semibold text-white">{aiMem.memory.genderHint || "未知"}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3">
                <Star className="mt-0.5 h-4 w-4 text-yellow-300/70" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-white/35">学习目标</p>
                  {aiMem.memory.goals?.length ? (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {aiMem.memory.goals.slice(0, 6).map((g, i) => (
                        <span key={i} className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] text-white/70">{g}</span>
                      ))}
                    </div>
                  ) : (<p className="mt-0.5 text-sm font-semibold text-white/50">暂无</p>)}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3">
              <p className="text-[10px] text-white/35">学习兴趣</p>
              {aiMem.memory.interests?.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {aiMem.memory.interests.slice(0, 8).map((tag, i) => (
                    <span key={i} className="rounded-full border border-violet-300/15 bg-violet-300/[0.07] px-2 py-0.5 text-[11px] text-violet-100/80">{tag}</span>
                  ))}
                </div>
              ) : (<p className="mt-1 text-sm text-white/50">AI 老师还没了解到，多跟它聊聊吧</p>)}
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3">
              <p className="text-[10px] text-white/35">常见错误</p>
              {aiMem.memory.mistakes?.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {aiMem.memory.mistakes.slice(0, 8).map((m, i) => (
                    <span key={i} className="rounded-full border border-red-300/15 bg-red-300/[0.06] px-2 py-0.5 text-[11px] text-red-200/70">{m}</span>
                  ))}
                </div>
              ) : (<p className="mt-1 text-sm text-white/50">暂无常见错误记录</p>)}
            </div>

            {aiMem.memory.preferences?.length > 0 && (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3">
                <p className="text-[10px] text-white/35">表达偏好</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {aiMem.memory.preferences.slice(0, 8).map((tag, i) => (
                    <span key={i} className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] text-white/70">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] px-4 py-6 text-center">
            <p className="text-xs text-white/30">
              AI 老师会通过和你的对话逐渐了解你的名字、水平、兴趣与常见错误。
              多跟它聊聊，画像会自动更新；你也可以现在就手动填写。
            </p>
            <button
              type="button"
              onClick={openAiMemEdit}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-violet-400/10 px-4 py-2 text-xs font-semibold text-violet-200/90 transition hover:bg-violet-400/20"
            >
              <Pencil className="h-3.5 w-3.5" />
              手动填写画像
            </button>
          </div>
        )}
      </motion.div>


      {/* ======================================================
          学习能力 + 本周目标
      ====================================================== */}

      <div className="grid gap-5 lg:grid-cols-2">

        <motion.div
          initial={{
            opacity: 0,
            y: 15,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.08,
          }}
          className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-xl"
        >
          <div className="mb-5 flex items-center justify-between">

            <div>
              <h2 className="font-bold text-white">
                学习能力
              </h2>

              <p className="mt-1 text-xs text-white/30">
                当前学习进度
              </p>
            </div>

            <Brain className="h-5 w-5 text-emerald-300/50" />
          </div>

          <div className="space-y-5">

            <ProgressRow
              label="词汇掌握"
              value={accuracy}
            />

            <ProgressRow
              label="课程学习"
              value={courseSummary.progressPercent}
            />

            <ProgressRow
              label="今日目标"
              value={Math.min(100, dailyPct)}
            />

            <ProgressRow
              label="连续学习"
              value={Math.min(
                100,
                Math.round((streak / 30) * 100)
              )}
            />
          </div>
        </motion.div>

        <motion.div
          initial={{
            opacity: 0,
            y: 15,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.12,
          }}
          className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-xl"
        >
          <div className="mb-5 flex items-center justify-between">

            <div>
              <h2 className="font-bold text-white">
                本周学习目标
              </h2>

              <p className="mt-1 text-xs text-white/30">
                保持你的学习节奏
              </p>
            </div>

            <Target className="h-5 w-5 text-yellow-300/60" />
          </div>

          <div className="flex items-center gap-5">

            <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full border-4 border-emerald-400/20 bg-emerald-400/[0.04]">

              <div className="text-center">
                <div className="text-2xl font-black text-white">
                  72%
                </div>

                <div className="text-[10px] text-white/30">
                  已完成
                </div>
              </div>
            </div>

            <div className="space-y-3">

              <GoalItem
                icon={BookOpen}
                text="学习 100 个词汇"
                done="72 / 100"
              />

              <GoalItem
                icon={Mic}
                text="完成 10 次口语"
                done="6 / 10"
              />

              <GoalItem
                icon={CalendarDays}
                text="学习 7 天"
                done="5 / 7"
              />
            </div>
          </div>
        </motion.div>
      </div>

      {/* ======================================================
          学习成就
      ====================================================== */}

      <motion.div
        initial={{
          opacity: 0,
          y: 15,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          delay: 0.15,
        }}
        className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-xl"
      >
        <div className="mb-5 flex items-center justify-between">

          <div>
            <h2 className="font-bold text-white">
              学习成就
            </h2>

            <p className="mt-1 text-xs text-white/30">
              记录你的学习里程碑
            </p>
          </div>

          <div className="flex items-center gap-2">

            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-yellow-300/20 bg-yellow-300/[0.07] px-3 py-1.5 text-xs font-semibold text-yellow-200/90 transition hover:bg-yellow-300/[0.12]"
            >
              <Share2 className="h-3.5 w-3.5" />
              分享成就
            </button>

            <Award className="h-5 w-5 text-yellow-300/60" />

          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

          <Achievement
            icon="🔥"
            title="坚持不懈"
            description="连续学习 7 天"
            unlocked={streak >= 7}
          />

          <Achievement
            icon="📚"
            title="百词达人"
            description="掌握 100 个词汇"
            unlocked={totalVocab >= 100}
          />

          <Achievement
            icon="🎤"
            title="课程先锋"
            description="完成 10 节课程视频"
            unlocked={
              courseSummary.completedCount >= 10
            }
          />

          <Achievement
            icon="🏆"
            title="学习达人"
            description="累计学习 30 天"
            unlocked={streak >= 30}
          />

          <Achievement
            icon="⭐"
            title="词汇大师"
            description="掌握 500 个词汇"
            unlocked={totalVocab >= 500}
          />

          <Achievement
            icon="🎯"
            title="发音高手"
            description="正确率达到 90%"
            unlocked={accuracy >= 90}
          />

          <Achievement
            icon="🚀"
            title="全课通关"
            description="完成全部课程视频"
            unlocked={
              courseSummary.totalLessons > 0 &&
              courseSummary.completedCount >=
                courseSummary.totalLessons
            }
          />

          <Achievement
            icon="👑"
            title="VIP 会员"
            description="解锁全部高级功能"
            unlocked={!!authUser?.isVip}
          />
        </div>
      </motion.div>

      {/* ======================================================
          泰语能力评估（六维雷达 + 成长曲线）
      ====================================================== */}

      <AbilitySection />

      {/* ======================================================
          口语练习记录
      ====================================================== */}

      {speakingStats && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-white">口语练习记录</h2>
              <p className="mt-1 text-xs text-white/30">共 {speakingStats.total} 次练习</p>
            </div>
            <Mic className="h-5 w-5 text-cyan-300/50" />
          </div>

          {/* 四维均值 */}
          <div className="mb-4 grid grid-cols-5 gap-2">
            {[
              { label: "总分", value: speakingStats.avg, color: "text-white" },
              { label: "发音", value: speakingStats.avgAcc, color: "text-emerald-300" },
              { label: "声调", value: speakingStats.avgTone, color: "text-yellow-300" },
              { label: "流利度", value: speakingStats.avgFlu, color: "text-blue-300" },
              { label: "完整度", value: speakingStats.avgComp, color: "text-purple-300" },
            ].map((d) => (
              <div key={d.label} className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-2 py-2.5 text-center">
                <div className="text-[9px] text-white/25">{d.label}</div>
                <div className={`mt-0.5 text-base font-black ${d.color}`}>{d.value}</div>
              </div>
            ))}
          </div>

          {/* 趋势图 */}
          <SpeakingTrendChart data={speakingTrend} />

          {/* 最近 5 次练习 */}
          <div className="mt-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/20">最近练习</div>
            <div className="space-y-1.5">
              {speakingHistory.slice(-5).reverse().map((r, i) => {
                const sc = r.score >= 90 ? "text-emerald-300" : r.score >= 70 ? "text-yellow-300" : "text-red-300";
                const time = new Date(r.timestamp).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
                return (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/40">{time}</span>
                      <span className="text-[10px] text-white/25">{r.mode === "word" ? "单词" : r.mode === "sentence" ? "句子" : "段落"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-white/30">发音 {r.accuracy || "—"}</span>
                      <span className="text-[10px] text-white/30">声调 {r.tone || "—"}</span>
                      <span className={`text-sm font-black ${sc}`}>{r.score}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* ======================================================
          最近学习
      ====================================================== */}

      <motion.div
        initial={{
          opacity: 0,
          y: 15,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          delay: 0.18,
        }}
        className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-xl"
      >
        <div className="mb-5 flex items-center justify-between">

          <div>
            <h2 className="font-bold text-white">
              最近学习
            </h2>

            <p className="mt-1 text-xs text-white/30">
              最近的学习记录
            </p>
          </div>

          <Clock3 className="h-5 w-5 text-emerald-300/50" />
        </div>

        <div className="space-y-2">
          {courseSummary.recentList.length > 0 ? (
            courseSummary.recentList
              .slice(0, 4)
              .map((item) => (
                <RecentLearning
                  key={`${item.courseId}-${item.lessonId}`}
                  icon={PlayCircle}
                  title={item.title}
                  description={item.courseTitle}
                  time={formatRecentTime(
                    item.updatedAt
                  )}
                />
              ))
          ) : (
            <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] px-4 py-6 text-center">
              <p className="text-xs text-white/30">
                还没有学习记录，去观看一节课程视频吧
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* 管理员入口（仅管理员可见） */}

      {user.role === "admin" && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-3xl border border-yellow-300/15 bg-gradient-to-br from-yellow-300/[0.06] to-amber-500/[0.03] p-5 backdrop-blur-xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-white">
                管理工具
              </h2>
              <p className="mt-1 text-xs text-white/30">
                激活码管理（管理员专属）
              </p>
            </div>

            <ShieldCheck className="h-5 w-5 text-yellow-300/60" />
          </div>

          <button
            onClick={() => navigate("/admin/codes")}
            className="flex w-full items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-left transition hover:bg-white/[0.07]"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-300/[0.08]">
                <KeyRound className="h-4 w-4 text-yellow-300" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-white">
                  激活码管理
                </span>
                <span className="mt-0.5 block text-[10px] text-white/30">
                  批量生成、复制、导出 CSV
                </span>
              </span>
            </span>

            <ChevronRight className="h-4 w-4 text-white/25" />
          </button>
        </motion.div>
      )}

      {/* VIP 权益面板 */}

      <VipPanel
        open={vipOpen}
        onClose={() => setVipOpen(false)}
      />

      {/* 成就分享卡 */}

      <ShareCard
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        stats={{
          nickname: user?.nickname || authUser?.nickname || "泰语学习者",
          level: levelInfo?.name || `Lv.${levelInfo?.level || 1}`,
          streak,
          totalVocab,
          accuracy,
          completedCount: courseSummary.completedCount,
        }}
      />
    </div>
  );
}

// ============================================================
// 数据卡片
// ============================================================

// ============================================================
// 新闻听力 · 近 7 天趋势图（每日新闻数柱状 + 正确率折线）
// ============================================================

function NewsTrendChart({ daily = [] }) {
  // 后端 daily 只有“有记录”的天；这里按泰国时区补成连续 7 天，无记录补零
  const data = useMemo(() => {
    const byDate = {};
    for (const d of daily) byDate[d.date] = d;
    const now = new Date(Date.now() + 7 * 3600 * 1000);
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(now.getTime() - i * 86400000);
      const key = dt.toISOString().slice(0, 10);
      const rec = byDate[key];
      out.push({
        date: key,
        label: `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`,
        newsCount: rec ? rec.newsCount : 0,
        accuracy: rec && rec.clozeTotal > 0 ? rec.clozeAccuracy : null,
      });
    }
    return out;
  }, [daily]);

  const hasAny =
    data.some((d) => d.newsCount > 0) ||
    data.some((d) => d.accuracy != null);

  const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0]?.payload;
    return (
      <div className="rounded-xl border border-white/10 bg-[#0e1a17]/95 px-3 py-2 text-xs shadow-xl backdrop-blur-xl">
        <div className="mb-1 font-semibold text-white">{item?.date}</div>
        <div className="text-emerald-300">
          新闻 {item?.newsCount ?? 0} 篇
        </div>
        <div className="text-yellow-300">
          正确率{" "}
          {item?.accuracy != null ? `${item.accuracy}%` : "暂无填空数据"}
        </div>
      </div>
    );
  };

  if (!hasAny) {
    return (
      <div className="mt-5 rounded-2xl border border-white/[0.04] bg-white/[0.02] px-4 py-6 text-center">
        <p className="text-xs text-white/30">近 7 天还没有练习记录</p>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-medium text-white/45">
          近 7 天趋势
        </div>
        <div className="flex items-center gap-4 text-[10px] text-white/35">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-emerald-400/80" />
            新闻数
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-yellow-300/80" />
            正确率
          </span>
        </div>
      </div>
      <div className="h-[150px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 4, right: 0, left: -22, bottom: 0 }}
          >
            <CartesianGrid
              stroke="rgba(255,255,255,0.05)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
              axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="count"
              allowDecimals={false}
              tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="acc"
              orientation="right"
              domain={[0, 100]}
              tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
            />
            <Bar
              yAxisId="count"
              dataKey="newsCount"
              fill="rgba(52,211,153,0.75)"
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
            />
            <Line
              yAxisId="acc"
              type="monotone"
              dataKey="accuracy"
              stroke="#fbbf24"
              strokeWidth={2}
              dot={{
                r: 2.5,
                fill: "#fbbf24",
                strokeWidth: 0,
              }}
              activeDot={{ r: 4 }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ProfileStat({
  icon: Icon,
  label,
  value,
  description,
  highlight = false,
}) {
  return (
    <motion.div
      whileHover={{
        y: -3,
      }}
      transition={{
        duration: 0.2,
      }}
      className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between">

        <div
          className={
            highlight
              ? "flex h-9 w-9 items-center justify-center rounded-xl bg-orange-400/10"
              : "flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10"
          }
        >
          <Icon
            className={
              highlight
                ? "h-4 w-4 text-orange-300"
                : "h-4 w-4 text-emerald-300"
            }
          />
        </div>

        <ChevronRight className="h-3.5 w-3.5 text-white/15" />
      </div>

      <div className="mt-3">
        <div className="text-xl font-black text-white">
          {value}
        </div>

        <div className="mt-1 text-xs font-medium text-white/60">
          {label}
        </div>

        <div className="mt-1 text-[10px] text-white/25">
          {description}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// 学习进度
// ============================================================

function ProgressRow({
  label,
  value,
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">

        <span className="text-white/40">
          {label}
        </span>

        <span className="font-semibold text-emerald-300">
          {value}%
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">

        <motion.div
          initial={{
            width: 0,
          }}
          animate={{
            width: `${value}%`,
          }}
          transition={{
            duration: 0.8,
            ease: "easeOut",
          }}
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300"
        />
      </div>
    </div>
  );
}

// ============================================================
// 学习目标
// ============================================================

function GoalItem({
  icon: Icon,
  text,
  done,
}) {
  return (
    <div className="flex items-center gap-3">

      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04]">
        <Icon className="h-3.5 w-3.5 text-emerald-300/70" />
      </div>

      <div>
        <p className="text-xs text-white/60">
          {text}
        </p>

        <p className="mt-0.5 text-[10px] text-white/25">
          {done}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// 成就
// ============================================================

function Achievement({
  icon,
  title,
  description,
  unlocked = false,
}) {
  return (
    <div
      className={
        unlocked
          ? "rounded-2xl border border-yellow-300/10 bg-yellow-300/[0.035] p-4"
          : "rounded-2xl border border-white/[0.05] bg-white/[0.015] p-4 opacity-40"
      }
    >
      <div className="flex items-center gap-3">

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-xl">
          {icon}
        </div>

        <div className="min-w-0">

          <p className="truncate text-sm font-semibold text-white">
            {title}
          </p>

          <p className="mt-1 text-[10px] text-white/30">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 最近学习
// ============================================================

function RecentLearning({
  icon: Icon,
  title,
  description,
  time,
}) {
  return (
    <div className="group flex items-center justify-between rounded-2xl border border-white/[0.04] bg-white/[0.02] px-4 py-3 transition hover:bg-white/[0.04]">

      <div className="flex min-w-0 items-center gap-3">

        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-400/[0.06]">
          <Icon className="h-4 w-4 text-emerald-300/70" />
        </div>

        <div className="min-w-0">

          <p className="truncate text-sm font-medium text-white/70">
            {title}
          </p>

          <p className="mt-0.5 truncate text-[10px] text-white/25">
            {description}
          </p>
        </div>
      </div>

      <span className="ml-4 flex-shrink-0 text-[10px] text-white/20">
        {time}
      </span>
    </div>
  );
}




// ============================================================
// 成就分享卡（Canvas 绘制，可下载 PNG）
// ============================================================

function ShareCard({ open, onClose, stats }) {
  const canvasRef = useRef(null);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const w = 750;
    const h = 1000;
    canvas.width = w;
    canvas.height = h;

    // 背景
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#04110f");
    bg.addColorStop(0.55, "#0b241f");
    bg.addColorStop(1, "#04110f");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // 金色装饰线
    const gold = ctx.createLinearGradient(0, 0, w, 0);
    gold.addColorStop(0, "rgba(245,214,123,0)");
    gold.addColorStop(0.5, "rgba(245,214,123,0.7)");
    gold.addColorStop(1, "rgba(245,214,123,0)");
    ctx.fillStyle = gold;
    ctx.fillRect(60, 90, w - 120, 2);

    // Logo
    ctx.fillStyle = "#f5d67b";
    ctx.font = "700 52px 'PingFang SC', 'Noto Sans SC', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ThaiAI", w / 2, 70);

    // 泰文标语
    ctx.fillStyle = "rgba(245,214,123,0.85)";
    ctx.font = "400 30px 'Noto Serif Thai', 'Sarabun', serif";
    ctx.fillText("เรียนภาษาไทยทุกวัน", w / 2, 150);

    // 昵称 + 等级
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 46px 'PingFang SC', 'Noto Sans SC', sans-serif";
    ctx.fillText(stats.nickname, w / 2, 230);
    ctx.fillStyle = "#6ee7b7";
    ctx.font = "500 28px 'PingFang SC', sans-serif";
    ctx.fillText(stats.level + " · 泰语学习者", w / 2, 280);

    // 数据区
    const items = [
      ["连续学习", `${stats.streak} 天`],
      ["掌握词汇", `${stats.totalVocab} 个`],
      ["发音正确率", `${stats.accuracy}%`],
      ["完成课程", `${stats.completedCount} 节`],
    ];

    const cardW = w - 120;
    const startY = 340;
    const rowH = 130;

    items.forEach((item, i) => {
      const y = startY + i * rowH;
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.strokeStyle = "rgba(245,214,123,0.18)";
      ctx.lineWidth = 1;
      roundRect(ctx, 60, y, cardW, rowH - 16, 20);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "400 24px 'PingFang SC', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(item[0], 100, y + 62);

      ctx.fillStyle = "#f5d67b";
      ctx.font = "700 36px 'PingFang SC', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(item[1], w - 100, y + 62);
    });

    // 底部
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "400 24px 'PingFang SC', sans-serif";
    ctx.fillText("ThaiAI · 智慧学习每一天", w / 2, h - 60);
  };

  const roundRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  useEffect(() => {
    if (open) draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stats]);

  if (!open) return null;

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "thai-learning-achievement.png";
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-yellow-300/20 bg-[#071817]/95 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white">分享学习成就</h3>
            <p className="mt-0.5 text-xs text-white/35">
              生成专属学习成果图
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 预览卡（与 Canvas 视觉一致） */}

        <div className="mt-4 overflow-hidden rounded-2xl border border-yellow-300/15 bg-gradient-to-b from-[#04110f] via-[#0b241f] to-[#04110f] p-5 text-center">
          <div className="mx-auto h-px w-3/4 bg-gradient-to-r from-transparent via-yellow-300/60 to-transparent" />

          <div className="mt-3 text-2xl font-black text-yellow-300">
            ThaiAI
          </div>

          <div className="font-thai-serif mt-1 text-sm text-yellow-200/80">
            เรียนภาษาไทยทุกวัน
          </div>

          <div className="mt-3 text-lg font-bold text-white">
            {stats.nickname}
          </div>

          <div className="mt-1 text-xs text-emerald-300">
            {stats.level} · 泰语学习者
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              ["连续学习", `${stats.streak} 天`],
              ["掌握词汇", `${stats.totalVocab} 个`],
              ["发音正确率", `${stats.accuracy}%`],
              ["完成课程", `${stats.completedCount} 节`],
            ].map((item) => (
              <div
                key={item[0]}
                className="rounded-xl border border-yellow-300/15 bg-white/[0.03] px-3 py-2.5"
              >
                <div className="text-[10px] text-white/45">{item[0]}</div>
                <div className="mt-0.5 text-base font-bold text-yellow-300">
                  {item[1]}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-[10px] text-white/30">
            ThaiAI · 智慧学习每一天
          </div>
        </div>

        {/* 隐藏 canvas 用于导出 */}

        <canvas ref={canvasRef} className="hidden" />

        <button
          type="button"
          onClick={download}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-300 to-amber-400 py-2.5 text-sm font-bold text-[#172018] transition hover:-translate-y-0.5"
        >
          <Download className="h-4 w-4" />
          下载图片
        </button>
      </div>
    </div>
  );
}
