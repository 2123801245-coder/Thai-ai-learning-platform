#!/usr/bin/env python3
# ============================================================
# ThaiAI · 发布结果通知
#
#   python3 deploy/notify.py success --commit a55f760 --elapsed 62 --site-code 200
#   python3 deploy/notify.py failure --commit a55f760 --stage "本机验证" --detail "首页非 200"
#   python3 deploy/notify.py success --commit x --dry-run      # 只看会发什么
#
# 由 deploy/build-on-server.sh 在「发布成功」与「失败已回滚 / 未预期中断」两处调用，
# 所以 GitHub Actions、Gitee WebHook、轮询兜底三条触发路径都会通知。
#
# ------------------------------------------------------------
# 支持的通道（配哪个发哪个，可多选；都不配则静默跳过）
#
#   【个人推送，不需要建群】
#   BARK_KEY=xxx              iOS：装 Bark App，打开即得 key（默认 https://api.day.app）
#   BARK_URL=https://api.day.app   # 可选：自建 Bark 服务端
#   SERVERCHAN_KEY=SCTxxx     微信：sct.ftqq.com 扫码登录拿 SendKey
#   PUSHPLUS_TOKEN=xxx        微信/邮件/短信：pushplus.plus 扫码登录拿 token
#
#   【群机器人，需要先有一个群】
#   DINGTALK_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=xxx
#   DINGTALK_SECRET=SECxxx    # 可选：机器人开了「加签」时填
#   WECHAT_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
#
# 配置写在服务器本地 /etc/thaiai-notify.env（权限 600，不进仓库）。
# ------------------------------------------------------------
#
# 退出码：0=已发送或未配置；1=至少一个通道发送失败
# （调用方一律 `|| true`，通知失败绝不影响发布）
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
CONFIG_KEYS = (
    "DINGTALK_WEBHOOK", "DINGTALK_SECRET", "WECHAT_WEBHOOK",
    "BARK_KEY", "BARK_URL", "SERVERCHAN_KEY", "PUSHPLUS_TOKEN",
)


def load_config():
    """从 env 文件读配置；已存在的同名环境变量优先（便于临时覆盖/自检）。"""
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
    for key in CONFIG_KEYS:
        if os.environ.get(key):
            cfg[key] = os.environ[key]
    return cfg


def build_messages(args):
    """返回 (title, markdown, plain) —— 各通道渲染能力不同，分别给。"""
    when = time.strftime("%Y-%m-%d %H:%M:%S")
    trigger = args.trigger or os.environ.get("THAIAI_TRIGGER") or "未标注"
    commit = args.commit or "未知"
    subject = f"{commit} {args.subject}".strip()

    if args.status == "success":
        title = "✅ ThaiAI 发布成功"
        rows = [("提交", subject), ("触发", trigger)]
        if args.elapsed:
            rows.append(("耗时", f"{args.elapsed}s"))
        if args.site_code:
            rows.append(("站点", f"{SITE} → {args.site_code}"))
        rows.append(("时间", when))
    else:
        title = "⚠️ ThaiAI 发布失败（已自动回滚）"
        rows = [("提交", subject), ("触发", trigger)]
        if args.stage:
            rows.append(("失败环节", args.stage))
        if args.detail:
            rows.append(("详情", args.detail))
        rows.append(("影响", "站点停留在上一版，线上未受影响"))
        rows.append(("日志", "/var/log/thaiai-deploy.log"))
        rows.append(("时间", when))

    markdown = "\n".join([f"### {title}"] + [f"> {k}：{v}" for k, v in rows])
    plain = "\n".join([title] + [f"{k}：{v}" for k, v in rows])
    return title, markdown, plain


def build_targets(cfg, title, markdown, plain):
    """每个通道：名称 / URL / body / 编码方式 / 成功判定字段与取值。"""
    targets = []
    if cfg.get("DINGTALK_WEBHOOK"):
        targets.append((
            "钉钉", dingtalk_url(cfg["DINGTALK_WEBHOOK"], cfg.get("DINGTALK_SECRET")),
            {"msgtype": "markdown", "markdown": {"title": title, "text": markdown}},
            "json", "errcode", 0,
        ))
    if cfg.get("WECHAT_WEBHOOK"):
        targets.append((
            "企业微信", cfg["WECHAT_WEBHOOK"],
            {"msgtype": "markdown", "markdown": {"content": markdown}},
            "json", "errcode", 0,
        ))
    if cfg.get("BARK_KEY"):
        base = (cfg.get("BARK_URL") or "https://api.day.app").rstrip("/")
        key = cfg["BARK_KEY"].strip("/")
        targets.append((
            "Bark(iOS)", f"{base}/{key}",
            {"title": title, "body": plain, "group": "ThaiAI", "level": "timeSensitive"},
            "json", "code", 200,
        ))
    if cfg.get("SERVERCHAN_KEY"):
        targets.append((
            "Server酱(微信)", f"https://sctapi.ftqq.com/{cfg['SERVERCHAN_KEY']}.send",
            {"title": title, "desp": markdown},
            "form", "code", 0,
        ))
    if cfg.get("PUSHPLUS_TOKEN"):
        targets.append((
            "PushPlus(微信)", "https://www.pushplus.plus/send",
            {"token": cfg["PUSHPLUS_TOKEN"], "title": title,
             "content": markdown, "template": "markdown"},
            "json", "code", 200,
        ))
    return targets


def dingtalk_url(webhook, secret):
    if not secret:
        return webhook
    # 钉钉「加签」：sign = urlencode(base64(hmac_sha256(secret, f"{ts}\n{secret}")))
    ts = str(round(time.time() * 1000))
    digest = hmac.new(secret.encode(), f"{ts}\n{secret}".encode(), hashlib.sha256).digest()
    sign = urllib.parse.quote_plus(base64.b64encode(digest).decode())
    joiner = "&" if "?" in webhook else "?"
    return f"{webhook}{joiner}timestamp={ts}&sign={sign}"


def post(url, payload, encoding):
    if encoding == "form":
        data = urllib.parse.urlencode(payload).encode()
        content_type = "application/x-www-form-urlencoded"
    else:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        content_type = "application/json; charset=utf-8"
    req = urllib.request.Request(url, data=data, headers={"Content-Type": content_type}, method="POST")
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return resp.read().decode("utf-8", "replace")


def deliver(target, dry_run=False):
    name, url, payload, encoding, ok_field, ok_value = target
    host = urllib.parse.urlparse(url).netloc
    if dry_run:
        print(f"[notify] dry-run → {name} ({host})")
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return True, "dry-run"
    try:
        body = post(url, payload, encoding)
    except urllib.error.URLError as exc:
        return False, str(getattr(exc, "reason", exc))
    except OSError as exc:
        return False, str(exc)
    try:
        result = json.loads(body)
    except ValueError:
        return False, f"响应非 JSON: {body[:120]}"
    if result.get(ok_field) == ok_value:
        return True, "ok"
    return False, f"{ok_field}={result.get(ok_field)} {result.get('errmsg') or result.get('message') or body[:100]}"


def send(cfg, title, markdown, plain, dry_run=False):
    targets = build_targets(cfg, title, markdown, plain)
    if not targets:
        print(f"[notify] 未配置任何通道（{ENV_FILE} 为空），跳过通知")
        return 0
    failed = 0
    for target in targets:
        ok, message = deliver(target, dry_run=dry_run)
        print(f"[notify] {target[0]}: {'已发送' if ok else '失败 - ' + message}")
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

    title, markdown, plain = build_messages(args)
    return send(load_config(), title, markdown, plain, dry_run=args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
