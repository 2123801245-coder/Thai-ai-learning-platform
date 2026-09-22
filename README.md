# ThaiAI · AI 泰语学习平台

**线上：https://thai-ai.online**

把「AI 老师 + 泰语专业知识 + 泰国文化 + 个性化学习路径」合在一起的泰语学习平台。
目标不是做一个功能很多的泰语网站，而是让用户形成
**发现方向 → 拿到路径 → 学课程 → 练习 → AI 纠错 → 复习 → 能力成长 → 探索文化** 的长期循环。

## 主要能力

| 板块 | 内容 |
|---|---|
| 学习 | 入学能力测试 → A1~B2 学习路径、分类课程、专业方向（商务/媒体/旅游/翻译…） |
| 课程 | 课文精读：同步音频、逐句字幕、点词查义、词汇提取、语法与文化讲解 |
| AI 老师 | 跨会话记住学生的对话教学（画像/目标/薄弱点/偏好），贯穿讲解、纠错、情景模拟 |
| 练习 | 词汇 SRS、错题本、每日小测、挑战 |
| 探索 | 泰国文化、新闻实验室（真实新闻双语）、媒体学习（泰剧/音乐/新闻）、泰国地图 |
| 我的 | 学习计划、能力雷达、成就证书、排行榜、设置 |
| 沉浸世界 | 首页不是课程列表，而是空间化的「学习星系」（three.js，见下文性能规则） |

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React + Vite、React Router、Framer Motion、Tailwind CSS |
| 3D | three.js / @react-three/fiber（**只允许懒加载**，见「ThaiAI World」章节） |
| 后端 | Node + Express、SQLite（`backend/users.db`）、JWT 认证 |
| AI | 统一出口 `backend/aiProvider.js`（DeepSeek / OpenAI 兼容网关）、Azure 发音评估、Edge 神经语音 TTS |
| 部署 | nginx + Docker Compose，GitHub Actions 与 Gitee 镜像双通道自动发布 |

## 仓库与发布

主仓库在 GitHub，**每次 push 到 `main` 会自动镜像到 Gitee 私有仓库并发布上线**。
两条发布通道共用同一个脚本 `deploy/build-on-server.sh`（文件锁串行 + 已发布 commit 短路，不会重复构建）：

```
git push main
├─ 通道一（主）：GitHub Actions → 镜像 push 到 Gitee → SSH 执行服务器发布脚本
├─ 通道二（备）：Gitee WebHook → https://thai-ai.online/hooks/gitee
│                 → 验签（X-Gitee-Token）→ 同一个发布脚本
└─ 兜底（拉取式）：服务器每 3 分钟拉一次 Gitee main，变化即发布
```

服务器侧细节（一次性初始化、密钥、分支保护、回滚机制）见 **[`deploy/README.md`](deploy/README.md)**。

## 本地开发（前后端）

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

## 只跑前端

```bash
npm run dev        # Vite，默认 http://localhost:5173
```

开发服务器把 `/api`、`/videos`、`/uploads` 代理到 `http://localhost:3001`（见 `vite.config.js`），
所以前端始终走同源相对路径 —— 本地与生产一致，无需另外配置 API 地址。

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
| `AI_PROVIDER` | AI 提供方：`auto`（默认，自动挑可用者）/ `deepseek` / `agnes` |
| `DEEPSEEK_API_KEY` | AI 老师对话·出题·讲解与新闻翻译的密钥（默认提供方）。可选 `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL`（默认 `deepseek-chat`） |
| `AGNES_API_KEY` / `AGNES_BASE_URL` / `AGNES_MODEL` | 可选替代提供方（OpenAI 兼容网关）。填好 key 后设 `AI_PROVIDER=agnes` 即整体切过去；历史别名 `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` 等价识别 |
| `TRANSCRIBE_API_URL` | 口语评测转写服务地址（可选，未配置时口语评测返回 503 提示） |
| `SPEECH_KEY` / `SPEECH_REGION` | **Azure 发音评估**（专业声学评分）。配置后口语练习自动走音素级评测（accuracy/fluency/completeness）；未配置时前端自动降级为浏览器本地估算。音频要求 16kHz/16bit/mono WAV（前端已按此采集） |
| `NODE_ENV=production` | 隐藏密码重置链接等开发信息 |

### AI 服务自检

所有 AI 调用（对话 / 出题 / 讲解 / 新闻翻译）走**同一个出口** `backend/aiProvider.js`，
密钥与网关由 `AI_PROVIDER` + 可用 key 决定；Azure 发音评估与 Edge TTS 各自独立。

- `.env` 的加载不依赖启动目录（优先 `backend/.env`，其次仓库根 `.env`，见 `backend/env.js`）——
  用 `systemd` / `pm2` / 容器指定 `WorkingDirectory=backend` 也不会读不到密钥
- 占位符 key（如「你的xxxKEY」）会被识别为**未配置**并给出明确原因，而不是等上游 401
- 自检接口：`GET /api/ai/status`（配置视图），加 `?probe=1` 会真实发一次极小的上游请求验证连通

