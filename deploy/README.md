# ThaiAI 部署

## 架构（2026-09-21 起）

```
push main (GitHub)
  └─ Actions: mirror push → Gitee 私有镜像（zhbedwin/thai-ai-learning-platform）
       └─ Actions: SSH(root 密码, secrets.SSH_PASSWORD) → 服务器执行 deploy/build-on-server.sh
            ├─ git fetch + reset（Gitee，国内带宽秒级）
            ├─ node:20-bookworm-slim 容器构建（npmmirror，缓存卷 thaiai-npm-cache）
            ├─ 备份 → rsync 原子替换 /opt/thaiai/dist
            ├─ docker restart thaiai_frontend
            └─ 本机验证（hash / 首页 200 / API 200），失败自动回滚
```

- 正常发布耗时 **2~5 分钟**（不再有跨海 rsync）。
- backend 容器独立运行，本流程不触碰；后端改动需在服务器上另行重建。
- 服务器 Node 构建在一次性容器内完成，宿主机零 Node 依赖。

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
