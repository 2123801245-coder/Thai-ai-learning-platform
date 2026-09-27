import * as React from "react"

const MOBILE_BREAKPOINT = 768
const WIDE_BREAKPOINT = 1024

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange);
  }, [])

  return !!isMobile
}

/**
 * 宽屏（lg+）。
 * 与 useIsMobile 是同一个判断的另一半，供「同一组件按可用宽度换档」的场合使用
 * （例如桌面顶部一级导航：窄屏用 xs 档，宽屏才换到 sm）。
 *
 * 首帧就直接读 window，不像 useIsMobile 那样先给 undefined：
 * 那个 undefined 会让窄导航先画一帧、再跳成宽导航，用户看得见这次回流。
 */
export function useIsWide() {
  const [isWide, setIsWide] = React.useState(
    () => window.innerWidth >= WIDE_BREAKPOINT
  )

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${WIDE_BREAKPOINT}px)`)
    const onChange = () => setIsWide(window.innerWidth >= WIDE_BREAKPOINT)
    mql.addEventListener("change", onChange)
    setIsWide(window.innerWidth >= WIDE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange);
  }, [])

  return isWide
}
