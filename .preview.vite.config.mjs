// 预览专用 vite 配置（不改动仓库里的 vite.config.js）。
//
// 本机（iCloud 目录）跑 dev server 有两个坑，这份配置专门绕开：
//   1. 依赖预构建默认写 node_modules/.vite —— 写 iCloud 会阻塞 dev server
//      事件循环（端口在 LISTEN、连接能建立、请求 0 字节返回）→ cacheDir 指到 /tmp。
//   2. 项目根有大量 iCloud 同步文件（_extract/、backend/ 的 db 等），
//      chokidar 会被同步事件淹没（日志刷出成片 page reload），
//      拖住请求处理 → watch.ignored 屏蔽与前端无关的目录。
//
// 用法（在主检出里）：
//   node node_modules/vite/bin/vite.js --config .preview.vite.config.mjs \
//        --host 127.0.0.1 --port 5173 --strictPort
import base from "./vite.config.js";

export default {
  ...base,
  cacheDir: "/tmp/thaiai-vite-cache",
  server: {
    ...base.server,
    watch: {
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/dist/**",
        "**/.freebuff/**",
        "**/_extract/**",
        "**/backend/uploads/**",
        "**/*.db",
        "**/*.db-shm",
        "**/*.db-wal",
      ],
    },
  },
};
