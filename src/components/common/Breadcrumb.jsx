// src/components/common/Breadcrumb.jsx
//
// =========================================================
// 页面层级 · Breadcrumb
// ---------------------------------------------------------
// 回答一个问题：我现在在哪一层。
//
// 层级链的每一层各有归属，**不在这里判断任何一条**：
//   一级 / 二级 / 三级……   → src/lib/navigation.js 的 navTrail()（parent 链）
//   更深的名字（课程名、课文名、结业测试）
//                        → 页面自己用 usePageTrail() 交上来
//                          （那些名字只有页面手里有真实数据，见 CourseDetail
//                            等页；导航数据里写不出来，也不该写死一份假的）
//
// 一级页面（六个入口本身）不渲染：那时链上只有一段，等于没说。
//
// 顶部一级导航的选中项与这里的第一段是**同一条链**（PrimaryNav 用
// navTrail 的根节点），所以两者不可能出现「导航说是练习、面包屑说是学习」
// 这种互相矛盾的情况。
// =========================================================

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { navTrail } from "@/lib/navigation";

const TrailContext = createContext(null);

/** 一份尾级列表的稳定签名：内容不变就不重新提交，避免渲染循环 */
function trailKey(list) {
  return list.map((crumb) => `${crumb.to || ""}\u001f${crumb.label}`).join("\u001e");
}

export function PageTrailProvider({ children }) {
  const { pathname } = useLocation();
  const [extra, setExtra] = useState(null);

  const value = useMemo(
    () => ({
      /*
       * 只认当前路径的提交：路由切走后旧页面的尾级立刻失效，
       * 不会挂在新页面的面包屑上（页面卸载晚于新页面挂载时会出这种错）。
       */
      current: extra && extra.path === pathname ? extra.list : [],
      commit(path, list) {
        const key = trailKey(list);
        setExtra((prev) =>
          prev && prev.path === path && prev.key === key ? prev : { path, key, list }
        );
      },
    }),
    [extra, pathname]
  );

  return <TrailContext.Provider value={value}>{children}</TrailContext.Provider>;
}

/**
 * 页面把「只有自己知道的层级」交给面包屑。
 * 传的是纯描述：{ label, to }，to 省略即当前页（不可点）。
 *
 *   usePageTrail([{ label: course.title, to: `/course/${course.id}` }])
 */
export function usePageTrail(list = []) {
  const ctx = useContext(TrailContext);
  const { pathname } = useLocation();

  /* 用 ref 拿最新值，effect 只依赖「签名」——否则每次渲染都是新数组，会无限提交 */
  const listRef = useRef(list);
  listRef.current = list;
  const key = trailKey(list);

  useLayoutEffect(() => {
    /* 布局阶段提交：和页面首帧同一次绘制，看不到面包屑缺失的那一帧 */
    if (ctx) ctx.commit(pathname, listRef.current);
  }, [ctx, pathname, key]);
}

export default function Breadcrumb() {
  const location = useLocation();
  const ctx = useContext(TrailContext);
  const extras = ctx?.current;

  const trail = useMemo(() => {
    const chain = navTrail(location.pathname, location.search);
    const fromNav = chain.map((item, index) => ({
      label: index === 0 ? item.short || item.name : item.name,
      to: item.path,
    }));
    return [...fromNav, ...(extras || [])];
  }, [location.pathname, location.search, extras]);

  if (trail.length < 2) return null;

  return (
    <nav aria-label="页面层级" className="mb-1 px-1">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[11px] leading-5 sm:text-xs">
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1;
          return (
            <li
              key={`${crumb.to || ""}\u001f${crumb.label}`}
              className="flex items-center gap-x-1"
            >
              {index > 0 ? (
                <ChevronRight
                  className="h-3 w-3 shrink-0 text-white/25"
                  aria-hidden="true"
                />
              ) : null}

              {crumb.to && !last ? (
                <Link
                  to={crumb.to}
                  className="rounded text-white/50 transition-colors hover:text-amber-300"
                >
                  {crumb.label}
                </Link>
              ) : (
                /*
                 * 当前层用 theme.css 的赭金（text-amber-300）：它是全站唯一两套主题
                 * 都给得出可读值的强调色 —— 深色下是 --tp-accent 暖金，纸面上被压到
                 * rgb(122 90 16)（实测 5.7:1）。
                 * 不能用 text-emerald-300/85：纸面模式下它还是浅薄荷（实测 ≈1.2:1）；
                 * 也不能靠 text-white/85 加深，它和 /50 在纸面上被压成同一个墨色。
                 */
                <span
                  aria-current={last ? "page" : undefined}
                  className={last ? "font-medium text-amber-300" : "text-white/50"}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
