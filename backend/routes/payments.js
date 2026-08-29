import express from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import Stripe from "stripe";
import db from "../database.js";
import { extendVipDays } from "../vipService.js";
import {
  wechatConfigured,
  createNativeOrder,
  verifyWechatNotify,
  decryptResource,
} from "../wechatPay.js";

const router = express.Router();

// ============================================================
// 支付提供商抽象
//
//  1) 微信支付官方 Native（首选，推荐「小微商户」个人可申请）
//     需要环境变量：
//       PAY_WECHAT_MCHID / PAY_WECHAT_APIV3_KEY /
//       PAY_WECHAT_SERIAL_NO / PAY_WECHAT_PRIVATE_KEY
//     （详见 backend/wechatPay.js 头部注释）
//
//  2) 易支付聚合（补充：支付宝渠道；个人开发者标准方案）
//     需要环境变量：
//       PAY_EPAY_MCHID    商户号（pid）
//       PAY_EPAY_KEY      商户密钥（md5 签名用）
//       PAY_EPAY_GATEWAY  网关地址，如 https://pay.example.com
//
//  3) Stripe（国际卡兜底，可选）
//     需要环境变量：STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET
//
//  4) 都不配 → 支付关闭，前端降级为「激活码」开通
//
// 易支付回调协议（彩虹易支付标准）：
//   notify_url 收到 POST/GET：pid, trade_no, out_trade_no, type,
//   name, money, trade_status, sign
//   sign = md5(按 key 升序的 k=v&k=v 串 + 商户密钥)，排除 sign/sign_type
//   校验通过 → 更新订单 + 激活 VIP，响应纯文本 "success"
// ============================================================

// 注意：ES Module 导入先于 dotenv.config() 执行，
// 因此所有环境变量必须在【函数内】惰性读取，不能放到模块顶层。

function getEpayConfig() {
  return {
    mchid: process.env.PAY_EPAY_MCHID || "",
    key: process.env.PAY_EPAY_KEY || "",
    gateway: (process.env.PAY_EPAY_GATEWAY || "").replace(/\/+$/, ""),
  };
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY || "";
  return key ? new Stripe(key) : null;
}

function getProvider() {
  // 演示模式：PAY_WECHAT_MOCK=1 时假装微信已配置（本地看 UI 用，不调真实 API）
  if (process.env.PAY_WECHAT_MOCK === "1") return "wechat";

  // 微信官方优先（最可靠）；易支付补充（支付宝）；Stripe 兜底
  if (wechatConfigured()) return "wechat";
  const { mchid, key, gateway } = getEpayConfig();
  if (mchid && key && gateway) return "epay";
  if (getStripe()) return "stripe";
  return null;
}

/* 是否处于微信支付演示模式（本地展示二维码 UI，不真正下单） */
function isWechatMock() {
  return process.env.PAY_WECHAT_MOCK === "1";
}

// ============================================================
// 套餐定义（金额单位：分 / CNY）
// 可用环境变量覆盖价格：VIP_PLAN_30_CNY / VIP_PLAN_90_CNY / VIP_PLAN_365_CNY
// ============================================================

export const VIP_PLANS = {
  first: {
    label: "首充月卡",
    days: 30,
    amount: Number(process.env.VIP_FIRST_PURCHASE_CNY || 9.9) * 100,
    firstPurchaseOnly: true,
  },
  m1: {
    label: "月度会员",
    days: 30,
    amount: Number(process.env.VIP_PLAN_30_CNY || 49) * 100,
  },
  m3: {
    label: "季度会员",
    days: 90,
    amount: Number(process.env.VIP_PLAN_90_CNY || 128) * 100,
  },
  y1: {
    label: "年度会员",
    days: 365,
    amount: Number(process.env.VIP_PLAN_365_CNY || 399) * 100,
  },
};

// 认证中间件（与 auth.js 同款，避免循环依赖）
function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    return res.status(401).json({ message: "请先登录" });
  }

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || "thai_ai_teacher_2026"
    );
    req.userId = payload.userId || payload.id;
    next();
  } catch (err) {
    return res.status(401).json({ message: "登录已过期，请重新登录" });
  }
}

