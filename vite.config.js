import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/* ============================================================
   分享卡片（og:image / og:url）需要**绝对 URL**
   ------------------------------------------------------------
   微信、Twitter、Facebook 的抓取器不会替我们把 /brand/og-image.png
   补成完整域名 —— 相对路径在分享出去后就是一张空图。所以站点地址
   必须由环境决定，不能写死在 index.html 里：

     VITE_SITE_URL=https://thai-ai.online

   index.html 里写占位符 %SITE_URL%，这里在 dev 与 build 时一起替换。
   没配置时（例如新克隆的仓库、CI 里忘了设）故意替换成空串 —— 页面
   退化成相对路径仍然可用，同时构建时打一条醒目警告，而不是静默产出
   一个「%SITE_URL%」字样跑进分享卡片的坏 URL。
   ============================================================ */
function siteUrlPlugin(mode) {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  /* 先看进程环境（CI / 一次性 `VITE_SITE_URL=… npm run build`），再看 .env */
  const siteUrl = (process.env.VITE_SITE_URL || env.VITE_SITE_URL || '')
    .trim()
    .replace(/\/+$/, '')
  const isBuild = mode === 'production'

  if (!siteUrl && isBuild) {
    console.warn(
      '\n[thaiai-share-meta] 未配置 VITE_SITE_URL：index.html 的 og:image 会是相对路径，' +
        '微信 / Twitter 抓取分享卡片时会取不到图。\n' +
        '  修复：在 .env 里写 VITE_SITE_URL=https://你的域名\n'
    )
  }

  return {
    name: 'thaiai-share-meta',
    transformIndexHtml(html) {
      return html.replaceAll('%SITE_URL%', siteUrl)
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    siteUrlPlugin(mode),
  ],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src')
    },
    // three.js 必须只有一份实例。
    // 任何带进第二份 three 的依赖（例如曾经由 drei → stats-gl 引进的嵌套
    // 副本）都会触发「Multiple instances of Three.js being imported」：
    // 两份实例会让 instanceof / 材质与几何体的类型判断悄悄失效。
    dedupe: ['three', '@react-three/fiber'],
  },
  server: {
    // 开发时代理到本地后端（与生产同源部署一致：前端只发相对路径）
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/videos': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/subtitles': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // 按供应商分包，避免单个 1.6MB 大包拖慢首屏
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-http': ['axios'],
          // three 单独成包：只有英雄区/星系真正用得到，
          // 其他页面不该为 3D 付下载代价
          'vendor-three': ['three'],
        },
      },
    },
    // 禁用 modulepreload polyfill 并移除 crossorigin 属性
    // （自签证书 + 微信浏览器下 crossorigin 会导致 JS 加载失败）
    modulePreload: false,
    // 不在 script/link 标签上加 crossorigin（同源资源不需要）
    cssCodeSplit: true,
  },
}))
