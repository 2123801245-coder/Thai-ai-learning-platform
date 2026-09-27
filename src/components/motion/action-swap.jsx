// src/components/motion/action-swap.jsx
//
// beui 的 ActionSwapIcon（vendored，https://beui.dev/components/motion/action-swap）。
//
// 上游同时提供 ActionSwapText / ActionSwapButton 与 blur / roll / cascade 三种
// 动画；主题按钮只用得到「图标用模糊交叉换掉」这一种，所以这里只保留
// ActionSwapIcon + blur，另外两个导出与 roll / cascade 没搬过来。
//
// 依赖用 framer-motion（本项目既有），不是上游的 `motion/react` —— 同一个库
// 的新包名，装两份没有意义。
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const BLUR_TRANSITION = { duration: 0.2, ease: "easeInOut" };
const SWAP_BLUR = "blur(8px)";

const ICON_VARIANTS = {
  initial: { opacity: 0, scale: 0.25, filter: SWAP_BLUR },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)", transition: BLUR_TRANSITION },
  exit: { opacity: 0, scale: 0.25, filter: SWAP_BLUR, transition: BLUR_TRANSITION },
};

/**
 * 在同一个格子里交叉淡入换掉图标。
 *
 * @param {object}  props
 * @param {string}  props.value     当前值；它一变就播一次换场动画
 * @param {node}    props.children  当前应该显示的图标
 * @param {string} [props.className] 尺寸等（h-4 w-4 之类）
 */
export function ActionSwapIcon({ value, children, className }) {
  const reduce = useReducedMotion();

  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center overflow-hidden", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          aria-hidden
          variants={ICON_VARIANTS}
          initial={reduce ? false : "initial"}
          animate={reduce ? { opacity: 1, filter: "blur(0px)", scale: 1 } : "animate"}
          exit={reduce ? undefined : "exit"}
          className="col-start-1 row-start-1 inline-flex items-center justify-center will-change-[opacity,filter,transform]"
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
