
import React from "react";
import { NavLink, useNavigate } from "react-router-dom";

import {
  Home,
  BookOpen,
  BookOpenText,
  Mic,
  Languages,
  MessageCircle,
  CalendarDays,
  Trophy,
  Settings,
  User,
  LogOut,
  ChevronRight,
  SpellCheck,
  Shuffle,
  FileText,
  Puzzle,
  Landmark,
} from "lucide-react";

import { useAuth } from "@/lib/AuthContext";
import { prefetchRoute } from "@/lib/routePrefetch";
import { useFeatureFlag } from "@/lib/features";
import { useLearningProgress } from "@/hooks/useLearningProgress";
import { getLevelInfo } from "@/lib/level";
import {
  ThaiDivider,
  ThaiRoof,
} from "@/components/common/ThaiMotifs";
import ThemeQuickSwitcher from "@/components/theme/ThemeQuickSwitcher";

import { SERVER_BASE_URL } from "@/lib/api";

export default function Sidebar() {
  const navigate = useNavigate();
  const aiTeacher = useFeatureFlag("aiTeacher");

  // ============================================================
  // 使用 AuthContext
  // 保证 Profile 修改头像 / 昵称后 Sidebar 立即同步
  // ============================================================

  const { user, logout } = useAuth();

  // ============================================================
  // 真实学习数据（localStorage 持久化）
  // ============================================================

  const { progress: learning } =
    useLearningProgress();

  const xp = learning?.xp || 0;
  const levelInfo = getLevelInfo(xp);

  // ============================================================
  // 头像地址
  // ============================================================

  const getAvatarUrl = (avatar) => {
    if (!avatar) {
      return "/default-avatar.png";
    }

    if (
      avatar.startsWith("http://") ||
      avatar.startsWith("https://") ||
      avatar.startsWith("data:")
    ) {
      return avatar;
    }

    if (avatar.startsWith("/")) {
      return `${SERVER_BASE_URL}${avatar}`;
    }

    return `${SERVER_BASE_URL}/${avatar}`;
  };

  const avatarUrl = getAvatarUrl(user?.avatar);

  // ============================================================
  // 菜单
  // ============================================================

  const menus = [
    {
      name: "首页",
      path: "/",
      icon: Home,
    },
    ...(aiTeacher
      ? [
          {
            name: "对话练习",
            path: "/conversation",
            icon: MessageCircle,
          },
        ]
      : []),
    {
      name: "课程学习",
      path: "/course",
      icon: BookOpen,
    },
    {
      name: "口语练习",
      path: "/speaking",
      icon: Mic,
    },
    {
      name: "课文教学",
      path: "/lessons",
      icon: BookOpenText,
    },
    {
      name: "词汇学习",
      path: "/vocabulary",
      icon: Languages,
    },
    {
      name: "字母表",
      path: "/alphabet",
      icon: SpellCheck,
    },
    {
      name: "词汇配对",
      path: "/vocab-match",
      icon: Shuffle,
    },
    {
      name: "句子填空",
      path: "/sentence-fill",
      icon: FileText,
    },
    {
      name: "分词练习",
      path: "/word-segment",
      icon: Puzzle,
    },
    {
      name: "本地语料库",
      path: "/corpus",
      icon: BookOpenText,
    },
    {
      name: "泰国文化",
      path: "/culture",
      icon: Landmark,
    },
    {
      name: "学习计划",
      path: "/plan",
      icon: CalendarDays,
    },
    {
      name: "学习排行榜",
      path: "/ranking",
      icon: Trophy,
    },
    {
      name: "设置中心",
      path: "/settings",
      icon: Settings,
    },
  ];

  // ============================================================
  // 头像加载失败
  // ============================================================

  const handleAvatarError = (event) => {
    if (
      event.currentTarget.dataset.fallback === "true"
    ) {
      return;
    }

    event.currentTarget.dataset.fallback = "true";
    event.currentTarget.src = "/default-avatar.png";
  };

  // ============================================================
  // 退出登录
  // ============================================================

  const handleLogout = () => {
    if (typeof logout === "function") {
      logout();
      return;
    }

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/login");
  };

  return (
    <aside
      className="
        hidden
        md:flex

        fixed
        left-0
        top-0
        bottom-0

        w-[220px]

        z-50

        flex-col

        px-5
        py-6

        overflow-hidden

        bg-[#121e24]/92

        backdrop-blur-2xl

        theme-sidebar

        border-r
        border-white/[0.08]

        shadow-[20px_0_60px_rgba(0,0,0,0.25)]
      "
    >

      {/* ========================================================
          背景装饰
      ======================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          -top-32
          -left-20
          w-64
          h-64
          rounded-full
          bg-emerald-400/[0.06]
          blur-3xl
        "
      />

      <div
        className="
          pointer-events-none
          absolute
          bottom-20
          -right-32
          w-72
          h-72
          rounded-full
          bg-[#b8844a]/[0.03]
          blur-3xl
        "
      />

      {/* 底部泰式屋顶剪影（极淡装饰） */}

      <ThaiRoof
        className="
          pointer-events-none
          absolute
          -bottom-4
          right-4
          w-36
          opacity-60
        "
        opacity={0.07}
      />

      {/* ========================================================
          Logo
      ======================================================== */}

      <div className="relative mb-9">

        <div
          className="
            flex
            items-center
            gap-2.5
          "
        >

          {/* 品牌 Logo：泰式尖顶 + 金色光环 + AI 核心 */}

          <div className="relative">

            {/* 外发光 */}

            <div className="absolute inset-[-6px] rounded-2xl bg-emerald-400/15 blur-lg breathe" />

            {/* 旋转金色光环 */}

            <div className="absolute inset-[-9px] rounded-[18px] border border-emerald-300/25 ring-spin">
              <span className="absolute -top-[3px] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(200,145,74,0.9)]" />
            </div>

            <div
              className="
                relative
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-2xl

                border
                border-emerald-300/20

                bg-gradient-to-br
                from-emerald-400/20
                via-[#8a5e30]/10
                to-[#050A14]

                shadow-lg
                shadow-emerald-400/15
              "
            >
              {/* 泰式尖顶装饰 */}

              <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full" fill="none">
                <path
                  d="M 20 6 L 34 12 L 33 14 L 20 9.5 L 7 14 L 6 12 Z"
                  fill="#F5D67B"
                  opacity="0.5"
                />
                <path
                  d="M 20 10 L 31 15 L 30 17 L 20 13 L 10 17 L 9 15 Z"
                  fill="#F5D67B"
                  opacity="0.3"
                />
              </svg>

              <span className="relative text-sm font-black text-white/90">ไทย</span>

              {/* 核心光点 */}

              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(200,145,74,0.9)]" />
            </div>

          </div>

          <h1              className="
              text-3xl
              font-black

              tracking-tight

              gold-gradient-text

              drop-shadow-[0_0_18px_rgba(200,145,74,0.2)]
              
            "
          >
            ThaiAI
          </h1>

        </div>

        <p
          className="
            mt-3
            pl-1
            text-[11px]
            leading-relaxed
            tracking-wide
            text-white/35
          "
        >
          AI 泰语老师 · 智慧学习每一天
        </p>

        {/* 泰式纹样分隔线 */}

        <ThaiDivider compact className="mt-4" />

        {/* 快捷主题切换 */}

        <div className="mt-3 flex items-center justify-between gap-2 pl-1">
          <span className="theme-quick-label text-[9px] font-bold tracking-[0.18em] text-white/30">主题</span>
          <ThemeQuickSwitcher compact />
        </div>

      </div>

      {/* ========================================================
          Menu
      ======================================================== */}

      <nav
        className="
          relative
          flex-1
          space-y-2
          overflow-y-auto
          pr-1

          scrollbar-thin
          scrollbar-thumb-white/10
        "
      >

        {menus.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onMouseEnter={() => prefetchRoute(item.path)}
              className={({ isActive }) => `
                group
                relative

                flex
                items-center
                gap-3.5

                px-3.5
                py-3

                rounded-2xl

                border

                transition-all
                duration-200

                ${
                  isActive
                    ? `
                      border-emerald-300/15

                      premium-glass-strong

                      text-white

                      shadow-[0_8px_30px_rgba(180,120,60,0.1)]
                    `
                    : `
                      border-transparent

                      text-white/55

                      hover:border-white/[0.05]

                      hover:bg-white/[0.045]

                      hover:text-white

                      hover:translate-x-[2px]
                    `
                }
              `}
            >

              {/* 当前页面指示条 */}

              <span
                className={`
                  absolute
                  left-0
                  top-1/2

                  h-6
                  w-[3px]

                  -translate-y-1/2

                  rounded-r-full

                  bg-emerald-400

                  shadow-[0_0_12px_rgba(200,145,74,0.6)]

                  transition-opacity
                  duration-200

                  ${
                    item.path
                      ? "group-[.active]:opacity-100"
                      : "opacity-0"
                  }
                `}
              />

              <div
                className="
                  flex
                  h-9
                  w-9
                  flex-shrink-0
                  items-center
                  justify-center
                  rounded-xl

                  bg-white/[0.035]

                  transition-all
                  duration-200

                  group-hover:bg-white/[0.07]
                "
              >

                <Icon
                  className="
                    h-[18px]
                    w-[18px]

                    transition-transform
                    duration-200

                    group-hover:scale-105
                  "
                />

              </div>

              <span
                className="
                  flex-1

                  text-[13px]
                  font-medium
                "
              >
                {item.name}
              </span>

              {item.name === "口语练习" && (
                <span
                  className="
                    rounded-full
                    border
                    border-yellow-300/25

                    bg-yellow-300/[0.08]

                    px-1.5
                    py-0.5

                    text-[9px]
                    font-semibold

                    text-yellow-200/80
                  "
                >
                  部分免费
                </span>
              )}

              {item.name === "课文教学" && (
                <span
                  className="
                    rounded-full
                    border
                    border-yellow-300/25

                    bg-yellow-300/[0.08]

                    px-1.5
                    py-0.5

                    text-[9px]
                    font-semibold

                    text-yellow-200/80
                  "
                >
                  VIP
                </span>
              )}

              <ChevronRight
                className="
                  h-3.5
                  w-3.5

                  opacity-0

                  -translate-x-1

                  transition-all
                  duration-200

                  group-hover:translate-x-0
                  group-hover:opacity-30
                "
              />

            </NavLink>
          );
        })}

      </nav>

      {/* ========================================================
          User Card
      ======================================================== */}

      <div
        className={`
          relative
          mt-4

          overflow-hidden

          rounded-3xl

          ${user?.isVip ? "premium-glass-gold" : "premium-glass"}

          p-4
        `}
      >

        {/* 卡片顶部光晕 */}

        <div
          className="
            pointer-events-none
            absolute
            -right-10
            -top-10

            h-28
            w-28

            rounded-full                bg-emerald-400/[0.06]

            blur-2xl
          "
        />

        {/* ======================================================
            User
        ====================================================== */}

        <div
          className="
            relative

            flex
            items-center
            gap-3
          "
        >

          {/* Avatar */}

          <div
            className="
              relative
              flex-shrink-0
            "
          >

            <div
              className="
                absolute
                inset-[-4px]

                rounded-full

                bg-emerald-400/12

                blur-md
              "
            />

            <img
              src={avatarUrl}
              alt="用户头像"
              onError={handleAvatarError}
              className="
                relative

                h-12
                w-12

                rounded-full

                border-2
                border-emerald-300/30

                bg-[#121e24]

                object-cover

                shadow-lg
                shadow-[#121e24]/30
              "
            />

            {/* 在线状态 */}

            <span
              className="
                absolute
                bottom-0
                right-0

                h-3
                w-3

                rounded-full

                border-2 border-[#121e24]
                bg-emerald-400

                shadow-[0_0_8px_rgba(200,145,74,0.8)]
              "
            />

          </div>

          {/* Name */}

          <div className="min-w-0">

            <div
              className="
                truncate

                text-sm
                font-bold

                text-white
              "
            >
              {user?.nickname || "学生"}
            </div>

            <div
              className="
                mt-1

                flex
                items-center
                gap-1.5

                text-[10px]

                text-white/35
              "
            >
              <span
                className="
                  rounded-md

                  bg-yellow-300/10

                  px-1.5
                  py-0.5

                  text-yellow-300/80
                "
              >
                Lv.{levelInfo.level}
              </span>

              <span>
                {levelInfo.name}
              </span>
            </div>

          </div>

        </div>

        {/* ======================================================
            XP
        ====================================================== */}

        <div className="relative mt-4">

          <div
            className="
              mb-2

              flex
              items-center
              justify-between

              text-[10px]
            "
          >

            <span className="text-white/35">
              学习经验值
            </span>

            <span className="font-semibold text-emerald-300/80">
              {levelInfo.percent}%
            </span>

          </div>

          <div
            className="
              h-1.5

              overflow-hidden

              rounded-full                  bg-white/[0.07]
            "
          >

            <div
              className="
                h-full

                rounded-full

                bg-gradient-to-r
                from-[#c8914a]
                via-[#b8844a]
                to-[#a07040]

                shadow-[0_0_10px_rgba(200,145,74,0.3)]
              "
              style={{ width: `${levelInfo.percent}%` }}
            />

          </div>

          <div
            className="
              mt-2

              flex
              justify-between

              text-[9px]

              text-white/20
            "
          >

            <span>
              {xp.toLocaleString()} XP
            </span>

            <span>
              {levelInfo.next != null
                ? `${levelInfo.next.toLocaleString()} XP`
                : "MAX"}
            </span>

          </div>

        </div>

        {/* ======================================================
            Profile Button
        ====================================================== */}

        <button
          type="button"
          onClick={() => navigate("/profile")}
          className="
            relative

            mt-4

            flex
            w-full
            items-center
            justify-center
            gap-2

            overflow-hidden

            rounded-xl

            border
            border-yellow-300/20

            bg-gradient-to-r
            from-emerald-400/[0.12]
            to-[#8a5e30]/[0.08]

            py-2.5

            text-xs
            font-semibold

            text-white

            transition-all
            duration-200

            hover:border-yellow-300/30

            hover:from-emerald-400/[0.2]
            hover:to-[#8a5e30]/[0.15]

            hover:shadow-lg
            hover:shadow-emerald-400/10

            active:scale-[0.98]
          "
        >

          <User className="h-3.5 w-3.5" />

          个人中心

        </button>

        {/* ======================================================
            Logout
        ====================================================== */}

        <button
          type="button"
          onClick={handleLogout}
          className="
            mt-2.5

            flex
            w-full
            items-center
            justify-center
            gap-2

            rounded-xl

            border
            border-transparent

            py-2

            text-[11px]

            text-white/30

            transition-all
            duration-200

            hover:border-red-400/10
            hover:bg-red-400/[0.06]
            hover:text-red-300/80
          "
        >

          <LogOut className="h-3.5 w-3.5" />

          退出登录

        </button>

      </div>

    </aside>
  );
}