```bash
curl -s localhost:3001/api/ai/status | jq
curl -s 'localhost:3001/api/ai/status?probe=1' | jq .probe
```

### ThaiAI World（沉浸式首页 · 3D 世界）

首页不是课程列表，而是一个空间化世界。四层结构，全部由**现有数据**推导
（映射层 `src/lib/worldData.js`，不新增任何学习数据源）：

| 空间 | 组件 | 数据来源 | 技术 |
|---|---|---|---|
| 英雄区 · AI 守护者 | `components/world/WorldHero.jsx` | 等级/画像/进度 | R3F + three.js（懒加载） |
| AI 泰语教室 | `components/world/AITeacherSpace.jsx` | 学习记录 + 今日任务 + AI 推荐 | Canvas 2D 声波 |
| 学习星系 | `components/world/LearningGalaxy.jsx` | `generateLearningPath(profile)` 的真实阶段 | R3F + three.js（懒加载） |
| 泰语技能树 | `components/world/SkillTree.jsx` | `estimateAbilities(progress)` 六维能力 | SVG + Framer Motion |
| 数字博物馆 | `components/world/DigitalMuseum.jsx` | `thaiCulture.js` + `mediaLessons.js` + 媒体学习记录 | CSS 3D 透视 |

**性能规则（改这块前请先读）：**

- `WorldStage.jsx` 是唯一的 3D 承载层，**不允许 import `three` / `@react-three/fiber`**。
  画布本体在 `WorldCanvas.jsx`，由 `React.lazy` 引入——否则 three（gzip ~176KB）
  会被静态挂进首页 chunk。加新 3D 场景时同样必须是 lazy 的。
- 进视口附近才挂载；离屏 / 标签页隐藏 → `frameloop="never"` 完全停帧。
- 移动端（UA 或 ≤4 核）自动降档：dpr ≤1.5、关抗锯齿、粒子减到 1/3。
- 系统「减弱动态效果」→ 只画一帧静态画面（动画代码保留但不跑）。
- 无 WebGL 或 `?world=static` → 静态画面回退，内容与入口一个不少。

**如何验证 3D 真的在画（重要）：**

```js
// 开发态探针会把真实渲染统计写到 canvas 的 data-* 上
const c = document.querySelector('canvas');
c.dataset.worldgl;    // "live"
c.dataset.drawCalls;  // 绘制调用数（应为正）
c.dataset.triangles;  // 三角面数
```

⚠️ **不要用 `readPixels` 或截图验证画布**：没有 `preserveDrawingBuffer` 时
`readPixels` 读到的是已清空的缓冲，本机预览的截图工具也只抓首帧——两者都会给出
假的「什么都没画」。另外**不要对已存在的 canvas 调 `getContext()`**（会把画布
锁成 2D，导致 3D 挂载后永远是 300×150 空白）。

```bash
npm run build   # 产物里 vendor-three 应只被 World* 与 *Scene chunk 引用，不能出现在 Home chunk
```

#### 星系的两层编码：累计 vs 今天

`worldData.js` 管**累计**（轨道半径 = 掌握度、星尘 = 还没轮到、琥珀环 = 进度最低），
`todayActivity.js` 管**今天**（向外扩的环、汇入中心的光丝、尘埃被吹开、一次性冲击波）。
两层共用一个星系，但**互不篡改**：今天练一次不会改变任何累计值，尘埃只是被推开、
不会被删掉（今天的活跃过去了它还会回来）。

「今天」只认**真实时间戳**：

| 星球 | 今日信号来源 |
|---|---|
| 基础基石 | `daily_history[today]`（词汇操练）+ 基础/精读/发音/语法类课程 |
| 口语交流 | `speakingHistory` 今天的时间戳（次数 + 平均分）+ 口语/场景/听力类课程 |
| 文化探索 | 文化/阅读类课程 + 文学类媒体课 |
| 媒体沉浸 | `mediaProgress` 今天的学习记录 / 今天有进展的媒体课 |
| 专业方向 | 商务/外交类课程（含今天通过的结业测试） |

三条硬规则（改这里前必读）：

1. **今天 = 本地日历日**。课程进度的 `updatedAt` 是 `toISOString()`（UTC），
   直接切前 10 个字符比对，在东八区晚上 8 点后会把昨天算成今天。
2. **不发明数据**。`lessons[id].minutes` 是累计时长，**不是**今天学了多久，所以
   界面上永远不会出现「今天 X 分钟」；没有时间戳的完成状态（`markLessonComplete`
   那条路径不写时间）不算今天。
3. **不含用户自己勾的完成**。每日计划里手动打勾是自述，不是测量；并进来会让
   脉冲变成可以点出来的装饰。

课程归到哪颗星球以**路线**为准（`planetOfStage`，同一门课服务多个阶段时优先当前
阶段），路线里没有才按 `category` 兜底；都查不到就如实列进 `unmapped`，不硬塞。

