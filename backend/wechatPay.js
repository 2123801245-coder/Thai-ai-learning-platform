// ============================================================
// 微信支付 v3 核心模块（官方 Native 扫码支付）
//
// 适用：微信支付「小微商户」/ 普通商户（个人凭身份证+银行卡可申请小微商户）
// 文档：https://pay.weixin.qq.com/docs/merchant/apis/native-payment/introduction.html
//
// 需要环境变量（全部在【函数内】惰性读取——ES Module 导入先于 dotenv）：
//   PAY_WECHAT_MCHID       商户号（微信支付商户平台申请）
//   PAY_WECHAT_APIV3_KEY   API v3 密钥（32 位，商户平台设置）
//   PAY_WECHAT_SERIAL_NO   商户 API 证书序列号（apiclient_cert.pem 的序列号）
//   PAY_WECHAT_PRIVATE_KEY 商户 API 私钥（apiclient_key.pem，可填路径或内联 PEM）
//   PAY_WECHAT_PLATFORM_CERT 微信支付平台证书 PEM（可填路径或内联；不填则自动从
//                          /v3/certificates 下载并缓存——首次回调时获取）
//   PAY_WECHAT_APPID       可选；小微商户 Native 扫码一般无需 appid
// ============================================================

import crypto from "crypto";
import fs from "fs";

const API_BASE = "https://api.mch.weixin.qq.com";

function getConfig() {
  return {
    mchid: process.env.PAY_WECHAT_MCHID || "",
    apiV3Key: process.env.PAY_WECHAT_APIV3_KEY || "",
    serialNo: process.env.PAY_WECHAT_SERIAL_NO || "",
    privateKey: process.env.PAY_WECHAT_PRIVATE_KEY || "",
    platformCert: process.env.PAY_WECHAT_PLATFORM_CERT || "",
    appid: process.env.PAY_WECHAT_APPID || "",
  };
}

/* 是否已配置微信支付（四项核心凭证齐全） */
export function wechatConfigured() {
  const c = getConfig();
  return !!(c.mchid && c.apiV3Key && c.serialNo && c.privateKey);
}

/* 读取商户私钥：支持内联 PEM 或文件路径 */
function loadMerchantPrivateKey() {
  const raw = getConfig().privateKey;
  if (raw.includes("-----BEGIN")) return raw;
  return fs.readFileSync(raw, "utf8");
}

/* 读取平台证书：支持内联 PEM 或文件路径；否则返回 null（走自动下载） */
function loadPlatformCertPem() {
  const raw = getConfig().platformCert;
  if (!raw) return null;
  if (raw.includes("-----BEGIN")) return raw;
  return fs.readFileSync(raw, "utf8");
}

/* ============================================================
   请求签名（WECHATPAY2-SHA256-RSA2048）
============================================================ */

function signMessage(message) {
  return crypto
    .createSign("RSA-SHA256")
    .update(message)
    .sign(loadMerchantPrivateKey(), "base64");
}

/* 生成请求 Authorization 头 */
function buildAuthHeader(method, urlPath, body, timestamp, nonce) {
  const c = getConfig();
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;
  const signature = signMessage(message);
  return (
    `WECHATPAY2-SHA256-RSA2048 mchid="${c.mchid}",` +
    `nonce_str="${nonce}",signature="${signature}",` +
    `timestamp="${timestamp}",serial_no="${c.serialNo}"`
  );
}

/* 带签名调用微信支付 API（GET / POST） */
async function wechatRequest(method, urlPath, bodyObj = null) {
  const body = bodyObj ? JSON.stringify(bodyObj) : "";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomBytes(16).toString("hex");

  const resp = await fetch(API_BASE + urlPath, {
    method,
    headers: {
      Authorization: buildAuthHeader(method, urlPath, body, timestamp, nonce),
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "ThaiAI/1.0 (Thai language learning app)",
    },
    body: body || undefined,
  });

  const text = await resp.text();
  const data = text ? JSON.parse(text) : {};

  if (!resp.ok) {
    throw new Error(
      `微信支付 API ${resp.status} ${method} ${urlPath}: ${JSON.stringify(data)}`
    );
  }
  return data;
}

