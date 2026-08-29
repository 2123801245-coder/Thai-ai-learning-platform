# Base44 Project

Use this repository to run and edit the app locally, then publish changes back through Base44.

Any change pushed to the repo will also be reflected in the Base44 Builder.

## Prerequisites

1. Clone the repository using the project's Git URL.
2. Navigate to the project directory.
3. Install dependencies: `npm install`.
4. Install the Base44 CLI: `npm install -g base44@latest`.

See the [Base44 CLI docs](https://docs.base44.com/developers/references/cli/get-started/overview) if you want to run Base44 commands directly.

## Run Locally

Run the full local development environment from the project root:

```bash
base44 dev
```

`base44 dev` starts the local Base44 development backend and, when this app is configured for it, also starts the frontend dev server for you. Use the frontend URL printed by the command.

For example, when the Base44 project config includes a `serveCommand`, `base44 dev` can launch the frontend too:

```json5
{
  "site": {
    "serveCommand": "npm run dev"
  }
}
```

In a Base44 project this lives in `base44/config.jsonc`.

## Run The Full Stack Locally

This app has two parts that can run independently:

- **Frontend** (Vite + React) — `npm run dev` (defaults to http://localhost:5173).
- **Backend** (Express + SQLite, in `backend/`) — the Thai AI Teacher API: auth,
  avatar uploads (`/uploads`), and speaking-practice analysis (`/api/speaking`).

Start the backend from the project root:

```bash
npm run server        # or: npm run server:dev  (auto-restart)
```

or from inside `backend/`:

```bash
npm start             # runs node app.js
```

The backend listens on `http://localhost:3001` by default (set `PORT` to
override). The frontend's API client already points at
`http://localhost:3001/api`.

### Notes

- The SQLite database lives at `backend/users.db` (created automatically).
- Uploaded avatars are stored in `backend/uploads/avatars` and served from
  `/uploads/avatars`.
- **Password reset** has no email service configured. In development the reset
  link is printed in the backend console and returned in the API response
  (`reset_url`) so you can open it directly. Set `NODE_ENV=production` to hide
  the link from the response, or set `RESET_PASSWORD_BASE_URL` to change where
  the link points (defaults to `http://localhost:5173`).
- Speaking analysis requires a speech-to-text service: set
  `TRANSCRIBE_API_URL` (and optionally `TRANSCRIBE_API_KEY`) in `backend/.env`
  or your environment. Without it, `POST /api/speaking/analyze` returns 503
  with a clear message.

## Run Only The Frontend

If you only want to work on the frontend against the hosted Base44 backend, run:

```bash
npm run dev
```

Open the local URL printed by Vite.

## 生产部署（Production）

前端构建产物（`dist/`）与后端（Express + SQLite）推荐部署在**同一域名**下
（如 nginx 把 `/` 指向 `dist/`、把 `/api`、`/uploads`、`/videos`、`/subtitles`
反代到 `localhost:3001`），前端默认走**同源相对路径**，无需任何额外配置：

```bash
npm run build          # 产出 dist/
PORT=3001 node backend/app.js   # 启动后端（或 pm2/systemd 托管）
```

如果前后端**不同域名**，构建时指定后端地址：

```bash
VITE_API_BASE_URL=https://api.thaiai.app npm run build
```

（`/api`、`/uploads`、`/videos`、`/subtitles` 均基于该地址推导。）

### 生产环境必须配置的环境变量

| 变量 | 说明 |
|---|---|
| `JWT_SECRET` | 登录令牌签名密钥。**生产缺失时后端拒绝启动**，请用 `openssl rand -hex 32` 生成 |
| `ADMIN_EMAILS` | 管理员邮箱（逗号分隔），注册该邮箱自动获得管理端权限 |
| `CORS_ORIGINS` | 允许跨域的前端域名（逗号分隔）。同源部署无需设置；默认放行本地开发源 |
| `AI_API_KEY` | AI 对话/讲解服务密钥（见根目录 `.env`） |
| `TRANSCRIBE_API_URL` | 口语评测转写服务地址（可选，未配置时口语评测返回 503 提示） |
| `SPEECH_KEY` / `SPEECH_REGION` | **Azure 发音评估**（专业声学评分）。配置后口语练习自动走音素级评测（accuracy/fluency/completeness）；未配置时前端自动降级为浏览器本地估算。音频要求 16kHz/16bit/mono WAV（前端已按此采集） |
| `NODE_ENV=production` | 隐藏密码重置链接等开发信息 |

### 功能开关（管理员可视化，无需改代码）

AI 老师等灰度功能由后端 `settings` 表持久化，管理员在**设置中心 → 功能管理**
可视化开关，全站即时生效（首页 AI 老师卡片、侧边栏「对话练习」、移动端
「对话」tab 同步出现/移除，路由与代码保留）。

- 公共读取：`GET /api/features`
- 管理员修改：`PUT /api/admin/features`（body: `{ "aiTeacher": true }`）
- **实时同步：`GET /api/features/stream`（SSE）** —— 前端启动时建立 EventSource 长连接，
  任何端修改开关后，所有在线端**立即**收到推送并刷新界面（无需刷新页面）；
  连接断开自动重连，初始连接先推送当前快照
- 管理员身份：`ADMIN_EMAILS` 环境变量中的邮箱注册即获得，或 DB 中 `role='admin'`

## Use The Hosted Backend

For frontend-only development, create or update `.env.local` in the project root:

```bash
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=https://your-app.base44.app
```

`VITE_BASE44_APP_ID` identifies the Base44 app.

`VITE_BASE44_APP_BASE_URL` tells the Base44 Vite plugin where to send local `/api` requests. Point it at your deployed Base44 app URL when you want the local frontend to use the hosted backend.

When you use `base44 dev`, the command injects the local Base44 values for you, so `.env.local` is mainly needed for frontend-only workflows.

## Publish Your Changes

After pushing your changes to git, open the Base44 dashboard and publish the app:

```bash
base44 dashboard open
```

## Docs & Support

Documentation: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

Base44 CLI command reference: [https://docs.base44.com/developers/references/cli/commands/introduction](https://docs.base44.com/developers/references/cli/commands/introduction)

Support: [https://app.base44.com/support](https://app.base44.com/support)
