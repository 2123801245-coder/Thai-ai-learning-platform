# ThaiAI 部署

## 架构（2026-09-21 起）

```
push main (GitHub)
  └─ 通道一（主）：Actions mirror push → Gitee 私有镜像（zhbedwin/thai-ai-learning-platform）
       └─ Actions: SSH(root 密码, secrets.SSH_PASSWORD) → 服务器执行 deploy/build-on-server.sh

push main (Gitee)
  └─ 通道二（备）：Gitee WebHook → https://thai-ai.online/hooks/gitee
       └─ 验签（X-Gitee-Token）→ 同一个发布脚本
  └─ 兜底（拉取式）：thaiai-gitee-sync.timer 每 3 分钟检查 Gitee main

            ┌── 两条通道共用 ───────────────────────────┐
            │  1. flock 排它（后到者等锁，双通道不会并发构建）  │
            │  2. git fetch + reset（Gitee，国内带宽秒级）      │
            │  3. 变更判定：前端（非 backend/）与后端各自判断   │
            │     两边都没变 → 直接退出（秒级）                │
            │  4. 后端：backend/ 或 src/data/ 有变 →          │
            │     备份 SQLite → 构建镜像 → compose 重建容器    │
            │     健康断言不过 → 回滚镜像 + 数据库              │
            │  5. 前端：node:20 容器构建（npmmirror，缓存卷）   │
            │  6. 备份 → rsync 原子替换 /opt/thaiai/dist      │
            │  7. 同步 nginx.conf（按实际网关重写 WebHook 地址）│
            │  8. 同步并重启 thaiai-webhook 服务              │
            │  9. docker restart thaiai_frontend            │
            │ 10. 验证（hash / 首页 / API / 音频 MIME / 接收端）│
            │     任一失败 → 自动回滚到上一版                    │
            └────────────────────────────────────────┘
```

- 正常发布耗时 **2~5 分钟**（不再有跨海 rsync）；只改后端、不改前端时约 **1~2 分钟**。
- 后端容器已纳入本流程（见下节）；只改前端的发布会跳过后端，反过来也一样。
- 服务器 Node 构建在一次性容器内完成，宿主机零 Node 依赖。
- `FORCE=1 bash build-on-server.sh` 强制重建前端；`BACKEND_FORCE=1` 强制重建后端。

## 后端容器重建（2026-09-22 起）

`backend/` 或 `src/data/` 有变化时，发布流程会自动重建 backend 容器并跑健康断言。
由 `deploy/deploy-backend.sh` 实现，`build-on-server.sh` **先做后端再做前端**
（前端自检要查 `/api/features`，后端先起来才不会误判）。

```
变更检测（backend/ + src/data/，基线 /opt/thaiai/.deployed-backend-commit）
  └─ 无变化 → BACKEND_SKIP（0.01s）
  └─ 有变化 ↓
       1. 一致性备份 SQLite（python3 sqlite3 backup API，WAL 下也安全）
       2. 旧镜像留档 thaiai-backend:rollback
       3. docker build -f $SRC/backend/Dockerfile -t <运行中镜像名> $SRC
       4. docker compose up -d --no-build --no-deps --force-recreate backend
       5. 断言：容器 healthy + 跑的是刚构建的镜像 + 网络未漂移 + /api/features 200
          + 新路由 /api/thai/segment 非 404（证明不是旧代码）
       6. 失败 → 镜像指回 rollback、数据库还原快照、容器重建、等健康，然后退出 1
```

**为什么必须用 git 源码目录当构建上下文**：compose 里 backend 的 `build.context` 是
`.`（即 `/opt/thaiai` 运行目录），而那份 `backend/` 是旧快照——直接 `docker compose build`
会打出旧代码。脚本一律从 `/opt/thaiai-src` 构建，再把镜像 tag 成运行中容器实际使用的名字
（从 `docker inspect` 反查，不硬编码）。

