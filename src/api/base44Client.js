import { createClient } from '@base44/sdk';

export const base44 = createClient({
  appId: "6a70620806859c6c4d0a00fe",
  // 不设置就用 SDK 默认的 https://base44.app（生产/本地 vite dev 都适用）。
  // 以后如果想切到 `base44 dev` 起的本地后端，在 .env.local 里加一行
  // VITE_BASE44_SERVER_URL=http://localhost:<base44 dev 的端口> 就行，不用再改代码。
  serverUrl: import.meta.env.VITE_BASE44_SERVER_URL || undefined,
  headers: {
    api_key: import.meta.env.VITE_BASE44_API_KEY || ""
  }
});