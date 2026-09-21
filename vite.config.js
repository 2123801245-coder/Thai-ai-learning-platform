import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react()
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
})