订阅层在 `useTodayActivity.js`（与纯映射层分开，因为 `todayActivity.js` 必须能在
node 里跑断言）。它在四个进度事件 + `storage` + 30 秒兜底刷新上重算，并把
「刚变多」的星球标成爆发（2.6 秒后收回成持续脉冲）。**挂载后的 3 秒水合期内不算
爆发**：首屏 localStorage 是异步读上来的，否则「0 → 有数据」会先炸一下（实测到过）。

验证：`.check-world.mjs` 里有 40+ 条断言覆盖今日归属、时区、能量强度与爆发检测；
开发态探针 `[data-today]` 上能读到 `{date, activeCount, planets, burst}`。

### AI 老师长期记忆（AI Teacher Memory）

AI 老师会**跨会话记住学生**，并在每次对话中按重要度注入 system prompt。存储见
`backend/aiMemory.js`（一张表、一条记忆一行）：

```sql
ai_teacher_memory(
  id, user_id, memory_type, content, importance, source, hits, created_at, updated_at
)
```

| 字段 | 说明 |
|---|---|
| `memory_type` | `profile` 身份 / `goal` 目标 / `habit` 学习习惯 / `weakness` 薄弱点 / `error` 错误记录 / `interest` 兴趣内容 / `preference` 表达偏好 |
| `importance` | 1~5，越高越优先注入；`goal`/`weakness` 这类影响教学方向的默认更高 |
| `source` | `ai` 对话中自动提取 / `placement` 入学测试画像 / `manual` 用户手写 |
| `hits` | 同一句话被重复提到的次数，排序时加权 |

记忆的三个来源：

1. **入学测试画像** → 每次读记忆时同步（幂等、可重跑）。重测等级或改目标后，
   旧的 `placement` 条目会被清掉，不会同时留着「A0」和「B1」
2. **对话内容** → 每满 5 轮，异步调用模型提取分类条目（失败不影响回复）
3. **用户手写** → 个人中心「AI 老师记住的你」直接添加/删除单条

接口（均需登录）：

```bash
GET    /api/ai/teacher/memory            # 条目 + 分类分组 + 摘要（含旧结构兼容字段）
POST   /api/ai/teacher/memory/items      # { type, content, importance? } 新增一条
DELETE /api/ai/teacher/memory/items/:id  # 删除一条（仅限自己的）
PUT    /api/ai/teacher/memory            # 旧表单的扁平结构整体修正
```

说明：**旧表结构自动迁移**——首次启动时旧表（`user_id, memory` 的 JSON blob）改名为
`ai_teacher_memory_legacy_imported` 备份，并拆成分类条目导入；迁移幂等、中断可重跑。
记忆会随对话一起发给模型提供方（作为 system prompt 的一部分），请勿写入密钥等敏感信息。

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

## 部署与发布

生产环境是阿里云单机：nginx（容器）+ Express 后端（容器）+ SQLite。
完整流程、一次性初始化与排错见 **[`deploy/README.md`](deploy/README.md)**，这里只讲日常使用。

### 日常发布

```bash
git push origin main      # 其余全部自动完成，约 2~3 分钟上线
```

Actions 把代码镜像到 Gitee → 服务器 `git reset --hard origin/main` → 容器内 `npm run build`
→ 原子替换 `dist` → 重启前端容器 → 自检（JS hash / 首页 / API / 音频 MIME / WebHook 存活）
→ 任一失败自动回滚到上一版。

- 只同步镜像、不发布：手动触发 workflow 并勾选 `skip_deploy`
- 纯文档改动（`**.md`、`docs/**`）不触发部署
- 后端（`backend/`）不在前端发布流程内，后端改动需上服务器单独重建容器

### 直接从 Gitee 发布（GitHub 不通时）

Gitee 是完整镜像。把改动推到 Gitee 的 `main`，仓库 WebHook 会通知服务器
（`https://thai-ai.online/hooks/gitee`，用 `X-Gitee-Token` 验签），服务器自行拉取并发布。
两条通道同时触发时只会有一次真实构建。

### 分支保护

Gitee `main` 为保护分支：仅仓库管理员可推送、不可删除。镜像推送以管理员身份进行，
因此正常发布不受影响；但若 GitHub 侧发生**历史重写**（force push / rebase 已发布提交），
镜像的强制推送会被保护规则拦下 —— 此时需要临时调整保护设置，或改用非强制推送。

## 常见问题

| 现象 | 处理 |
|---|---|
| 发布后页面白屏 | `index.html` 是 no-cache，先硬刷新；仍不行看服务器 `dist/index.html` 引用的是否本次构建 |
| 课文音频无法播放 | 查 `/lessons/audio/**` 的 `Content-Type` 是否为 `audio/*`（nginx 配置随发布同步） |
| 部署失败但站点正常 | 发布脚本验证未过会自动回滚，站点留在上一版；看 Actions 日志或服务器 `/var/log/thaiai-deploy.log` |
| WebHook 没触发发布 | `systemctl status thaiai-webhook`、`journalctl -u thaiai-webhook -n 50` |