/* 生成我方订单号（out_trade_no，网关回调幂等键） */
function genOrderNo() {
  return (
    "TAI" +
    Date.now().toString(36).toUpperCase() +
    crypto.randomBytes(4).toString("hex").toUpperCase()
  );
}

/* 金额：分 → 元字符串（2 位小数） */
function centsToYuan(cents) {
  return (cents / 100).toFixed(2);
}

/* ============================================================
   易支付 MD5 签名
   （彩虹易支付标准：参数按 key 升序拼接 k=v&k=v，末尾 + 商户密钥）
============================================================ */

function epaySign(params) {
  const keys = Object.keys(params)
    .filter(
      (k) =>
        k !== "sign" &&
        k !== "sign_type" &&
        params[k] !== "" &&
        params[k] != null
    )
    .sort();

  const raw = keys.map((k) => `${k}=${params[k]}`).join("&");

  return crypto
    .createHash("md5")
    .update(raw + getEpayConfig().key)
    .digest("hex");
}

/* 构造易支付收银台跳转 URL（前端新窗口打开，用户扫码/跳转支付） */
function buildEpayUrl(order) {
  const { mchid, gateway } = getEpayConfig();

  const params = {
    pid: mchid,
    type: order.channel === "alipay" ? "alipay" : "wxpay", // 微信通道用 wxpay
    out_trade_no: order.order_no,
    notify_url: `${process.env.PAY_NOTIFY_BASE || ""}/api/payments/notify`,
    return_url: `${process.env.PAY_NOTIFY_BASE || ""}/vip?paid=1`,
    name: `ThaiAI VIP ${order.days} 天`,
    money: centsToYuan(order.amount),
    sign_type: "MD5",
  };
  params.sign = epaySign(params);

  return (
    `${gateway}/submit.php?` +
    Object.keys(params)
      .map((k) => `${k}=${encodeURIComponent(params[k])}`)
      .join("&")
  );
}

/* 创建支付订单（pending），返回订单行 */
function createOrder(userId, planKey, channel) {
  return new Promise((resolve, reject) => {
    const planInfo = VIP_PLANS[planKey];
    if (!planInfo) return reject(new Error("套餐不存在"));

    const orderNo = genOrderNo();
    const provider = getProvider();

    db.run(
      `INSERT INTO payments
         (user_id, amount_cents, currency, plan_days, status,
          order_no, channel, provider, first_purchase)
       VALUES (?, ?, 'cny', ?, 'pending', ?, ?, ?, ?)`,
      [
        userId,
        planInfo.amount,
        planInfo.days,
        orderNo,
        channel || "wechat",
        provider,
        planInfo.firstPurchaseOnly ? 1 : 0,
      ],
      (err) => {
        if (err) return reject(err);
        resolve({
          orderNo,
          amount: planInfo.amount,
          days: planInfo.days,
          channel: channel || "wechat",
          provider,
        });
      }
    );
  });
}

/* 关闭超时未支付的订单（创建后 30 分钟） */
function closeStaleOrders() {
  db.run(
    `UPDATE payments SET status = 'closed'
     WHERE status = 'pending' AND created_at < datetime('now', '-30 minutes')`
  );
}

/*
 * 首充资格：首次充值优惠只针对从未成功支付过的用户。
 * pending/processing 首充订单也会暂时占用资格，避免重复创建待支付单。
 */
function getFirstPurchaseEligibility(userId) {
  return new Promise((resolve, reject) => {
    closeStaleOrders();
    db.get(
      `SELECT
         EXISTS(
           SELECT 1 FROM payments
           WHERE user_id = ? AND status = 'paid'
         ) AS has_paid,
         EXISTS(
           SELECT 1 FROM payments
           WHERE user_id = ?
             AND first_purchase = 1
             AND status IN ('pending', 'processing')
         ) AS has_active_first`,
      [userId, userId],
      (err, row) => {
        if (err) return reject(err);
        resolve({
          eligible: !row?.has_paid && !row?.has_active_first,
          hasPaid: Boolean(row?.has_paid),
          hasActiveFirst: Boolean(row?.has_active_first),
        });
      }
    );
  });
}

