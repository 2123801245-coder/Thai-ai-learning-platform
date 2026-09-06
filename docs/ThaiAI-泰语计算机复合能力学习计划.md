# ThaiAI 泰语 × 计算机复合能力学习计划

> **目标不是让 AI 替你写网站，而是让你最终拥有独立分析、设计、编码、测试、部署 ThaiAI 的能力。**
>
> 本计划以当前 ThaiAI 项目为真实实验室，覆盖：泰语学习、Web 基础、JavaScript、React、Express、SQLite、音频、声调评测、测试、安全、Docker、Nginx 和部署。

---

## 目录

1. [如何使用这份计划](#一如何使用这份计划)
2. [24 周后的能力目标](#二24-周后的能力目标)
3. [当前项目地图](#三当前项目地图)
4. [每日与每周执行制度](#四每日与每周执行制度)
5. [AI 使用边界](#五ai-使用边界)
6. [开始前的环境检查](#六开始前的环境检查)
7. [前 14 天逐日执行表](#七前-14-天逐日执行表)
8. [24 周完整路线](#八24-周完整路线)
9. [泰语 × 计算机专项路线](#九泰语--计算机专项路线)
10. [真实功能实战验收标准](#十真实功能实战验收标准)
11. [通用测试方法](#十一通用测试方法)
12. [学习记录模板](#十二学习记录模板)
13. [毕业项目](#十三毕业项目)
14. [能力分级与晋级考试](#十四能力分级与晋级考试)
15. [长期学习规则](#十五长期学习规则)

---

# 一、如何使用这份计划

## 1. 学习周期

- **总周期**：24 周
- **建议投入**：每周 10–12 小时
- **建议频率**：每周 6 天学习，1 天复盘
- **每次学习**：90–120 分钟
- **学习方式**：理论 30%，手写代码 50%，测试与复盘 20%

如果每周只有 6–8 小时，不要压缩内容，延长到 36 周即可。不要通过“看完视频”代替“完成实战”。

## 2. 每周必须有可检查的产物

每周结束时必须留下至少一项真实证据：

- 一个可以运行的小功能
- 一条通过 `curl` 验证的 API
- 一个可以查询的 SQLite 表或 SQL 结果
- 一份浏览器 Network/Console 观察记录
- 一个移动端尺寸测试结果
- 一个被你复现并修复的 bug
- 一页不用 AI 复制的学习总结

没有产物，就不算完成这一周。

## 3. 三条不可违反的规则

### 规则 A：先理解，后编码

任何功能开始前，先写下：

1. 用户做了什么操作？
2. 前端哪个组件接收了操作？
3. 请求发送到哪个 URL？
4. 后端哪个路由接收请求？
5. 数据库读写了什么？
6. 返回失败时界面怎么办？
7. 我准备如何验证？

### 规则 B：不能只验证“页面显示出来了”

必须同时验证：

- 页面是否渲染
- 请求是否发出
- HTTP 状态码是否正确
- 数据库状态是否改变
- 刷新后数据是否保留
- 未登录、空输入、重复提交时是否正确

### 规则 C：每周至少有一次“无 AI 编码时间”

无 AI 编码时间内：

- 不让 AI 生成完整组件
- 不复制完整答案
- 只查官方文档和项目已有代码
- 允许自己写错，但必须自己调试

---

# 二、24 周后的能力目标

## 1. 你应该能够独立完成的事情

到第 24 周结束，你应该能够：

- 从空白文件写出语义正确的 HTML 页面
- 用 CSS 完成 375px、390px、414px、768px、1280px 的响应式布局
- 用 JavaScript 处理数组、对象、事件、异步请求和错误
- 用 React 拆分组件、管理状态、处理表单和副作用
- 读懂一个完整的前端请求链路
- 用 Express 设计并实现 REST API
- 用 SQLite 设计表、索引、查询、事务和迁移
- 实现登录、鉴权、学习记录和连续打卡
- 处理头像上传、文件校验和静态资源访问
- 理解浏览器录音、音频格式、采样率和权限
- 区分语音转文字、音素评分、音高、时长和声调识别
- 用真实数据评估声调算法，而不是盲信一个分数
- 用 DevTools、`curl`、日志和 SQL 定位问题
- 使用 Docker Compose 管理服务、卷和容器
- 理解 Nginx 反向代理、HTTPS、DNS 和回滚
- 审查 AI 生成代码并发现不必要的复杂性

## 2. 五级能力模型

| 等级 | 能力 | 必须通过的实践测试 |
|---|---|---|
| L1 阅读者 | 能说明代码大致作用 | 画出一个功能的前端→API→数据库流程 |
| L2 修改者 | 能安全修改现有功能 | 独立完成一个小 UI 或校验修改 |
| L3 功能开发者 | 能跨前后端完成功能 | 自己完成一个 API + 页面 + 数据表 |
| L4 调试者 | 能定位真实故障 | 只用日志、Network、SQL 和命令行修复 bug |
| L5 产品工程师 | 能设计、开发、测试、上线和维护 | 独立完成毕业项目并解释所有关键代码 |

---

# 三、当前项目地图

## 1. 技术栈

```text
前端：Vite + React + React Router + Tailwind CSS
后端：Node.js + Express
数据库：SQLite
部署：Docker Compose + Nginx + HTTPS
自动化：GitHub Actions
语音：浏览器 SpeechSynthesis / MediaRecorder + 后端语音评测接口
```

## 2. 用户请求的完整链路

```text
用户点击按钮
    ↓
React 页面或组件
    ↓
事件处理函数 / Hook
    ↓
src/lib/api.js 或 src/api/
    ↓
HTTP 请求
    ↓
Nginx /api 反向代理
    ↓
backend/app.js
    ↓
backend/routes/*.js
    ↓
backend/database.js
    ↓
SQLite
    ↓
JSON 响应
    ↓
React 更新状态
    ↓
页面重新渲染
```

## 3. 重要目录与学习顺序

| 学习主题 | 当前项目位置 | 第一次学习时要回答的问题 |
|---|---|---|
| 路由 | `src/App.jsx` | URL 如何决定显示哪个页面？为什么有懒加载？ |
| 首页 | `src/pages/Home.jsx` | 首页哪些数据来自本地，哪些来自服务器？ |
| 学习计划 | `src/pages/Plan.jsx` | 任务完成、打卡和奖励如何同步？ |
| 学习进度 | `src/hooks/useLearningProgress.js` | 状态如何加载、修复、保存和跨天？ |
| API 基地址 | `src/lib/api.js` | 同源部署与不同后端地址如何切换？ |
| API 客户端 | `src/api/auth.js`、`src/api/plan.js` | token 如何自动携带？请求失败如何处理？ |
| 登录上下文 | `src/lib/AuthContext` | 登录状态由谁拥有？页面如何知道用户是否登录？ |
| 语音播放 | `src/lib/thaiSpeech.js` | 浏览器为什么禁止自动播放？音频失败怎么办？ |
| 口语页面 | `src/pages/SpeakingPractice.jsx` | 录音、上传、评分和展示的边界在哪里？ |
| 后端入口 | `backend/app.js` | 中间件、CORS、静态文件和路由如何装配？ |
| 学习计划 API | `backend/routes/plan.js` | 谁能访问概览？打卡是否幂等？ |
| 语音 API | `backend/routes/speaking.js` | 音频如何上传、分析和返回评分？ |
| 数据库 | `backend/database.js` | 表如何创建？旧数据库如何兼容？ |
| 生产容器 | `docker-compose.prod.yml` | 哪些目录是持久化卷？容器重建会丢什么？ |
| Web 服务器 | `deploy/nginx.conf` | `/api`、`/uploads`、SPA 路由如何被代理？ |
| 部署 | `deploy/deploy.sh`、`.github/workflows/` | 构建、同步、校验和回滚如何串起来？ |

## 4. 推荐的阅读方法

不要一次打开几千行代码。每次只做以下步骤：

1. 用搜索定位函数、路由或字符串
2. 读取匹配位置上下各 50–150 行
3. 在纸上写输入、输出和状态变化
4. 用浏览器或 `curl` 触发一次真实行为
5. 回到代码确认自己的猜测
6. 写下一个仍然不明白的问题

常用搜索命令：

```bash
# 搜索函数、变量或接口
rg -n "getPlanOverview|checkInPlan|plan/overview" src backend

# 查看指定文件某个范围
sed -n '1,180p' src/lib/api.js
sed -n '60,150p' backend/routes/plan.js

# 查看最近修改
 git log --oneline -10

# 查看项目脚本
node -e "console.log(require('./package.json').scripts)"
```

---

# 四、每日与每周执行制度

## 1. 标准学习时段（90–120 分钟）

| 时间 | 内容 | 结果 |
|---|---|---|
| 15 分钟 | 泰语输入 | 朗读、听辨、抄写或分析 5–10 个词 |
| 20 分钟 | 计算机概念 | 用自己的话写出定义和一个例子 |
| 35–45 分钟 | 手写代码 | 不复制完整 AI 答案，完成一个小目标 |
| 15–20 分钟 | 测试与调试 | 至少测试成功、失败、空输入三种状态 |
| 10 分钟 | 代码解释 | 口头或文字解释关键代码 |
| 5 分钟 | 学习记录 | 写下今天最不懂的一点 |

## 2. 每周节奏

### 第一天：理解

- 体验本周对应的真实功能
- 阅读入口文件
- 画数据流
- 列出未知概念

### 第二天：学习概念

- 阅读官方文档或教材
- 写 3 个自己的例子
- 不直接改主项目

### 第三天：孤立练习

- 在临时目录写一个最小版本
- 只实现核心逻辑
- 用命令行或浏览器验证

### 第四天：接入 ThaiAI

- 先写改动计划
- 只改必要文件
- 保持既有 API 兼容

### 第五天：真实测试

- 测试正常流程
- 测试未登录、空输入、失败请求、重复操作
- 查 Network、Console、后端日志和数据库

### 第六天：复盘与重写

- 关闭 AI
- 不看原实现，重新写核心逻辑
- 对比两版并解释差异

### 第七天：考试

回答：

1. 这周我能不看代码解释什么？
2. 我遇到的真实 bug 是什么？
3. 我用什么证据证明它已修复？
4. 如果流量、用户或数据量增加，哪里会先出问题？

---

# 五、AI 使用边界

## 1. 四阶段提问法

### 阶段一：让 AI 教，不让 AI 写

```text
请不要写代码。
请解释这个功能从用户操作到数据库更新的完整流程。
列出涉及的文件、状态、请求和可能的失败点。
最后出五道题测试我是否理解。
```

### 阶段二：让 AI 审查你的方案

```text
这是我自己写的功能方案：
……
请只指出数据流、状态所有权、权限、边界条件和测试方面的问题。
不要重写代码。
```

### 阶段三：让 AI 生成测试，不生成实现

```text
请根据这个 API 设计 10 个测试场景。
必须包括空输入、重复请求、未登录、数据库为空、网络失败和跨天情况。
不要给实现代码。
```

### 阶段四：最后才请求局部代码帮助

```text
这是我已经理解并实现的代码。
请只修改导致测试失败的最小部分，并解释每一行修改的原因。
不要重构无关代码，不要新增依赖。
```

## 2. 每次接受 AI 代码前的四个问题

你必须能回答：

- 这段代码为什么放在这个文件，而不是另一个文件？
- 如果输入为空、请求失败或用户重复点击，会发生什么？
- 哪一行决定权限？哪一行改变数据？
- 我能否不看 AI，再自己修改一个小行为？

如果不能回答，先不要合并代码。

## 3. AI 使用递减表

| 周期 | AI 可以做什么 | AI 不应该替你做什么 |
|---|---|---|
| 1–4 周 | 解释概念、出题、指出文档位置 | 生成完整页面或功能 |
| 5–8 周 | 审查组件设计、生成测试清单 | 直接写完整 React 页面 |
| 9–12 周 | 审查 API、SQL 和错误处理 | 直接替你设计数据库 |
| 13–16 周 | 帮你定位具体错误 | 一次性改多个业务文件 |
| 17–20 周 | 讨论声学特征和实验设计 | 凭感觉声称声调算法准确 |
| 21–24 周 | 做发布前审查 | 替你完成毕业项目核心逻辑 |

---

# 六、开始前的环境检查

在项目根目录运行：

```bash
node -v
npm -v
npm run build
npm run typecheck
npm run lint
```

当前项目常用脚本：

```bash
npm run dev          # Vite 前端开发服务器
npm run build        # 生产构建 + crossorigin 清理
npm run preview      # 预览 dist
npm run server       # 启动 Express 后端
npm run server:dev   # watch 模式启动后端
npm run typecheck    # JS/TS 类型检查
npm run lint         # ESLint 检查
```

## 本地双服务运行

终端一：

```bash
npm run server
```

终端二：

```bash
npm run dev
```

默认：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3001`

本地开发时，`vite.config.js` 将 `/api`、`/videos`、`/uploads`、`/subtitles` 代理到后端。

> 注意：本地默认数据库通常是 `backend/users.db`；生产 Compose 通过 `DB_PATH=/data/users.db` 使用持久化卷。学习时要明确自己正在访问哪一份数据库。

---

# 七、前 14 天逐日执行表

这 14 天不能跳过。它们的目标是让你从“会运行项目”进入“能解释项目”。

## 第 1 天：建立项目地图

### 学习任务

- 打开首页、课程、词汇、口语和学习计划
- 记录每个页面的 URL
- 找到 `src/App.jsx`
- 找到 `src/pages/Home.jsx`
- 找到 `backend/app.js`

### 命令

```bash
pwd
find src -maxdepth 2 -type f | sort | head -80
find backend -maxdepth 2 -type f | sort | head -80
rg -n "path=|lazy\(|express\.use|router\.get|router\.post" src/App.jsx backend/app.js backend/routes
```

### 手写产物

画一张图：

```text
首页 → Home.jsx → 某个 API → backend/routes/某文件 → database.js
```

### 自测

不用打开 AI，回答：

- `/plan` 路由在哪里注册？
- 前端请求基地址在哪里定义？
- 后端端口从哪里读取？

---

## 第 2 天：Git 与变更意识

### 学习任务

学习：`status`、`log`、`show`、`diff`、分支和提交。

### 命令

```bash
git status --short
git log --oneline -10
git show --stat --oneline HEAD
git diff --check
```

### 手写练习

创建一个只在本地存在的说明文件，写三行学习笔记，然后删除它。观察：

- 未跟踪文件如何显示
- 删除如何显示
- 哪些文件不能随便提交

### 自测

解释：

- 工作树、暂存区、提交分别是什么？
- 为什么 `.env` 和密钥不能提交？
- 为什么上线前要看 diff 而不是只看页面？

---

## 第 3 天：浏览器 DevTools

### 学习任务

打开浏览器 DevTools，重点使用：

- Elements
- Console
- Network
- Application/Storage
- Mobile device emulation

### 操作任务

1. 登录或使用已有登录状态进入首页
2. 刷新页面
3. 在 Network 中找到 `/api/plan/overview` 或 `/api/features`
4. 记录请求方法、状态码、请求头、响应 JSON
5. 在 Application 中找到 token 和学习进度

### 自测

解释：

- 401 和 403 有什么区别？
- 代码返回 200 但页面没变化时，下一步查哪里？
- 为什么 Console 没报错不等于功能正确？

---

## 第 4 天：HTML 语义与表单

### 学习任务

学习：`main`、`nav`、`section`、`button`、`label`、`input`、`form`。

### 手写练习

在临时文件中写一个泰语词汇卡：

- 泰语词
- 罗马音
- 中文含义
- 播放按钮
- 认识/不认识按钮

要求：

- 不用 `div` 代替所有元素
- 按钮可以键盘触发
- 输入框有 `label`
- 图片有 `alt`

### 自测

- 为什么用 `div onClick` 代替 `button` 会损害可访问性？
- `type="submit"` 的表单如何防止重复提交？

---

## 第 5 天：CSS 布局与手机尺寸

### 学习任务

学习：盒模型、Flexbox、Grid、`minmax`、媒体查询、`clamp`、CSS 变量。

### 手写练习

制作一个响应式泰语学习卡：

- 375px：单列
- 768px：两列
- 1280px：主内容 + 侧边信息

### 验收

在 DevTools 中逐一测试：

- 375×812
- 390×844
- 414×896
- 768×1024
- 1280×800

记录：是否横向滚动、按钮是否超出、泰文字体是否被裁切。

---

## 第 6 天：JavaScript 数据结构

### 学习任务

学习：变量、对象、数组、函数、解构、`map`、`filter`、`find`、可选链和默认值。

### 手写练习

创建 10 个泰语词对象：

```js
{
  id: "sawasdee",
  thai: "สวัสดี",
  roman: "sà-wàt-dii",
  meaning: "你好",
  tone: "低调 + 中调"
}
```

实现：

- 按中文搜索
- 按声调筛选
- 找到一个指定 ID
- 统计词数

### 自测

- `map`、`filter`、`find` 的返回值有什么区别？
- 为什么不要直接修改共享数组？

---

## 第 7 天：JavaScript 事件与 LocalStorage

### 学习任务

学习：事件对象、事件冒泡、`preventDefault`、JSON 序列化和 LocalStorage。

### 手写练习

做一个不依赖后端的闪卡：

- 点击显示答案
- 认识/不认识
- 记录当天完成数
- 刷新后数据仍然存在

### 命令/观察

在 Console 中观察：

```js
localStorage.getItem("thai_ai_learning_progress")
JSON.parse(localStorage.getItem("thai_ai_learning_progress"))
```

### 周测

关闭 AI，重新写出：

- `readJSON`
- `writeJSON`
- `toggleWord`

不要求和项目完全一样，但必须解释每一行。

---

## 第 8 天：Promise、fetch 与状态三分法

### 学习任务

学习：Promise、`async/await`、HTTP 请求、加载状态、成功状态、错误状态。

### 手写练习

使用公开或本地 mock 数据实现：

```text
loading → success
loading → empty
loading → error → retry
```

### 必须写出的状态

```js
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");
```

### 自测

- 为什么 `try/catch` 不能捕获没有 `await` 的 Promise？
- 请求失败时，按钮应该显示什么？
- 空数组和请求失败为什么不是同一种状态？

---

## 第 9 天：认识 React 组件

### 学习任务

学习：组件、Props、State、条件渲染、列表和 key。

### 阅读文件

- `src/pages/Home.jsx`
- `src/pages/Plan.jsx`
- `src/components/`

### 手写练习

拆出三个小组件：

- `ThaiWordCard`
- `ProgressBar`
- `StatusMessage`

不要一次改主项目，先在临时练习文件里完成。

### 自测

- Props 和 State 的区别是什么？
- 列表为什么需要稳定的 `key`？
- 什么数据应该由父组件拥有？

---

## 第 10 天：useEffect 与清理

### 学习任务

学习：副作用、依赖数组、清理函数、组件卸载和请求竞态。

### 真实阅读

重点看 `HomePlanCard` 和 `Plan.jsx` 中的：

- 拉取计划概览
- 组件卸载后的 `alive` 标记
- 定时器清理
- 自动打卡

### 手写练习

实现一个“加载词汇”的 Hook，要求：

- 组件卸载后不更新状态
- 请求失败能显示错误
- 重新加载不会叠加旧定时器

### 自测

- 依赖数组为空意味着什么？
- 为什么 `setTimeout` 必须清理？
- 两次快速请求返回顺序相反时会发生什么？

---

## 第 11 天：React 表单与状态所有权

### 学习任务

学习：受控输入、表单提交、验证、派生状态和状态单一所有者。

### 练习

为泰语词汇添加表单：

- 泰文必填
- 中文含义必填
- 罗马音可选
- 提交时禁用按钮
- 成功后清空表单
- 失败保留用户输入

### 自测

- `completed` 是否应该被单独存储，还是从任务状态计算？
- 同一个服务端数据被两个组件请求时，谁拥有它？

---

## 第 12 天：HTTP API 与 Express

### 学习任务

阅读：

- `backend/app.js`
- 一个简单的 `backend/routes/*.js`
- `src/lib/api.js`

### 命令

```bash
curl -i http://localhost:3001/
curl -i http://localhost:3001/api/features
curl -i http://localhost:3001/api/plan/overview
```

### 手写练习

写一个最小 Express API：

```text
GET /api/practice/health
POST /api/practice/answer
```

要求：

- JSON 响应
- 空输入返回 400
- 成功返回 200
- 用 `curl` 验证

### 自测

- 中间件执行顺序是什么？
- 什么时候返回 400，什么时候返回 401？

---

## 第 13 天：SQLite 基础

### 学习任务

学习：表、主键、唯一约束、索引、查询和参数化 SQL。

### 阅读

- `backend/database.js`
- `backend/routes/plan.js`

### 命令

```bash
sqlite3 backend/users.db '.tables'
sqlite3 backend/users.db '.schema users'
sqlite3 backend/users.db 'select count(*) from users;'
```

如果本机没有 `sqlite3`，用 Node 的 `sqlite3` 依赖写一个只读查询脚本，不要直接修改生产数据库。

### 手写练习

创建临时数据库和表：

```sql
CREATE TABLE words (
  id INTEGER PRIMARY KEY,
  thai TEXT NOT NULL,
  meaning TEXT NOT NULL,
  expected_tone INTEGER,
  UNIQUE(thai)
);
```

### 自测

- 为什么用户邮箱要有唯一约束？
- 为什么 SQL 不能直接拼接用户输入？
- 索引解决什么问题，又有什么成本？

---

## 第 14 天：完整追踪一个真实功能

选择“首页学习计划卡显示连续打卡状态”或“学习计划打卡”，完成一次完整追踪：

```text
点击/页面加载
→ HomePlanCard 或 Plan.jsx
→ src/api/plan.js
→ /api/plan/overview 或 /api/plan/checkin
→ backend/routes/plan.js
→ database.js / SQLite
→ JSON
→ React state
→ 页面文字和进度变化
```

### 必须交付

1. 一张数据流图
2. 一份请求/响应样例
3. 一份 SQL 变化说明
4. 三个失败场景
5. 一段 300 字总结

### 14 天考试

不看 AI，回答：

- 未登录访问 `/api/plan/overview` 为什么应该是 401？
- 为什么“今日完成 4/4”不能只由前端 LocalStorage 决定？
- 如果用户在另一台设备打卡，首页如何获得变化？

通过后再进入第 2 周后的路线。

---

# 八、24 周完整路线

下面每周都包含：学习重点、当前代码、孤立练习、ThaiAI 实战、验收标准。

---

## 阶段一：Web 与编程基础（第 1–4 周）

### 第 1 周：项目认知、命令行、Git、DevTools

**学习重点**

- 文件系统和终端
- npm scripts
- Git 工作树和提交
- HTTP 基础
- 浏览器 Network、Console、Storage

**当前代码**

- `package.json`
- `src/App.jsx`
- `src/lib/api.js`
- `backend/app.js`

**实战**

- 画项目架构图
- 追踪一个登录或计划请求
- 用 `curl` 调用三个接口

**验收**

能够说明一条请求从浏览器到 SQLite 再返回的全过程。

### 第 2 周：HTML、表单和可访问性

**学习重点**

- 语义 HTML
- 表单和校验
- 键盘操作
- 焦点和按钮语义
- 图片、音频的可访问名称

**孤立练习**

手写泰语闪卡和登录表单，不使用组件库。

**ThaiAI 实战**

检查一个现有页面：

- 所有可点击元素是否真的使用 `button` 或 `a`
- 表单输入是否有 label
- 错误信息是否能被读屏软件发现

**验收**

只用键盘完成一次闪卡操作和表单提交。

### 第 3 周：CSS、响应式与排版

**学习重点**

- 盒模型
- Flexbox/Grid
- CSS 变量
- 断点与流式尺寸
- 深色/浅色主题
- 字体、行高、字距

**当前代码**

- `src/index.css`
- `src/themes/theme.css`
- `src/themes/theme.js`
- `src/components/ui/premium.jsx`

**实战**

重写一个课程卡，使它在 375px 到 1440px 不溢出。

**验收**

截图或记录五个尺寸下的：

- 页面宽度
- 横向滚动状态
- 卡片宽度
- 按钮可点击区域
- 泰文是否被裁切

### 第 4 周：JavaScript 与泰语 Unicode

**学习重点**

- 对象与数组
- 模块
- 事件
- JSON
- LocalStorage
- Unicode code point、组合字符和规范化

**当前代码**

- `src/data/vocabulary.js`
- `src/data/vocabularyExpansion.js`
- `src/lib/thaiWordLookup.js`
- `src/hooks/useLearningProgress.js`

**实战**

制作一个手写泰语闪卡引擎：

- 搜索
- 筛选
- 认识/不认识
- 每日计数
- 本地保存

**验收**

不看之前代码，重新写出核心数据处理函数，并解释泰语字符长度为什么不能简单等于用户看到的字数。

---

## 阶段二：React 与浏览器行为（第 5–8 周）

### 第 5 周：异步 JavaScript 与 fetch

**学习重点**

- Promise
- `async/await`
- fetch/axios
- 加载、空数据、错误、重试
- 请求超时和取消

**当前代码**

- `src/lib/api.js`
- `src/api/auth.js`
- `src/api/plan.js`
- `src/lib/features.js`

**实战**

做一个“今日泰语词汇”页面，必须有：

- 加载骨架
- 空状态
- 错误提示
- 重试按钮
- 请求状态日志

**验收**

通过浏览器 Network 证明四种状态真的发生过。

### 第 6 周：React 组件、Props、State

**学习重点**

- 组件拆分
- Props 设计
- 状态最小化
- 条件渲染
- 列表 key

**当前代码**

- `src/pages/Home.jsx`
- `src/pages/Course.jsx`
- `src/components/`

**实战**

独立实现：

- `ThaiWordCard`
- `LessonProgress`
- `AudioButton`
- `EmptyState`

**验收**

每个组件都能单独说明输入、输出和状态所有权。

### 第 7 周：useEffect、表单和清理

**学习重点**

- 副作用
- 依赖数组
- 清理定时器和事件
- 受控表单
- 派生状态

**当前代码**

- `src/pages/Plan.jsx`
- `src/pages/Home.jsx` 的 `HomePlanCard`
- `src/hooks/useLearningProgress.js`

**实战**

改造一个练习页面，要求：

- 进入页面自动加载数据
- 离开页面取消更新
- 重试不叠加请求
- 提交期间按钮禁用

**验收**

在慢网络模拟下快速进入/离开页面，Console 没有状态更新警告，数据没有被旧请求覆盖。

### 第 8 周：路由、移动导航与可访问性

**学习重点**

- React Router
- 懒加载和 Suspense
- 面包屑/返回路径
- 移动端底部导航
- reduced motion
- 触摸目标尺寸

**当前代码**

- `src/App.jsx`
- `src/components/MobileTabBar.jsx`
- `src/layouts/MainLayout.jsx`

**实战**

为词汇→练习→结果建立一个三页学习流。

**验收**

- 刷新深层 URL 不白屏
- 浏览器后退行为合理
- 375px 下导航不遮挡内容
- 开启减少动态效果后仍有状态反馈

---

## 阶段三：后端与数据库（第 9–12 周）

### 第 9 周：Node.js 与 Express

**学习重点**

- Node 模块
- Express 应用
- 中间件
- 请求/响应
- 静态资源
- 生命周期

**当前代码**

- `backend/app.js`
- `backend/routes/features.js`
- `backend/routes/vocabulary.js`

**实战**

实现一个独立的 `/api/practice` 路由：

```text
GET  /api/practice/health
GET  /api/practice/words
POST /api/practice/answer
```

**验收**

使用 `curl` 验证 200、400、404 三种返回。

### 第 10 周：REST、验证与鉴权

**学习重点**

- 资源命名
- 请求体验证
- 401/403/404/409/422/500
- Bearer token
- CORS
- 统一错误格式

**当前代码**

- `backend/routes/auth.js`
- `backend/routes/plan.js`
- `src/api/auth.js`
- `src/lib/AuthContext`

**实战**

为一个练习结果 API 增加：

- 必须登录
- 必填字段校验
- 重复提交处理
- 不存在的记录返回 404

**验收**

不用页面，单独用 `curl` 证明权限边界正确。

### 第 11 周：SQLite、事务与迁移

**学习重点**

- 表结构
- 主键和外键
- 唯一约束
- 索引
- 参数化查询
- 事务
- `CREATE TABLE IF NOT EXISTS`
- 旧数据库兼容

**当前代码**

- `backend/database.js`
- 与学习记录、用户、VIP、计划相关的表

**实战**

设计一个临时数据库：

```text
users
words
learning_records
daily_plan_records
streak_rewards
```

写出：

- 建表 SQL
- 查询某用户近 7 天学习记录
- 统计每日完成率
- 防止重复奖励的约束或查询

**验收**

删除临时数据库后重新启动，表能够自动建立；重复运行迁移不会丢数据。

### 第 12 周：重建连续学习与 7 天 VIP 奖励

**学习重点**

- 服务端权威状态
- 日历日期与时区
- 幂等操作
- 连续天数计算
- 奖励发放事务

**当前代码**

- `src/pages/Plan.jsx`
- `src/api/plan.js`
- `backend/routes/plan.js`
- `backend/vipService.js`
- `backend/database.js`

**必须回答的问题**

- 什么叫“完成一天”？
- 用户当天重复打卡会怎样？
- 7 天奖励如何保证只发一次？
- 用户在午夜前后提交如何处理？
- 服务器日期和用户本地日期是否一致？

**实战**

从空数据库重写一个简化版本：

```text
POST /checkin
GET  /overview
```

**验收**

测试以下状态：

- 第 1 天
- 连续第 2 天
- 中间断 1 天
- 第 7 天奖励
- 第 7 天重复请求
- 未登录请求
- 不同用户互不影响

---

## 阶段四：全栈产品行为（第 13–16 周）

### 第 13 周：登录、Token 与保护路由

**学习重点**

- 注册
- 登录
- Token 保存
- Axios 拦截器
- 过期与退出
- 前端保护和后端保护的区别

**当前代码**

- `src/lib/AuthContext`
- `src/api/auth.js`
- `src/App.jsx`
- `backend/routes/auth.js`

**实战**

手写一个最小登录闭环：

```text
注册 → 登录 → 保存 token → 请求用户信息 → 退出
```

**验收**

清除 token 后：

- 首页不能伪装成已登录
- 受保护 API 返回 401
- 页面回到登录入口

### 第 14 周：学习记录与恢复学习

**学习重点**

- LocalStorage 与服务器记录的边界
- 进度事件
- 幂等完成操作
- 刷新恢复
- 断网重试

**当前代码**

- `src/hooks/useLearningProgress.js`
- `src/pages/Plan.jsx`
- `backend/routes/progress.js`
- `backend/database.js`

**实战**

实现一个课程完成记录：

- 开始课程
- 完成课程
- 保存分数
- 刷新后继续
- 重复完成不重复计算

**验收**

同一用户在两个浏览器中操作，说明哪一个值是本地临时值，哪一个值是服务器权威值。

### 第 15 周：头像上传与文件安全

**学习重点**

- `multipart/form-data`
- Multer
- 文件大小限制
- MIME 检查
- 安全文件名
- 静态文件服务
- 头像替换和旧文件处理

**当前代码**

- `src/pages/Profile.jsx`
- `backend/routes/auth.js`
- `backend/app.js` 的 `/uploads`
- `docker-compose.prod.yml` 的 uploads 卷

**实战**

实现或审查头像流程：

- 选择图片
- 本地预览
- 上传
- 成功刷新头像
- 拒绝非图片
- 拒绝过大文件
- 网络失败可重试

**验收**

至少测试：JPG、PNG、超大文件、改后缀的非图片文件、空文件和重复上传。

### 第 16 周：跨设备同步与状态所有权

**学习重点**

- 客户端状态、服务器状态、派生状态
- 乐观更新
- 最终一致性
- 轮询与刷新
- 冲突与覆盖

**当前代码**

- `src/pages/Home.jsx` 的 `HomePlanCard`
- `src/pages/Plan.jsx`
- `src/api/plan.js`
- `backend/routes/plan.js`

**实战**

让首页展示：

- 服务端连续天数
- 今日服务端打卡状态
- 服务端奖励进度
- 本地任务交互状态

**验收**

使用两个浏览器账号会话模拟两台设备：

1. 设备 A 完成计划
2. 设备 B 刷新首页
3. 设备 B 显示最新服务端状态
4. 重复刷新不会把服务器状态降回旧值

---

## 阶段五：泰语语言技术与语音（第 17–20 周）

### 第 17 周：泰语文字与声调数据模型

**泰语学习内容**

- 中辅音、高辅音、低辅音
- 长元音与短元音
- 活音节与死音节
- 尾音
- 声调符号
- 音节边界
- 拼读顺序

**软件建模练习**

为每个词设计字段：

```text
id
thai_word
normalized_text
syllables
romanization
meaning
consonant_class
vowel_length
final_sound
syllable_type
tone_mark
expected_tone
audio_url
```

**当前代码**

- `src/data/vocabulary.js`
- `src/data/vocabularyExpansion.js`
- `src/pages/ThaiAlphabet.jsx`
- `src/lib/thaiWordLookup.js`

**验收**

任选 30 个词，人工检查：

- 泰文是否正确
- 罗马音是否一致
- 声调标签是否有依据
- 组合字符是否被错误拆分

### 第 18 周：浏览器录音与音频播放

**学习重点**

- `MediaRecorder`
- 麦克风权限
- MIME 类型
- WAV、WebM、MP3
- 采样率、位深、声道
- 播放兼容性
- 上传大小和超时

**当前代码**

- `src/pages/SpeakingPractice.jsx`
- `src/lib/thaiSpeech.js`
- `backend/routes/speaking.js`
- `backend/tts.js`

**实战**

做一个最小录音组件：

```text
请求权限 → 开始录音 → 停止 → 本地播放 → 上传 → 显示结果
```

**必须记录**

- 浏览器和系统
- 录音 MIME 类型
- 音频时长
- 文件大小
- 是否能播放
- 上传返回状态

**验收**

至少在桌面浏览器和一台手机上测试权限拒绝、取消录音、无麦克风和网络失败。

### 第 19 周：声调识别与评分

**必须先区分四件事**

1. 语音转文字：说了什么
2. 音素识别：发出了哪些音
3. 韵律分析：音高、时长、强度如何变化
4. 声调分类：是否符合目标泰语声调

**学习内容**

- F0 基频
- 音高轮廓
- 时长
- 音节边界
- 静音区间
- 说话人差异
- 麦克风和噪音影响
- 混淆矩阵

**当前代码**

- `src/pages/SpeakingPractice.jsx`
- `backend/routes/speaking.js`
- `src/lib/speakingHistory.js`
- `src/lib/abilityModel.js`

**实战顺序**

1. 先建立 5 个声调的人工标注词表
2. 收集至少 3 位说话人样本
3. 记录目标声调和实际音频
4. 提取或读取评测结果
5. 输出混淆矩阵
6. 观察错误集中在哪些声调对
7. 再设计评分解释

**禁止的做法**

- 只有一段录音就宣称算法准确
- 把文字识别正确当成声调正确
- 给用户显示没有解释的 92 分
- 用固定阈值忽略男女声差异

**验收**

你必须能回答：

- 模型为什么把两个声调混淆？
- 分数中的 tone 与 accuracy 有什么区别？
- 哪些数据会让评测偏差变大？
- 当置信度低时，产品应该如何提示用户？

### 第 20 周：泰语课程、例句与错误复习系统

**学习重点**

- 语言内容数据建模
- 难度等级
- 例句自然度
- 错误分类
- 间隔复习
- 听说读写能力标签

**当前代码**

- `src/data/lessons.js`
- `src/data/courses.js`
- `src/lib/wordBooks.js`
- `src/lib/newsListening.js`
- `src/pages/WrongNotebook.jsx`

**实战**

建立 20 个“声调易错词”内容包，每个词包含：

- 泰文
- 中文
- 罗马音
- 目标声调
- 最小对立或易混词
- 例句
- 练习建议

**验收**

一个错误记录能从练习页面进入错题本，并在复习后正确更新状态。

---

## 阶段六：产品质量、测试与运维（第 21–24 周）

### 第 21 周：设计系统与 Apple Design 原则

**学习重点**

- 设计 token
- 层级和留白
- 颜色对比度
- 字体光学尺寸
- 动画的响应性与克制
- 目的、熟悉、简单、灵活、责任

**当前代码**

- `src/index.css`
- `src/components/ui/premium.jsx`
- `src/components/MobileTabBar.jsx`
- `src/pages/Home.jsx`
- `src/pages/Course.jsx`

**实战**

选一个课程卡或进度模块，完成：

- 状态设计：加载、成功、空、失败
- 键盘焦点
- hover/active/disabled
- reduced motion
- 375px 适配

**验收**

删除一半装饰后，核心任务仍然更清楚；你能解释每个视觉元素的产品目的。

### 第 22 周：移动端与无障碍

**学习重点**

- 移动优先
- 触摸目标
- 底部导航安全区
- 横屏和旋转
- 大字体
- `prefers-reduced-motion`
- 对比度和读屏

**实战**

逐页测试：

- 首页
- 学习计划
- 课程
- 口语练习
- 个人中心

**验收清单**

- 无横向滚动
- 主要按钮可单手点击
- 底部导航不遮挡输入框
- 异步加载时不会跳动到不可点击位置
- 语音按钮有明确状态
- 文字变大后不重叠

### 第 23 周：测试、调试与安全

**学习重点**

- 单元测试和集成测试思维
- API 黑盒测试
- 状态机测试
- 数据库测试
- 日志和错误追踪
- 密钥管理
- CORS
- 限流
- 密码和上传安全

**必须测试的真实功能**

- 注册/登录
- 学习计划概览
- 每日打卡
- 7 天奖励幂等
- 学习记录
- 头像上传
- 语音上传
- 未登录访问

**每个功能至少测试**

```text
正常输入
空输入
非法输入
重复请求
未登录
权限不足
数据库为空
网络失败
刷新页面
移动端宽度
```

**验收**

你能从一个 500/401/404 错误开始，只通过：

- 浏览器 Network
- 后端日志
- `curl`
- SQLite 查询
- 代码定位

找到真实原因，而不是反复刷新页面。

### 第 24 周：Docker、Nginx、CI/CD 与毕业考试

**学习重点**

- Dockerfile 的构建上下文
- Compose 服务、网络和固定容器名
- 持久化卷
- Nginx 反代和 SPA 回退
- HTTPS 证书
- DNS
- 构建产物 hash
- GitHub Actions
- 备份、回滚和最小权限

**当前代码**

- `Dockerfile`
- `backend/Dockerfile`
- `docker-compose.prod.yml`
- `deploy/nginx.conf`
- `deploy/deploy.sh`
- `.github/workflows/deploy.yml`

**实战**

在本地或隔离环境完成一次演练：

```text
构建 → 启动 → 检查首页 → 检查 API → 检查数据库卷
→ 模拟失败 → 回滚 → 再次验证
```

**验收**

你必须能解释：

- 为什么 `data/` 不能只存在容器内部
- 为什么 `dist/` 挂载后容器重建不能覆盖它
- Nginx 如何把 `/api` 转给后端
- 首页为什么需要 SPA fallback
- 部署后如何证明服务器正在运行当前版本

---

# 九、泰语 × 计算机专项路线

## 1. 知识对应关系

| 泰语知识 | 计算机应用 | 练习产物 |
|---|---|---|
| Unicode 与组合字符 | 搜索、排序、规范化 | 泰语词搜索器 |
| 音节结构 | 内容数据模型 | syllable schema |
| 辅音类别 | 声调规则引擎 | tone rule table |
| 长短元音 | 发音解释和标签 | 最小对立词表 |
| 尾音和活死音节 | 规则推导 | 声调预测器 |
| 声调符号 | 目标答案生成 | expected tone 字段 |
| 自然表达 | 课程和对话数据 | 场景例句集 |
| 学习者错误 | 复习队列 | wrong answer record |
| 音高轮廓 | 声调分类 | F0 特征实验 |
| 语速和时长 | 流利度评估 | duration metrics |
| 多说话人差异 | 模型校准 | speaker split dataset |

## 2. 每周泰语学习固定任务

每周至少完成：

- 新学 30–50 个词
- 精听 5–10 分钟真实泰语
- 录音朗读 10 个词或句子
- 人工标注 5 个声调样本
- 写 5 个自然例句
- 记录 3 个自己容易混淆的音

## 3. 泰语词条验收表

每增加一个词，检查：

```text
[ ] 泰文拼写正确
[ ] Unicode 没有异常空格或错误组合
[ ] 中文含义符合上下文
[ ] 罗马音方案统一
[ ] 辅音类别已确认
[ ] 元音长短已确认
[ ] 尾音已确认
[ ] 目标声调有规则依据
[ ] 例句自然，不是逐字中文翻译
[ ] 音频来源和版权可追溯
```

## 4. 声调评测的实验记录要求

每次实验记录：

```text
实验编号：
日期：
目标词：
目标声调：
说话人：
性别/年龄段（可选匿名标签）：
设备：
环境噪声：
音频格式：
采样率：
实际音频时长：
服务端返回：
人工判断：
是否一致：
错误原因猜测：
下一步实验：
```

---

# 十、真实功能实战验收标准

## 1. 首页学习计划卡

必须能解释并验证：

- 未登录时为什么不显示服务端状态
- 登录后何时拉取 `/api/plan/overview`
- 服务端失败时如何降级
- 服务端连续天数如何显示
- 服务端今日完成如何影响 UI
- 本地手动勾选和服务端权威状态如何避免冲突

## 2. 学习计划打卡

必须验证：

| 场景 | 预期 |
|---|---|
| 未登录 | 401 |
| 首次完成计划 | streak 增加或建立 |
| 同一天重复打卡 | 不重复增加天数 |
| 连续 7 天 | 发放 3 天 VIP |
| 重复请求第 7 天 | 不重复发放 |
| 中断一天 | 连续天数重新计算 |
| 两个用户 | 数据完全隔离 |

## 3. 头像上传

必须验证：

- 头像预览不会把本地路径当成服务器 URL
- 上传中有明确状态
- 上传失败不清空旧头像
- 非法 MIME 被拒绝
- 超大文件被拒绝
- 刷新页面后头像仍可访问
- 容器重建后文件仍在持久化目录

## 4. 语音播放与听力

必须验证：

- 第一次用户交互后语音能启动
- 无语音列表时有降级
- 音频请求失败有提示
- 手机浏览器能播放
- 播放中可以停止
- 新音频开始前旧音频被释放
- 自托管字体和音频不会依赖不可达的外部资源

## 5. 登录和其他设备

必须验证：

- 新设备能打开登录页
- 登录响应包含有效 token
- token 被正确保存
- `/api/auth/me` 或对应用户接口返回用户
- 登录后路由跳到主界面
- 失效 token 会回到登录页
- 一个设备操作后另一个设备刷新能拿到服务器状态

---

# 十一、通用测试方法

## 1. 浏览器真实入口测试

每次改 UI 不要只看构建：

1. 启动前后端
2. 打开真实路由
3. 点击真实按钮
4. 观察 Network
5. 观察 Console
6. 刷新页面
7. 改变窗口宽度
8. 检查 LocalStorage
9. 检查服务端响应

## 2. API 黑盒测试模板

```bash
# 正常请求
curl -i http://localhost:3001/api/features

# 未授权请求
curl -i http://localhost:3001/api/plan/overview

# 带 token 请求
curl -i \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/plan/overview

# JSON POST
curl -i -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"completedTasks":4,"totalTasks":4,"planCompleted":true}' \
  http://localhost:3001/api/plan/checkin
```

## 3. 状态机测试

对任何学习功能画出状态：

```text
idle
  ↓ 点击
loading
  ├─ 成功 → success
  ├─ 空数据 → empty
  └─ 失败 → error → retry
```

口语录音可以画成：

```text
idle
→ requesting_permission
→ recording
→ processing
→ uploading
→ analyzing
→ result
```

每条箭头都要有失败路径。

## 4. 数据库验证模板

```sql
-- 用户数量
SELECT COUNT(*) FROM users;

-- 某用户最近记录
SELECT *
FROM daily_plan_records
WHERE user_id = ?
ORDER BY plan_date DESC
LIMIT 10;

-- 奖励是否重复
SELECT user_id, milestone, COUNT(*)
FROM streak_rewards
GROUP BY user_id, milestone
HAVING COUNT(*) > 1;
```

## 5. 发布前检查

```bash
npm run build
npm run typecheck
npm run lint
git diff --check
```

然后再检查：

- 没有密钥进入 diff
- 没有调试 `console.log` 泄露敏感数据
- 没有临时账号和测试 token
- 没有把数据库备份提交进仓库
- 没有把 `node_modules`、构建产物或临时文件误提交

---

# 十二、学习记录模板

## 1. 每日记录

```markdown
# 学习记录 YYYY-MM-DD

## 今日泰语
- 新词：
- 精听内容：
- 朗读录音：
- 今天分不清的音：

## 今日计算机
- 概念：
- 用自己的话解释：
- 当前项目对应文件：

## 今日代码
- 我自己写了什么：
- 运行结果：
- 遇到的错误：
- 我如何定位：

## 验证证据
- 命令：
- 页面入口：
- HTTP 状态：
- 数据库变化：

## 仍然不懂
-

## 明天第一件事
-
```

## 2. Bug 调查记录

```markdown
# Bug：

## 现象
-

## 可复现步骤
1.
2.
3.

## 预期
-

## 实际
-

## 证据
- 浏览器 Network：
- Console：
- 后端日志：
- SQL 查询：

## 假设
1.
2.

## 最小修复
-

## 修复后验证
-

## 防止复发的测试
-
```

## 3. API 设计记录

```markdown
# API：

## 用途

## 方法和路径

## 是否需要登录

## 请求参数

| 字段 | 类型 | 必填 | 规则 |
|---|---|---|---|

## 成功响应

## 失败响应

| 状态码 | 条件 | 响应 |
|---|---|---|

## 幂等性

## 数据库影响

## 测试命令
```

## 4. AI 代码审查记录

```markdown
# AI 审查记录

## 我原本的设计

## 我向 AI 问了什么

## AI 指出的风险

## 我接受的建议

## 我拒绝的建议以及原因

## 我自己验证了什么

## 现在我能否独立修改这段代码
- 能 / 不能
```

## 5. 每周复盘

每周回答：

- 本周最重要的一个概念是什么？
- 我亲手写了多少代码？
- 哪段代码是我真正理解的？
- 哪个问题我只是暂时绕过？
- 本周哪个测试最有价值？
- 我是否错误地相信了 AI 的结论？
- 下周要删掉什么复杂性？

---

# 十三、毕业项目

## 项目名称

**ThaiAI 声调训练与解释系统**

## 目标

用户选择一个泰语词或短句，看到目标声调，录制自己的发音，系统返回可解释的结果，并把结果保存到学习记录和错题复习中。

## 功能范围

### 前端

- 声调训练词列表
- 泰文、中文、罗马音
- 目标声调说明
- 开始录音、停止录音、重录
- 上传进度
- 评分结果
- 音高/时长的简明解释
- 重试和错误状态
- 手机端适配

### 后端

- 获取训练词
- 创建评测任务
- 接收音频
- 校验用户和文件
- 调用或封装语音评测
- 返回评分和置信度
- 保存练习记录
- 提供历史查询

### 数据库

至少设计：

```text
tone_practice_items
tone_attempts
speaking_scores
```

字段必须能区分：

- 目标声调
- 识别声调
- 分数
- 置信度
- 音频时间
- 用户
- 创建时间
- 评测版本

### 测试

至少包括：

- 未登录
- 无音频
- 空音频
- 非法文件
- 超大文件
- 评测服务超时
- 低置信度
- 重复提交
- 刷新结果页
- 两个用户互相隔离

## 毕业项目限制

1. 前两天禁止让 AI 生成实现代码
2. 先自己写数据流和 API 合同
3. 先实现假的评测服务，再接真实语音服务
4. 所有分数都要带置信度或限制说明
5. 不允许把“识别文字正确”直接当成“声调正确”
6. 至少写 5 个后端测试场景或黑盒验证脚本
7. 必须在手机尺寸上真实操作
8. 部署前必须完成回滚演练

## 毕业答辩题

你需要口头回答：

1. 用户点击录音按钮后，浏览器发生了什么？
2. 音频用什么格式传输？为什么？
3. 哪些错误在前端处理，哪些必须由后端处理？
4. 如果评测服务超时，用户看到什么？数据库写入什么？
5. 如何证明两个用户的数据没有混淆？
6. 如何判断奖励或学习记录是否重复写入？
7. 声调分数的训练数据从哪里来？标签是否可靠？
8. 如果男女声、设备和环境变化导致准确率下降，你会怎么实验？
9. 容器重建后哪些数据必须仍然存在？
10. 如何证明线上运行的是当前提交的版本？

---

# 十四、能力分级与晋级考试

## L1 阅读者考试

- 画出 App 路由图
- 解释一个 React 页面
- 找到一个 API 的前后端对应位置
- 用 `curl` 调用一个接口

**通过标准**：能独立讲清楚一个小功能，但还不能安全修改复杂逻辑。

## L2 修改者考试

独立完成一个小任务，例如：

- 增加表单校验
- 修改空状态
- 添加一个进度标签
- 修复一个移动端溢出

**通过标准**：改动范围小，能运行、能测试、能说明回滚方式。

## L3 功能开发者考试

独立完成：

```text
一个 React 页面
+ 一个 Express API
+ 一个 SQLite 表或字段
+ 登录权限
+ 至少 5 个测试场景
```

**通过标准**：正常流程和失败流程都能工作。

## L4 调试者考试

给自己制造一个故障：

- 改错 API 路径
- 改错字段名
- 删除一条数据库记录
- 让后端返回 500
- 制造一个过期 token

然后只用证据恢复。

**通过标准**：不能靠盲目刷新或让 AI 猜答案。

## L5 产品工程师考试

完成毕业项目，并提交：

- 产品说明
- 数据流图
- API 合同
- 数据库设计
- 测试记录
- 移动端记录
- 安全检查
- 部署记录
- 回滚步骤
- 已知限制

**通过标准**：能够在没有 AI 代写的情况下解释和修改核心代码。

---

# 十五、长期学习规则

## 1. 每月必须完成一次“脱离 AI 日”

这一天只允许使用：

- 项目源代码
- 浏览器 DevTools
- 官方文档
- `curl`
- SQLite 查询
- Git 历史

完成一个小功能或修复一个真实 bug。

## 2. 每月必须重写一个旧功能的最小版本

推荐顺序：

1. 闪卡
2. LocalStorage 进度
3. mock API
4. 登录 API
5. SQLite 学习记录
6. 连续打卡
7. 音频录音
8. 声调评分结果展示

## 3. 每次大改动前先问“能不能更小”

检查：

- 是否新增了重复状态？
- 是否把业务逻辑放进了错误的组件？
- 是否为了一个问题新增了依赖？
- 是否改变了无关页面？
- 是否有更小的测试可以证明问题？
- 是否真的需要实时同步，还是一次刷新就够？

## 4. 不要把生产环境当练习场

学习部署时：

1. 先本地运行
2. 再用临时数据库
3. 再用隔离服务器或备份
4. 验证成功后才碰生产
5. 上线前准备回滚
6. 不在生产数据库里随意插入测试数据

## 5. 你的最终身份目标

不要停留在：

```text
“我会让 AI 改页面。”
```

逐步达到：

```text
“我能解释需求。”
“我能设计数据流。”
“我能写最小实现。”
“我能用证据调试。”
“我能判断 AI 的建议是否正确。”
“我能把泰语知识转化成可靠的软件模型。”
“我能独立维护和演进 ThaiAI。”
```

## 最后一句

**每学一个泰语规则，就问它如何成为数据；每学一个计算机概念，就问它如何帮助用户学好泰语。**

这就是你的泰语 × 计算机复合能力路线。