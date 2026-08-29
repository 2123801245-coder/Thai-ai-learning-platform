import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Mic,
  Sparkles,
  BookOpen,
  Volume2,
  Crown,
  Type,
  AlignLeft,
  Lock,
} from "lucide-react";

import Navbar from "@/components/Navbar";
import SpeakingRecorder from "@/components/speaking/SpeakingRecorder";
import VipPanel from "@/components/common/VipPanel";
import { base44 } from "@/api/base44Client";
import { localVocabulary } from "@/data/vocabulary";
import {
  speakingSentences,
  speakingParagraphs,
} from "@/data/speakingMaterials";
import { useAuth } from "@/lib/AuthContext";
import { API_BASE_URL } from "@/lib/api";
import {
  ThaiCorner,
  ThaiSectionDivider,
  ParticleField,
} from "@/components/common/ThaiDecor";

/* 练习模式定义 */
const MODES = [
  {
    key: "word",
    label: "单词",
    icon: Type,
    desc: "单个词发音",
  },
  {
    key: "sentence",
    label: "句子",
    icon: AlignLeft,
    desc: "完整句型跟读",
  },
  {
    key: "paragraph",
    label: "段落",
    icon: BookOpen,
    desc: "短文连读语感",
  },
];

export default function SpeakingPractice() {
  const location = useLocation();

  /* 旧版独立路由 /speaking-practice 保留顶部 Navbar；
     MainLayout 内的 /speaking 由侧边栏+底部导航接管 */

  const isStandalone = location.pathname === "/speaking-practice";

  const { user } = useAuth();
  const isVip = !!user?.isVip;

  const [mode, setMode] = useState("word");
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [azureReady, setAzureReady] = useState(false);
  const [vipOpen, setVipOpen] = useState(false);

  /* 探测后端 Azure 专业评测状态 */

  useEffect(() => {
    let alive = true;

    fetch(`${API_BASE_URL}/speaking/health`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && d?.azureConfigured) {
          setAzureReady(true);
        }
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      let data = null;

      if (mode === "sentence") {
        data = speakingSentences;
      } else if (mode === "paragraph") {
        data = speakingParagraphs;
      } else {
        /* 单词模式：优先云端词库；失败或为空时用本地内置词库（离线可用） */

        try {
          const remote =
            await base44.entities.Vocabulary.list(
              "-created_date",
              50
            );

          if (remote && remote.length > 0) {
            data = remote;
          }
        } catch (error) {
          console.error(
            "加载云端词汇失败，使用本地词库:",
            error
          );
        }

        if (!data) {
          data = localVocabulary;
        }
      }

      setWords(data || []);
      setLoading(false);
    };

    setLoading(true);
    load();
  }, [mode]);

  return (
    <div className="relative min-h-screen text-white">

      {/* 独立路由自带背景氛围 + 顶部导航 */}

      {isStandalone && (
        <>
          <div className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-emerald-500/[0.09] blur-[130px]" />
            <div className="absolute right-[-180px] top-[8%] h-[500px] w-[500px] rounded-full bg-yellow-400/[0.055] blur-[130px]" />
            <div className="absolute bottom-[-240px] left-[35%] h-[520px] w-[520px] rounded-full bg-teal-400/[0.06] blur-[130px]" />
          </div>

          <Navbar />
        </>
      )}

      <main className="relative z-10 mx-auto max-w-[1200px] px-4 py-6 pb-28 sm:px-6 lg:px-8">
        {/* =========================
            Hero
        ========================= */}

        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-7"
        >
          {/* 霓虹 teal 粒子场（AI Voice 记忆点） */}

          <ParticleField
            color="#5eead4"
            opacity={0.32}
          />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.22em] text-emerald-300/80">
                <Sparkles className="h-4 w-4" />
                THAI SPEAKING LAB
              </div>

              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                口语练习
                <span className="ml-3 bg-gradient-to-r from-emerald-300 via-teal-200 to-yellow-300 bg-clip-text text-transparent">
                  Speaking
                </span>
              </h1>

              <p className="mt-2 text-sm text-white/40 sm:text-base">
                {azureReady
                  ? "开口说泰语，AI 逐音素评分发音"
                  : "开口说泰语，浏览器本地识别发音"}
              </p>

              {!isVip && (
                <button
                  onClick={() => setVipOpen(true)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-yellow-300/20 bg-yellow-300/[0.07] px-3.5 py-1.5 text-[11px] font-semibold text-yellow-200/90 transition hover:bg-yellow-300/[0.12]"
                >
                  <Crown className="h-3.5 w-3.5" />
                  句子 / 段落为 VIP 专属 · 单词免费练习
                </button>
              )}
            </div>

            <div
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 ${
                azureReady
                  ? "border-emerald-300/20 bg-emerald-300/[0.07]"
                  : "border-yellow-300/10 bg-yellow-300/[0.05]"
              }`}
            >
              <Mic
                className={`h-4 w-4 ${
                  azureReady
                    ? "text-emerald-300/90"
                    : "text-yellow-300/80"
                }`}
              />

              <span
                className={`text-xs ${
                  azureReady
                    ? "text-emerald-200/80"
                    : "text-white/50"
                }`}
              >
                {azureReady
                  ? "专业评测已就绪 · Azure 音素级声学评分"
                  : "AI 评分服务准备中"}
              </span>
            </div>
          </div>
        </motion.div>

        {/* =========================
            模式切换
        ========================= */}

        <ThaiSectionDivider
          className="mb-5 max-w-md"
          compact
        />

        <div className="mb-6 grid grid-cols-3 gap-3">
          {MODES.map((m) => {
            const Icon = m.icon;

            /* 单词模式免费；句子/段落为 VIP 专属 */
            const locked =
              m.key !== "word" && !isVip;

            return (
              <button
                key={m.key}
                onClick={() => {
                  if (locked) {
                    setVipOpen(true);
                    return;
                  }

                  setMode(m.key);
                }}
                className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition-all ${
                  mode === m.key
                    ? "border-emerald-300/25 bg-gradient-to-br from-emerald-400/[0.10] via-white/[0.03] to-yellow-300/[0.05]"
                    : locked
                    ? "border-white/[0.08] bg-white/[0.02]"
                    : "border-white/[0.08] bg-white/[0.035] hover:border-emerald-300/15"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                      mode === m.key
                        ? "border-emerald-300/25 bg-emerald-400/[0.12]"
                        : locked
                        ? "border-yellow-300/15 bg-yellow-300/[0.06]"
                        : "border-white/[0.08] bg-white/[0.05]"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 ${
                        mode === m.key
                          ? "text-emerald-300"
                          : locked
                          ? "text-yellow-300/70"
                          : "text-white/50"
                      }`}
                    />
                  </div>

                  {locked && (
                    <Lock className="h-3.5 w-3.5 text-yellow-300/60" />
                  )}
                </div>

                <p className="mt-2.5 text-sm font-bold text-white/85">
                  {m.label}
                </p>

                <p className="mt-0.5 text-[10px] text-white/30">
                  {locked ? "VIP 专属" : m.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* =========================
            数据概览
        ========================= */}

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SpeakingStat
            icon={BookOpen}
            label={
              mode === "word"
                ? "练习词汇"
                : mode === "sentence"
                ? "练习句子"
                : "练习段落"
            }
            value={loading ? "—" : words.length}
            suffix={
              mode === "word"
                ? "词"
                : mode === "sentence"
                ? "句"
                : "段"
            }
          />

          <SpeakingStat
            icon={Mic}
            label="识别方式"
            value={azureReady ? "专业" : "本地"}
            suffix={azureReady ? "评测" : "识别"}
            highlight={azureReady}
          />

          <SpeakingStat
            icon={Volume2}
            label="训练目标"
            value={mode === "word" ? "发音" : mode === "sentence" ? "句型" : "语感"}
            suffix="准确度"
          />
        </div>

        {/* =========================
            Recorder
            （单词模式免费；句子/段落为 VIP，点击时弹面板）
        ========================= */}

        {!isVip && mode !== "word" ? (
          <VipLockCard onOpen={() => setVipOpen(true)} />
        ) : loading ? (
          <LoadingState />
        ) : words.length === 0 ? (
          <EmptyState />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.035] p-2 shadow-2xl backdrop-blur-xl sm:p-3">
              <SpeakingRecorder
                words={words}
                mode={mode}
                onVipRequired={() =>
                  setVipOpen(true)
                }
              />
            </div>
          </motion.div>
        )}

        {/* =========================
            Tips
        ========================= */}

        {!loading && words.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-5 rounded-2xl border border-yellow-300/[0.08] bg-gradient-to-r from-yellow-300/[0.05] via-white/[0.02] to-emerald-400/[0.04] p-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-yellow-300/[0.08]">
                <Sparkles className="h-4 w-4 text-yellow-300/70" />
              </div>

              <div>
                <p className="text-xs font-semibold text-white/70">
                  练习小提示
                </p>

                <p className="mt-1 text-xs leading-relaxed text-white/30">
                  先听标准发音，再大声朗读。不要急着追求速度，
                  尽量模仿泰语的声调、长短音和语气。
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* VIP 开通面板（句子/段落模式为 VIP 专属） */}

      <VipPanel
        open={vipOpen}
        onClose={() => setVipOpen(false)}
      />
    </div>
  );
}


