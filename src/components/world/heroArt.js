// src/components/world/heroArt.js
//
// =========================================================
// 英雄区那尊佛像的素材表（首页 GuardianScene / 各页 WorldHero 共用）
// =========================================================
// 深色主题是一张「青黑陶瓷 + 傍晚」的真实照片；浅色主题换成白瓷浮雕
// （同一套构图：左侧留白给文案、右侧给玻璃卡、主体居中偏左）。
// 两套都分宽幅 / 竖幅：桌面用宽幅铺满，窄屏用竖幅免得主体被裁。
//
// 浅色只有 webp（2026 年浏览器全线支持），深色保留 jpg 兜底不变。
// =========================================================

export function heroArt(isDark) {
  if (isDark) {
    return {
      wide: "/images/thai-guardian-hero-wide.webp",
      wideFallback: { src: "/images/thai-guardian-hero-wide.jpg", type: "image/jpeg" },
      portrait: "/images/thai-guardian-hero.webp",
      portraitFallback: { src: "/images/thai-guardian-hero.jpg", type: "image/jpeg" },
    };
  }

  return {
    wide: "/images/thai-guardian-hero-light-wide.webp",
    wideFallback: null,
    portrait: "/images/thai-guardian-hero-light.webp",
    portraitFallback: null,
  };
}
