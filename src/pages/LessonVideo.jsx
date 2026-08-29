// src/pages/LessonVideo.jsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Captions,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Gauge,
  ListEnd,
  ListVideo,
  Lock,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize,
  Sparkles,
  Video,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { getCourseById } from "@/data/courses";
import { getLessonsByCourseId, DEFAULT_VIDEO } from "@/data/lessons";
import {
  isLessonCompleted,
  markLessonComplete,
  saveLessonPosition,
  COURSE_PROGRESS_CHANGE_EVENT,
} from "@/lib/courseProgress";

import { useAuth } from "@/lib/AuthContext";
import VipPanel from "@/components/common/VipPanel";


// =========================================================
// 播放速度选项
// =========================================================

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5];


// =========================================================
// YouTube IFrame API（懒加载，仅在需要时注入脚本）
// =========================================================

let ytApiPromise = null;

function loadYouTubeApi() {
  if (
    typeof window !== "undefined" &&
    window.YT?.Player
  ) {
    return Promise.resolve();
  }

  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve, reject) => {
    const previous =
      window.onYouTubeIframeAPIReady;

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

    setTimeout(() => {
      if (!window.YT?.Player) {
        ytApiPromise = null;
        reject(new Error("YouTube API 加载超时"));
      }
    }, 8000);
  });

  return ytApiPromise;
}


// =========================================================
// 时间格式
// =========================================================

// 进度条 CSS 变量（供 premium-range 渐变填充使用）
/** @returns {import("react").CSSProperties & Record<string, string>} */
function rangeStyle(percent) {
  return { "--range-progress": `${percent}%` };
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) {
    return "00:00";
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}


// =========================================================
// 页面
// =========================================================

