import React from "react";
import { Link } from "react-router-dom";
import {
  Target,
  Mic,
  MessageCircle,
  Grid3X3,
  Type,
  Braces,
  Headphones,
  ListX,
  Trophy,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { prefetchRoute } from "@/lib/routePrefetch";
import { useFeatureFlag } from "@/lib/features";

/* =========================================================
   练习中心 · Practice
   - 移动端底部导航「练习」Tab 的落地页
   - 汇总全部练习板块：闭环 / 口语 / 情景对话 / 词汇 / 句子 / 分词 / 听力 / 错题 / 挑战
========================================================= */

const GROUPS = [
  {
    name: "核心练习",
    desc: "每天 12 分钟，跟着 AI 老师练起来",
    items: [
      { to: "/loop", label: "今日学习闭环", desc: "学 · 练 · 测 · 复习", icon: Target, tone: "text-emerald-300 bg-emerald-400/10 border-emerald-300/20" },
      { to: "/speaking", label: "口语练习", desc: "四维评分 + AI 教练", icon: Mic, tone: "text-cyan-300 bg-cyan-400/10 border-cyan-300/20", vip: true },
      { to: "/conversation", label: "AI 情景对话", desc: "16 个真实场景角色扮演", icon: MessageCircle, tone: "text-pink-300 bg-pink-400/10 border-pink-300/20" },
    ],
  },
  {
    name: "词汇与句子",
    desc: "词书联动，哪里薄弱练哪里",
    items: [
      { to: "/vocab-match", label: "词汇配对", desc: "泰 ↔ 中速配", icon: Grid3X3, tone: "text-yellow-200 bg-yellow-300/10 border-yellow-300/20" },
      { to: "/sentence-fill", label: "句子填空", desc: "选词填空练句型", icon: Type, tone: "text-amber-200 bg-amber-300/10 border-amber-300/20" },
      { to: "/word-segment", label: "分词练习", desc: "句子里拆词", icon: Braces, tone: "text-orange-300 bg-orange-400/10 border-orange-300/20" },
    ],
  },
  {
    name: "进阶与巩固",
    desc: "听真实语料，查漏补缺",
    items: [
      { to: "/corpus/listening", label: "新闻听力", desc: "ThaiPBS 每日逐句练", icon: Headphones, tone: "text-sky-300 bg-sky-400/10 border-sky-300/20", vip: true },
      { to: "/wrong-notebook", label: "错题本", desc: "错词错句一键复习", icon: ListX, tone: "text-rose-300 bg-rose-400/10 border-rose-300/20" },
      { to: "/challenges", label: "挑战赛", desc: "限时闯关赢称号", icon: Trophy, tone: "text-purple-300 bg-purple-400/10 border-purple-300/20" },
    ],
  },
];

export default function Practice() {
  const aiTeacher = useFeatureFlag("aiTeacher");

  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((it) =>
      it.to === "/conversation" ? aiTeacher : true
    ),
  }));

  return (
    <div className="mx-auto max-w-5xl">
      {/* 页头 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/60">
          <Sparkles className="h-3.5 w-3.5" />
          Practice · ฝึ ก
        </div>
        <h1 className="mt-1.5 text-2xl font-black tracking-tight text-white sm:text-3xl">
          练习中心
        </h1>
        <p className="mt-1.5 max-w-xl text-sm leading-6 text-white/45">
          所有练习板块与你的词书、错题本、学习记录联动。AI 老师会根据你的表现推荐今天最该练的方向。
        </p>
      </div>

      {/* 练习分组 */}
      <div className="space-y-8">
        {groups.map((group) => (
          <section key={group.name}>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="text-base font-bold text-white/90">
                  {group.name}
                </h2>
                <p className="mt-0.5 text-xs text-white/35">{group.desc}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onMouseEnter={() => prefetchRoute(item.to)}
                    className="group relative flex flex-col gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3.5 transition hover:border-emerald-300/25 hover:bg-white/[0.07]"
                  >
                    <div className="flex items-start justify-between">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${item.tone}`}>
                        <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                      </span>
                      {item.vip && (
                        <span className="rounded-full border border-amber-300/25 bg-amber-400/[0.1] px-1.5 py-px text-[9px] font-bold text-amber-300/90">
                          VIP
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white/90">
                        {item.label}
                      </div>
                      <div className="mt-0.5 text-[11px] leading-4 text-white/35">
                        {item.desc}
                      </div>
                    </div>
                    <span className="mt-auto flex items-center gap-1 text-[10px] font-semibold text-emerald-300/50 transition group-hover:text-emerald-300">
                      开始练习 <ArrowRight className="h-3 w-3" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* AI 老师引导 */}
      <div className="mt-10 rounded-2xl border border-emerald-300/15 bg-gradient-to-br from-emerald-400/[0.08] via-transparent to-teal-400/[0.04] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-300/25 bg-gradient-to-br from-[#0e241f] to-[#0a1615]">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/[0.12] [animation-duration:3s]" style={{ pointerEvents: "none" }} />
              <Sparkles className="h-5 w-5 text-emerald-300" />
            </span>
            <div>
              <div className="text-sm font-bold text-white/90">
                不知道今天练什么？
              </div>
              <p className="mt-0.5 text-xs text-white/40">
                让 AI 老师根据你的水平和学习记录安排今日练习
              </p>
            </div>
          </div>
          <Link
            to="/conversation"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-[#061513] transition hover:bg-emerald-300"
          >
            问 AI 老师 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