/* 支付回调只允许一个请求把 pending 订单推进到 processing。 */
function claimPendingOrder(orderId) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE payments SET status = 'processing'
       WHERE id = ? AND status = 'pending'`,
      [orderId],
      function (err) {
        if (err) return reject(err);
        resolve(this.changes === 1);
      }
    );
  });
}

/* ============================================================
   GET /api/payments/status — 支付是否可用（公共）
============================================================ */

router.get("/status", (req, res) => {
  const provider = getProvider();

  res.json({
    enabled: !!provider,
    provider,
    channels:
      provider === "wechat"
        ? ["wechat"]
        : provider === "epay"
          ? ["wechat", "alipay"]
          : provider === "stripe"
            ? ["card"]
            : [],
    plans: Object.fromEntries(
      Object.entries(VIP_PLANS).map(([key, plan]) => [
        key,
        {
          label: plan.label,
          days: plan.days,
          amount: plan.amount / 100,
        },
      ])
    ),
  });
});

/* ============================================================
   GET /api/payments — 当前用户的订单记录
============================================================ */

router.get("/", authenticate, (req, res) => {
  db.all(
    `
    SELECT id, amount_cents, currency, plan_days, status,
           order_no, channel, trade_no, provider, source, created_at
    FROM payments
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
    `,
    [req.userId],
    (err, rows) => {
      if (err) {
        console.error("订单查询失败:", err);
        return res.status(500).json({ message: "数据库错误" });
      }

      res.json({
        orders: (rows || []).map((row) => ({
          id: row.id,
          orderNo: row.order_no,
          amount: row.amount_cents / 100,
          currency: row.currency,
          planDays: row.plan_days,
          status: row.status,
          channel: row.channel,
          provider: row.provider || row.source,
          createdAt: row.created_at,
        })),
      });
    }
  );
});

/* ============================================================
   POST /api/payments/checkout — 创建支付订单
   body: { plan: "m1"|"m3"|"y1", channel: "wechat"|"alipay"|"card" }
   返回 { url, orderNo }（url 为支付页，前端新窗口打开后轮询订单）
============================================================ */

router.post("/checkout", authenticate, async (req, res) => {
  const provider = getProvider();
  if (!provider) {
    return res.status(501).json({
      message: "在线支付暂未开通，请使用激活码开通 VIP",
    });
  }

  const { plan, channel } = req.body || {};
  const planInfo = VIP_PLANS[plan];
  if (!planInfo) {
    return res.status(400).json({ message: "套餐不存在" });
  }

  if (planInfo.firstPurchaseOnly) {
    try {
      const eligibility = await getFirstPurchaseEligibility(req.userId);
      if (!eligibility.eligible) {
        return res.status(409).json({
          code: "FIRST_PURCHASE_UNAVAILABLE",
          message: "首充月卡每位用户仅限购买一次，请选择标准套餐",
        });
      }
    } catch (err) {
      console.error("[payments] 首充资格查询失败:", err);
      return res.status(500).json({ message: "暂时无法校验首充资格，请稍后再试" });
    }
  }

  try {
    let order;

    if (provider === "wechat") {
      // 微信官方 Native 扫码：下单 → 返回二维码内容（前端渲染）
      order = await createOrder(req.userId, plan, "wechat");

      if (!process.env.PAY_NOTIFY_BASE) {
        console.warn(
          "[payments] 未设置 PAY_NOTIFY_BASE（支付回调域名），微信支付回调将无法送达！"
        );
      }

      // 演示模式：不调真实微信 API，返回演示二维码内容
      let codeUrl;
      if (isWechatMock()) {
        console.warn(
          "[payments] 演示模式（PAY_WECHAT_MOCK=1）：返回演示二维码，不会真正扣款"
        );
        codeUrl =
          "weixin://wxpay/bizpayurl?pr=" +
          order.orderNo.slice(-8) +
          "&mock=1";
      } else {
        codeUrl = await createNativeOrder({
          outTradeNo: order.orderNo,
          description: `ThaiAI VIP ${order.days} 天`,
          amountCents: order.amount,
        });
      }

      // 存二维码内容，前端可随时重新展示
      await new Promise((resolve) => {
        db.run(
          "UPDATE payments SET qrcode_url = ? WHERE order_no = ?",
          [codeUrl, order.orderNo],
          () => resolve()
        );
      });

      return res.json({ qrcode: codeUrl, orderNo: order.orderNo, provider });
    }

    if (provider === "epay") {
      const allowedChannel =
        channel === "alipay" ? "alipay" : "wechat";
      order = await createOrder(req.userId, plan, allowedChannel);

      if (!process.env.PAY_NOTIFY_BASE) {
        console.warn(
          "[payments] 未设置 PAY_NOTIFY_BASE（支付回调域名），易支付回调将无法送达！"
        );
      }

      const url = buildEpayUrl(order);
      return res.json({ url, orderNo: order.orderNo, provider });
    }

    // Stripe 兜底
    order = await createOrder(req.userId, plan, "card");

    const origin =
      req.headers.origin ||
      `http://localhost:${process.env.PORT || 3001}`;

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "cny",
            product_data: {
              name: `ThaiAI VIP ${planInfo.label}`,
              description: `${planInfo.days} 天全功能会员`,
            },
            unit_amount: planInfo.amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: String(req.userId),
        planDays: String(planInfo.days),
        orderNo: order.orderNo,
      },
      success_url: `${origin}/vip/success?order=${order.orderNo}`,
      cancel_url: `${origin}/vip?canceled=1`,
      client_reference_id: String(req.userId),
    });

    // 关联 session id
    await new Promise((resolve) => {
      db.run(
        "UPDATE payments SET stripe_session_id = ? WHERE order_no = ?",
        [session.id, order.orderNo],
        () => resolve()
      );
    });

    return res.json({ url: session.url, orderNo: order.orderNo, provider });
  } catch (err) {
    if (err?.code === "SQLITE_CONSTRAINT" && planInfo.firstPurchaseOnly) {
      return res.status(409).json({
        code: "FIRST_PURCHASE_UNAVAILABLE",
        message: "首充月卡每位用户仅限购买一次，请选择标准套餐",
      });
    }
    console.error("创建支付订单失败:", err?.message || err);
    res.status(500).json({ message: "创建支付订单失败，请稍后再试" });
  }
});