export default function LessonVideo() {
  const navigate = useNavigate();

  const { courseId, lessonId } = useParams();

  const { user } = useAuth();
  const isVipUser = !!user?.isVip;
  const [vipOpen, setVipOpen] = useState(false);

  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const completedRef = useRef(false);
  const lastSaveRef = useRef(0);
  const ytPlayerRef = useRef(null);
  const playbackRateRef = useRef(1);
  const thTrackRef = useRef(null);
  const zhTrackRef = useRef(null);
  const autoplayTimerRef = useRef(null);
  const autoAdvanceRef = useRef(false);


  // =======================================================
  // 获取课程
  // =======================================================

  const course = useMemo(
    () => getCourseById(courseId),
    [courseId]
  );


  // =======================================================
  // 获取课程视频（数据来自 src/data/lessons.js）
  // =======================================================

  const lessons = useMemo(
    () => getLessonsByCourseId(courseId),
    [courseId]
  );


  // =======================================================
  // 当前课程
  // =======================================================

  const currentIndex = lessons.findIndex(
    (lesson) => lesson.id === lessonId
  );

  const lesson = currentIndex >= 0 ? lessons[currentIndex] : null;

  // VIP 课程锁定（免费用户不可看非试看节；VIP 用户全部解锁）
  const locked = course.isVip && !lesson?.free && !isVipUser;


  // =======================================================
  // 状态
  // =======================================================

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [completed, setCompleted] = useState(false);
  const [ytReady, setYtReady] = useState(false);
  const [ytError, setYtError] = useState(false);

  // 字幕状态：off（关）/ th（泰语）/ zh（中文）
  const [subtitleLang, setSubtitleLang] = useState("off");

  // 自动连播：当前视频看完自动跳下一节（localStorage 持久化，默认开启）
  const [autoplayNext, setAutoplayNext] = useState(
    () => localStorage.getItem("thai_ai_autoplay_next") !== "0"
  );

  // 自动连播跳转前的过渡提示
  const [autoAdvancing, setAutoAdvancing] = useState(false);

  // 课程完成庆祝动画（受限式：金色粒子 + 光环 + 徽章）
  const [celebrating, setCelebrating] = useState(false);
  const celebrateTimerRef = useRef(null);

  // 播放模式：本地 MP4（videoUrl）优先，无墙可播；
  // 仅当课程只有 youtubeId 而没有 videoUrl 时才回退 YouTube 嵌入。
  const isYouTube = !!lesson?.youtubeId && !lesson?.videoUrl;

  const ytContainerId = useMemo(
    () => `yt-player-${lesson?.id || "video"}`,
    [lesson]
  );

  // 完成庆祝粒子（静态角度/距离，仅 transform/opacity 动画，GPU 友好）
  const celebrateParticles = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        angle:
          (index / 12) * Math.PI * 2 +
          (index % 2 === 0 ? 0.22 : -0.18),
        dist: 95 + (index % 4) * 22,
        size: 3 + (index % 3) * 2,
        delay: (index % 5) * 0.06,
        gold: index % 3 !== 2,
      })),
    []
  );


  // =======================================================
  // completed 同步到 ref（避免事件闭包读到旧值）
  // =======================================================

  useEffect(() => {
    completedRef.current = completed;
  }, [completed]);


  // =======================================================
  // 应用播放速度（HTML5 视频 + YouTube 都生效）
  // =======================================================

  useEffect(() => {
    playbackRateRef.current = playbackRate;

    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }

    if (isYouTube && ytReady && ytPlayerRef.current?.setPlaybackRate) {
      ytPlayerRef.current.setPlaybackRate(playbackRate);
    }
  }, [playbackRate, isYouTube, ytReady]);


  // =======================================================
  // 切换视频时重置 + 读取已保存的完成状态
  // =======================================================

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setCompleted(false);

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }

    // 从 localStorage 读取该节是否已完成（刷新不丢失）
    setCompleted(isLessonCompleted(courseId, lessonId));

    // 进度变化时刷新完成状态（例如从服务器水合完成后）
    const onProgressChange = () => {
      setCompleted(isLessonCompleted(courseId, lessonId));
    };

    window.addEventListener(COURSE_PROGRESS_CHANGE_EVENT, onProgressChange);

    // 清除上一节可能残留的自动连播定时器
    clearTimeout(autoplayTimerRef.current);
    setAutoAdvancing(false);

    // 清除上一节的完成庆祝动画
    clearTimeout(celebrateTimerRef.current);
    setCelebrating(false);

    // 自动连播跳转后：新一节自动开始播放
    if (autoAdvanceRef.current) {
      autoAdvanceRef.current = false;
      const el = videoRef.current;
      if (el) {
        el.play().catch(() => {});
      }
    }

    return () => {
      clearTimeout(celebrateTimerRef.current);
      window.removeEventListener(COURSE_PROGRESS_CHANGE_EVENT, onProgressChange);
    };
  }, [courseId, lessonId]);


  // =======================================================
  // 中泰双语字幕
  // =======================================================

  // 字幕切换：控制 <track> 的 mode（off / 泰语 / 中文）
  useEffect(() => {
    const applyTrackModes = () => {
      const setMode = (ref, lang) => {
        // mode 在 track.track（TextTrack）上；"showing" 显示，"hidden" 隐藏
        const textTrack = ref.current?.track;
        if (textTrack) {
          textTrack.mode =
            subtitleLang === lang ? "showing" : "hidden";
        }
      };

      setMode(thTrackRef, "th");
      setMode(zhTrackRef, "zh");
    };

    applyTrackModes();

    // 轨道异步加载，加载完成后浏览器可能重置 mode，重新应用一次
    const th = thTrackRef.current;
    const zh = zhTrackRef.current;
    const onLoad = () => applyTrackModes();

    th?.addEventListener("load", onLoad);
    zh?.addEventListener("load", onLoad);

    return () => {
      th?.removeEventListener("load", onLoad);
      zh?.removeEventListener("load", onLoad);
    };
  }, [subtitleLang, courseId, lessonId]);


  // =======================================================
  // YouTube 播放器（按视频懒加载创建）
  // =======================================================

  useEffect(() => {
    if (!isYouTube || locked) return;

    let cancelled = false;

    loadYouTubeApi()
      .then(() => {
        if (cancelled || !window.YT?.Player) return;

        ytPlayerRef.current = new window.YT.Player(
          ytContainerId,
          {
            videoId: lesson.youtubeId,
            playerVars: {
              playsinline: 1,
              rel: 0,
            },
            events: {
              onReady: (event) => {
                ytPlayerRef.current = event.target;
                event.target.setPlaybackRate(
                  playbackRateRef.current
                );
                setYtReady(true);
              },
              onStateChange: (event) => {
                const state = event.data;
                const PLAYING =
                  window.YT.PlayerState.PLAYING;
                const PAUSED =
                  window.YT.PlayerState.PAUSED;
                const ENDED =
                  window.YT.PlayerState.ENDED;

                if (state === PLAYING) {
                  setPlaying(true);
                } else if (
                  state === PAUSED ||
                  state === ENDED
                ) {
                  setPlaying(false);
                }

                if (state === ENDED) {
                  handleEnded();
                }

                if (state === PAUSED) {
                  const p = ytPlayerRef.current;
                  if (
                    p &&
                    typeof p.getCurrentTime ===
                      "function"
                  ) {
                    saveLessonPosition(
                      courseId,
                      lesson.id,
                      p.getCurrentTime() || 0,
                      p.getDuration() || 0
                    );
                  }
                }
              },
              onError: () => setYtError(true),
            },
          }
        );
      })
      .catch(() => {
        if (!cancelled) setYtError(true);
      });

    return () => {
      cancelled = true;

      if (ytPlayerRef.current?.destroy) {
        try {
          ytPlayerRef.current.destroy();
        } catch (e) {
          // ignore
        }
      }

      ytPlayerRef.current = null;
      setYtReady(false);
      setYtError(false);
    };
  }, [courseId, lessonId]);


  // =======================================================
  // YouTube 播放进度轮询（进度 / ≥90% 自动完成 / 位置保存）
  // =======================================================

  useEffect(() => {
    if (!isYouTube || !ytReady || locked) return;

    const timer = setInterval(() => {
      const p = ytPlayerRef.current;
      if (!p || typeof p.getCurrentTime !== "function") return;

      const t = p.getCurrentTime() || 0;
      const d = p.getDuration() || 0;

      setCurrentTime(t);
      if (d > 0) setDuration(d);

      // 播放到 >= 90% → 自动完成
      if (d > 0 && !completedRef.current) {
        if ((t / d) * 100 >= 90) {
          setCompleted(true);
          markLessonComplete(courseId, lesson.id);
          startCelebration();
        }
      }

      // 节流保存播放位置（每 5 秒一次）
      const now = Date.now();
      if (now - lastSaveRef.current >= 5000) {
        lastSaveRef.current = now;
        saveLessonPosition(courseId, lesson.id, t, d);
      }
    }, 500);

    return () => clearInterval(timer);
  }, [isYouTube, ytReady, courseId, lessonId, locked]);


  // =======================================================
  // 不存在
  // =======================================================

  if (!course || !lesson) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Video className="mx-auto h-10 w-10 text-white/20" />
          <h1 className="mt-4 text-xl font-bold text-white">
            找不到这个视频
          </h1>
          <button
            onClick={() => navigate(`/course/${courseId}`)}
            className="mt-5 rounded-xl bg-emerald-400/10 px-5 py-2.5 text-sm text-emerald-200"
          >
            返回课程
          </button>
        </div>
      </div>
    );
  }


  // =======================================================
  // 播放 / 暂停
  // =======================================================

  const togglePlay = async () => {
    if (locked) return;

    /* YouTube 嵌入 */
    if (isYouTube) {
      if (!ytReady || ytError) return;
      const p = ytPlayerRef.current;
      if (!p) return;

      const playingNow =
        typeof p.getPlayerState === "function" &&
        window.YT?.PlayerState &&
        p.getPlayerState() ===
          window.YT.PlayerState.PLAYING;

      if (playingNow) {
        p.pauseVideo();
        setPlaying(false);
      } else {
        p.playVideo();
        setPlaying(true);
      }

      return;
    }

    /* HTML5 视频 */
    if (!videoRef.current) return;

    if (videoRef.current.paused) {
      try {
        await videoRef.current.play();
        setPlaying(true);
      } catch (error) {
        console.error("视频播放失败:", error);
      }
    } else {
      videoRef.current.pause();
      setPlaying(false);
    }
  };


  // =======================================================
  // 视频事件
  // =======================================================

  const handleTimeUpdate = () => {
    const el = videoRef.current;
    if (!el) return;

    setCurrentTime(el.currentTime);

    // 播放到 >= 90% → 自动完成
    if (el.duration > 0 && !completedRef.current) {
      const percent = (el.currentTime / el.duration) * 100;

      if (percent >= 90) {
        setCompleted(true);
        markLessonComplete(courseId, lesson.id);
        startCelebration();
      }
    }

    // 节流保存播放位置（每 5 秒一次，避免频繁写 localStorage）
    const now = Date.now();

    if (now - lastSaveRef.current >= 5000) {
      lastSaveRef.current = now;
      saveLessonPosition(courseId, lesson.id, el.currentTime, el.duration);
    }
  };


  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };


  // 暂停时保存一次位置
  const handlePause = () => {
    const el = videoRef.current;
    if (!el) return;
    saveLessonPosition(courseId, lesson.id, el.currentTime, el.duration);
  };


  // =======================================================
  // 播放结束（自然看完 → 自动完成）
  // =======================================================

  const handleEnded = () => {
    setPlaying(false);
    setCompleted(true);
    markLessonComplete(courseId, lesson.id);
    startCelebration();

    if (isYouTube) {
      const p = ytPlayerRef.current;
      const d =
        p && typeof p.getDuration === "function"
          ? p.getDuration() || 0
          : 0;
      saveLessonPosition(courseId, lesson.id, d, d);
    } else if (videoRef.current) {
      saveLessonPosition(
        courseId,
        lesson.id,
        videoRef.current.duration,
        videoRef.current.duration
      );
    }

    // 自动连播：有可播的下一节时，稍作停留后自动跳转并继续播放
    const canAutoNext =
      autoplayNext &&
      currentIndex < lessons.length - 1 &&
      !(course.isVip && !lessons[currentIndex + 1].free && !isVipUser);

    if (canAutoNext) {
      autoAdvanceRef.current = true;
      setAutoAdvancing(true);
      clearTimeout(autoplayTimerRef.current);
      autoplayTimerRef.current = setTimeout(() => {
        setAutoAdvancing(false);
        goNext();
      }, 1500);
    }
  };


  // =======================================================
  // 跳转进度
  // =======================================================

  const handleSeek = (event) => {
    const value = Number(event.target.value);

    if (isYouTube) {
      ytPlayerRef.current?.seekTo?.(value, true);
      setCurrentTime(value);
      return;
    }

    if (!videoRef.current) return;
    videoRef.current.currentTime = value;
    setCurrentTime(value);
  };


  // =======================================================
  // 音量
  // =======================================================

  const handleVolume = (event) => {
    const value = Number(event.target.value);
    setVolume(value);

    if (isYouTube) {
      const p = ytPlayerRef.current;
      if (p && typeof p.setVolume === "function") {
        if (value === 0) {
          p.mute();
        } else {
          p.unMute();
          p.setVolume(Math.round(value * 100));
        }
      }

      setMuted(value === 0);
      return;
    }

    if (videoRef.current) {
      videoRef.current.volume = value;
      videoRef.current.muted = value === 0;
    }

    setMuted(value === 0);
  };


  const toggleMute = () => {
    if (isYouTube) {
      const p = ytPlayerRef.current;
      if (!p) return;

      if (muted) {
        p.unMute();
        setMuted(false);
      } else {
        p.mute();
        setMuted(true);
      }

      return;
    }

    if (!videoRef.current) return;

    const newMuted = !videoRef.current.muted;
    videoRef.current.muted = newMuted;
    setMuted(newMuted);
  };


  // =======================================================
  // 播放速度
  // =======================================================

  const cycleSpeed = () => {
    const index = SPEED_OPTIONS.indexOf(playbackRate);
    const next = SPEED_OPTIONS[(index + 1) % SPEED_OPTIONS.length];
    setPlaybackRate(next);
  };


  // =======================================================
  // 全屏
  // =======================================================

  const handleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await containerRef.current.requestFullscreen();
      }
    } catch (error) {
      console.error("全屏失败:", error);
    }
  };


  // =======================================================
  // 上一节
  // =======================================================

  const goPrevious = () => {
    if (currentIndex <= 0) return;

    const previous = lessons[currentIndex - 1];
    navigate(`/course/${courseId}/lesson/${previous.id}`);
  };


  // =======================================================
  // 下一节
  // =======================================================

  const goNext = () => {
    if (currentIndex >= lessons.length - 1) {
      navigate(`/course/${courseId}`);
      return;
    }

    const next = lessons[currentIndex + 1];

    // 下一节被锁定（VIP 未开通）
    if (course.isVip && !next.free && !isVipUser) {
      return;
    }

    navigate(`/course/${courseId}/lesson/${next.id}`);
  };


  // =======================================================
  // 重新播放
  // =======================================================

  const restart = () => {
    if (isYouTube) {
      const p = ytPlayerRef.current;
      if (!p) return;
      p.seekTo(0, true);
      p.playVideo();
      setPlaying(true);
      return;
    }

    if (!videoRef.current) return;

    videoRef.current.currentTime = 0;
    videoRef.current.play();
    setPlaying(true);
  };


  // =======================================================
  // 标记完成（持久化）
  // =======================================================

  // 触发一次完成庆祝动画（金色粒子 + 光环 + 徽章，自动消散）
  const startCelebration = () => {
    setCelebrating(true);
    clearTimeout(celebrateTimerRef.current);
    celebrateTimerRef.current = setTimeout(() => {
      setCelebrating(false);
    }, 3200);
  };

  const markCompleted = () => {
    if (completedRef.current) return;
    setCompleted(true);
    markLessonComplete(courseId, lesson.id);
    startCelebration();
  };


  // =======================================================
  // 字幕切换
  // =======================================================

  const hasSubtitles = !!(
    lesson?.subtitleUrl || lesson?.subtitleUrlTh
  );

  const subtitleLabel =
    subtitleLang === "th"
      ? "泰语"
      : subtitleLang === "zh"
        ? "中文"
        : "字幕";

  // 循环切换：关 → 泰语 → 中文 → 关
  const cycleSubtitle = () => {
    setSubtitleLang((prev) =>
      prev === "off" ? "th" : prev === "th" ? "zh" : "off"
    );
  };


  // =======================================================
  // 自动连播开关
  // =======================================================

  const toggleAutoplay = () => {
    setAutoplayNext((prev) => {
      const next = !prev;
      localStorage.setItem(
        "thai_ai_autoplay_next",
        next ? "1" : "0"
      );
      return next;
    });
  };


  // =======================================================
  // 页面
  // =======================================================

  return (
    <div className="space-y-5 pb-10">

      {/* =====================================================
          顶部
      ===================================================== */}

      <div className="flex flex-wrap items-center justify-between gap-3">

        <button
          onClick={() => navigate(`/course/${courseId}`)}
          className="flex items-center gap-2 text-sm text-white/35 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          返回课程目录
        </button>

        <div className="flex items-center gap-2 text-xs text-white/25">
          <ListVideo className="h-4 w-4" />
          第 {currentIndex + 1} / {lessons.length} 节
        </div>

      </div>


      {/* =====================================================
          视频播放器
      ===================================================== */}

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        ref={containerRef}
        className={`relative overflow-hidden rounded-[30px] border border-white/[0.1] bg-[#050b0a]/95 backdrop-blur-2xl transition-shadow duration-700 ${
          playing
            ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_80px_rgba(0,0,0,0.55),0_0_80px_-16px_rgba(16,185,129,0.4),0_0_60px_-24px_rgba(245,214,123,0.35)]"
            : "shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_80px_rgba(0,0,0,0.55),0_0_50px_-18px_rgba(16,185,129,0.16)]"
        }`}
      >

        {/* 顶部金色描边 */}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-yellow-300/40 to-transparent" />

        {/* 视频 */}

        <div className="relative aspect-video bg-black">

          {locked ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#071815] via-[#030908] to-black">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-yellow-300/10 bg-yellow-300/[0.05]">
                <Lock className="h-7 w-7 text-yellow-200/60" />
              </div>

              <h2 className="mt-5 text-lg font-bold text-white">
                VIP 专属课程
              </h2>

              <p className="mt-2 max-w-sm px-5 text-center text-xs leading-5 text-white/30">
                这是会员专属视频。
                开通 VIP 后即可观看完整课程。
              </p>

              <button
                onClick={() => setVipOpen(true)}
                className="mt-5 rounded-xl bg-gradient-to-r from-yellow-300 to-amber-400 px-6 py-3 text-sm font-bold text-[#172018] transition hover:-translate-y-0.5"
              >
                开通 VIP
              </button>
            </div>
          ) : isYouTube ? (
            <div className="relative h-full w-full bg-black">
              <div id={ytContainerId} className="h-full w-full" />

              {/* 加载中 */}

              {!ytReady && !ytError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-emerald-300" />
                </div>
              )}

              {/* 加载失败（播放器未能就绪，离线 / 网络受限） */}

              {ytError && !ytReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black px-6 text-center">
                  <Video className="h-10 w-10 text-white/20" />

                  <p className="mt-4 text-sm font-semibold text-white/60">
                    视频源加载失败
                  </p>

                  <p className="mt-2 max-w-sm text-xs leading-5 text-white/30">
                    可能处于离线环境或网络受限。
                    可以点击下方「标记为已完成」继续学习本节。
                  </p>
                </div>
              )}
            </div>
          ) : (
            <video
              ref={videoRef}
              src={lesson.videoUrl || DEFAULT_VIDEO}
              className="h-full w-full object-contain"
              playsInline
              preload="metadata"
              crossOrigin="anonymous"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => setPlaying(true)}
              onPause={handlePause}
              onEnded={handleEnded}
              onClick={togglePlay}
            >
              {/* 中泰双语字幕（播放器可切换） */}
              <track
                ref={thTrackRef}
                kind="subtitles"
                srcLang="th"
                label="泰语字幕"
                src={lesson.subtitleUrlTh}
              />
              <track
                ref={zhTrackRef}
                kind="subtitles"
                srcLang="zh"
                label="中文字幕"
                src={lesson.subtitleUrl}
              />
            </video>
          )}


          {/* =================================================
              中央播放按钮
          ================================================= */}

          {!locked && !playing && !ytError && (
            <button
              onClick={togglePlay}
              className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white shadow-[0_0_40px_rgba(16,185,129,0.28)] backdrop-blur-md transition-all hover:scale-105 hover:border-emerald-300/40 hover:bg-emerald-400 hover:shadow-[0_0_60px_rgba(16,185,129,0.5)]"
            >
              <Play className="ml-1 h-7 w-7 fill-current" />
            </button>
          )}


          {/* 自动连播过渡提示 */}

          {autoAdvancing && (
            <div className="pointer-events-none absolute bottom-16 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-emerald-300/20 bg-black/70 px-4 py-1.5 text-xs font-medium text-emerald-200 backdrop-blur-md">
              <ListEnd className="h-3.5 w-3.5" />
              即将播放下一节…
            </div>
          )}


          {/* =================================================
              环境光晕（Emerald + Gold，播放时呼吸增强）
          ================================================= */}

          <div
            className={`pointer-events-none absolute -left-14 -top-14 z-10 h-52 w-52 rounded-full bg-emerald-500/[0.11] blur-[70px] transition-opacity duration-700 ${
              playing ? "opacity-100" : "opacity-40"
            }`}
          />

          <div
            className={`pointer-events-none absolute -bottom-14 -right-14 z-10 h-60 w-60 rounded-full bg-yellow-400/[0.09] blur-[80px] transition-opacity duration-700 ${
              playing ? "opacity-100" : "opacity-40"
            }`}
          />


          {/* =================================================
              课程完成庆祝动画（บทเรียนเสร็จแล้ว）
          ================================================= */}

          <AnimatePresence>
            {celebrating && (
              <motion.div
                key="celebrate"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.4 } }}
                className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
              >
                {/* 金色扩散光环 */}

                <motion.div
                  initial={{ scale: 0.35, opacity: 0.9 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 1.3, ease: "easeOut" }}
                  className="absolute h-52 w-52 rounded-full border-2 border-yellow-300/50"
                />

                {/* 绿色光环（延迟一环） */}

                <motion.div
                  initial={{ scale: 0.45, opacity: 0.9 }}
                  animate={{ scale: 1.6, opacity: 0 }}
                  transition={{ duration: 1, ease: "easeOut", delay: 0.18 }}
                  className="absolute h-44 w-44 rounded-full border-2 border-emerald-300/45"
                />

                {/* 金色粒子放射 */}

                {celebrateParticles.map((p, i) => (
                  <motion.div
                    key={i}
                    initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                    animate={{
                      x: Math.cos(p.angle) * p.dist,
                      y: Math.sin(p.angle) * p.dist,
                      opacity: [0, 1, 0],
                      scale: [0.4, 1, 0.5],
                    }}
                    transition={{
                      duration: 1.1,
                      ease: "easeOut",
                      delay: p.delay,
                    }}
                    style={{
                      width: p.size * 2,
                      height: p.size * 2,
                    }}
                    className={`absolute rounded-full ${
                      p.gold ? "bg-yellow-300" : "bg-emerald-300"
                    } shadow-[0_0_12px_rgba(250,204,21,0.6)]`}
                  />
                ))}

                {/* 完成徽章 */}

                <motion.div
                  initial={{ scale: 0.6, opacity: 0, y: 14 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 16,
                    delay: 0.1,
                  }}
                  className="relative flex flex-col items-center"
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border border-yellow-300/30 bg-black/70 shadow-[0_0_50px_rgba(250,204,21,0.25)] backdrop-blur-md">
                    <CheckCircle2 className="h-9 w-9 text-yellow-300" />
                  </div>

                  <div className="font-thai mt-4 text-2xl font-black text-yellow-200">
                    บทเรียนเสร็จแล้ว
                  </div>

                  <div className="mt-1 text-xs text-white/55">
                    本节已完成 · 已加入学习进度
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>


        {/* =================================================
            控制栏
        ================================================= */}

        {!locked && (
          <div className="relative border-t border-white/[0.08] bg-black/60 px-4 py-3 backdrop-blur-2xl">

            {/* 内侧高光 */}

            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* 进度条（渐变填充 + 发光滑杆） */}

            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              style={rangeStyle(
                duration > 0
                  ? (currentTime / duration) * 100
                  : 0
              )}
              className="premium-range mb-4 w-full"
            />

            <div className="flex items-center gap-3">

              {/* 播放 */}

              <button
                onClick={togglePlay}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/[0.06] hover:text-white"
              >
                {playing ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4 fill-current" />
                )}
              </button>


              {/* 时间 */}

              <span className="text-[10px] tabular-nums text-white/30">
                {formatTime(currentTime)} {" / "} {formatTime(duration)}
              </span>


              <div className="flex-1" />


              {/* 播放速度 */}

              <button
                onClick={cycleSpeed}
                title="播放速度"
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-white/40 transition hover:bg-white/[0.06] hover:text-white"
              >
                <Gauge className="h-3.5 w-3.5" />
                {playbackRate}x
              </button>


              {/* 字幕切换（中泰双语） */}

              {hasSubtitles && (
                <button
                  onClick={cycleSubtitle}
                  title="切换字幕：关 → 泰语 → 中文"
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold transition hover:bg-white/[0.06] hover:text-white ${
                    subtitleLang === "off"
                      ? "text-white/40"
                      : "text-emerald-300"
                  }`}
                >
                  <Captions className="h-3.5 w-3.5" />
                  {subtitleLabel}
                </button>
              )}


              {/* 自动连播 */}

              <button
                onClick={toggleAutoplay}
                title="自动连播：视频看完自动跳到下一节继续播放"
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold transition hover:bg-white/[0.06] hover:text-white ${
                  autoplayNext ? "text-emerald-300" : "text-white/40"
                }`}
              >
                <ListEnd className="h-3.5 w-3.5" />
                连播
              </button>


              {/* 音量 */}

              <button
                onClick={toggleMute}
                className="text-white/35 transition hover:text-white"
              >
                {muted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>


              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={muted ? 0 : volume}
                onChange={handleVolume}
                style={rangeStyle((muted ? 0 : volume) * 100)}
                className="premium-range hidden w-20 sm:block"
              />


              {/* 重播 */}

              <button
                onClick={restart}
                className="text-white/35 transition hover:text-white"
              >
                <RotateCcw className="h-4 w-4" />
              </button>


              {/* 全屏 */}

              <button
                onClick={handleFullscreen}
                className="text-white/35 transition hover:text-white"
              >
                <Maximize className="h-4 w-4" />
              </button>

            </div>

          </div>

        )}

      </motion.div>


      {/* =====================================================
          视频信息
      ===================================================== */}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">

        {/* 左侧 */}

        <div className="premium-glass rounded-3xl p-5 sm:p-6">

          <div className="flex flex-wrap items-center gap-2">

            <span className="rounded-full bg-emerald-400/[0.07] px-3 py-1.5 text-[10px] text-emerald-200/60">
              {lesson.chapter}
            </span>

            {lesson.free && (
              <span className="rounded-full bg-yellow-300/[0.07] px-3 py-1.5 text-[10px] text-yellow-200/60">
                免费试看
              </span>
            )}

          </div>


          <h1 className="mt-4 text-2xl font-black tracking-tight text-white">
            {lesson.title}
          </h1>


          <p className="mt-3 text-sm leading-6 text-white/35">
            {lesson.description}
          </p>


          <div className="mt-5 flex flex-wrap gap-4 text-xs text-white/25">

            <span className="flex items-center gap-1.5">
              <Clock3 className="h-4 w-4" />
              {lesson.duration}
            </span>

            <span className="flex items-center gap-1.5">
              <Video className="h-4 w-4" />
              视频课程
            </span>

          </div>


          {/* 完成按钮 */}

          <button
            onClick={markCompleted}
            className={`mt-6 flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ${
              completed
                ? "bg-emerald-400/10 text-emerald-200"
                : "bg-white/[0.05] text-white/60 hover:bg-emerald-400/10 hover:text-emerald-200"
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            {completed ? "已完成本节" : "标记为已完成"}
          </button>

        </div>


        {/* =================================================
            课程导航
        ================================================= */}

        <div className="premium-glass rounded-3xl p-5">

          <div className="flex items-center gap-2">
            <ListVideo className="h-4 w-4 text-emerald-300/70" />
            <span className="text-sm font-bold text-white">课程导航</span>
          </div>

          <p className="mt-1 text-[10px] text-white/25">
            {currentIndex + 1} / {lessons.length} 节
          </p>


          {/* 上下节 */}

          <div className="mt-5 grid grid-cols-2 gap-2">

            <button
              disabled={currentIndex <= 0}
              onClick={goPrevious}
              className="flex items-center justify-center gap-1 rounded-xl bg-white/[0.04] px-3 py-2.5 text-xs text-white/50 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
            >
              <ChevronLeft className="h-4 w-4" />
              上一节
            </button>

            <button
              onClick={goNext}
              disabled={
                currentIndex >= lessons.length - 1 ||
                (course.isVip &&
                  lessons[currentIndex + 1] &&
                  !lessons[currentIndex + 1].free &&
                  !isVipUser)
              }
              className="flex items-center justify-center gap-1 rounded-xl bg-emerald-400/[0.08] px-3 py-2.5 text-xs text-emerald-200/70 transition hover:bg-emerald-400/[0.13] hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-20"
            >
              下一节
              <ChevronRight className="h-4 w-4" />
            </button>

          </div>


          {/* 自动学习提示 */}

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-300/[0.06] bg-emerald-400/[0.035] p-3">

            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300/50" />

            <p className="text-[10px] leading-5 text-white/25">
              播放进度达到 90% 或自然看完，系统会自动记录本节完成。
              刷新页面后学习进度不会丢失。
            </p>

          </div>

        </div>

      </div>


      {/* =====================================================
          底部导航
      ===================================================== */}

      <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">

        <button
          onClick={goPrevious}
          disabled={currentIndex <= 0}
          className="flex items-center gap-2 text-xs text-white/30 transition hover:text-white disabled:opacity-20"
        >
          <ChevronLeft className="h-4 w-4" />
          上一节
        </button>

        <span className="text-[10px] text-white/20">
          ThaiAI · 视频课程
        </span>

        <button
          onClick={goNext}
          className="flex items-center gap-2 text-xs text-emerald-300/60 transition hover:text-emerald-200"
        >
          下一节
          <ChevronRight className="h-4 w-4" />
        </button>

      </div>

      {/* VIP 权益面板 */}

      <VipPanel
        open={vipOpen}
        onClose={() => setVipOpen(false)}
      />

    </div>
  );
}
