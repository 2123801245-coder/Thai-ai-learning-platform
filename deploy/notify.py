#!/usr/bin/env python3
# ============================================================
# ThaiAI · 发布结果通知（渲染端）
#
#   python3 deploy/notify.py --status /opt/thaiai/.deploy-status
#   python3 deploy/notify.py --status /tmp/facts --dry-run      # 只看会发什么
#
# 「这次发布发生了什么」只有一份数据源：事实文件（每行 key=value，同名键取最后一次）。
# 执行侧只写事实（deploy/build-on-server.sh 写身份与结局、deploy/deploy-backend.sh 写
# 后端结局），本模块只做「事实 → 人话」的映射与渲染：标题不预设结论，详情由事实决定。
#
# 事实键（缺哪个就不渲染哪一行，不猜）：
#   status   success | failure
#   failure  backend | verify | nginx_config | abort     （仅失败时）
#   backend  rebuilt | skipped | untouched | rolled_back | recreated
#   frontend deployed | skipped | rolled_back
#   commit / subject / trigger / elapsed / site_code / test
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
STATUS_FILE = os.environ.get("THAIAI_STATUS", "/opt/thaiai/.deploy-status")
SITE = "https://thai-ai.online"
TIMEOUT = 10
CONFIG_KEYS = (
    "DINGTALK_WEBHOOK", "DINGTALK_SECRET", "WECHAT_WEBHOOK",
    "BARK_KEY", "BARK_URL", "SERVERCHAN_KEY", "PUSHPLUS_TOKEN",
)

# 事实 → 人话。同一份事实在成功与失败通知里含义一致，所以只有这一处映射。
BACKEND_TEXT = {
    "rebuilt": "已重建并上线",
    "skipped": "未涉及（无变化）",
    "untouched": "镜像未构建成功，线上容器未被改动（仍运行原镜像）",
    "rolled_back": "镜像与数据库已回滚到重建前状态",
    "recreated": "已用新镜像重建，但流程异常中断",
}
FRONTEND_TEXT = {
    "deployed": "已发布",
    "skipped": "未涉及（无变化）",
    "rolled_back": "已回滚到上一版",
    "not_run": "本次未发布（流程未走到）",
}
# 失败环节 → 环节名；环节 → (详情, 影响)。failure=backend 时后两者取后端结局的人话。
FAILURE_TEXT = {
    "backend": "后端容器重建",
    "verify": "本机验证未通过",
    "nginx_config": "nginx 配置语法检查",
    "abort": "未预期中断",
}
FAILURE_DETAIL = {
    "verify": ("已回滚到上一版（hash / 首页 / API / 音频 / 接收端 之一未通过）",
               "站点已恢复，线上未受影响"),
    "nginx_config": ("配置已还原，容器未重启", "站点不受影响"),
    "abort": ("脚本以非预期错误中止", "请查看日志确认线上状态"),
}
BACKEND_IMPACT = {
    "untouched": "站点停留在上一版，线上未受影响",
    "rolled_back": "站点已恢复，线上未受影响",
    "recreated": "线上已换成新镜像，请查看日志确认状态",
}


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


def read_facts(path):
    """读事实文件；同名键取最后一次（同一运行里后端与前端各自追加）。"""
    facts = {}
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            for line in fh:
                key, sep, value = line.rstrip("\n").partition("=")
                if sep:
                    facts[key.strip()] = value
    except OSError:
        pass
    return facts


def build_messages(facts):
    """事实 → (title, markdown, plain)。各通道渲染能力不同，分别给。"""
    when = time.strftime("%Y-%m-%d %H:%M:%S")
    commit = facts.get("commit") or "未知"
    # 按字符截断：`cut -c` 在 C locale 下会切断多字节字符，产生孤立代理项
    subject = f"{commit} {facts.get('subject', '')}".strip()[:80]
    rows = [("提交", subject), ("触发", facts.get("trigger") or "未标注")]
    # 后端结局在后端环节失败时由「详情」行承担，不再重复一次
    if facts.get("backend") and facts.get("failure") != "backend":
        rows.append(("后端", BACKEND_TEXT.get(facts["backend"], facts["backend"])))
    if facts.get("frontend"):
        rows.append(("前端", FRONTEND_TEXT.get(facts["frontend"], facts["frontend"])))

    if facts.get("status") == "failure":
        # 标题不写「已自动回滚」：镜像构建就失败时线上根本没被动过，
        # 到底回滚没回滚由「详情」与「影响」行如实说明。
        title = "⚠️ ThaiAI 发布失败"
        key = facts.get("failure", "")
        if key == "backend":
            # 详情与影响就是后端结局的人话，与成功通知里的「后端」行同一份映射
            end = facts.get("backend", "")
            detail = BACKEND_TEXT.get(end, "请查看日志确认状态")
            impact = BACKEND_IMPACT.get(end, "请查看日志确认状态")
        else:
            detail, impact = FAILURE_DETAIL.get(
                key, ("请查看日志确认状态", "请查看日志确认线上状态"))
        rows += [("失败环节", FAILURE_TEXT.get(key, "未标注")),
                 ("详情", detail), ("影响", impact),
                 ("日志", "/var/log/thaiai-deploy.log")]
    else:
        title = "✅ ThaiAI 发布成功"
        if facts.get("elapsed"):
            rows.append(("耗时", f"{facts['elapsed']}s"))
        if facts.get("site_code"):
            rows.append(("站点", f"{SITE} → {facts['site_code']}"))

    if facts.get("test") == "1":
        title = f"{title}·测试样例"
        rows.append(("说明", "测试样例，非真实故障（验证通知链路用）"))
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
        # errors="replace"：万一传来非法字节（孤立代理项），也只坏一个字符，不让整条通知抛异常
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8", "replace")
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
    parser = argparse.ArgumentParser(description="ThaiAI 发布通知（读事实文件渲染）")
    parser.add_argument("--status", default=STATUS_FILE, help="发布事实文件（key=value）")
    parser.add_argument("--dry-run", action="store_true", help="只打印将要发送的内容")
    args = parser.parse_args()

    facts = read_facts(args.status)
    if not facts:
        print(f"[notify] 事实文件为空或不存在（{args.status}），跳过通知")
        return 0
    title, markdown, plain = build_messages(facts)
    return send(load_config(), title, markdown, plain, dry_run=args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
