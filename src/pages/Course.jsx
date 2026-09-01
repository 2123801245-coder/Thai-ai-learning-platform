// src/pages/Course.jsx
// =========================================================
// ThaiAI 泰语视频学习库
// =========================================================

import React, { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
} from "@/data/videoLibrary";


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
    <div className="relative rounded-2xl overflow-hidden bg-black border border-white/[0.06]">
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
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition text-white"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>

            {/* 音量 */}
            <div className="flex items-center gap-2 group/vol">
              <button
                onClick={toggleMute}
                className="text-white/60 hover:text-white transition"
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
                className="text-xs text-white/50 hover:text-white transition px-2 py-1 rounded bg-white/5"
              >
                {speed}x
              </button>
              {showSpeed && (
                <div className="absolute bottom-full right-0 mb-2 bg-[#0a1a17] border border-white/10 rounded-xl p-2 flex flex-col gap-1 z-50">
                  {SPEED_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSpeed(s)}
                      className={`text-xs px-3 py-1.5 rounded-lg transition ${
                        speed === s
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "text-white/50 hover:bg-white/5 hover:text-white"
                      }`}
                    >
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
      className={`rounded-2xl border p-4 backdrop-blur-xl ${colorMap[color]}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/[0.04]">
          <Icon className="h-5 w-5 opacity-70" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest opacity-40">
            {label}
          </div>
          <div className="text-xl font-black mt-0.5">
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

  const locked = !video.free && !isVipUser;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
      onClick={() => !locked && onPlay(video)}
      className={`group relative cursor-pointer rounded-2xl border transition-all duration-300 overflow-hidden ${
        isActive
          ? "border-emerald-400/30 bg-emerald-400/[0.08] shadow-lg shadow-emerald-500/10"
          : locked
          ? "border-white/[0.05] bg-white/[0.02] opacity-60 hover:opacity-80"
          : "border-white/[0.06] bg-white/[0.03] hover:border-white/[0.12] hover:bg-white/[0.05] hover:shadow-lg hover:shadow-black/20"
      }`}
    >
      {/* 缩略图 */}
      <div className="relative aspect-video bg-black/40 overflow-hidden">
        {video.youtubeId ? (
          <img
            src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
            alt={video.title}
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
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
            <div
              className="h-full bg-emerald-400"
              style={{ width: `${localProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* 信息 */}
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-white/90 line-clamp-2 leading-snug group-hover:text-emerald-200 transition">
            {video.title}
          </h3>
        </div>
        <p className="mt-1.5 text-xs text-white/35 line-clamp-2 leading-relaxed">
          {video.description}
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40">
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

  // 筛选视频
  const filteredVideos = useMemo(() => {
    let list = getVideosByCategory(category);
    if (sortBy === "free") list = list.filter((v) => v.free);
    return list;
  }, [category, sortBy]);

  // 统计
  const totalVideos = videos.length;
  const freeVideos = getFreeVideos().length;
  const watchedCount = useMemo(() => {
    return videos.filter((v) => getProgress(v.id) > 0).length;
  }, []);

  // 分类标签
  const categoryObj = videoCategories.find((c) => c.id === category);

  return (
    <div className="relative space-y-6 pb-10">

      {/* =====================================================
          HERO
      ===================================================== */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-gradient-to-br from-emerald-400/[0.10] via-white/[0.035] to-yellow-300/[0.06] p-6 backdrop-blur-xl sm:p-7"
      >
        {/* 光晕 */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-400/[0.08] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-[40%] h-48 w-48 rounded-full bg-yellow-300/[0.05] blur-3xl" />

        <ThaiCorner corners={["tl", "tr", "bl", "br"]} size={28} className="z-10" />
        <BangkokSkyline className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full opacity-[0.12]" opacity={0.6} />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-emerald-300/70">
              <Sparkles className="h-4 w-4" />
              THAI VIDEO LIBRARY
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
              泰语视频学习
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/40 sm:text-base">
              精选泰语教学视频，从发音入门到日常会话。
              沉浸式观看，轻松提升泰语能力。
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-300/10 bg-emerald-400/[0.07] px-3 py-1.5 text-xs text-emerald-200/70">
                <GraduationCap className="h-3.5 w-3.5" />
                分类学习
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 text-xs text-white/40">
                <Video className="h-3.5 w-3.5" />
                {totalVideos} 个视频
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 text-xs text-white/40">
                <BookOpen className="h-3.5 w-3.5" />
                {freeVideos} 个免费
              </span>
            </div>
          </div>

          {/* 总进度 */}
          <div className="min-w-[220px] rounded-2xl border border-white/[0.08] bg-black/10 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-white/30">
                学习进度
              </span>
              <span className="text-sm font-bold text-emerald-300">
                {totalVideos > 0 ? Math.round((watchedCount / totalVideos) * 100) : 0}%
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${totalVideos > 0 ? (watchedCount / totalVideos) * 100 : 0}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-yellow-300"
              />
            </div>
            <div className="mt-2 text-[10px] text-white/25">
              已观看 {watchedCount} / {totalVideos} 个视频
            </div>
          </div>
        </div>
      </motion.div>


      {/* =====================================================
          统计
      ===================================================== */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Video} label="视频总数" value={totalVideos} suffix="个" color="emerald" />
        <StatCard icon={BookOpen} label="免费视频" value={freeVideos} suffix="个" color="cyan" />
        <StatCard icon={Target} label="已观看" value={watchedCount} suffix="个" color="purple" />
        <StatCard icon={Flame} label="学习状态" value={watchedCount > 0 ? "进行中" : "待开始"} color="yellow" />
      </div>


      {/* =====================================================
          正在播放
      ===================================================== */}
      <AnimatePresence>
        {activeVideo && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,.7)]" />
                <h2 className="text-lg font-bold text-white">正在播放</h2>
              </div>
              <button
                onClick={() => setActiveVideo(null)}
                className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] transition text-white/50 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <YouTubePlayer
              key={activeVideo.id}
              videoId={activeVideo.youtubeId}
              onProgress={(pct) => saveProgress(activeVideo.id, pct)}
              onEnded={() => saveProgress(activeVideo.id, 100)}
            />

            <div className="mt-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">{activeVideo.title}</h3>
                <p className="text-xs text-white/40 mt-1">{activeVideo.description}</p>
              </div>
              <span className="text-[10px] px-2 py-1 rounded-full bg-white/[0.06] text-white/40">
                {activeVideo.level}
              </span>
            </div>
          </motion.section>
        )}
      </AnimatePresence>


      {/* =====================================================
          分类标签
      ===================================================== */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {videoCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium transition-all ${
              category === cat.id
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/20 shadow-sm shadow-emerald-500/10"
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
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">
              {categoryObj?.icon} {categoryObj?.label || "全部视频"}
            </h2>
            <p className="mt-1 text-xs text-white/30">
              共 {filteredVideos.length} 个视频
            </p>
          </div>

          {/* 排序 */}
          <div className="flex items-center gap-1 bg-white/[0.04] rounded-xl p-1">
            {[
              { key: "default", label: "默认" },
              { key: "free", label: "仅免费" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={`text-[11px] px-3 py-1.5 rounded-lg transition ${
                  sortBy === opt.key
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
          VIP 提示
      ===================================================== */}
      {!isVipUser && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-yellow-300/10 bg-yellow-300/[0.04] p-5 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-yellow-400/[0.1]">
              <Crown className="h-5 w-5 text-yellow-300" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-yellow-200/80">
                解锁全部视频
              </h3>
              <p className="text-xs text-yellow-200/40 mt-0.5">
                升级 VIP 即可观看所有 {videos.length} 个泰语教学视频，包含进阶课程。
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
    </div>
  );
}
