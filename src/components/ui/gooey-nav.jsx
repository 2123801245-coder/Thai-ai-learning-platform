// src/components/ui/gooey-nav.jsx
//
// =========================================================
// Gooey Nav · 黏连式分段导航
// ---------------------------------------------------------
// 来源：Rare UI — https://www.rareui.com/components/gooeynav
// （MIT + Commons Clause，署名要求见 README「第三方组件」一节；请勿删除本段）
//
// 原理（上游原样保留）
// --------------------
// 每个条目左右各挂着一条「颈线」SVG，宽度由弹簧动画驱动。选中项两侧被顶开，
// 颈线在缝里被拉细直至断开（缝宽超过 NECK_BREAK 的比例就不再画），于是整条
// 读作「一块被拉开的整体」，而不是一排各自独立的按钮。
//
// 与上游的三处差异（本项目适配）
// ------------------------------
//   ① Next.js → react-router-dom：`href` 改为 `to`，并删掉 next/navigation 的
//      URL 嗅探。「哪条路由属于哪一项」的裁决权在 src/lib/navigation.js，
//      组件只接受受控的 `value`，不在第二处再判一遍。
//   ② motion/react → framer-motion：同一个库，项目里已经装了，不装第二份。
//   ③ 颜色交给主题层（src/themes/theme.css 的 --gv-*）。上游把颜色写死在 class
//      与 activeColor / activeLabelColor 两个 props 里；本项目有深/浅两套主题，
//      颜色必须只有一个出处，所以那两个 props 被删除。
// =========================================================

import { useEffect, useId } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion, useSpring, useTransform } from "framer-motion";

import { cn } from "@/lib/utils";

/* 分段弹簧：阻尼足够大，不会过冲 */
const SPRING = { type: "spring", stiffness: 200, damping: 28, mass: 1 };

/* 缝开到这个比例时，颈线已经细到没有 */
const NECK_BREAK = 0.22;

/* 颈线 SVG 的名义高度；实际高度由条目拉伸决定 */
const NECK_H = 100;

const FADE_IN = "transition-colors duration-[400ms]";
const FADE_OUT = "transition-colors duration-0";

/* 尺寸档：同时决定标签排版、圆角与默认缝宽，形状因此始终成比例 */
const SIZES = {
  xs: {
    label: "gap-1 px-2 py-1.5 text-[11px] leading-4 [&_svg]:size-[11px]",
    radius: 8,
    separation: 14,
  },
  sm: {
    label: "gap-1.5 px-3.5 py-2 text-xs leading-4 [&_svg]:size-3",
    radius: 10,
    separation: 16,
  },
  md: {
    label: "gap-2 px-5 py-2.5 text-sm leading-5 [&_svg]:size-3.5",
    radius: 12,
    separation: 20,
  },
  lg: {
    label: "gap-2.5 px-6 py-3 text-base leading-6 [&_svg]:size-4",
    radius: 14,
    separation: 24,
  },
};

const toItem = (item) => (typeof item === "string" ? { label: item } : item);

/* 两条内凹曲线在缝中间收成腰：缝越宽，腰越细 */
function neckPath(gap, span) {
  // NaN / 负跨度会算出一条满是 NaN 坐标的路径，直接不画
  if (!Number.isFinite(gap) || !Number.isFinite(span) || gap <= 0 || span <= 0) {
    return "";
  }
  const waist = NECK_H * (1 - gap / (span * NECK_BREAK));
  if (waist <= 0) return "";
  const start = span - gap;
  const mid = start + gap / 2;
  return `M${start} 0 Q${mid} ${NECK_H - waist} ${span} 0 L${span} ${NECK_H} Q${mid} ${waist} ${start} ${NECK_H} Z`;
}

