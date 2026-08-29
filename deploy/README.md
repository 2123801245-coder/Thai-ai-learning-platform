# ThaiAI 生产部署指南（国内服务器 · HTTPS · 微信/支付宝）

> 目标架构：一台国内云服务器（Ubuntu 22.04+ / Debian 12），
> 域名已备案并解析到服务器 IP。Docker Compose 一键部署。

```
浏览器 ── HTTPS ──> nginx (80/443)
                     ├── 静态前端 dist（SPA 回退 index.html）
                     └── /api /videos /uploads /subtitles ──> backend:3001 (Node)
```

---

## 一、服务器准备

```bash
# 安装 Docker（官方脚本，国内可用镜像源加速）
curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
sudo systemctl enable --now docker

# 安装 docker compose 插件（一般随 Docker 自带，确认一下）
docker compose version
```

域名解析：把 `your-domain.com`（及 `www.`）A 记录指向服务器公网 IP。

防火墙放行：`80`、`443`。

---

## 二、SSL 证书（HTTPS）

**方式 A：certbot 自动签发（推荐）**

```bash
# 先把 80 端口的 nginx 跑起来（或临时用其他服务），再签发：
sudo apt install -y certbot
sudo certbot certonly --standalone -d your-domain.com
# 证书生成在 /etc/letsencrypt/live/your-domain.com/

# 复制到项目 certs 目录（compose 挂载位置）
mkdir -p certs
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem certs/thaiai.crt
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem  certs/thaiai.key
sudo chown -R $USER certs/
```

**方式 B：已有证书** —— 直接放到 `certs/thaiai.crt` 和 `certs/thaiai.key`。

> 自动续期（crontab）：`0 3 * * * certbot renew --quiet --post-hook "cp ... && docker compose -f /path/docker-compose.yml restart frontend"`

---

## 三、配置环境变量

```bash
cp .env.example .env
vim .env
```

必填项：

| 变量 | 说明 |
|---|---|
| `JWT_SECRET` | 登录签名密钥，`openssl rand -hex 32` 生成 |
| `ADMIN_EMAILS` | 管理员邮箱（逗号分隔），注册即管理员 |
| `PAY_WECHAT_MCHID` | 微信支付商户号（小微商户个人可申请） |
| `PAY_WECHAT_APIV3_KEY` | 微信 API v3 密钥（32 位） |
| `PAY_WECHAT_SERIAL_NO` | 商户 API 证书序列号 |
| `PAY_WECHAT_PRIVATE_KEY` | 商户 API 私钥（路径或内联 PEM） |
| `PAY_WECHAT_PLATFORM_CERT` | 微信平台证书 PEM（可选，不填自动下载） |
| `PAY_WECHAT_MOCK` | ⚠️ 仅本地演示用。`=1` 时假装微信已配置并返回演示二维码（不扣款）。**生产必须删除/置空**，否则支付界面可用但永远收不到钱 |
| `PAY_EPAY_MCHID` | 易支付商户号（pid，支付宝补充渠道，可选） |
| `PAY_EPAY_KEY` | 易支付商户密钥 |
| `PAY_EPAY_GATEWAY` | 易支付网关，如 `https://pay.example.com` |
| `PAY_NOTIFY_BASE` | 你的站点域名，如 `https://your-domain.com`（回调地址） |
| `SPEECH_KEY` / `SPEECH_REGION` | Azure 发音评测（如已启用） |
| `CORS_ORIGINS` | `https://your-domain.com` |

> **首选：微信支付官方（小微商户）**——这是最可靠的路径，资金直达银行卡、费率 0.6%。
> 申请步骤：微信支付商户平台（pay.weixin.qq.com）→「小微商户」入驻（凭身份证 + 银行卡，
> 个人即可，约 1~3 个工作日审核）→ 商户后台「API 安全」→ 设置 APIv3 密钥、
> 下载 apiclient_key.pem / apiclient_cert.pem。把商户号 / 密钥 / 证书序列号 / 私钥填入
> 四个 `PAY_WECHAT_*` 变量，回调地址填 `https://your-domain.com/api/payments/wechat-notify`。
>
> **补充：易支付（支付宝渠道）**——个人无支付宝官方 API，如需支付宝收款，
> 可在任意易支付系统注册商户号（彩虹易支付等）获得 pid + 密钥 + 网关，
> 回填地址 `https://your-domain.com/api/payments/notify`。
>
> 若都不接，把 `PAY_*` 留空即可——前端自动隐藏在线支付，保留激活码开通。

---

## 四、一键部署

```bash
docker compose up -d --build
```

验证：

```bash
# 后端健康
curl -s https://your-domain.com/api/payments/status
# → {"enabled":false,"channels":[],"plans":{...}} （未配支付时 enabled:false）

# 前端首页
curl -sI https://your-domain.com | head -1   # → HTTP/1.1 200

# 日志
docker compose logs -f backend
```