/* ============================================================
   GET /api/payments/orders/:orderNo — 订单状态轮询
   （前端创建订单后每 3 秒轮询，支付完成即解锁）
============================================================ */

router.get("/orders/:orderNo", authenticate, (req, res) => {
  const orderNo = String(req.params.orderNo || "").slice(0, 64);

  db.get(
    `SELECT id, user_id, amount_cents, plan_days, status, channel, provider, qrcode_url
     FROM payments WHERE order_no = ? LIMIT 1`,
    [orderNo],
    (err, row) => {
      if (err) {
        return res.status(500).json({ message: "数据库错误" });
      }
      if (!row || row.user_id !== req.userId) {
        return res.status(404).json({ message: "订单不存在" });
      }

      closeStaleOrders();

      res.json({
        orderNo,
        status: row.status,
        amount: row.amount_cents / 100,
        planDays: row.plan_days,
        channel: row.channel,
        provider: row.provider,
        qrcode: row.qrcode_url || null,
      });
    }
  );
});

/* ============================================================
   POST /api/payments/notify — 易支付异步回调（无需登录）
   校验签名 → 更新订单 → 激活 VIP → 响应 "success"
   兼容 GET/POST（部分网关用 GET 通知）与多种 trade_status 取值
============================================================ */

router.post("/notify", (req, res) => {
  handleEpayNotify(req, res);
});
router.get("/notify", (req, res) => {
  handleEpayNotify(req, res);
});