这不是「等价替代」：实测该目录与仓库相差 **10 个缺失文件 + 6 个内容不同**（缺 `aiProvider.js`、
`aiMemory.js`、`env.js`、`routes/thai.js` 等），而运行中的镜像内容与仓库一致——从 compose
上下文构建会把后端退回旧版本。

**安全网**：

- 数据库快照放在 `/opt/thaiai/backups/users.db.<时间戳>.bak`，保留最近 5 份；
  回滚时会先停容器再覆盖数据文件（SQLite 带 WAL，在线覆盖不安全）。
- 旧镜像留档为 `thaiai-backend:rollback`；构建失败时容器未被触碰，线上原样运行。
- 断言里的「跑的是新镜像」是关键一项：它挡住「compose 用旧上下文自行重建」这种静默退化。

**首次纳入时的验证记录（2026-09-22）**：重建前镜像（`thaiai-backend:rollback`）与重建后镜像的
backend 源码树与 `src/data` 树哈希**完全一致**（162 个文件）——说明当时线上后端内容本就等于 HEAD，
首次重建属于纯机制验证，没有引入行为变更；发布完数据库 30 个用户、`pragma integrity_check` = ok。

手动重建（排查用）：

```bash
BACKEND_FORCE=1 bash /opt/thaiai-src/deploy/deploy-backend.sh
```

## 第二条发布通道：Gitee WebHook

用途：**GitHub 不可达时（例如本地网络被墙）也能从 Gitee 直接发布**。与 Actions 通道并行，互不依赖。

```
Gitee push main → nginx(容器) /hooks/gitee → 宿主 172.18.0.1:9911
                → deploy/gitee-webhook.py 验签 → 后台跑发布脚本
```

### 安全边界

| 层 | 措施 |
| --- | --- |
| nginx | `location = /hooks/gitee` 只收 POST，是唯一公网入口 |
| 接收端 | 只放行回环/私有网段来源，公网来源一律 403（实测 8.140.225.225 → 拒绝） |
| 验签 | `X-Gitee-Token` 与 `/etc/thaiai-webhook.env` 的密钥比对（`hmac.compare_digest`） |
| 范围 | 只有 `refs/heads/main` 的 push 触发；其他分支/tag 收下但忽略 |
| 发布 | 发布脚本本身的锁 + 已发布标记，重复触发不会重复构建 |

> ⚠️ nginx 在容器里，`127.0.0.1` 是**容器自己**，所以代理目标必须是宿主机在 docker 网桥上的网关地址
> （当前 `172.18.0.1`）。该地址会随网络重建变化，因此**发布脚本每次都会按容器实际网关重写这一行**，
> 并在发布自检里用错误密钥探一次公网链路（401=通、502=没打到接收端）。

### 一次性安装（服务器上）

```bash
# 1) 密钥（Gitee WebHook 的「密码」，与接收端共用）
printf 'THAIAI_WEBHOOK_SECRET=%s\n' "$(openssl rand -hex 32)" > /etc/thaiai-webhook.env
chmod 600 /etc/thaiai-webhook.env

# 2) systemd 服务（unit 随发布同步，首次需手动装一次）
install -m 644 /opt/thaiai-src/deploy/thaiai-webhook.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now thaiai-webhook

# 3) 在 Gitee 仓库创建 WebHook（或网页端：管理 → WebHooks）
#    URL: https://thai-ai.online/hooks/gitee    密码: 上面那个密钥    勾选 Push
```

### 排查

```bash
systemctl status thaiai-webhook
journalctl -u thaiai-webhook -n 50          # 验签失败/忽略的分支都会记在这里
tail -f /var/log/thaiai-deploy.log          # WebHook 触发的发布输出
curl -s http://127.0.0.1:9911/hooks/gitee   # 接收端自检
```

### ⚠️ 已知问题：Gitee 侧投递报 Connection reset（已用轮询兜底）

本环境实测：**Gitee 会尝试投递**（hook 详情里的 `result` 会随 push 变成
`SocketException: Connection reset`，`result_code=-2`），但请求**到不了 nginx**
（nginx 日志里没有任何来自 Gitee 的连接）。同时已逐项排除服务端原因：

