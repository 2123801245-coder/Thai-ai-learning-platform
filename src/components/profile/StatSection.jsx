// src/components/profile/StatSection.jsx
//
// =========================================================
// 个人中心 · 可折叠统计区块
// =========================================================
//
// 为什么需要它
// ------------
// 个人中心原来是 9 个一级板块、约 4.1 屏高（实测 1280×900 下 3695px），
// 其中「新闻听力」「词汇测验」两块的**外壳逐字相同**：
// 同样的 rounded-3xl + p-5 + eyebrow + h2 + 描述 + loading 圈。
// 另一组「学习能力 / 本周学习目标 / 学习成就」则在测同一件事，
// 三块都铺开摆着，用户滚到第三屏早就不知道自己要看什么了。
//
// 这个组件把三件事一次解决：
//   ① 外壳收敛成一处（标题、eyebrow、图标、加载态）
//   ② 默认折叠：概览始终可见，明细按需展开 → 首屏不再被明细淹没
//   ③ 用原生 <details>：无 JS 状态、可被浏览器搜索命中、键盘可达
//
// 折叠不是"藏功能"：标题行本身就把关键读数（summary）显示出来，
// 展开后才是明细列表。用户不点也能知道自己练了多少。

import React, { useState } from "react";

import { useTheme } from "@/lib/ThemeContext";
import { inkForWorld } from "@/themes/worlds";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

export function StatSection({
  icon: Icon,
  eyebrow,
  title,
  desc,
  /** 标题右侧的关键读数（不展开也能看到） */
  summary,
  loading = false,
  /** 强调色，默认 emerald */
  tone: toneProp = "#6ee7a8",
  /** 首次渲染是否展开 */
  defaultOpen = false,
  delay = 0,
  children,
}) {
  /*
   * 强调色要按世界调整。
   * `tone` 是 inline style（图标 + eyebrow），CSS 重映射够不到；直接用在
   * 米白纸上对比度只有 1.36，个人中心那些 "NEWS LISTENING" / "ABILITY"
   * 小标签基本看不见。inkForWorld 在深色世界原样返回，只在 paper 压深。
   */
  const { world } = useTheme();
  const tone = inkForWorld(toneProp, world?.visualMode);
  const [open, setOpen] = useState(defaultOpen);

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.035] backdrop-blur-xl"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.03] sm:px-5"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${tone}1a`, border: `1px solid ${tone}33` }}
        >
          {Icon ? <Icon className="h-4 w-4" style={{ color: tone }} /> : null}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-[13.5px] font-bold text-white/92">{title}</span>
            {eyebrow ? (
              <span
                className="text-[9px] font-bold uppercase tracking-[0.18em]"
                style={{ color: tone }}
              >
                {eyebrow}
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-white/35">
            {summary || desc}
          </span>
        </span>

        {loading ? (
          <span
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: `${tone}55`, borderTopColor: tone }}
          />
        ) : null}

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/35 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.06] px-4 pb-4 pt-4 sm:px-5">
              {children}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}

export default StatSection;
