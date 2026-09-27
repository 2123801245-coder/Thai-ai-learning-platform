// src/pages/Course.jsx
// =========================================================
// ThaiAI 泰语视频学习库
// =========================================================

import React, { useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { AccordionPanel } from "@/components/ui/accordion";
import {
  Play,
  Pause,
  Clock3,
  ChevronRight,
  Sparkles,
  Target,
  Flame,
  GraduationCap,
  Lock,
  Crown,
  Video,
  BookOpen,
  X,
  Volume2,
  VolumeX,
  Maximize,
  CheckCircle2,
  ListVideo,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/lib/AuthContext";
import VipPanel from "@/components/common/VipPanel";
import {
  ThaiCorner,
  ThaiSectionDivider,
  BangkokSkyline,
} from "@/components/common/ThaiDecor";

import {
  videoCategories,
  videos,
  getVideosByCategory,
  getFreeVideos,
  isEmbeddedSource,
  bilibiliWatchUrl,
} from "@/data/videoLibrary";
import { isVideoLocked } from "@/lib/entitlements";
import { API_BASE_URL } from "@/lib/api";
import SentenceStudy from "@/components/video/SentenceStudy";

// PAPER 世界的课程页版式层（“高级泰语教材”）。
// 在这里 import 而不是塞进 index.css：这一层只服务课程页，跟着本页的
// CSS chunk 一起加载/失效；文件内每条规则都带 html[data-visual-mode="paper"]
// 前缀，另外三个世界匹配不到，等于不存在。
import "@/themes/course-paper.css";


// =========================================================
// localStorage 进度 Key
// =========================================================

function getProgressKey(videoId) {
  return `thaiai_video_progress_${videoId}`;
}

function getProgress(videoId) {
  try {
    return parseInt(localStorage.getItem(getProgressKey(videoId)) || "0", 10);
  } catch {
    return 0;
  }
}

function saveProgress(videoId, pct) {
  try {
    localStorage.setItem(getProgressKey(videoId), String(Math.min(100, pct)));
  } catch {}
}


// =========================================================
// 播放速度选项
// =========================================================

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];


// =========================================================
// YouTube IFrame API（懒加载）
// =========================================================

let ytApiPromise = null;

function loadYouTubeApi() {
  if (typeof window !== "undefined" && window.YT?.Player) {
    return Promise.resolve();
  }
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    tag.onerror = () => {
      ytApiPromise = null;
      reject(new Error("YouTube API 加载失败"));
    };
    document.head.appendChild(tag);
  });

  return ytApiPromise;
}


// =========================================================
// B 站官方播放器（站外嵌入）
// =========================================================
// 为什么用 iframe 而不是自己拉流：视频始终在 B 站播放，播放量、弹幕、投币
// 都留在原作者与原站那边，本站既不下载也不转码 —— 这是风险最低的用法，
// 下架也只需删掉 videoLibrary.js 里那一条。
//
// 参数（官方文档：player.bilibili.com/ 的 QueryString 表）：
//   danmaku=0 默认关弹幕、autoplay=0 不抢用户操作、poster=1 先显示封面。
//   high_quality=1 / as_wide=1 是未写入文档但流传很广的两个参数，
//   留着无害（对已登录或第三方 cookie 放开的浏览器可能生效），但**不要**
//   指望它拉高清晰度 —— 实测结论见下。
//
// ⚠️ 清晰度上限是 B 站的，不是我们的：实测（未登录 cookie 的浏览器）
//   播放器发出的 playurl 是 qn=0（自动），实际解码分辨率 640×360；
//   `realQ=16`。播放器自带的清晰度菜单显示：
//     1080P 高清（登录即享）/ 720P 高清（登录即享）/ 480P 清晰（登录即享）/ 360P
//   点 720P 只会弹登录提示，realQ 仍是 16（已实测）。官方外链参数表里
//   **根本没有清晰度参数**，所以站外无法把默认清晰度改高，匿名访客就只能 360P。
//   要真正“拉高”，只有两条正路：① 用原片上源（见 videoLibrary 的 youtubeId
//   双源，可上 1080P）；② 自己制作/自有版权的视频（那才完全可控）。
//   绝不用第三方“解析接口”去破解会员清晰度 —— 那是绕过 B 站的访问控制，
//   侵权风险正好是我们要避开的东西。
//
// 播放进度拿不到（B 站没给站外的进度回传），所以这一类条目不计入
// 「已观看」统计 —— 不编造数据比统计好看更重要。