- 端点对外可达（外部通道 GET → 403；走公网 IP 回环 POST → 401）
- 证书为 Let's Encrypt 有效证书；TLS 1.2 / 1.3、无 SNI、CBC 与 GCM 套件均握手成功
- DNS 单条 A 记录、主机 iptables 无拦截

重置发生在 TCP/TLS 层，服务端无可修之处。因此新增**拉取式兜底**：

```bash
systemctl list-timers thaiai-gitee-sync.timer     # 下一次轮询时间
journalctl -u thaiai-gitee-sync -n 30             # 轮询触发的发布输出
systemctl start thaiai-gitee-sync.service         # 立即同步一次
```

- 每 3 分钟 `git fetch` 一次 Gitee main；无变化时几秒内退出（不构建）
- 与 WebHook / Actions 共用同一个发布脚本，锁 + 「已发布 commit」保证只有一个真构建
- 代价：Gitee-only 改动最多晚 3 分钟上线（Actions 主通道仍是即时）

若后续 Gitee 侧投递恢复（或改用网页端重建 hook），WebHook 会立即生效，与轮询共存不冲突。

## 分支保护（Gitee `main`）

- 仅仓库管理员可推送、不可删除。镜像推送以管理员身份进行，因此正常发布不受影响。
- ⚠️ 若 GitHub 侧发生**历史重写**（force push / rebase 已发布提交），镜像的强制推送会被保护规则拦下，
  需临时调整保护设置，或改用非强制推送。

## 发布通知（推送到手机）

发布**成功**或**失败回滚**都会推消息到手机。三条触发路径（Actions / WebHook / 轮询）
共用同一个发布脚本，因此都会通知，消息里带触发来源。

支持 5 个通道，**配哪个发哪个**（可多选，都不配则静默跳过）：

| 类型 | 通道 | 要不要建群 | 怎么拿 key |
| --- | --- | --- | --- |
| 个人 | **Bark**（iOS） | 不用 | 装 Bark App，打开即得 key |
| 个人 | **Server酱**（微信） | 不用 | sct.ftqq.com 扫码登录拿 SendKey |
| 个人 | **PushPlus**（微信/邮件） | 不用 | pushplus.plus 扫码登录拿 token |
| 群 | **钉钉**自定义机器人 | **需要群** | 群设置 → 智能群助手 → 自定义机器人（开「加签」最安全） |
| 群 | **企业微信**群机器人 | **需要群** | 群设置 → 群机器人 → 添加机器人 |

> 钉钉/企微的「自定义机器人」必须挂在一个群里（个人无法直接建机器人）；
> 若不想建群，选 Bark / Server酱 / PushPlus，三者都只需一个 key。

### 安装（服务器上，一次；按需保留要用的行）

```bash
cat > /etc/thaiai-notify.env <<'EOF'
# 个人推送（三选一即可）
BARK_KEY=你的BarkKey
SERVERCHAN_KEY=SCT你的SendKey
PUSHPLUS_TOKEN=你的token
# 群机器人（可选，需先有群）
DINGTALK_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=xxx
DINGTALK_SECRET=SECxxx
WECHAT_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
EOF
chmod 600 /etc/thaiai-notify.env
```

- `DINGTALK_SECRET` 仅在钉钉机器人开了「加签」时需要；若用「自定义关键词」模式，
  关键词需出现在消息里（默认消息含 `ThaiAI`）
- 自建 Bark 服务端可另配 `BARK_URL=https://你的域名`

### 发布事实（唯一数据源）

「这次发布发生了什么」只写进一份结构化事实：`/opt/thaiai/.deploy-status`（每行 `key=value`，
同名键取最后一次）。执行侧只写事实，`deploy/notify.py` 只做「事实 → 人话」的映射与渲染，
标题与详情都不各自预设结论。前端与后端结局在同一份契约里。

