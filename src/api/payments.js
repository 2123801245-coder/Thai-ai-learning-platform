import api from "./auth";

// ============================================================
// 支付 API（易支付聚合：微信/支付宝 + Stripe 兜底）
//
// 后端按配置自动选择提供商：
//   epay    → 返回收银台 URL（新窗口打开，前端轮询订单状态）
//   stripe  → 返回 Stripe Checkout URL（跳转支付）
//   未配置  → 在线支付关闭，前端降级为激活码开通
// ============================================================

// 支付是否可用 + 套餐价格 + 渠道（公共）
export const getPaymentStatus = () => {
  return api.get("/payments/status");
};

// 创建支付订单，返回 { url, orderNo, provider }
// plan: "m1" | "m3" | "y1"
// channel: "wechat" | "alipay" | "card"
export const createCheckout = (plan, channel = "wechat") => {
  return api.post("/payments/checkout", { plan, channel });
};

// 订单状态轮询（创建订单后每 3 秒调一次，支付完成即解锁）
export const getOrderStatus = (orderNo) => {
  return api.get(`/payments/orders/${orderNo}`);
};

// 当前用户订单记录
export const getOrders = () => {
  return api.get("/payments");
};

export default api;