function Segment({
  gap,
  span,
  hasSeam,
  stopFrom,
  stopTo,
  reduced,
  radii,
  className,
  children,
}) {
  const marginLeft = useSpring(gap, SPRING);
  const gradientId = `gooey-neck-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    if (reduced) marginLeft.jump(gap);
    else marginLeft.set(gap);
  }, [gap, marginLeft, reduced]);

  const d = useTransform(marginLeft, (g) => neckPath(g, span));

  return (
    <motion.li
      data-slot="gooey-nav-segment"
      className={cn("relative", className)}
      style={{ marginLeft }}
      initial={false}
      animate={radii}
      transition={reduced ? { duration: 0 } : SPRING}
    >
      {hasSeam && (
        <svg
          aria-hidden="true"
          width={span}
          viewBox={`0 0 ${span} ${NECK_H}`}
          preserveAspectRatio="none"
          className="pointer-events-none absolute right-full top-0 h-full"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="1">
              <stop offset="0" className={stopFrom} />
              <stop offset="1" className={stopTo} />
            </linearGradient>
          </defs>
          <motion.path d={d} fill={`url(#${gradientId})`} />
        </svg>
      )}
      {children}
    </motion.li>
  );
}

function NavLabel({ label, to, icon, isActive, size, onSelect, onHover }) {
  const props = {
    "data-slot": "gooey-nav-item",
    "data-active": isActive,
    "aria-current": isActive ? "page" : undefined,
    className: cn(
      "gv-label flex cursor-pointer items-center whitespace-nowrap font-medium [&_svg]:shrink-0",
      isActive ? FADE_IN : FADE_OUT,
      SIZES[size].label
    ),
    onClick: onSelect,
    onMouseEnter: onHover,
  };

  return to ? (
    <Link to={to} {...props}>
      {icon}
      {label}
    </Link>
  ) : (
    <button type="button" {...props}>
      {icon}
      {label}
    </button>
  );
}

/**
 * @param items   (string | { label, to?, icon? })[]；带 to 渲染成 Link，否则是按钮
 * @param value   当前选中项下标；-1 = 没有任何选中项（整条不分段）
 * @param onChange 点击某项时回调（导航由 Link 自己完成，通常不需要）
 * @param onItemHover 悬停某项时回调，用于路由预取
 * @param size    xs | sm | md | lg
 */
export function GooeyNav({
  items,
  value = -1,
  onChange,
  onItemHover,
  size = "md",
  separation,
  radius,
  className,
  ...props
}) {
  const reduced = useReducedMotion() ?? false;
  const span = separation ?? SIZES[size].separation;
  const corner = radius ?? SIZES[size].radius;

  /* 一条缝什么时候是张开的：条的两端，以及选中项的两侧 */
  const open = (seam) =>
    seam === 0 || seam === items.length || seam - 1 === value || seam === value;

  /* 颈线渐变的两端：这一侧那块是选中块还是普通块 */
  const stop = (i) => (i === value ? "gv-stop-active" : "gv-stop-bar");

  return (
    <nav data-slot="gooey-nav" className={cn("gooey-nav inline-block", className)} {...props}>
      <ul className="flex items-center">
        {items.map((raw, i) => {
          const item = toItem(raw);
          const isActive = i === value;

          return (
            <Segment
              key={`${i}-${item.label}`}
              /* 关着的缝往里收 1px，避免露出发丝般的背景缝 */
              gap={i === 0 ? 0 : open(i) ? span : -1}
              span={span}
              hasSeam={i > 0}
              stopFrom={stop(i - 1)}
              stopTo={stop(i)}
              reduced={reduced}
              radii={{
                borderTopLeftRadius: open(i) ? corner : 0,
                borderBottomLeftRadius: open(i) ? corner : 0,
                borderTopRightRadius: open(i + 1) ? corner : 0,
                borderBottomRightRadius: open(i + 1) ? corner : 0,
              }}
              className={cn("gv-bar", isActive ? cn("gv-active", FADE_IN) : FADE_OUT)}
            >
              <NavLabel
                {...item}
                isActive={isActive}
                size={size}
                onSelect={() => onChange?.(i)}
                onHover={onItemHover ? () => onItemHover(i) : undefined}
              />
            </Segment>
          );
        })}
      </ul>
    </nav>
  );
}