function BilibiliPlayer({ bvid, title }) {
  const src = useMemo(
    () =>
      `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(
        bvid
      )}&page=1&high_quality=1&danmaku=0&autoplay=0&as_wide=1&poster=1`,
    [bvid]
  );

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-black">
      <iframe
        src={src}
        title={`${title}（哔哩哔哩）`}
        className="absolute inset-0 h-full w-full"
        frameBorder="0"
        scrolling="no"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}


// =========================================================
// YouTube 播放器组件
// =========================================================

function YouTubePlayer({ videoId, onProgress, onEnded }) {
  const containerRef = React.useRef(null);
  const playerRef = React.useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [speed, setSpeed] = useState(1);
  const [showSpeed, setShowSpeed] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  React.useEffect(() => {
    let destroyed = false;

    loadYouTubeApi().then(() => {
      if (destroyed || !containerRef.current) return;

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          autoplay: 0,
          rel: 0,
          modestbranding: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          playsinline: 1,
        },
        events: {
          onReady: () => setIsReady(true),
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
            } else if (
              e.data === window.YT.PlayerState.PAUSED ||
              e.data === window.YT.PlayerState.ENDED
            ) {
              setIsPlaying(false);
            }
            if (e.data === window.YT.PlayerState.ENDED) {
              onEnded?.();
            }
          },
        },
      });
    });

    return () => {
      destroyed = true;
      try {
        playerRef.current?.destroy();
      } catch {}
    };
  }, [videoId]);

  // 进度轮询
  React.useEffect(() => {
    if (!isReady) return;
    const iv = setInterval(() => {
      try {
        const p = playerRef.current;
        if (!p?.getCurrentTime) return;
        const ct = p.getCurrentTime();
        const dur = p.getDuration();
        setCurrentTime(ct);
        setDuration(dur);
        if (dur > 0) {
          onProgress?.(Math.round((ct / dur) * 100));
        }
      } catch {}
    }, 2000);
    return () => clearInterval(iv);
  }, [isReady, onProgress]);

  const togglePlay = useCallback(() => {
    try {
      if (isPlaying) playerRef.current?.pauseVideo();
      else playerRef.current?.playVideo();
    } catch {}
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    try {
      if (isMuted) playerRef.current?.unMute();
      else playerRef.current?.mute();
      setIsMuted(!isMuted);
    } catch {}
  }, [isMuted]);

  const handleVolume = useCallback((v) => {
    try {
      playerRef.current?.setVolume(v);
      setVolume(v);
      if (v > 0 && isMuted) {
        playerRef.current?.unMute();
        setIsMuted(false);
      }
    } catch {}
  }, [isMuted]);

  const handleSpeed = useCallback((s) => {
    try {
      playerRef.current?.setPlaybackRate(s);
      setSpeed(s);
      setShowSpeed(false);
    } catch {}
  }, []);

  const seekTo = useCallback((pct) => {
    try {
      const dur = playerRef.current?.getDuration();
      if (dur) playerRef.current?.seekTo((pct / 100) * dur, true);
    } catch {}
  }, []);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="tp-paper-player relative rounded-2xl overflow-hidden bg-black border border-white/[0.06]">
      {/* YouTube iframe 容器 */}
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <div ref={containerRef} className="absolute inset-0" />
      </div>

      {/* 自定义控制栏 */}
      <div className="relative bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-4 pt-16 -mt-16">
        {/* 进度条 */}
        <div
          className="group/progress relative h-1.5 rounded-full bg-white/10 cursor-pointer mb-3 hover:h-2.5 transition-all"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = ((e.clientX - rect.left) / rect.width) * 100;
            seekTo(pct);
          }}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-emerald-400 opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-lg"
            style={{ left: `calc(${progress}% - 6px)` }}
          />
        </div>

        {/* 控制按钮 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* 播放/暂停 */}
            <button
              onClick={togglePlay}
              className="apple-button flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>

            {/* 音量 */}
            <div className="flex items-center gap-2 group/vol">
              <button
                onClick={toggleMute}
                className="apple-button text-white/60 transition hover:text-white"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolume(Number(e.target.value))}
                className="w-0 group-hover/vol:w-20 transition-all accent-emerald-400 h-1 cursor-pointer"
              />
            </div>

            {/* 时间 */}
            <span className="text-xs text-white/50 font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* 倍速 */}
            <div className="relative">
              <button
                onClick={() => setShowSpeed(!showSpeed)}
                className="apple-button rounded bg-white/5 px-2 py-1 text-xs text-white/50 transition hover:text-white"
              >
                {speed}x
              </button>
              {showSpeed && (
                <div className="absolute bottom-full right-0 mb-2 bg-[#0a1a17] border border-white/10 rounded-xl p-2 flex flex-col gap-1 z-50">
                  {SPEED_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSpeed(s)}
                      className={`apple-button rounded-xl px-3 py-1.5 text-xs transition ${
                        speed === s
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "text-white/50 hover:bg-white/5 hover:text-white"
                      }`}                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// =========================================================
// 统计卡片
// =========================================================

function StatCard({ icon: Icon, label, value, suffix, color = "emerald" }) {
  const colorMap = {
    emerald: "text-emerald-300 bg-emerald-400/[0.07] border-emerald-300/10",
    yellow: "text-yellow-300 bg-yellow-400/[0.07] border-yellow-300/10",
    cyan: "text-cyan-300 bg-cyan-400/[0.07] border-cyan-300/10",
    purple: "text-purple-300 bg-purple-400/[0.07] border-purple-300/10",
  };

  return (
    <div
      className={`tp-paper-statcard rounded-2xl border p-4 backdrop-blur-xl ${colorMap[color]}`}
    >
      <div className="flex items-center gap-3">
        <div className="tp-paper-statcard-icon w-10 h-10 rounded-xl flex items-center justify-center bg-white/[0.04]">
          <Icon className="h-5 w-5 opacity-70" />
        </div>
        <div>
          <div className="tp-paper-statcard-label text-[10px] uppercase tracking-widest opacity-40">
            {label}
          </div>
          <div className="tp-paper-statcard-value text-xl font-black mt-0.5">
            {value}
            {suffix && (
              <span className="text-xs font-normal opacity-50 ml-1">
                {suffix}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// =========================================================
// 视频卡片
// =========================================================

function VideoCard({ video, index, isVipUser, onPlay, isActive }) {
  const [localProgress, setLocalProgress] = useState(() =>
    getProgress(video.id)
  );

  React.useEffect(() => {
    setLocalProgress(getProgress(video.id));
  }, [video.id]);

  const locked = isVideoLocked({ video, isVipUser });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
      onKeyDown={(event) => {
        if (!locked && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onPlay(video);
        }
      }}
      onClick={() => {
        if (!locked) onPlay(video);
      }}
      role="button"
      tabIndex={locked ? -1 : 0}
      aria-disabled={locked}
      aria-label={`${video.title}${locked ? "（VIP 专属）" : "，播放课程"}`}
      className={`tp-paper-card apple-course-card group relative cursor-pointer overflow-hidden rounded-2xl border transition-all duration-300 apple-surface ${
        isActive
          ? "border-emerald-400/30 bg-emerald-400/[0.08] shadow-lg shadow-emerald-500/10"
          : locked
          ? "opacity-60 hover:opacity-80"
          : "hover:bg-white/[0.05]"
      }`}
    >
      {/* 缩略图 */}
      <div className="tp-paper-plate-frame relative aspect-video bg-black/40 overflow-hidden">
        {video.cover || video.youtubeId ? (
          <img
            src={
              video.cover ||
              `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`
            }
            alt={video.title}
            /* B 站 CDN 图带 referrerPolicy=no-referrer 才稳定；加载失败就
               自己隐掉，露出底下的渐变与播放键，不留白框 */
            referrerPolicy="no-referrer"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-900/40 to-teal-900/40">
            <Video className="h-10 w-10 text-white/20" />
          </div>
        )}

        {/* 播放按钮叠加 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
              locked
                ? "bg-white/10"
                : "bg-emerald-500/80 group-hover:bg-emerald-400 group-hover:scale-110 shadow-lg shadow-emerald-500/30"
            }`}
          >
            {locked ? (
              <Lock className="h-5 w-5 text-white/50" />
            ) : (
              <Play className="h-5 w-5 text-white ml-0.5" />
            )}
          </div>
        </div>

        {/* 时长 */}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 text-[10px] text-white/70 font-mono">
          {video.duration}
        </div>

        {/* 站外来源：B 站嵌入的条目要让人一眼看出不是本站自己的片子 */}
        {isEmbeddedSource(video) && (
          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-[#fb7299]/85 text-[10px] font-semibold text-white">
            B 站
          </div>
        )}

        {/* 免费标签 */}
        {video.free && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-emerald-500/80 text-[10px] font-semibold text-white">
            免费
          </div>
        )}

        {/* VIP 锁 */}
        {locked && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-yellow-500/80 text-[10px] font-semibold text-black flex items-center gap-1">
            <Crown className="h-3 w-3" />
            VIP
          </div>
        )}

        {/* 进度条 */}
        {localProgress > 0 && (
          <div className="tp-paper-track absolute bottom-0 left-0 right-0 h-1 bg-white/10">
            <div
              className="tp-paper-track-fill h-full bg-emerald-400"
              style={{ width: `${localProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* 信息 */}
      <div className="tp-paper-card-body p-3.5">
        {/* PAPER 的“图版号”：序号来自列表下标，不新增数据；其他世界被 hidden 关掉 */}
        <span className="tp-paper-plate hidden">
          图版 {String(index + 1).padStart(2, "0")}
        </span>
        <div className="flex items-start justify-between gap-2">
          <h3 className="tp-paper-card-title text-sm font-bold text-white/90 line-clamp-2 leading-snug group-hover:text-emerald-200 transition">
            {video.title}
          </h3>
        </div>
        <p className="tp-paper-card-desc mt-1.5 text-xs text-white/35 line-clamp-2 leading-relaxed">
          {video.description}
        </p>
        <div className="tp-paper-card-meta mt-2.5 flex items-center gap-2">
          <span className="tp-paper-chip text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40">
            {video.level}
          </span>
          <span className="text-[10px] text-white/25">
            {localProgress > 0 ? `已看 ${localProgress}%` : ""}
          </span>
        </div>
      </div>
    </motion.div>
  );
}


// =========================================================
// 主页面
// =========================================================

export default function Course() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isVipUser = !!user?.isVip;

  const [category, setCategory] = useState("all");
  const [vipOpen, setVipOpen] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);
  const [sortBy, setSortBy] = useState("default"); // default | free | duration
  /* 同时有 B 站源与原片源的条目（中泰双语那一类）：默认 B 站（大陆直连免登录）。
     换片子重置回 B 站 —— 高清是备选，不是默认。 */
  const [playSource, setPlaySource] = useState("auto"); // auto | local | bilibili | original

  /* 换一条片子就回到默认播放源（auto 会选可用里最好的那个），选择不被继承 */
  React.useEffect(() => {
    setPlaySource("auto");
  }, [activeVideo?.id]);

  /*
   * 本地原片索引：y2a-auto 流水线下载的 1080P 原片（带泰/中字幕）。
   * 按 youtubeId 对到视频库的条目上 —— 同一个视频，本地源比 B 站外链
   * 清楚三档（实测外链匿名只给 360P），而且能做逐句解析。
   */
  const [localTasks, setLocalTasks] = useState({});
  React.useEffect(() => {
    let alive = true;
    fetch(`${API_BASE_URL}/bilingual`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.tasks) return;
        const map = {};
        for (const t of d.tasks) {
          if (t.youtubeId && t.hasSubtitles) map[t.youtubeId] = t.taskId;
        }
        setLocalTasks(map);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /* 当前片子能匹配上的本地原片（按 youtubeId）与可选的播放源 */
  const localTaskId = activeVideo?.youtubeId
    ? localTasks[activeVideo.youtubeId] || null
    : null;

  const sourceOptions = [
    localTaskId && { key: "local", label: "本地原片 · 1080P 逐句" },
    activeVideo &&
      isEmbeddedSource(activeVideo) && {
        key: "bilibili",
        label: "哔哩哔哩 · 免登录（360P）",
      },
    activeVideo?.youtubeId && {
      key: "original",
      label: isEmbeddedSource(activeVideo)
        ? "原片 · 最高 1080P"
        : "YouTube · 1080P",
    },
  ].filter(Boolean);

  /* auto：有本地原片就用它（最清楚、不依赖外站、能逐句），否则 B 站，再否则原片 */
  const source =
    playSource === "auto"
      ? localTaskId
        ? "local"
        : isEmbeddedSource(activeVideo)
        ? "bilibili"
        : "original"
      : playSource;

  // 筛选视频
  const filteredVideos = useMemo(() => {
    let list = getVideosByCategory(category);
    if (sortBy === "free") list = list.filter((v) => v.free);
    return list;
  }, [category, sortBy]);

  /* 当前筛选里有多少条是站外嵌入（B 站）：列表下方要据此补一句版权说明 */
  const embeddedCount = useMemo(
    () => filteredVideos.filter(isEmbeddedSource).length,
    [filteredVideos]
  );

  // 统计
  const totalVideos = videos.length;
  const freeVideos = getFreeVideos().length;
  const watchedCount = useMemo(() => {
    return videos.filter((v) => getProgress(v.id) > 0).length;
  }, []);

  // 分类标签
  const categoryObj = videoCategories.find((c) => c.id === category);

  // PAPER 版式的“章节号”：沿用 videoCategories 的既有顺序（“全部”排第 0 项），
  // 纯展示用，不参与筛选 / 进度 / 解锁任何逻辑。
  const chapterNo =
    category === "all"
      ? "总目"
      : String(videoCategories.findIndex((c) => c.id === category)).padStart(2, "0");

  return (
    <div className="tp-paper-page apple-course-shell relative space-y-6 pb-10">

      {/* =====================================================
          PAPER 页眉（running head）：只在 paper 世界出现
          -----------------------------------------------------
          注意用的是 hidden **属性**，不是 `hidden` 类：
          根容器是 space-y-6，它的选择器是 `> :not([hidden]) ~ :not([hidden])`，
          只有 HTML 属性才会被它排除。若用类，hero 会凭空多出 1.5rem 上边距，
          另外三个世界的版式就跟着变了。间距改由 .tp-paper-runhead 的
          margin-bottom 交出（见 course-paper.css）。
      ===================================================== */}
      <div hidden className="tp-paper-runhead" aria-hidden="true">
        <span>泰语视频学习</span>
        <span>THAI VIDEO LIBRARY</span>
      </div>

      {/* =====================================================
          HERO（PAPER 下即“书名页”）
      ===================================================== */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="tp-paper-hero apple-surface apple-course-hero relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-gradient-to-br from-emerald-400/[0.10] via-white/[0.035] to-yellow-300/[0.06] p-6 backdrop-blur-xl sm:p-7"
      >
        {/* 光晕 / 角饰 / 天际线：PAPER 版式要克制，由 .tp-paper-ornament 关掉 */}
        <div className="tp-paper-ornament pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-400/[0.08] blur-3xl" />
        <div className="tp-paper-ornament pointer-events-none absolute -bottom-24 left-[40%] h-48 w-48 rounded-full bg-yellow-300/[0.05] blur-3xl" />

        <ThaiCorner corners={["tl", "tr", "bl", "br"]} size={28} className="tp-paper-ornament z-10" />
        <BangkokSkyline className="tp-paper-ornament pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full opacity-[0.12]" opacity={0.6} />

        <div className="tp-paper-hero-row relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="tp-paper-eyebrow flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-emerald-300/70">
              <Sparkles className="h-4 w-4" />
              THAI VIDEO LIBRARY
            </div>
            <h1 className="tp-paper-title mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
              泰语视频学习
            </h1>
            <p className="tp-paper-lede mt-2 max-w-xl text-sm leading-6 text-white/40 sm:text-base">
              精选泰语教学视频，从发音入门到日常会话。
              沉浸式观看，轻松提升泰语能力。
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="tp-paper-chip tp-paper-chip-accent flex items-center gap-1.5 rounded-full border border-emerald-300/10 bg-emerald-400/[0.07] px-3 py-1.5 text-xs text-emerald-200/70">
                <GraduationCap className="h-3.5 w-3.5" />
                分类学习
              </span>
              <span className="tp-paper-chip flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 text-xs text-white/40">
                <Video className="h-3.5 w-3.5" />
                {totalVideos} 个视频
              </span>
              <span className="tp-paper-chip flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 text-xs text-white/40">
                <BookOpen className="h-3.5 w-3.5" />
                {freeVideos} 个免费
              </span>
            </div>
          </div>

          {/* 总进度（PAPER 下即“藏书信息栏”） */}
          <div className="tp-paper-bookstat apple-course-stat min-w-[220px] rounded-2xl border border-white/[0.08] bg-black/10 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-white/30">
                学习进度
              </span>
              <span className="text-sm font-bold text-emerald-300">
                {totalVideos > 0 ? Math.round((watchedCount / totalVideos) * 100) : 0}%
              </span>
            </div>
            <div className="tp-paper-track mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${totalVideos > 0 ? (watchedCount / totalVideos) * 100 : 0}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="tp-paper-track-fill h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-yellow-300"
              />
            </div>
            <div className="mt-2 text-[10px] text-white/25">
              已观看 {watchedCount} / {totalVideos} 个视频
            </div>
          </div>
        </div>
      </motion.div>


      {/* =====================================================
          统计（PAPER 下即“数据台账行”）
      ===================================================== */}
      <div className="tp-paper-stats grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Video} label="视频总数" value={totalVideos} suffix="个" color="emerald" />
        <StatCard icon={BookOpen} label="免费视频" value={freeVideos} suffix="个" color="cyan" />
        <StatCard icon={Target} label="已观看" value={watchedCount} suffix="个" color="purple" />
        <StatCard icon={Flame} label="学习状态" value={watchedCount > 0 ? "进行中" : "待开始"} color="yellow" />
      </div>


      {/* =====================================================
          正在播放
      ===================================================== */}
      <AccordionPanel open={!!activeVideo}>
        {activeVideo && (
          <section>
            <div className="tp-paper-section-head mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="tp-paper-ornament h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,.7)]" />
                <h2 className="tp-paper-h2 text-lg font-bold text-white">正在播放</h2>
              </div>
              <button
                onClick={() => setActiveVideo(null)}
                className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] transition text-white/50 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 播放源：优先本地原片（1080P + 逐句解析）；其次 B 站（大陆免登录，
                但实测匿名只给 360P）；再其次原片 YouTube 嵌入（可上 1080P，需能访问）。 */}
            {sourceOptions.length > 1 && (
              <div className="mb-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-white/35">播放源</span>
                {sourceOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setPlaySource(opt.key)}
                    aria-pressed={playSource === opt.key}
                    className={`apple-button rounded-full px-3 py-1 transition ${
                      playSource === opt.key
                        ? "border border-emerald-400/25 bg-emerald-500/20 text-emerald-200"
                        : "border border-white/[0.06] bg-white/[0.04] text-white/45 hover:bg-white/[0.07] hover:text-white/70"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                {playSource === "original" && (
                  <span className="text-white/30">需能访问 YouTube</span>
                )}
              </div>
            )}

            {source === "local" && localTaskId ? (
              <SentenceStudy
                key={`${activeVideo.id}-local`}
                taskId={localTaskId}
                onProgress={(pct) => saveProgress(activeVideo.id, pct)}
              />
            ) : source === "bilibili" && isEmbeddedSource(activeVideo) ? (
              <BilibiliPlayer
                key={`${activeVideo.id}-bili`}
                bvid={activeVideo.bilibiliId}
                title={activeVideo.title}
              />
            ) : (
              <YouTubePlayer
                key={`${activeVideo.id}-${source}`}
                videoId={activeVideo.youtubeId}
                onProgress={(pct) => saveProgress(activeVideo.id, pct)}
                onEnded={() => saveProgress(activeVideo.id, 100)}
              />
            )}

            <div className="mt-3 flex items-center justify-between">
              <div>
                <h3 className="tp-paper-card-title text-sm font-bold text-white">{activeVideo.title}</h3>
                <p className="tp-paper-card-desc text-xs text-white/40 mt-1">{activeVideo.description}</p>
              </div>
              <span className="tp-paper-chip text-[10px] px-2 py-1 rounded-full bg-white/[0.06] text-white/40">
                {activeVideo.level}
              </span>
            </div>

            {/* 出处与版权：站外嵌入或本地原片的条目都要写清「谁的片子、原片在哪」 */}
            {(isEmbeddedSource(activeVideo) || localTaskId) && (
              <div className="tp-paper-sub mt-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/45">
                  {source === "local" ? (
                    <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                      本地原片 · 1080P · 逐句解析
                    </span>
                  ) : (
                    <>
                      <span className="rounded-full bg-[#fb7299]/15 px-2 py-0.5 text-[10px] font-medium text-[#fb7299]">
                        外站嵌入
                      </span>
                      <span>来源：{activeVideo.sourceName}</span>
                      {activeVideo.sourceNote && <span>· {activeVideo.sourceNote}</span>}
                      <a
                        href={bilibiliWatchUrl(activeVideo)}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-emerald-300/80 underline decoration-dotted underline-offset-2 hover:text-emerald-200"
                      >
                        在 B 站打开
                      </a>
                    </>
                  )}
                </div>

                {activeVideo.originName && (
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/35">
                    <span>原片：{activeVideo.originName}</span>
                    {activeVideo.originUrl && (
                      <a
                        href={activeVideo.originUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="underline decoration-dotted underline-offset-2 hover:text-white/60"
                      >
                        原片链接
                      </a>
                    )}
                  </div>
                )}

                {source === "bilibili" ? (
                  <p className="mt-1.5 text-[10px] leading-relaxed text-white/25">
                    清晰度：B 站外链播放器对未登录访客只给 360P（480P/720P/1080P 需在 B 站登录，站外嵌入无法代为登录）—— 要看高清请切到上方「原片」源，或点「在 B 站打开」后登录观看。
                  </p>
                ) : (
                  <p className="mt-1.5 text-[10px] leading-relaxed text-white/25">
                    本地原片：来自自己的 y2a-auto 下载流水线（1920×1080），播放不经过任何外站，逐句字幕也由同一批字幕清洗而来。
                  </p>
                )}

                <p className="mt-1.5 text-[10px] leading-relaxed text-white/25">
                  版权归原作者与原站所有：本站在此仅做站外嵌入播放，不下载、不转码、不二次剪辑；若权利人希望下架，联系我们即可移除。
                </p>
              </div>
            )}
          </section>
        )}
      </AccordionPanel>


      {/* =====================================================
          分类标签（PAPER 下即“章目录条”）
      ===================================================== */}
      <div className="tp-paper-tabs flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {videoCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`tp-paper-tab apple-button flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium transition-all ${
              category === cat.id
                ? "tp-paper-tab-active bg-emerald-500/20 text-emerald-300 border border-emerald-400/20 shadow-sm shadow-emerald-500/10"
                : "bg-white/[0.04] text-white/40 border border-white/[0.06] hover:bg-white/[0.07] hover:text-white/60"
            }`}
          >
            <span>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>


      {/* =====================================================
          视频网格
      ===================================================== */}
      <section>
        <div className="tp-paper-section-head mb-4 flex items-center justify-between">
          <div>
            <h2 className="tp-paper-h2 text-lg font-bold text-white">
              {/* 章节号：PAPER 专用版式信号，其他世界被 hidden 关掉 */}
              <span className="tp-paper-ordinal hidden" aria-hidden="true">
                {chapterNo}
              </span>
              {categoryObj?.icon} {categoryObj?.label || "全部视频"}
            </h2>
            <p className="tp-paper-sub mt-1 text-xs text-white/30">
              共 {filteredVideos.length} 个视频
              {/* 站外嵌入的条目在此说明一句：播放、版权都在原站 */}
              {embeddedCount > 0 && (
                <span className="text-white/25">
                  （其中 {embeddedCount} 条为哔哩哔哩站外嵌入，版权归原作者）
                </span>
              )}
            </p>
          </div>

          {/* 排序 */}
          <div className="tp-paper-sortgroup flex items-center gap-1 bg-white/[0.04] rounded-xl p-1">
            {[
              { key: "default", label: "默认" },
              { key: "free", label: "仅免费" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={`tp-paper-sort apple-button text-[11px] px-3 py-1.5 rounded-lg transition ${
                  sortBy === opt.key
                    ? "tp-paper-sort-on bg-emerald-500/20 text-emerald-300"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="tp-paper-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredVideos.map((video, index) => (
            <VideoCard
              key={video.id}
              video={video}
              index={index}
              isVipUser={isVipUser}
              onPlay={(v) => {
                setActiveVideo(v);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              isActive={activeVideo?.id === video.id}
            />
          ))}
        </div>

        {filteredVideos.length === 0 && (
          <div className="text-center py-16 text-white/30">
            <Video className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无该分类的视频</p>
          </div>
        )}
      </section>


      {/* =====================================================
          VIP 提示（PAPER 下即“页边注”）
      ===================================================== */}
      {!isVipUser && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="tp-paper-note rounded-2xl border border-yellow-300/10 bg-yellow-300/[0.04] p-5 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3">
            <div className="tp-paper-iconbox w-10 h-10 rounded-xl flex items-center justify-center bg-yellow-400/[0.1]">
              <Crown className="h-5 w-5 text-yellow-300" />
            </div>
            <div className="flex-1">
              <h3 className="tp-paper-note-title text-sm font-bold text-yellow-200/80">
                解锁全部视频
              </h3>
              <p className="tp-paper-note-body text-xs text-yellow-200/40 mt-0.5">
                每个分类都留了 1 条免费精讲（共 {freeVideos} 条）；
                升级 VIP 解锁全部 {videos.length} 条视频，含进阶课程。
              </p>
            </div>
            <button
              onClick={() => setVipOpen(true)}
              className="px-4 py-2 rounded-xl bg-yellow-400/[0.12] border border-yellow-300/20 text-xs font-semibold text-yellow-200/80 hover:bg-yellow-400/[0.2] transition"
            >
              了解 VIP
            </button>
          </div>
        </motion.div>
      )}

      <VipPanel open={vipOpen} onClose={() => setVipOpen(false)} />

      {/* =====================================================
          PAPER 页脚（colophon）
          -----------------------------------------------------
          与页眉同理：用 hidden 属性，才不会被 space-y-6 算进兄弟间距。
          数字全部来自既有统计（totalVideos / freeVideos / watchedCount），
          没有新增数据来源。
      ===================================================== */}
      <div hidden className="tp-paper-colophon" aria-hidden="true">
        <span>ThaiAI · 泰语视频学习</span>
        <span>
          共 {totalVideos} 讲 · 免费 {freeVideos} 讲
        </span>
        <span>已阅 {watchedCount} 讲</span>
      </div>
    </div>
  );
}