function handleEpayNotify(req, res) {
  const provider = getProvider();
  if (provider !== "epay") {
    return res.status(501).send("fail");
  }

  // 网关可能 POST form 或 GET query，统一合并
  const params = { ...(req.query || {}), ...(req.body || {}) };

  const sign = String(params.sign || "");
  if (!sign) {
    return res.status(400).send("fail");
  }

  // 校验签名
  const expectSign = epaySign(params);
  if (sign.toLowerCase() !== expectSign.toLowerCase()) {
    console.warn("[payments] 易支付回调签名校验失败", {
      out_trade_no: params.out_trade_no,
      sign,
      expectSign,
    });
    return res.status(400).send("fail");
  }

  const orderNo = String(params.out_trade_no || "").slice(0, 64);
  const tradeStatus = String(params.trade_status || "").toUpperCase();
  const paid =
    tradeStatus === "TRADE_SUCCESS" ||
    tradeStatus === "1" ||
    tradeStatus === "SUCCESS";

  if (!orderNo) {
    return res.status(400).send("fail");
  }

  db.get(
    `SELECT id, user_id, amount_cents, plan_days, status, channel, first_purchase
     FROM payments WHERE order_no = ? LIMIT 1`,
    [orderNo],
    async (err, row) => {
      if (err || !row) {
        return res.status(404).send("fail");
      }

      // 幂等：已支付直接返回 success（网关会重复回调）
      if (row.status === "paid") {
        return res.send("success");
      }
      if (row.status !== "pending") {
        return res.status(409).send("fail");
      }

      if (!paid) {
        return res.send("success"); // 未支付成功，不处理，等下次回调
      }

      // 金额校验：网关回传的 money（元）必须与订单一致
      const money = Number(params.money);
      if (!Number.isFinite(money) || Math.round(money * 100) !== row.amount_cents) {
        console.warn("[payments] 易支付回调金额不匹配", {
          orderNo,
          expect: row.amount_cents,
          got: params.money,
        });
        return res.status(400).send("fail");
      }

      try {
        const claimed = await claimPendingOrder(row.id);
        if (!claimed) return res.send("success");
        const channel = row.channel || "wechat";
        await extendVipDays(db, row.user_id, row.plan_days, channel);

        await new Promise((resolve, reject) => {
          db.run(
            `UPDATE payments
             SET status = 'paid', trade_no = ?, channel = ?
             WHERE id = ?`,
            [String(params.trade_no || "").slice(0, 128), channel, row.id],
            (e) => (e ? reject(e) : resolve())
          );
        });

        console.log(
          `[支付成功] user=${row.user_id} days=${row.plan_days} order=${orderNo} channel=${channel}`
        );

        res.send("success");
      } catch (err) {
        console.error("[payments] 回调处理失败:", err);
        res.status(500).send("fail");
      }
    }
  );
}

/* ============================================================
   POST /api/payments/wechat-notify — 微信支付官方回调（无需登录）
   验签（平台证书 RSA-SHA256）→ AES-GCM 解密 → 校验金额 → 激活 VIP
   app.js 中已为此路径挂载 express.raw 保留原始 body
============================================================ */

