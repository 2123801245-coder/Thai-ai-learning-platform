# GitHub Actions 自动部署配置指南（一次性设置）

> 配好后效果：`git push origin main` → GitHub 自动构建 → SSH key 免密部署到阿里云 → 自动验证，失败自动回滚。无需密码、无需本地操作。

---

## 一、生成部署专用 SSH 密钥（本机）

```bash
# 生成专用 key（不设 passphrase，CI 无法交互输入）
ssh-keygen -t ed25519 -f ~/.ssh/thaiai_deploy -C "github-actions-deploy" -N ""
cat ~/.ssh/thaiai_deploy.pub
```

> 建议用**专用 key** 而非复用个人 key：泄露或换锁时可单独从服务器删除吊销，不影响你自己的登录。

## 二、服务器：放行公钥（阿里云 8.140.225.225）

```bash
# 把上一步的公钥内容追加到服务器（会提示输入一次服务器密码，这是最后一次用密码）
ssh-copy-id -i ~/.ssh/thaiai_deploy.pub root@8.140.225.225

# 验证免密登录成功：
ssh -i ~/.ssh/thaiai_deploy root@8.140.225.225 'echo OK'
```

（可选加固，等 CI 跑通一段时间后再做）：在 `/etc/ssh/sshd_config` 设置 `PasswordAuthentication no`，彻底关闭密码登录，只留密钥。

## 三、GitHub 仓库配置 Secrets

仓库页面 → **Settings → Secrets and variables → Actions → New repository secret**，只需添加一个：

| Secret 名 | 值 |
|---|---|
| `SSH_PRIVATE_KEY` | `~/.ssh/thaiai_deploy` **私钥**的完整内容（`cat ~/.ssh/thaiai_deploy` 全文复制，含 `-----BEGIN` 和 `-----END` 行） |

其余（服务器 IP、用户、路径、站点 URL）已硬编码在 workflow 的 `env` 段，改服务器时直接改 `.github/workflows/deploy.yml`。

## 四、触发

- **自动**：向 `main` 推送任何非文档改动 → 立即构建并部署（`**.md`、`docs/**` 改动不触发）
- **手动**：仓库 Actions 页 → "Deploy Frontend" → Run workflow，可勾选「只构建验证，不部署」
- **排队**：多次快速 push 会排队依次部署，不会互相打断（`concurrency` 已配置）

## 五、验证与回滚

- 每次部署自动校验：线上/本地 JS hash 一致、crossorigin=0、首页与 API 均 200
- 任一校验失败 → **自动回滚**到部署前备份（`/opt/thaiai/dist.bak-<时间戳>`），workflow 标红并邮件通知
- 手动回滚：服务器上 `ls -dt /opt/thaiai/dist.bak-* | head -1` 找最近备份，按 `deploy/README.md` 回滚命令执行

## 六、与本地 deploy.sh 的关系

| 场景 | 用哪个 |
|---|---|
| 日常开发，push 即上线 | GitHub Actions（本 workflow） |
| 本地快速迭代验证 / 无网络访问 GitHub 时 | `deploy/deploy.sh`（密码方式） |

两者部署逻辑一致（备份 → rsync → 重启 → 验证 → 回滚），互不影响。
