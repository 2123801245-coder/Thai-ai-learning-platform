# ThaiAI 部署

## 架构（2026-09-21 起）

```
push main (GitHub)
  └─ 通道一（主）：Actions mirror push → Gitee 私有镜像（zhbedwin/thai-ai-learning-platform）
       └─ Actions: SSH(root 密码, secrets.SSH_PASSWORD) → 服务器执行 deploy/build-on-server.sh

push main (Gitee)
  └─ 通道二（备）：Gitee WebHook → https://thai-ai.online/hooks/gitee
       └─ 验签（X-Gitee-Token）→ 同一个发布脚本

            ┌── 两条通道共用 ───────────────────────────┐
            │  1. flock 排它（后到者等锁，双通道不会并发构建）  │
            │  2. git fetch + reset（Gitee，国内带宽秒级）      │
            │  3. 已发布 commit 标记 → 命中则短路退出         │
            │  4. node:20 容器构建（npmmirror，缓存卷）        │
            │  5. 备份 → rsync 原子替换 /opt/thaiai/dist      │
            │  6. 同步 nginx.conf（按实际网关重写 WebHook 地址）│
            │  7. 同步并重启 thaiai-webhook 服务              │
            │  8. docker restart thaiai_frontend            │
            │  9. 验证（hash / 首页 / API / 音频 MIME / 接收端）│
            │     任一失败 → 自动回滚到上一版                    │
            └────────────────────────────────────────┘
```

- 正常发布耗时 **2~5 分钟**（不再有跨海 rsync）。
- backend 容器独立运行，本流程不触碰；后端改动需在服务器上另行重建。
- 服务器 Node 构建在一次性容器内完成，宿主机零 Node 依赖。
- `FORCE=1 bash build-on-server.sh` 可强制重建（忽略「已发布」标记）。

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

## 分支保护（Gitee `main`）

- 仅仓库管理员可推送、不可删除。镜像推送以管理员身份进行，因此正常发布不受影响。
- ⚠️ 若 GitHub 侧发生**历史重写**（force push / rebase 已发布提交），镜像的强制推送会被保护规则拦下，
  需临时调整保护设置，或改用非强制推送。

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
