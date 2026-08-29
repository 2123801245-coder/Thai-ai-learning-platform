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
RUN npm install

COPY . .
RUN npm run build

# ---- 阶段 2：nginx ----
FROM nginx:1.27-alpine

# 站点配置（含 HTTPS 与 /api 反代，见 deploy/nginx.conf）
COPY deploy/nginx-http.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
