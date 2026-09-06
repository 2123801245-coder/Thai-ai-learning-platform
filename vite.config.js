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
    }
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
