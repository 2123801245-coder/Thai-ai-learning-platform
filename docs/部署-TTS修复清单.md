# 部署清单：TTS 电音修复（commit cdf433e）

> 目的：让线上（阿里云 8.140.225.225）后端不再返回原始 Edge MP3（削波/压缩噪声 = 电音），
> 改为 ffmpeg 转 WAV + 峰值限幅。以下命令在**服务器**上执行。

## 0. 前置确认

```bash
# 确认服务器上项目目录与当前部署状态（路径以实际为准）
cd /opt/thaiai && ls backend/tts.js backend/Dockerfile
```

## 1. 传输两个改动文件

### 方式 A：scp（从你本机项目根目录执行，把文件推上去）

```bash
# 在本机执行，不是在服务器
scp backend/tts.js backend/Dockerfile root@8.140.225.225:/opt/thaiai/backend/
```

### 方式 B：git（若服务器上已 clone 仓库）

```bash
# 在服务器执行
cd /opt/thaiai && git fetch origin && git checkout cdf433e -- backend/tts.js backend/Dockerfile
```

### 方式 C：手动上传
把这两个文件放进服务器 `/opt/thaiai/backend/` 覆盖同名文件即可：

- `backend/tts.js`（新增 ffmpeg 兜底 + 峰值限幅）
- `backend/Dockerfile`（镜像内安装 ffmpeg）

## 2. 重建后端镜像并重启

```bash
cd /opt/thaiai

# 只重建 backend 服务（frontend 无改动，不必重建）
docker compose -f docker-compose.prod.yml up -d --build backend

# 确认容器起来了
docker compose -f docker-compose.prod.yml ps backend
```

> 说明：`up -d --build backend` 只重建 backend 服务，不动 frontend。
> 如需整站重建，去掉末尾的 `backend` 即可。

## 3. 冒烟测试（验证不再有电音）

```bash
# 1) 确认返回的是 WAV 而非 MP3
curl -s -o /tmp/tts.wav -w "HTTP %{http_code} | %{content_type} | %{size_download}B\n" \
  "http://localhost:3001/api/tts?text=%E0%B8%AA%E0%B8%A7%E0%B8%B1%E0%B8%AA%E0%B8%94%E0%B8%B5%E0%B8%84%E0%B8%A3%E0%B8%B1%E0%B8%9A&rate=0.75&pitch=1"

# 期望输出：
#   HTTP 200 | audio/wav | ...B
#   （若显示 audio/mpeg 说明 ffmpeg 兜底未生效，检查第 2 步是否重建成功）

# 2) 检查音频是否削波（峰值 ≤ 0.85、无满刻度样本）
python3 - <<'EOF'
import wave, struct
w = wave.open('/tmp/tts.wav','rb')
n = w.getnframes()
s = struct.unpack('<%dh' % n, w.readframes(n))
peak = max(abs(v) for v in s) / 32768.0
clips = sum(1 for v in s if abs(v) >= 32766)
print(f"peak={peak:.3f} clips={clips}")
assert peak <= 0.85 and clips == 0, "仍存在削波！"
print("OK：无削波，电音修复生效")
EOF

# 3) 网站端验证：任意朗读按钮（词汇/课文/新闻听力）应出声干净、无发燥感
```

## 4. 回滚（如遇问题）

```bash
# 服务器上执行：回退 backend 到上一个镜像
cd /opt/thaiai
docker compose -f docker-compose.prod.yml stop backend
docker compose -f docker-compose.prod.yml rm -f backend
docker compose -f docker-compose.prod.yml up -d --no-build backend
```

> 若服务器之前用 `docker compose up -d --build`（不带 -f 指定文件）启动过，
> 把上面的 `-f docker-compose.prod.yml` 换成 `-f docker-compose.yml` 或去掉，
> 以实际启动命令为准（`docker compose ls` 可查当前使用哪个 compose 文件）。
