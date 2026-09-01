# ============================================================
# ThaiAI 前端镜像（多阶段构建）
#   1) node 构建 dist
#   2) nginx 托管静态文件 + 反代后端 API
#
# 构建（根目录执行）：
#   docker build -t thaiai-frontend .
# ============================================================

# ---- 阶段 1：构建 ----
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --registry=https://registry.npmmirror.com

COPY . .
RUN npm run build

# ---- 阶段 2：nginx ----
FROM docker.m.daocloud.io/library/nginx:1.27-alpine

# 站点配置（HTTPS：HTTP→HTTPS 跳转 + 443 SSL + /api 反代，见 deploy/nginx.conf）
# 证书通过 docker-compose 挂载到 /etc/nginx/certs/（thaiai.crt / thaiai.key）
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