/* =========================
   Speaking Stat
========================= */

function SpeakingStat({
  icon: Icon,
  label,
  value,
  suffix,
  highlight = false,
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`
        relative
        overflow-hidden
        rounded-2xl
        border
        p-4
        backdrop-blur-xl
        ${
          highlight
            ? "border-yellow-300/25 bg-gradient-to-br from-yellow-300/[0.08] via-white/[0.03] to-emerald-400/[0.05]"
            : "border-white/[0.08] bg-white/[0.035]"
        }
      `}
    >
      <div
        className={`absolute -right-8 -top-8 h-20 w-20 rounded-full blur-2xl ${
          highlight
            ? "bg-yellow-300/[0.10]"
            : "bg-emerald-400/[0.05]"
        }`}
      />

      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
              highlight
                ? "border-yellow-300/20 bg-yellow-300/[0.10]"
                : "border-white/[0.08] bg-white/[0.05]"
            }`}
          >
            <Icon
              className={`h-4 w-4 ${
                highlight
                  ? "text-yellow-300"
                  : "text-emerald-300"
              }`}
            />
          </div>
        </div>

        <div className="flex items-baseline gap-1">
          <span
            className={`text-xl font-bold tracking-tight ${
              highlight
                ? "bg-gradient-to-r from-yellow-200 via-yellow-100 to-emerald-200 bg-clip-text text-transparent"
                : "text-white"
            }`}
          >
            {value}
          </span>

          <span className="text-xs text-white/30">
            {suffix}
          </span>
        </div>

        <p className="mt-1 text-xs text-white/35">
          {label}
        </p>
      </div>
    </motion.div>
  );
}


/* =========================
   VIP 锁定卡
========================= */

function VipLockCard({ onOpen }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="gold-shimmer relative overflow-hidden rounded-[28px] border border-yellow-300/20 bg-gradient-to-br from-yellow-300/[0.06] via-white/[0.02] to-emerald-400/[0.05] p-10 text-center shadow-2xl backdrop-blur-2xl"
    >
      <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-yellow-400/[0.10] blur-3xl" />

      <div className="pointer-events-none absolute -right-20 bottom-10 h-56 w-56 rounded-full bg-emerald-400/[0.07] blur-3xl" />

      <div className="relative">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-yellow-300/25 bg-gradient-to-br from-yellow-300/[0.15] to-amber-500/[0.08]">
          <Crown className="h-9 w-9 text-yellow-300" />
        </div>

        <h2 className="mt-6 text-2xl font-black tracking-tight text-white">
          口语练习为 <span className="bg-gradient-to-r from-yellow-200 via-yellow-100 to-emerald-200 bg-clip-text text-transparent">VIP 专属</span> 功能
        </h2>

        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/40">
          解锁专业发音评测、单词 / 句子 / 段落三种练习模式，
          AI 逐音素分析你的泰语发音。
        </p>

        <div className="mx-auto mt-6 grid max-w-lg grid-cols-3 gap-3">
          {["单词练习", "句型跟读", "短文连读"].map(
            (label, i) => (
              <div
                key={label}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-4"
              >
                <p className="text-lg font-bold text-yellow-200/80">
                  {["01", "02", "03"][i]}
                </p>

                <p className="mt-1 text-[11px] text-white/40">
                  {label}
                </p>
              </div>
            )
          )}
        </div>

        <button
          onClick={onOpen}
          className="mx-auto mt-7 flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-300 to-amber-400 px-8 py-3 text-sm font-bold text-[#172018] transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-yellow-900/30"
        >
          <Crown className="h-4 w-4" />
          立即开通 VIP
        </button>
      </div>
    </motion.div>
  );
}


/* =========================
   Loading
========================= */

function LoadingState() {
  return (
    <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.035] px-6 py-24 text-center backdrop-blur-xl">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-emerald-300" />

      <p className="mt-5 text-sm text-white/40">
        正在准备口语练习...
      </p>
    </div>
  );
}


/* =========================
   Empty
========================= */

function EmptyState() {
  return (
    <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.035] px-6 py-24 text-center backdrop-blur-xl">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-300/10 bg-emerald-400/[0.05]">
        <Mic className="h-9 w-9 text-emerald-300/40" />
      </div>

      <h3 className="mt-5 text-base font-semibold text-white/70">
        暂时没有可练习的词汇
      </h3>

      <p className="mt-2 text-sm text-white/30">
        请先在词汇学习中添加一些泰语单词
      </p>
    </div>
  );
}