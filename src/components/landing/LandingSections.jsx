import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Check,
  Clapperboard,
  Crown,
  Landmark,
  Mic,
  Quote,
  Sparkles,
  Target,
  Trophy,
  Users,
  Volume2,
} from "lucide-react";
import {
  DEFAULT_PLANS,
  FIRST_PURCHASE_PLAN,
  SUPPORT_CONFIG,
} from "@/lib/vipConfig";

/* =========================================================
   登录页 / 落地页：Apple 软件风营销区
   - 排版：系统字体（SF Pro）、紧字距、大留白、近黑文字
   - 结构：Features / Pricing / Community / Footer
   - 数据：价格直接取自 vipConfig，与站内 VIP 面板同源
========================================================= */

/* 导航锚点（Login.jsx 的顶部导航与这里共用） */
export const NAV_ITEMS = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Community", href: "#community" },
];

const INK = "#1d1d1f";
const INK_SOFT = "#6e6e73";

/* ---------- 通用排版零件 ---------- */

function SectionShell({ id, children, tone = "cream" }) {
  return (
    <section
      id={id}
      className={`scroll-mt-16 px-6 py-20 sm:px-8 sm:py-28 lg:py-32 ${
        tone === "white" ? "bg-white" : "bg-[#fbfbfd]"
      }`}
    >
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

function SectionHead({ eyebrow, title, accent, sub }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#0b7a5a]">
        {eyebrow}
      </p>
      <h2
        className="mt-3 text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[42px] lg:text-[54px]"
        style={{ color: INK }}
      >
        {title}
        {accent ? (
          <>
            {" "}
            <span
              className="italic"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              {accent}
            </span>
          </>
        ) : null}
      </h2>
      {sub ? (
        <p
          className="mx-auto mt-4 max-w-2xl text-[16px] leading-relaxed sm:text-[18px]"
          style={{ color: INK_SOFT }}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}

/* ---------- Features ---------- */

const FEATURES = [
  {
    Icon: Sparkles,
    title: "AI Conversation",
    cn: "AI 对话陪练",
    desc: "24 小时在线的泰语老师，实时纠正用词与语序，并给出更地道的说法。",
  },
  {
    Icon: Volume2,
    title: "Tones & Pronunciation",
    cn: "声调发音课",
    desc: "五个声调逐个拆解，跟读即时打分，把最容易听错的音练准。",
  },
  {
    Icon: BookOpen,
    title: "5,000+ Vocabulary",
    cn: "词汇与词书",
    desc: "按主题、等级与考试大纲编排的词书，配记忆曲线自动安排复习。",
  },
  {
    Icon: Mic,
    title: "Speaking Practice",
    cn: "口语练习",
    desc: "情景对话脚本 + 录音回放，从点单、砍价到面试都能张口就来。",
  },
  {
    Icon: Landmark,
    title: "Culture Universe",
    cn: "泰国文化宇宙",
    desc: "以城市、节日与影视作品为线索，边逛边学，语言和文化一起长。",
  },
  {
    Icon: Target,
    title: "Daily Plan",
    cn: "每日计划",
    desc: "每天一节课、一份任务清单，学完自动打卡，进度看得见。",
  },
];

const STATS = [
  { value: "5,000+", label: "泰语词汇" },
  { value: "18", label: "主题词书" },
  { value: "3", label: "种测验模式" },
  { value: "10 min", label: "每日一节课" },
];

export function FeaturesSection() {
  return (
    <SectionShell id="features" tone="cream">
      <SectionHead
        eyebrow="Features"
        title="Everything you need to"
        accent="speak Thai."
        sub="从认字、发音到开口对话，六件事组成一条完整闭环——每天 10 分钟，进步可量化。"
      />

      <div className="mt-14 grid gap-4 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {FEATURES.map(({ Icon, title, cn, desc }) => (
          <div
            key={title}
            className="group rounded-[22px] border border-black/[0.06] bg-white p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_44px_rgba(0,0,0,0.09)]"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#f5f5f7] text-[#0b7a5a] transition group-hover:bg-[#0b7a5a] group-hover:text-white">
              <Icon className="h-[22px] w-[22px]" strokeWidth={1.8} />
            </div>
            <h3
              className="mt-5 text-[19px] font-semibold tracking-[-0.01em]"
              style={{ color: INK }}
            >
              {title}
            </h3>
            <p className="mt-1 text-[13px] font-medium text-[#0b7a5a]">{cn}</p>
            <p
              className="mt-3 text-[15px] leading-relaxed"
              style={{ color: INK_SOFT }}
            >
              {desc}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-14 grid grid-cols-2 gap-y-10 border-t border-black/[0.07] pt-12 sm:mt-16 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="text-center">
            <div
              className="text-[30px] font-semibold tracking-[-0.03em] sm:text-[38px]"
              style={{ color: INK }}
            >
              {s.value}
            </div>
            <div className="mt-1 text-[14px]" style={{ color: INK_SOFT }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

/* ---------- Pricing ---------- */

/* 套餐权益：基础三项人人都有，按档位递进 */
const PLAN_PERKS = {
  月度: ["全部课程与词书", "AI 对话无限次", "声调发音练习"],
  季度: ["月度全部权益", "文化宇宙全部展区", "媒体课与错题本解锁"],
  年度: ["季度全部权益", "新功能抢先体验", "专属学习报告"],
};

const COMMON_PERKS = ["无自动续费", "支持微信 / 支付宝", "跨设备同步学习进度"];

function perMonth(p) {
  return (p.amount / (p.days / 30)).toFixed(p.days >= 365 ? 0 : 1);
}

export function PricingSection() {
  const highlightLabel = "年度";

  return (
    <SectionShell id="pricing" tone="white">
      <SectionHead
        eyebrow="Pricing"
        title="One membership."
        accent="Every course."
        sub="一次购买固定时长，没有自动续费、没有隐藏费用。先免费试用，满意再升级。"
      />

      <div className="mt-14 grid gap-5 sm:mt-16 lg:grid-cols-3">
        {DEFAULT_PLANS.map((p) => {
          const isHot = p.label === highlightLabel;
          return (
            <div
              key={p.label}
              className={`relative flex flex-col rounded-[26px] p-7 transition duration-300 sm:p-8 ${
                isHot
                  ? "bg-[#1d1d1f] shadow-[0_24px_70px_rgba(0,0,0,0.22)] lg:-mt-3 lg:mb-3"
                  : "border border-black/[0.07] bg-[#fbfbfd] hover:shadow-[0_14px_44px_rgba(0,0,0,0.08)]"
              }`}
            >
              {isHot && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#e8c26a] to-[#0b7a5a] px-3.5 py-1 text-[11px] font-semibold tracking-wide text-white shadow-sm">
                  最超值
                </span>
              )}

              <div className="flex items-center gap-2">
                <h3
                  className={`text-[17px] font-semibold ${
                    isHot ? "text-white" : ""
                  }`}
                  style={isHot ? undefined : { color: INK }}
                >
                  {p.label}会员
                </h3>
                {isHot && <Crown className="h-4 w-4 text-[#e8c26a]" />}
              </div>

              <div className="mt-5 flex items-end gap-2">
                <span
                  className={`text-[46px] font-semibold leading-none tracking-[-0.04em] ${
                    isHot ? "text-white" : ""
                  }`}
                  style={isHot ? undefined : { color: INK }}
                >
                  ¥{p.amount}
                </span>
                <span
                  className={`pb-1 text-[14px] ${isHot ? "text-white/60" : ""}`}
                  style={isHot ? undefined : { color: INK_SOFT }}
                >
                  / {p.days} 天
                </span>
              </div>
              <p
                className={`mt-1.5 text-[13px] ${isHot ? "text-white/55" : ""}`}
                style={isHot ? undefined : { color: INK_SOFT }}
              >
                折合每月约 ¥{perMonth(p)}
              </p>

              <ul className="mt-7 flex-1 space-y-3">
                {PLAN_PERKS[p.label].map((perk) => (
                  <li key={perk} className="flex items-start gap-2.5">
                    <Check
                      className={`mt-[3px] h-4 w-4 flex-shrink-0 ${
                        isHot ? "text-[#7fe0bb]" : "text-[#0b7a5a]"
                      }`}
                      strokeWidth={2.5}
                    />
                    <span
                      className={`text-[15px] ${isHot ? "text-white/85" : ""}`}
                      style={isHot ? undefined : { color: INK }}
                    >
                      {perk}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                to="/register"
                className={`mt-8 flex h-11 items-center justify-center gap-1.5 rounded-full text-[15px] font-medium transition ${
                  isHot
                    ? "bg-white text-[#1d1d1f] hover:bg-white/90"
                    : "bg-[#1d1d1f] text-white hover:bg-black"
                }`}
              >
                开通{p.label}会员
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          );
        })}
      </div>

      {/* 首充优惠 + 通用权益 */}
      <div className="mt-10 overflow-hidden rounded-[22px] border border-[#e8c26a]/40 bg-gradient-to-r from-[#fdf7e8] to-[#f6fbf8] px-6 py-6 sm:px-8">
        <p className="text-center text-[15px] font-medium" style={{ color: INK }}>
          🎁 首次开通月卡仅 ¥{FIRST_PURCHASE_PLAN.amount}
          <span className="mx-2 text-black/20">|</span>
          每位用户限享一次
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
        {COMMON_PERKS.map((perk) => (
          <span
            key={perk}
            className="flex items-center gap-1.5 text-[13px]"
            style={{ color: INK_SOFT }}
          >
            <Check className="h-3.5 w-3.5 text-[#0b7a5a]" strokeWidth={2.5} />
            {perk}
          </span>
        ))}
      </div>

      <p className="mt-6 text-center text-[13px]" style={{ color: INK_SOFT }}>
        需要人工开通或咨询？客服微信{" "}
        <span className="font-medium" style={{ color: INK }}>
          {SUPPORT_CONFIG.wechatId}
        </span>
      </p>
    </SectionShell>
  );
}

/* ---------- Community ---------- */

const VOICES = [
  {
    quote:
      "声调一直是我最大的坎。跟读打分练了两周，泰国同事终于不用再猜我在说什么了。",
    name: "小林",
    meta: "曼谷 · 外派工程师",
  },
  {
    quote:
      "每天下班一节课，10 分钟。三个月后能在菜市场和摊主砍价，孩子都惊了。",
    name: "Amy",
    meta: "清迈 · 旅居两年",
  },
  {
    quote:
      "文化宇宙那一块很上头，看完节日展签再去听歌，歌词突然就听懂了。",
    name: "阿哲",
    meta: "上海 · 泰剧爱好者",
  },
];

const HUB = [
  {
    Icon: Trophy,
    title: "排行榜",
    desc: "每日学习时长与打卡天数榜，和同伴一起坚持。",
    to: "/ranking",
  },
  {
    Icon: Users,
    title: "学习计划",
    desc: "AI 按你的水平生成每日任务，完成即自动打卡。",
    to: "/plan",
  },
  {
    Icon: Clapperboard,
    title: "媒体课",
    desc: "新闻、歌曲与影视片段拆解，在真实语料里泡着学。",
    to: "/media",
  },
];

export function CommunitySection() {
  return (
    <SectionShell id="community" tone="cream">
      <SectionHead
        eyebrow="Community"
        title="Learn better"
        accent="together."
        sub="一个人容易半途而废，一群人能走很远。打卡、榜单、交流，都在这里。"
      />

      <div className="mt-14 grid gap-5 sm:mt-16 lg:grid-cols-3">
        {VOICES.map((v) => (
          <figure
            key={v.name}
            className="flex h-full flex-col rounded-[22px] border border-black/[0.06] bg-white p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <Quote className="h-6 w-6 text-[#e8c26a]" strokeWidth={2} />
            <blockquote
              className="mt-4 flex-1 text-[16px] leading-relaxed"
              style={{ color: INK }}
            >
              {v.quote}
            </blockquote>
            <figcaption className="mt-6 border-t border-black/[0.06] pt-4">
              <div className="text-[15px] font-semibold" style={{ color: INK }}>
                {v.name}
              </div>
              <div className="text-[13px]" style={{ color: INK_SOFT }}>
                {v.meta}
              </div>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {HUB.map(({ Icon, title, desc, to }) => (
          <Link
            key={title}
            to={to}
            className="group flex items-start gap-4 rounded-[20px] border border-black/[0.06] bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-[0_14px_44px_rgba(0,0,0,0.08)]"
          >
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] bg-[#f5f5f7] text-[#0b7a5a]">
              <Icon className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <span className="min-w-0">
              <span
                className="flex items-center gap-1 text-[16px] font-semibold"
                style={{ color: INK }}
              >
                {title}
                <ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
              </span>
              <span
                className="mt-1 block text-[14px] leading-relaxed"
                style={{ color: INK_SOFT }}
              >
                {desc}
              </span>
            </span>
          </Link>
        ))}
      </div>

      {/* 收尾 CTA */}
      <div className="relative mt-14 overflow-hidden rounded-[28px] bg-[#1d1d1f] px-7 py-12 text-center sm:px-12 sm:py-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #e8c26a 0%, transparent 45%), radial-gradient(circle at 80% 80%, #0b7a5a 0%, transparent 45%)",
          }}
        />
        <div className="relative">
          <h3 className="text-[26px] font-semibold tracking-[-0.02em] text-white sm:text-[34px]">
            今天就说出第一句泰语。
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-white/60 sm:text-[16px]">
            注册即可免费开始，AI 老师会先测一下你的水平，再安排第一节课。
          </p>
          <Link
            to="/register"
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-[16px] font-medium text-[#1d1d1f] transition hover:bg-white/90"
          >
            免费开始
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </SectionShell>
  );
}

/* ---------- Footer ---------- */

const FOOTER_COLS = [
  {
    title: "产品",
    links: [
      { label: "课程", to: "/course" },
      { label: "词汇", to: "/vocabulary" },
      { label: "口语练习", to: "/speaking" },
      { label: "文化宇宙", to: "/culture-universe" },
    ],
  },
  {
    title: "学习",
    links: [
      { label: "今日计划", to: "/plan" },
      { label: "排行榜", to: "/ranking" },
      { label: "媒体课", to: "/media" },
      { label: "语料库", to: "/corpus" },
    ],
  },
  {
    title: "支持",
    links: [
      { label: "注册账号", to: "/register" },
      { label: "登录", to: "/login" },
      { label: "忘记密码", to: "/forgot-password" },
      { label: "价格与会员", to: "#pricing" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="bg-[#f5f5f7] px-6 pb-10 pt-16 sm:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <img
              src="/brand/thaiai-logo-180.png"
              alt="ThaiAI"
              data-no-theme-filter
              className="h-11 w-11 rounded-[12px]"
            />
            <p
              className="mt-4 max-w-xs text-[14px] leading-relaxed"
              style={{ color: INK_SOFT }}
            >
              ThaiAI · Learn Thai with AI.
              <br />
              用 AI 把泰语学成能开口的语言。
            </p>
          </div>

          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <h4
                className="text-[13px] font-semibold"
                style={{ color: INK }}
              >
                {col.title}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      to={l.to}
                      className="text-[14px] transition hover:text-[#1d1d1f]"
                      style={{ color: INK_SOFT }}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-black/[0.08] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px]" style={{ color: INK_SOFT }}>
            © {new Date().getFullYear()} ThaiAI · 泰语学习空间
          </p>
          <p className="text-[13px]" style={{ color: INK_SOFT }}>
            客服微信 {SUPPORT_CONFIG.wechatId}
          </p>
        </div>
      </div>
    </footer>
  );
}