router.post("/wechat-notify", async (req, res) => {
  const provider = getProvider();
  if (provider !== "wechat") {
    return res.status(501).json({ code: "FAIL", message: "支付未配置" });
  }

  const rawBody = Buffer.isBuffer(req.body)
    ? req.body.toString("utf8")
    : String(req.body || "");

  // 1) 验签
  const valid = await verifyWechatNotify(req.headers, rawBody);
  if (!valid) {
    console.warn("[payments] 微信回调验签失败");
    return res.status(400).json({ code: "FAIL", message: "签名验证失败" });
  }

  // 2) 解密资源
  let event;
  try {
    const parsed = JSON.parse(rawBody);
    event = JSON.parse(decryptResource(parsed.resource));
  } catch (err) {
    console.error("[payments] 微信回调解密失败:", err?.message);
    return res.status(400).json({ code: "FAIL", message: "解密失败" });
  }

  const tradeState = String(event.trade_state || "");
  const orderNo = String(event.out_trade_no || "").slice(0, 64);

  if (!orderNo) {
    return res.status(400).json({ code: "FAIL", message: "缺少订单号" });
  }

  // 3) 查单 + 幂等 + 金额校验
  db.get(
    `SELECT id, user_id, amount_cents, plan_days, status, channel, first_purchase
     FROM payments WHERE order_no = ? LIMIT 1`,
    [orderNo],
    async (err, row) => {
      if (err || !row) {
        return res.status(404).json({ code: "FAIL", message: "订单不存在" });
      }

      // 幂等：已支付直接返回成功（微信会重复回调）
      if (row.status === "paid") {
        return res.json({ code: "SUCCESS", message: "成功" });
      }
      if (row.status !== "pending") {
        return res.status(409).json({ code: "FAIL", message: "订单正在处理中" });
      }

      if (tradeState !== "SUCCESS") {
        // 未支付成功，不处理；返回成功避免微信无限重试
        return res.json({ code: "SUCCESS", message: "成功" });
      }

      // 金额校验：微信回传的 total（分）必须与订单一致
      const total = Number(event.amount?.total);
      if (!Number.isFinite(total) || total !== row.amount_cents) {
        console.warn("[payments] 微信回调金额不匹配", {
          orderNo,
          expect: row.amount_cents,
          got: total,
        });
        return res.status(400).json({ code: "FAIL", message: "金额不匹配" });
      }

      try {
        const claimed = await claimPendingOrder(row.id);
        if (!claimed) return res.json({ code: "SUCCESS", message: "已由其他请求处理" });
        const channel = row.channel || "wechat";
        await extendVipDays(db, row.user_id, row.plan_days, channel);

        await new Promise((resolve, reject) => {
          db.run(
            `UPDATE payments
             SET status = 'paid', trade_no = ?, channel = ?
             WHERE id = ?`,
            [
              String(event.transaction_id || "").slice(0, 128),
              channel,
              row.id,
            ],
            (e) => (e ? reject(e) : resolve())
          );
        });

        console.log(
          `[支付成功] user=${row.user_id} days=${row.plan_days} order=${orderNo} channel=wechat(official)`
        );

        res.json({ code: "SUCCESS", message: "成功" });
      } catch (e) {
        console.error("[payments] 微信回调处理失败:", e);
        res.status(500).json({ code: "FAIL", message: "处理失败" });
      }
    }
  );
});

/* ============================================================
   POST /api/payments/webhook — Stripe Webhook（保留）
   支付成功 → 激活 VIP + 记录订单
============================================================ */

router.post(
  "/webhook",
  async (req, res) => {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(501).json({ message: "支付未配置" });
    }

    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        webhookSecret
      );
    } catch (err) {
      console.error("Webhook 签名校验失败:", err?.message);
      return res.status(400).json({ message: "签名校验失败" });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = Number(session.metadata?.userId);
      const planDays = Number(session.metadata?.planDays);
      const orderNo = String(session.metadata?.orderNo || "");

      if (!userId || !planDays) {
        return res.status(400).json({ message: "缺少订单元数据" });
      }

      try {
        // 幂等：同一 session / orderNo 只处理一次
        const existing = await new Promise((resolve) => {
          db.get(
            `SELECT id FROM payments
             WHERE stripe_session_id = ? OR (order_no = ? AND order_no != '')
             LIMIT 1`,
            [session.id, orderNo],
            (err, row) => resolve(row)
          );
        });

        if (existing) {
          return res.json({ received: true, duplicate: true });
        }

        await extendVipDays(db, userId, planDays, "card");

        const paymentIntent = session.payment_intent;

        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO payments
              (user_id, amount_cents, currency, plan_days, status,
               order_no, channel, provider, stripe_session_id,
               stripe_payment_intent, source)
            VALUES (?, ?, ?, ?, 'paid', ?, 'card', 'stripe', ?, ?, 'stripe')`,
            [
              userId,
              session.amount_total || 0,
              session.currency || "cny",
              planDays,
              orderNo || genOrderNo(),
              session.id,
              paymentIntent ? String(paymentIntent) : null,
            ],
            (err) => (err ? reject(err) : resolve())
          );
        });

        console.log(
          `[支付成功] user=${userId} days=${planDays} session=${session.id}`
        );
      } catch (err) {
        console.error("Webhook 处理失败:", err);
        return res.status(500).json({ message: "处理失败" });
      }
    }

    res.json({ received: true });
  }
);

export default router;