/* ============================================================
   Native 下单 → 返回 code_url（二维码内容）
============================================================ */

export async function createNativeOrder({ outTradeNo, description, amountCents }) {
  const c = getConfig();

  const payload = {
    mchid: c.mchid,
    description,
    out_trade_no: outTradeNo,
    notify_url: `${process.env.PAY_NOTIFY_BASE || ""}/api/payments/wechat-notify`,
    amount: { total: amountCents, currency: "CNY" },
  };
  // 小微商户 Native 扫码一般无需 appid；配置了才带上
  if (c.appid) payload.appid = c.appid;

  const data = await wechatRequest(
    "POST",
    "/v3/pay/transactions/native",
    payload
  );

  if (!data.code_url) {
    throw new Error(`微信下单未返回 code_url: ${JSON.stringify(data)}`);
  }
  return data.code_url;
}

/* ============================================================
   平台证书：验证回调签名用
   优先用环境变量指定的 PEM；否则从 /v3/certificates 下载并缓存
============================================================ */

const platformCertCache = new Map(); // serial_no -> pem
let certFetchPromise = null;

async function fetchPlatformCerts() {
  const data = await wechatRequest("GET", "/v3/certificates");
  for (const item of data.data || []) {
    try {
      const pem = decryptResource(item.encrypt_certificate);
      platformCertCache.set(item.serial_no, pem);
    } catch (err) {
      console.warn("[wechatPay] 平台证书解密失败:", err?.message);
    }
  }
}

async function getPlatformCert(serial) {
  // 环境变量直接指定（最省事，推荐）
  const direct = loadPlatformCertPem();
  if (direct) return direct;

  // 缓存命中
  if (serial && platformCertCache.has(serial)) {
    return platformCertCache.get(serial);
  }

  // 首次下载（并发去重）
  if (!certFetchPromise) {
    certFetchPromise = fetchPlatformCerts().finally(() => {
      certFetchPromise = null;
    });
  }
  await certFetchPromise;

  return serial ? platformCertCache.get(serial) || null : null;
}

/* ============================================================
   回调验签 + 资源解密
============================================================ */

/* 校验微信支付回调签名（RSA-SHA256，用平台证书公钥） */
export async function verifyWechatNotify(headers, rawBody) {
  const timestamp = headers["wechatpay-timestamp"];
  const nonce = headers["wechatpay-nonce"];
  const signature = headers["wechatpay-signature"];
  const serial = headers["wechatpay-serial"];

  if (!timestamp || !nonce || !signature) return false;

  const platformCert = await getPlatformCert(serial);
  if (!platformCert) {
    console.warn("[wechatPay] 平台证书不可用（serial:", serial, "）");
    return false;
  }

  const message = `${timestamp}\n${nonce}\n${rawBody}\n`;

  try {
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(message);
    return verifier.verify(platformCert, signature, "base64");
  } catch (err) {
    console.warn("[wechatPay] 回调验签异常:", err?.message);
    return false;
  }
}

/* 解密微信支付资源（AEAD_AES_256_GCM，密钥为 APIv3 Key） */
export function decryptResource(resource) {
  const key = Buffer.from(getConfig().apiV3Key, "utf8");

  const ciphertext = Buffer.from(resource.ciphertext, "base64");
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const data = ciphertext.subarray(0, ciphertext.length - 16);

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(resource.nonce, "utf8")
  );
  decipher.setAuthTag(authTag);
  if (resource.associated_data) {
    decipher.setAAD(Buffer.from(resource.associated_data, "utf8"));
  }

  const plain = Buffer.concat([
    decipher.update(data),
    decipher.final(),
  ]).toString("utf8");

  return plain;
}
