#!/usr/bin/env python3
# ============================================================
# ThaiAI · Gitee WebHook 接收端
#
#   Gitee push → https://thai-ai.online/hooks/gitee（nginx 反代到本进程）
#              → 校验密钥 → 后台执行 deploy/build-on-server.sh
#
# 这是与 GitHub Actions 并行的**第二条发布通道**：GitHub 不可达时（例如
# 本地网络被墙），直接推 Gitee 也能上线。两条通道的并发由发布脚本自己的
# 文件锁串行化，同一 commit 重复触发会被「已发布」标记跳过，不会重复构建。
#
# 只用标准库（宿主机没有 Node），只监听 127.0.0.1，公网入口由 nginx 提供。
# 密钥走 systemd 的 EnvironmentFile=/etc/thaiai-webhook.env，不写在代码里。
# ============================================================

import hmac
import json
import os
import subprocess
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SECRET = os.environ.get("THAIAI_WEBHOOK_SECRET", "")
DEPLOY = os.environ.get("THAIAI_DEPLOY_SCRIPT", "/opt/thaiai-src/deploy/build-on-server.sh")
LOG = os.environ.get("THAIAI_DEPLOY_LOG", "/var/log/thaiai-deploy.log")
HOST = os.environ.get("THAIAI_WEBHOOK_HOST", "127.0.0.1")
PORT = int(os.environ.get("THAIAI_WEBHOOK_PORT", "9911"))
PATH = "/hooks/gitee"
# 只有主分支的 push 才触发发布
TRIGGER_REF = os.environ.get("THAIAI_TRIGGER_REF", "refs/heads/main")
MAX_BODY = 64 * 1024


def log(line):
    print(f"[webhook] {line}", flush=True)


def trigger(commit):
    """后台启动发布脚本；脚本自带 flock，与 Actions 通道串行。"""
    if not os.path.exists(DEPLOY):
        return False, f"发布脚本不存在: {DEPLOY}"
    stamp = time.strftime("%F %T")
    try:
        with open(LOG, "ab", buffering=0) as out:
            out.write(f"\n=== {stamp} Gitee push 触发发布 commit={commit or '(未知)'} ===\n".encode())
            subprocess.Popen(
                ["/bin/bash", DEPLOY],
                stdin=subprocess.DEVNULL,
                stdout=out,
                stderr=subprocess.STDOUT,
                # 独立会话：父进程（以及 systemd 重启服务）都不会带走它
                start_new_session=True,
            )
    except OSError as exc:
        log(f"启动发布失败: {exc}")
        return False, f"启动失败: {exc}"
    log(f"已启动发布 commit={commit}，日志: {LOG}")
    return True, "started"


class Handler(BaseHTTPRequestHandler):
    server_version = "thaiai-webhook"
    protocol_version = "HTTP/1.1"

    def _reply(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        # 健康检查：不泄露密钥是否配置以外的任何信息
        if self.path.split("?")[0] == PATH:
            self._reply(200, {"ok": True, "secret_configured": bool(SECRET)})
        else:
            self._reply(404, {"ok": False})

    def do_POST(self):
        if self.path.split("?")[0] != PATH:
            self._reply(404, {"ok": False, "error": "not found"})
            return
        if not SECRET:
            log("拒绝：未配置 THAIAI_WEBHOOK_SECRET")
            self._reply(500, {"ok": False, "error": "secret not configured"})
            return
        # Gitee 把「密码」原样放在 X-Gitee-Token 头里（兼容 body.password）
        token = self.headers.get("X-Gitee-Token", "")
        try:
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(min(length, MAX_BODY)) if length > 0 else b""
            data = json.loads(raw.decode("utf-8")) if raw else {}
            if not isinstance(data, dict):
                data = {}
        except (ValueError, TypeError, UnicodeDecodeError):
            self._reply(400, {"ok": False, "error": "bad json"})
            return
        if not hmac.compare_digest(token, SECRET) and not hmac.compare_digest(
            str(data.get("password") or ""), SECRET
        ):
            log(f"拒绝：密钥不匹配（来自 {self.client_address[0]}）")
            self._reply(401, {"ok": False, "error": "bad token"})
            return

        ref = str(data.get("ref") or "")
        if ref != TRIGGER_REF:
            # 例如分支/tag push：收下但不发布
            log(f"忽略：ref={ref or '(缺失)'}")
            self._reply(200, {"ok": True, "skipped": ref or "(missing ref)"})
            return

        commit = str(data.get("after") or "")[:8]
        ok, message = trigger(commit)
        self._reply(200 if ok else 500, {"ok": ok, "deploy": message, "commit": commit})

    def log_message(self, fmt, *args):
        log(f"{self.client_address[0]} {fmt % args}")


def main():
    if not SECRET:
        log("⚠️  THAIAI_WEBHOOK_SECRET 未配置，所有 push 都会被拒绝（只保留健康检查）")
    if not os.path.exists(DEPLOY):
        log(f"⚠️  发布脚本不存在: {DEPLOY}")
    log(f"监听 http://{HOST}:{PORT}{PATH}（触发分支 {TRIGGER_REF}）")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    server.daemon_threads = True
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        sys.exit(0)


if __name__ == "__main__":
    main()