| 键 | 取值 | 谁写 |
| --- | --- | --- |
| `commit` / `subject` / `trigger` | 短 sha / 提交标题 / 触发来源 | `build-on-server.sh`（开跑时） |
| `backend` | `rebuilt` `skipped` `untouched` `rolled_back` `recreated` | `deploy-backend.sh` |
| `status` / `frontend` / `failure` / `elapsed` / `site_code` / `test` | 见下 | `build-on-server.sh`（收尾） |
| `frontend` | `deployed` `skipped` `rolled_back` `not_run` | 同上 |
| `failure` | `backend` `verify` `nginx_config` `abort` | 同上 |

缺哪个键就不渲染哪一行：例如未预期中断时前端状态未知，就既不写也不显示，
所以文案里不会出现「不知道却说已回滚」这类结论。后端的五个结局含义：

| `backend` | 含义 |
| --- | --- |
| `rebuilt` | 已重建并上线 |
| `skipped` | 未涉及（无变化） |
| `untouched` | 镜像未构建成功，线上容器未被改动 |
| `rolled_back` | 镜像与数据库已回滚到重建前状态 |
| `recreated` | 已用新镜像重建，但流程异常中断 |

### 测试与排查

```bash
python3 /opt/thaiai-src/deploy/notify.py --status /opt/thaiai/.deploy-status --dry-run  # 只看内容
THAIAI_NOTIFY_TEST=1 FORCE=1 bash /opt/thaiai-src/deploy/build-on-server.sh   # 真跑一次，标题带「测试样例」
```

手动发送：先写一份事实文件（内容即上表的键值对），再 `notify.py --status <文件>`。

### 设计约定

**通知永远不影响发布**：`notify.py` 缺失、事实文件为空、配置为空、网络不通都只打印一行日志，
发布流程照常继续（`notify()` 内部 `|| true`，且失败路径不会递归触发 ERR 陷阱）。

消息内容（`后端` / `前端` 两行按事实出现，缺则整行不显示）：

| 状态 | 内容 |
| --- | --- |
| ✅ 成功 | 提交（含标题）、触发来源、后端、前端、耗时、站点状态码 |
| ⚠️ 失败 | 提交、触发来源、后端、前端、失败环节（后端重建 / nginx 语法 / 本机验证 / 未预期中断）、详情与影响、日志位置 |

## 一次性初始化（已完成，留档）

1. Gitee 建私有仓库 `thai-ai-learning-platform`（token 经 API 创建）。
2. 本地首次全量推送：`git push https://<user>:<token>@gitee.com/zhbedwin/thai-ai-learning-platform.git main:main`
3. 服务器 `/opt/thaiai-src`：`git init` + `git remote add origin https://<user>:<token>@gitee.com/...`（凭据内嵌 .git/config，权限 600）。
4. GitHub Secrets：`GITEE_USERNAME`、`GITEE_TOKEN`、`SSH_PASSWORD`（root 密码）。

## GitHub Secrets 清单

| Secret | 用途 |
| --- | --- |
| `SSH_PRIVATE_KEY` | （旧）保留无害，新流程未使用 |
| `SSH_PASSWORD` | 服务器 root 密码，Actions SSH 用 |
| `GITEE_USERNAME` | Gitee 用户名（镜像推送） |
| `GITEE_TOKEN` | Gitee 私人令牌（需 projects 权限） |

## 手动操作

```bash
# 手动触发一次完整发布（Actions 页面 Run workflow，skip_deploy=false）

# 只同步 Gitee 镜像不部署（skip_deploy=true）

# 服务器上手动发布（SSH 后）：
bash /opt/thaiai-src/deploy/build-on-server.sh

# 服务器上手动回滚（最近一份备份）：
BAK=$(ls -dt /opt/thaiai/dist.bak-* | head -1)
rm -rf /opt/thaiai/dist && cp -a "$BAK" /opt/thaiai/dist
docker restart thaiai_frontend
```

## 旧方案（已废弃，仅留档）

GitHub Actions 构建 → rsync 158MB 产物跨海（实测 <30KB/s）→ 重启容器。
首次全量部署耗时数小时、依赖多轮 --partial 续传。`deploy/deploy.sh`（本地构建 + sshpass rsync）仍可用作手动应急通道。
