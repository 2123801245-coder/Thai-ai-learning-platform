#!/usr/bin/env python3
# ============================================================
# ThaiAI · 发布结果通知（钉钉 / 企业微信群机器人）
#
#   python3 deploy/notify.py success --commit a55f760 --elapsed 62 --site-code 200
#   python3 deploy/notify.py failure --commit a55f760 --stage "本机验证" --detail "首页非 200"
#
# 由 deploy/build-on-server.sh 在「发布成功」与「验证失败已回滚/意外中断」两处调用，
# 所以 WebHook、轮询、GitHub Actions 三条触发路径都会通知（它们跑的是同一个脚本）。
#
# 配置写在服务器本地 /etc/thaiai-notify.env（权限 600，不进仓库）：
#   DINGTALK_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=xxx
#   DINGTALK_SECRET=SECxxxx        # 可选：钉钉机器人开了「加签」时填
#   WECHAT_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
# 两个都填就两个都发；都没填则静默跳过（视为未启用）。
#
# 退出码：0=已发送或未配置；1=发送失败（调用方一律 `|| true`，绝不打断发布）
# ============================================================

import argparse
import base64
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ENV_FILE = os.environ.get("THAIAI_NOTIFY_ENV", "/etc/thaiai-notify.env")
SITE = "https://thai-ai.online"
TIMEOUT = 10


def load_config():
    """从 env 文件读配置；已存在的同名环境变量优先（方便临时覆盖）。"""
    cfg = {}
    try:
        with open(ENV_FILE, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                cfg[key.strip()] = value.strip().strip('"').strip("'")
    except OSError:
        pass
    for key in ("DINGTALK_WEBHOOK", "DINGTALK_SECRET", "WECHAT_WEBHOOK"):
        if os.environ.get(key):
            cfg[key] = os.environ[key]
    return cfg


def build_content(args):
    when = time.strftime("%Y-%m-%d %H:%M:%S")
    trigger = args.trigger or os.environ.get("THAIAI_TRIGGER") or "未标注"
    commit = args.commit or "未知"
    subject = f"`{commit}` {args.subject}" if args.subject else f"`{commit}`"

    if args.status == "success":
        lines = [
            "### ✅ ThaiAI 发布成功",
            f"> 提交：{subject}",
            f"> 触发：{trigger}",
        ]
        if args.elapsed:
            lines.append(f"> 耗时：{args.elapsed}s")
        if args.site_code:
            lines.append(f"> 站点：{SITE} → {args.site_code}")
        lines.append(f"> 时间：{when}")
        return "ThaiAI 发布成功", "\n".join(lines)

    lines = [
        "### ⚠️ ThaiAI 发布失败（已自动回滚）",
        f"> 提交：{subject}",
        f"> 触发：{trigger}",
    ]
    if args.stage:
        lines.append(f"> 失败环节：{args.stage}")
    if args.detail:
        lines.append(f"> 详情：{args.detail}")
    lines.append("> 已回滚：站点停留在上一版，线上未受影响")
    lines.append("> 日志：服务器 `/var/log/thaiai-deploy.log`、`journalctl -u thaiai-gitee-sync -n 50`")
    lines.append(f"> 时间：{when}")
    return "ThaiAI 发布失败", "\n".join(lines)


def post_json(url, payload):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        body = resp.read().decode("utf-8", "replace")
    try:
        result = json.loads(body)
    except ValueError:
        return False, f"响应非 JSON: {body[:120]}"
    code = result.get("errcode", result.get("code", -1))
    if code == 0:
        return True, "ok"
    return False, f"errcode={code} errmsg={result.get('errmsg', body[:120])}"


def dingtalk_url(webhook, secret):
    if not secret:
        return webhook
    # 钉钉「加签」：sign = urlencode(base64(hmac_sha256(secret, f"{ts}\n{secret}")))
    ts = str(round(time.time() * 1000))
    digest = hmac.new(secret.encode(), f"{ts}\n{secret}".encode(), hashlib.sha256).digest()
    sign = urllib.parse.quote_plus(base64.b64encode(digest).decode())
    joiner = "&" if "?" in webhook else "?"
    return f"{webhook}{joiner}timestamp={ts}&sign={sign}"


def send(cfg, title, content, dry_run=False):
    targets = []
    if cfg.get("DINGTALK_WEBHOOK"):
        targets.append((
            "钉钉",
            dingtalk_url(cfg["DINGTALK_WEBHOOK"], cfg.get("DINGTALK_SECRET")),
            {"msgtype": "markdown", "markdown": {"title": title, "text": content}},
        ))
    if cfg.get("WECHAT_WEBHOOK"):
        targets.append((
            "企业微信",
            cfg["WECHAT_WEBHOOK"],
            {"msgtype": "markdown", "markdown": {"content": content}},
        ))
    if not targets:
        print(f"[notify] 未配置机器人（{ENV_FILE} 为空），跳过通知")
        return 0
    if dry_run:
        for name, url, payload in targets:
            host = urllib.parse.urlparse(url).netloc
            print(f"[notify] dry-run → {name} ({host})")
            print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    failed = 0
    for name, url, payload in targets:
        try:
            ok, message = post_json(url, payload)
        except urllib.error.URLError as exc:
            ok, message = False, str(exc.reason if hasattr(exc, "reason") else exc)
        except OSError as exc:
            ok, message = False, str(exc)
        print(f"[notify] {name}: {'已发送' if ok else '失败 - ' + message}")
        if not ok:
            failed += 1
    return 1 if failed else 0


def main():
    parser = argparse.ArgumentParser(description="ThaiAI 发布通知")
    parser.add_argument("status", choices=["success", "failure"])
    parser.add_argument("--commit", default="")
    parser.add_argument("--subject", default="")
    parser.add_argument("--trigger", default="")
    parser.add_argument("--elapsed", type=int, default=0)
    parser.add_argument("--stage", default="")
    parser.add_argument("--detail", default="")
    parser.add_argument("--site-code", default="")
    parser.add_argument("--dry-run", action="store_true", help="只打印将要发送的内容")
    args = parser.parse_args()

    title, content = build_content(args)
    return send(load_config(), title, content, dry_run=args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
