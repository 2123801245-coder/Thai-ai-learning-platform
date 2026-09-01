# ============================================================
# ThaiAI 后端镜像
#
# 注意：构建上下文必须是【项目根目录】（含 src/data，后端启动时
# 会把前端词库同步进 SQLite），所以请从根目录构建：
#
#   docker build -f backend/Dockerfile -t thaiai-backend .
# ============================================================

FROM node:20-bookworm-slim

WORKDIR /app

# 系统依赖：sqlite3 原生模块编译（如有预编译包则不会触发）
# 国内服务器用阿里云 Debian 镜像，避免 deb.debian.org 拉包超时
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true; \
    apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# 先拷依赖清单，利用 Docker 层缓存
COPY backend/package.json backend/package-lock.json* ./backend/
WORKDIR /app/backend
RUN npm install --omit=dev --build-from-source --registry=https://registry.npmmirror.com

WORKDIR /app

# 后端代码 + 前端数据（词库/对话场景，启动时同步进库）
COPY backend/ ./backend/
COPY src/data/ ./src/data/

# 运行时目录
RUN mkdir -p /app/backend/uploads/avatars /app/backend/videos /app/backend/subtitles

ENV NODE_ENV=production
EXPOSE 3001

WORKDIR /app/backend
CMD ["node", "app.js"]
