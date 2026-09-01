// src/components/ai/SceneCertificate.jsx
// =========================================================
// 场景完成证书 — 可截图分享的成就卡片
// =========================================================

import React, { useRef } from "react";
import { motion } from "framer-motion";
import { Download, Share2, Trophy, BookOpen, MessageCircle, User, Calendar, Star, Sparkles } from "lucide-react";

export default function SceneCertificate({
  sceneTitle,
  sceneSubtitle,
  characterName,
  vocabLearned,
  stagesComplete,
  totalStages,
  sceneEmoji,
  date,
}) {
  const cardRef = useRef(null);

  const displayDate = date || new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // 根据词汇数评星
  const stars = vocabLearned >= 12 ? 3 : vocabLearned >= 6 ? 2 : 1;

  // 保存为图片（canvas 截图）
  const handleDownload = async () => {
    try {
      const { default: html2canvas } = await import("html2canvas");
      const el = cardRef.current;
      if (!el) return;
      const canvas = await html2canvas(el, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `ThaiAI-${sceneTitle}-证书.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      // html2canvas 未安装时降级：提示用户截图
      alert("长按或右键保存截图即可分享证书");
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `ThaiAI 场景完成证书 — ${sceneTitle}`,
          text: `我在 ThaiAI 完成了「${sceneTitle}」场景对话！学习了 ${vocabLearned} 个词汇，完成了 ${stagesComplete} 轮对话。🎭`,
          url: window.location.href,
        });
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "backOut" }}
      className="space-y-4"
    >
      {/* 证书卡片 */}
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-3xl border border-emerald-300/20 bg-gradient-to-br from-[#0a1f1a] via-[#0d2a22] to-[#081a15] p-6 sm:p-8"
      >
        {/* 顶部装饰 */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-400/[0.06] blur-3xl" />
          <div className="absolute -bottom-12 left-[30%] h-36 w-36 rounded-full bg-yellow-300/[0.04] blur-3xl" />
          {/* 金线角饰 */}
          <svg className="absolute left-4 top-4 h-8 w-8 text-yellow-300/30" viewBox="0 0 32 32" fill="none">
            <path d="M0 12 L0 0 L12 0" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <svg className="absolute right-4 top-4 h-8 w-8 text-yellow-300/30" viewBox="0 0 32 32" fill="none">
            <path d="M32 12 L32 0 L20 0" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <svg className="absolute bottom-4 left-4 h-8 w-8 text-yellow-300/30" viewBox="0 0 32 32" fill="none">
            <path d="M0 20 L0 32 L12 32" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <svg className="absolute bottom-4 right-4 h-8 w-8 text-yellow-300/30" viewBox="0 0 32 32" fill="none">
            <path d="M32 20 L32 32 L20 32" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>

        <div className="relative text-center">
          {/* 奖杯 */}
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300/20 to-emerald-400/10 border border-yellow-300/20">
            <Trophy className="h-8 w-8 text-yellow-300" />
          </div>

          {/* 标题 */}
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4 text-yellow-300/60" />
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-yellow-300/60">
              SCENE COMPLETE
            </span>
            <Sparkles className="h-4 w-4 text-yellow-300/60" />
          </div>

          <h2 className="mt-3 text-xl font-black text-white sm:text-2xl">
            {sceneEmoji} {sceneTitle}
          </h2>
          {sceneSubtitle && (
            <p className="mt-1 text-xs text-emerald-300/50">{sceneSubtitle}</p>
          )}

          {/* 星级 */}
          <div className="mt-4 flex items-center justify-center gap-1">
            {[1, 2, 3].map((i) => (
              <Star
                key={i}
                className={`h-5 w-5 ${
                  i <= stars
                    ? "text-yellow-300 fill-yellow-300"
                    : "text-white/10"
                }`}
              />
            ))}
          </div>

          {/* 分割线 */}
          <div className="mx-auto my-5 h-px w-48 bg-gradient-to-r from-transparent via-emerald-300/20 to-transparent" />

          {/* 数据卡片 */}
          <div className="mx-auto grid max-w-sm grid-cols-3 gap-3">
            <div className="rounded-xl border border-emerald-300/10 bg-emerald-400/[0.05] p-3">
              <BookOpen className="mx-auto h-4 w-4 text-emerald-300/60" />
              <div className="mt-2 text-2xl font-black text-emerald-300">{vocabLearned}</div>
              <div className="mt-0.5 text-[10px] text-white/30">学习词汇</div>
            </div>
            <div className="rounded-xl border border-yellow-300/10 bg-yellow-300/[0.05] p-3">
              <MessageCircle className="mx-auto h-4 w-4 text-yellow-300/60" />
              <div className="mt-2 text-2xl font-black text-yellow-300">{stagesComplete}</div>
              <div className="mt-0.5 text-[10px] text-white/30">对话轮数</div>
            </div>
            <div className="rounded-xl border border-purple-300/10 bg-purple-400/[0.05] p-3">
              <User className="mx-auto h-4 w-4 text-purple-300/60" />
              <div className="mt-2 text-sm font-bold text-purple-300 truncate">{characterName || "AI 老师"}</div>
              <div className="mt-0.5 text-[10px] text-white/30">对话角色</div>
            </div>
          </div>

          {/* 日期 + 品牌 */}
          <div className="mx-auto mt-5 flex max-w-sm items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] text-white/20">
              <Calendar className="h-3 w-3" />
              {displayDate}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-300/40">
              <span className="text-lg">🇹🇭</span>
              ThaiAI
            </div>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-center gap-3">
        <button
          onClick={handleShare}
          className="flex items-center gap-2 rounded-xl bg-emerald-400/10 border border-emerald-300/20 px-5 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/20"
        >
          <Share2 className="h-4 w-4" />
          分享证书
        </button>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm text-white/60 transition hover:bg-white/[0.08]"
        >
          <Download className="h-4 w-4" />
          保存图片
        </button>
      </div>
    </motion.div>
  );
}