---

## 五、支付联调自测（模拟易支付回调）

后端内置了完整的验签 + 幂等逻辑，可用本地 Node 脚本模拟网关回调：

```bash
# 1. 登录拿 token
TOKEN=$(curl -s -X POST https://your-domain.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"xxx"}' | jq -r .token)

# 2. 创建订单
curl -s -X POST https://your-domain.com/api/payments/checkout \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"plan":"m1","channel":"wechat"}'
# → {"url":"https://pay.example.com/submit.php?...","orderNo":"TAI..."}

# 3. 用 orderNo + money 复算 MD5 签名并模拟回调（验签通过即激活 VIP）
```

前端流程：VipPanel「在线支付」页签 → 选套餐/渠道 → 新窗口打开收银台 → 每 3 秒轮询订单 → 支付成功自动解锁 VIP 并刷新状态。

---

## 六、数据与备份

- SQLite 数据库：`./data/users.db`（compose 卷挂载，重启不丢）
- 用户头像：`./data/uploads/`
- 备份：
  ```bash
  # 每天凌晨备份（crontab）
  0 4 * * * docker exec $(docker compose ps -q backend) sqlite3 /data/users.db ".backup '/data/backup-$(date +\%F).db'" && docker cp ... 
  ```

---

## 七、升级发布

```bash
git pull
docker compose up -d --build
```

新代码上线即生效；数据库表结构由后端启动时自动迁移（幂等 ADD COLUMN）。

---

## 常见问题

| 问题 | 处理 |
|---|---|
| 微信支付回调收不到 | ① 确认 `PAY_NOTIFY_BASE` 是公网可访问的 https 域名；② 微信商户平台「API安全 → 支付通知」确认回调地址为 `/api/payments/wechat-notify`；③ 看 `docker compose logs backend` 里有无 `[payments]` 日志 |
| 微信回调报验签失败 | 平台证书过期/未下载。配置 `PAY_WECHAT_PLATFORM_CERT`（商户平台下载最新平台证书 PEM）即可，后端也支持自动下载 |
| 易支付回调收不到 | ① 确认 `PAY_NOTIFY_BASE` 是公网可访问的 https 域名；② 在易支付后台填回调地址 `/api/payments/notify`；③ 看 `docker compose logs backend` 里有无 `[payments]` 日志 |
| 微信/支付宝扫码不开 | 易支付商户需要实名认证 + 开通收款，联系易支付客服 |
| 视频 404 | 确认 `backend/videos/` 目录在镜像里（.dockerignore 未排除） |
| 线上显示微信扫码但收不到钱 | `.env` 里 `PAY_WECHAT_MOCK=1` 没删！生产必须删除该行 |

---

## 八、商业化上线路线图（按推荐顺序）

> ①②③ 是「主体 + 资质」前置，只能由你本人完成；④ 之后系统已可跑通全流程，
> ⑤⑥⑦⑧ 的代码全部就绪，拿到商户号后填入 `.env` 即自动启用。

| 步骤 | 事项 | 谁做 | 说明 |
|---|---|---|---|
| ① | 个体工商户主体 | 你 | 本地市场监管局 / 线上政务平台办理，几天下证；微信支付官方 API 的前提 |
| ② | 正式域名 | 你 | 阿里云/腾讯云注册，建议 `.com/.cn`；备案前可先用 IP 预览 |
| ③ | ICP 备案 | 你 | 云厂商控制台提交，通常 1~3 周；备案完成前 80/443 不能对大陆公网开放 |
| ④ | ThaiAI 正式商业版上线 | 一起 | 按本指南部署（域名→证书→compose up），此时激活码模式已可收款前先跑通 |
| ⑤ | 微信支付商户号 | 你 | 小微商户（身份证+银行卡）或普通商户（需①执照），1~3 个工作日 |
| ⑥ | 微信支付 API 凭证 | 你 | 商户后台 → API安全 → APIv3 密钥 + 证书序列号 + apiclient_key.pem |
| ⑦ | 订单系统 | 已完成 | `payments` 表 + checkout/订单轮询/记录，实测通过 |
| ⑧ | VIP 自动开通 | 已完成 | wechat-notify 验签 → 金额校验 → 幂等激活 VIP，实测通过 |

**第 ④ 步之后、⑤⑥ 之前**：网站照常运营，用「激活码」模式先收第一波用户；
拿到商户号后，填 `PAY_WECHAT_*` + 删 `PAY_WECHAT_MOCK`，重启即切换为真实微信收款，前端零改动。
| TTS 没声音 | 后端 `say` 依赖 macOS 本地语音，**服务器是 Linux 时无 Kanya**——会自动走 Edge 神经语音（需服务器能访问微软服务），或用 Windows/macOS 本机部署 |
