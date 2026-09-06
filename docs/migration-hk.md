# 迁移到香港服务器（免备案）操作清单

> 目标：把 ThaiAI 从大陆服务器（8.140.225.225，需备案）迁到香港服务器（免备案），
> 域名 `thai-ai.online` 解析切到新 IP 后用户无感。
>
> 核心思路：**旧服务器全程不停机**，新服务器先完整就绪并自检通过，再切 DNS。
> 出任何问题，把 A 记录切回旧 IP 即回滚。

---

## 一、前置准备（在新服务器开通后做）

1. 购买香港轻量应用服务器（阿里云/腾讯云均可，2核2G 即可，约 ¥25–40/月）
2. 记录新服务器 **公网 IP** 和 **root 密码**
3. 在云控制台 **安全组/防火墙放行 80、443、22** 端口（轻量服务器在"防火墙"页）
4. 新服务器系统建议 Ubuntu 22.04+ / Debian 12
5. 本地确认能 SSH 登录新服务器：`ssh root@<新IP>`

---

## 二、执行迁移脚本

脚本在**新服务器**上运行，自动完成：装 docker + compose v2 → 从旧服务器
rsync `/opt/thaiai` 全部状态 → 重建镜像 → compose up → 本机健康检查。

```bash
# 把脚本传到新服务器（在本地项目目录执行）
scp deploy/migrate-hk.sh root@<新IP>:/root/

# 登录新服务器（方式一：SSH 密钥免密连旧服务器，推荐）
ssh root@<新IP>
export MIGRATE_SSH_KEY=/root/.ssh/old_server_key   # 旧服务器的私钥
bash /root/migrate-hk.sh

# 或方式二：密码连旧服务器
ssh root@<新IP>
export SSHPASS='旧服务器root密码'
bash /root/migrate-hk.sh
```

脚本结束时若显示 `迁移完成`，说明新服务器上：

- ✅ 首页 https 200、`/api/features` 200
- ✅ `/api/plan/overview` 未登录 401（打卡接口受保护）
- ✅ http 80 → 301 跳 https
- ✅ 恰好 2 个容器：`thaiai_backend`（healthy）+ `thaiai_frontend`
- ✅ `data/users.db`（用户数据）、`certs/`（HTTPS 证书）、`dist/`（前端）、
  `backend/`（源码）、`.env`（密钥）已全部同步
- ✅ 前端镜像重建（crossorigin 已剥离，微信浏览器不会白屏）

> 脚本 rsync 清单与实际服务器布局核对过：compose 文件、.env、deploy/nginx.conf、
> dist、data（users.db + uploads）、certs、backend 源码、src/data（词库）全部覆盖；
> 已排除 node_modules、备份目录（dist.bak-*、backend.bak-plan）、日志等垃圾。

---

## 三、DNS 切换前：先验证新服务器（不切 DNS）

在**本地电脑**上用 `--resolve` 直连新服务器验证，不影响线上：

```bash
# 本地 Mac/Linux（无需改 hosts）
curl -sk --resolve thai-ai.online:443:<新IP> https://thai-ai.online/ -o /dev/null -w "首页 %{http_code}\n"
curl -sk --resolve thai-ai.online:443:<新IP> https://thai-ai.online/api/features -o /dev/null -w "API %{http_code}\n"
curl -sk --resolve thai-ai.online:443:<新IP> https://thai-ai.online/api/plan/overview -o /dev/null -w "plan未登录 %{http_code}（期望401）\n"
```

手机上验证（改 hosts 需要越狱/代理，简单做法：先用电脑验证 + 新服务器本机健康检查通过即可）。

**注意**：`certs/thaiai.crt` 是阿里云签发的域名证书，同步到新服务器后
HTTPS 直接可用（域名没变，证书有效）。**不要重新签发**。

---

## 四、DNS 切换（阿里云控制台）

1. 登录阿里云控制台 → **云解析 DNS** → 找到 `thai-ai.online`
2. 建议先改 TTL：解析设置 → TTL 改为 **600 秒**（10 分钟，加快生效/回滚）
3. 修改 `@` 的 **A 记录**：`8.140.225.225` → `<新IP>`
4. 保存。生效时间 ≈ TTL（通常 10–30 分钟内全球生效）

## 五、DNS 切换后：全量验证

```bash
# 1) DNS 已生效？
dig +short thai-ai.online A          # 应返回 <新IP>
nslookup thai-ai.online              # 同样确认

# 2) 浏览器/手机（关 Wi-Fi 用流量）打开 https://thai-ai.online
#    应直接看到首页，无证书警告

# 3) 功能链路（用真实账号或新注册）：
#    - 注册/登录
#    - 首页学习计划卡显示连续打卡徽标（/api/plan/overview 200）
#    - 学习计划页打卡一次（/api/plan/checkin）
#    - 词汇/听力播放、口语练习 TTS
#    - 头像上传（/uploads/）
```

---

## 六、回滚方案（任何问题，10 分钟内回退）

旧服务器**全程未停机**，回滚就是切 DNS：

1. 阿里云控制台 → 云解析 DNS → `thai-ai.online` → A 记录改回 `8.140.225.225`
2. 等 TTL（≤10 分钟）生效，用户自动回到旧服务器，一切如初
3. 排查新服务器问题（`ssh root@<新IP>` → `docker logs thaiai_backend` / `thaiai_frontend`）

> **数据注意**：切换期间用户在新服务器产生的数据（打卡/学习记录）不会自动
> 回流旧服务器。回滚前如担心，可在旧服务器上 `rsync root@<新IP>:/opt/thaiai/data/ /opt/thaiai/data/` 拉回。

---

## 七、迁移收尾（稳定运行 1–3 天后）

1. 确认无误后，旧服务器可保留一周作后备；之后可关机省钱（数据已在 data/ 卷中）
2. 更新本地 `deploy/deploy.env` 的 `DEPLOY_SERVER=<新IP>`，之后
   `bash deploy/deploy.sh` 直接部署到新服务器
3. 如需旧服务器彻底退役，先在新服务器做一次 `data/` 最终同步