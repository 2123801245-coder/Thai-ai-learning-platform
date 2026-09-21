// src/components/common/PageShell.jsx
//
// =========================================================
// 统一页面外壳 · PageShell
// =========================================================
//
// 为什么需要它
// ------------
// 重构前每个页面各自决定三件事，结果三件事都不一致：
//
//   ① 页面宽度:      max-w-3xl / max-w-5xl / max-w-7xl / max-w-[1500px] / 不设
//   ② 页头形态:      PageHeader / 手写 h1 / WorldHero / 干脆没有
//   ③ 首屏构图:      有的直接进内容，有的先来一张全屏照片
//
// 于是「从 /vocabulary 切到 /media」会感觉像换了三个不同的产品。
//
// PageShell 把这三件事收敛成**一次决定**：
//
//   <PageShell title="词汇星球" icon={Languages} subtitle="…">
//     …页面内容…
//   </PageShell>
//
// `hero` 是给「需要沉浸式首屏」的页面留的出口（首页 / 学习宇宙 / 文化宇宙
// 用 WorldHero 那一套），传了就渲染在页头位置，其余页面走统一页头。
//
// 兼容说明：PageHeader 仍是页头的实现（品牌语言不变），PageShell 只是规定
// 「什么时候用它、用多宽」，不重写它。

import React from "react";

import { PageHeader } from "@/components/ui/premium";

/* 页面宽度档位：只有这三档，不再允许每页自己写 max-w-[xxx] */
export const SHELL_WIDTH = {
  /** 阅读型：课文、新闻、设置——一行别太长 */
  reading: "mx-auto w-full max-w-3xl",
  /** 标准型：绝大多数功能页 */
  default: "mx-auto w-full max-w-6xl",
  /** 宽敞型：仪表盘、地图、宇宙页 */
  wide: "mx-auto w-full max-w-[1500px]",
};

export function PageShell({
  title,
  subtitle,
  icon,
  badge,
  actions,
  hero,
  width = "default",
  className = "",
  /** 页头下方到内容之间是否留间距（有些页自带分区，不需要） */
  spaced = true,
  children,
}) {
  const widthClass = SHELL_WIDTH[width] || SHELL_WIDTH.default;
  const showHeader = !hero && Boolean(title);

  return (
    <div className={`${widthClass} ${className}`}>
      {hero ? <div className="-mx-1 mb-2">{hero}</div> : null}

      {showHeader ? (
        <PageHeader title={title} subtitle={subtitle} icon={icon} badge={badge}>
          {actions}
        </PageHeader>
      ) : null}

      <div className={showHeader && spaced ? "" : hero && spaced ? "mt-6" : ""}>
        {children}
      </div>
    </div>
  );
}

export default PageShell;
