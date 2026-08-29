import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown,
  Check,
  X,
  BookOpen,
  Video,
  Mic,
  MessageCircle,
  Sparkles,
  BarChart3,
  KeyRound,
  Loader2,
  CheckCircle2,
  Clock3,
  Smartphone,
  Wallet,
  CreditCard,
  ExternalLink,
  ReceiptText,
  Zap,
  Copy,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";

import { activateVip } from "@/api/auth";
import {
  getPaymentStatus,
  createCheckout,
  getOrderStatus,
  getOrders,
} from "@/api/payments";
import { useAuth } from "@/lib/AuthContext";
import {
  SUPPORT_CONFIG,
  DEFAULT_PLANS,
  FIRST_PURCHASE_PLAN,
  copyText,
} from "@/lib/vipConfig";

/* =========================================================
   VIP 权益面板（共享组件）
   =========================================================
   开通方式：
   1. 在线支付（易支付聚合：微信 / 支付宝；或 Stripe 卡支付）
      —— 需后端配置 PAY_EPAY_* / STRIPE_* 环境变量。
      未配置时在线支付自动隐藏，只保留激活码。
   2. 激活码 —— 管理员发码，后端启动时生成演示码，
      也可用环境变量 VIP_CODES 自定义（CODE:天数）。
   3. 权益内容与 Course.jsx / CourseDetail.jsx 保持一致。
========================================================= */

const benefits = [
  {
    icon: BookOpen,
    text: "全部课程解锁",
    desc: "5 门 VIP 进阶课程全开放",
  },
  {
    icon: Video,
    text: "全部视频",
    desc: "含 VIP 专属章节与完整课时",
  },
  {
    icon: Mic,
    text: "完整口语训练",
    desc: "单词 / 句子 / 段落三模式 + Azure 专业评测",
  },
  {
    icon: MessageCircle,
    text: "AI 对话高级功能",
    desc: "更多场景与智能互动",
  },
  {
    icon: Sparkles,
    text: "高级词汇",
    desc: "进阶词库与学习内容",
  },
  {
    icon: BarChart3,
    text: "高级学习数据",
    desc: "更完整的学习分析与报告",
  },
];

/* 到期时间格式化：YYYY-MM-DD HH:mm → 显示日期 */
function formatExpiry(value) {
  if (!value) return "";
  const text = String(value).replace(" ", "T") + "Z";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return String(value);

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* 订单状态徽章 */
const ORDER_STATUS = {
  pending: { label: "待支付", cls: "bg-yellow-300/10 text-yellow-200 border-yellow-300/20" },
  paid: { label: "已支付", cls: "bg-emerald-300/10 text-emerald-200 border-emerald-300/25" },
  refunded: { label: "已退款", cls: "bg-red-300/10 text-red-200 border-red-300/20" },
  failed: { label: "失败", cls: "bg-red-300/10 text-red-200 border-red-300/20" },
  closed: { label: "已关闭", cls: "bg-white/[0.04] text-white/30 border-white/[0.08]" },
};

const CHANNEL_META = {
  wechat: { label: "微信支付", icon: Smartphone, desc: "微信扫码 / 跳转支付" },
  alipay: { label: "支付宝", icon: Wallet, desc: "支付宝扫码 / 跳转支付" },
  card: { label: "银行卡", icon: CreditCard, desc: "国际信用卡（Stripe）" },
};



export default function VipPanel({ open, onClose }) {
  const navigate = useNavigate();
  const { user, isAuthenticated, updateUser, refreshUser } = useAuth();

  const [tab, setTab] = useState("pay");
  const [code, setCode] = useState("");
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");
  const [justActivated, setJustActivated] = useState(false);
  const [copiedWechat, setCopiedWechat] = useState(false);

  // 在线支付状态
  const [payStatus, setPayStatus] = useState(null); // { enabled, provider, channels, plans }
  const [plan, setPlan] = useState("m1");
  const [channel, setChannel] = useState("wechat");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const [firstPurchaseUnavailable, setFirstPurchaseUnavailable] = useState(false);
  const [payingOrderNo, setPayingOrderNo] = useState("");
  const [payState, setPayState] = useState("idle"); // idle | pending | paid | failed
  const [qrcode, setQrcode] = useState(null); // 微信 Native 扫码内容
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const pollTimer = useRef(null);
  const pollAttempts = useRef(0);

  const isVip = !!user?.isVip;

  const loadOrders = useCallback(async () => {
    try {
      const res = await getOrders();
      setOrders(res.data?.orders || []);
    } catch (err) {
      // 静默：订单记录加载失败不打扰支付主流程
      console.warn("订单记录加载失败:", err?.message);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  // 微信二维码内容 → 可展示的 dataURL（离线生成，不依赖外部 API）
  useEffect(() => {
    if (!qrcode) {
      setQrDataUrl("");
      return;
    }

    let cancelled = false;

    QRCode.toDataURL(qrcode, {
      width: 224,
      margin: 2,
      color: { dark: "#0A1F1B", light: "#F7E7B9" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });

    return () => {
      cancelled = true;
    };
  }, [qrcode]);

  // 打开面板且已登录时：拉取支付可用性 + 订单记录
  useEffect(() => {
    if (!open || !isAuthenticated) {
      // 面板关闭：清理支付状态，避免下次打开残留旧二维码/轮询
      stopPolling();
      setQrcode(null);
      setPayState("idle");
      setPaying(false);
      setPayingOrderNo("");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await getPaymentStatus();
        if (cancelled) return;
        setPayStatus(res.data);
        const channels = res.data?.channels || [];
        if (channels.length > 0) {
          setChannel(channels[0]);
        }
      } catch (err) {
        if (cancelled) return;
        setPayStatus({ enabled: false, channels: [], plans: null });
      }
    })();

    setOrdersLoading(true);
    loadOrders();

    return () => {
      cancelled = true;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isAuthenticated]);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  // 轮询订单状态：每 3 秒一次，最多 60 次（3 分钟）
  const startPolling = useCallback(
    (orderNo) => {
      stopPolling();
      pollAttempts.current = 0;

      pollTimer.current = setInterval(async () => {
        pollAttempts.current += 1;

        try {
          const res = await getOrderStatus(orderNo);
          const status = res.data?.status;

          if (status === "paid") {
            stopPolling();
            setPayState("paid");
            setPaying(false);
            setPayingOrderNo("");
            setQrcode(null);
            await refreshUser(); // 同步最新 VIP 状态
            loadOrders();
          } else if (
            status === "closed" ||
            status === "failed" ||
            status === "refunded" ||
            pollAttempts.current >= 60
          ) {
            stopPolling();
            setPayState("failed");
            setPaying(false);
            setPayingOrderNo("");
            setQrcode(null);
          }
        } catch (err) {
          if (pollAttempts.current >= 60) {
            stopPolling();
            setPayState("failed");
            setPaying(false);
            setPayingOrderNo("");
            setQrcode(null);
          }
        }
      }, 3000);
    },
    [refreshUser, stopPolling, loadOrders]
  );

  const handlePay = async () => {
    if (!plan || !channel) return;

    setPaying(true);
    setPayError("");
    setFirstPurchaseUnavailable(false);
    setPayState("pending");
    setQrcode(null);

    try {
      const res = await createCheckout(plan, channel);
      const { url, qrcode: qr, orderNo } = res.data || {};

      if ((!url && !qr) || !orderNo) {
        throw new Error("创建订单失败");
      }

      setPayingOrderNo(orderNo);

      if (qr) {
        // 微信官方 Native：面板内直接展示二维码（微信扫码支付）
        setQrcode(qr);
      } else if (url) {
        // 易支付 / Stripe：新窗口打开收银台（用户扫码/跳转支付）
        window.open(url, "_blank", "noopener,noreferrer");
      }

      startPolling(orderNo);
    } catch (err) {
      const message = err?.response?.data?.message || "创建订单失败，请稍后再试";
      setFirstPurchaseUnavailable(err?.response?.data?.code === "FIRST_PURCHASE_UNAVAILABLE");
      setPayError(message);
      setPayState("failed");
      setPaying(false);
    }
  };

  const handleActivate = async () => {
    const cleanCode = code.trim();

    if (!cleanCode) {
      setError("请输入激活码");
      return;
    }

    setActivating(true);
    setError("");

    try {
      const res = await activateVip(cleanCode);
      const nextUser = res.data?.user;

      if (nextUser) {
        updateUser(nextUser);
        setJustActivated(true);
        setCode("");
      } else {
        setError("开通失败，请稍后再试");
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "开通失败，请检查激活码"
      );
    } finally {
      setActivating(false);
    }
  };

  // 复制客服微信号（带 execCommand 兜底，兼容无 https 环境）
  const copyWechat = async () => {
    const ok = await copyText(SUPPORT_CONFIG.wechatId);
    setCopiedWechat(ok);
    if (ok) setTimeout(() => setCopiedWechat(false), 2000);
  };

  const channels = payStatus?.channels || [];
  const plans = payStatus?.plans || null;
  const payEnabled = !!payStatus?.enabled && channels.length > 0;

  // 价格表：优先用后端套餐价，取不到用默认价
  const pricePlans = plans
    ? Object.entries(plans).map(([key, p]) => ({
        label: p.label.replace("会员", ""),
        days: p.days,
        amount: p.amount,
      }))
    : DEFAULT_PLANS;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="gold-shimmer relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[28px] border border-yellow-300/15 bg-[#0A1F1B] shadow-2xl"
          >
            {/* 顶部光晕 */}

            <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-yellow-400/[0.10] blur-3xl" />

            <div className="pointer-events-none absolute -right-20 top-40 h-56 w-56 rounded-full bg-emerald-400/[0.07] blur-3xl" />

            <div className="relative p-6 sm:p-8">
              {/* 关闭 */}

              <button
                onClick={onClose}
                className="absolute right-4 top-4 rounded-lg p-1.5 text-white/30 transition hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>

              {/* 标题 */}

              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-yellow-300/20 bg-gradient-to-br from-yellow-300/[0.15] to-amber-500/[0.08]">
                  <Crown className="h-6 w-6 text-yellow-300" />
                </div>

                <div>
                  <h2 className="text-xl font-black text-white">
                    ThaiAI VIP 会员
                  </h2>

                  <p className="mt-0.5 text-xs text-yellow-200/50">
                    {isVip
                      ? "已开通 · 全部进阶内容已解锁"
                      : "解锁全部进阶学习内容"}
                  </p>
                </div>
              </div>

              {/* 已开通状态 */}

              {isVip && (
                <div className="mt-5 rounded-2xl border border-yellow-300/20 bg-yellow-300/[0.07] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-yellow-300" />
                    <p className="text-sm font-semibold text-yellow-200">
                      VIP 会员已激活
                    </p>
                  </div>

                  {user?.vipExpiresAt && (
                    <p className="mt-2 flex items-center gap-1.5 text-[11px] text-yellow-200/60">
                      <Clock3 className="h-3 w-3" />
                      有效期至 {formatExpiry(user.vipExpiresAt)}
                    </p>
                  )}
                </div>
              )}

              {!isAuthenticated ? (
                <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4 text-center">
                  <p className="text-xs text-white/40">
                    登录后即可开通 VIP
                  </p>

                  <button
                    onClick={() => {
                      onClose();
                      navigate("/login");
                    }}
                    className="mt-3 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 px-6 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5"
                  >
                    去登录
                  </button>
                </div>
              ) : (
                <>
                  {/* 开通方式页签 */}

                  <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-white/[0.06] bg-black/20 p-1">
                    <button
                      onClick={() => setTab("pay")}
                      className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        tab === "pay"
                          ? "bg-gradient-to-r from-yellow-300/20 to-amber-400/15 text-yellow-200"
                          : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      <Zap className="h-3.5 w-3.5" />
                      在线支付
                    </button>

                    <button
                      onClick={() => setTab("code")}
                      className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        tab === "code"
                          ? "bg-gradient-to-r from-yellow-300/20 to-amber-400/15 text-yellow-200"
                          : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      激活码
                    </button>
                  </div>

                  {tab === "pay" ? (
                    payEnabled ? (
                      <div className="mt-4 space-y-3">
                        {/* 套餐选择 */}

                        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                          <div className="mb-3 rounded-xl border border-yellow-300/25 bg-yellow-300/[0.07] px-3 py-2 text-[10px] leading-4 text-yellow-100/80">
                            🎁 首次充值专享：首个月仅 ¥9.9，每位用户限享一次
                          </div>
                          <p className="flex items-center gap-1.5 text-xs font-semibold text-white/60">
                            <Crown className="h-3.5 w-3.5 text-yellow-300/70" />
                            选择套餐
                          </p>

                          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {Object.entries(plans || {}).map(
                              ([key, p]) => {
                                const active = plan === key;

                                return (
                                  <button
                                    key={key}
                                    onClick={() => setPlan(key)}
                                    className={`rounded-xl border px-2 py-3 text-center transition ${
                                      active
                                        ? "border-yellow-300/40 bg-yellow-300/[0.08]"
                                        : "border-white/[0.08] bg-black/20 hover:border-white/20"
                                    }`}
                                  >
                                    <p
                                      className={`text-[11px] font-bold ${
                                        active
                                          ? "text-yellow-200"
                                          : "text-white/60"
                                      }`}
                                    >
                                      {p.label}
                                    </p>

                                    <p className="mt-1 text-base font-black text-white">
                                      ¥{p.amount}
                                    </p>

                                    <p className="mt-0.5 text-[9px] text-white/30">
                                      {p.days} 天
                                    </p>
                                  </button>
                                );
                              }
                            )}
                          </div>
                        </div>

                        {/* 支付渠道选择 */}

                        {channels.length > 1 && (
                          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-white/60">
                              <CreditCard className="h-3.5 w-3.5 text-emerald-300/70" />
                              支付方式
                            </p>

                            <div className="mt-3 grid grid-cols-2 gap-2">
                              {channels.map((ch) => {
                                const meta = CHANNEL_META[ch] || {
                                  label: ch,
                                  icon: CreditCard,
                                  desc: "",
                                };
                                const Icon = meta.icon;
                                const active = channel === ch;

                                return (
                                  <button
                                    key={ch}
                                    onClick={() => setChannel(ch)}
                                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                                      active
                                        ? "border-emerald-300/40 bg-emerald-300/[0.08]"
                                        : "border-white/[0.08] bg-black/20 hover:border-white/20"
                                    }`}
                                  >
                                    <Icon
                                      className={`h-4 w-4 ${
                                        active
                                          ? "text-emerald-300"
                                          : "text-white/40"
                                      }`}
                                    />

                                    <span className="min-w-0">
                                      <span
                                        className={`block text-xs font-bold ${
                                          active
                                            ? "text-white"
                                            : "text-white/60"
                                        }`}
                                      >
                                        {meta.label}
                                      </span>
                                      <span className="block text-[9px] text-white/30">
                                        {meta.desc}
                                      </span>
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 支付按钮 + 状态 */}

                        <button
                          onClick={handlePay}
                          disabled={paying || payState === "pending"}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-300 to-amber-400 px-4 py-3 text-sm font-bold text-[#172018] transition hover:-translate-y-0.5 disabled:opacity-60"
                        >
                          {paying || payState === "pending" ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              等待支付…
                            </>
                          ) : (
                            <>
                              <Crown className="h-4 w-4" />
                              立即支付
                            </>
                          )}
                        </button>

                        {payState === "pending" && payingOrderNo && (
                          <div className="rounded-xl border border-yellow-300/20 bg-yellow-300/[0.05] px-3 py-3">
                            {qrcode ? (
                              <div className="flex flex-col items-center gap-2.5">
                                <div className="rounded-xl bg-[#F7E7B9] p-2.5 shadow-inner">
                                  {qrDataUrl ? (
                                    <img
                                      src={qrDataUrl}
                                      alt="微信支付二维码"
                                      className="h-44 w-44 rounded-md"
                                    />
                                  ) : (
                                    <div className="flex h-44 w-44 items-center justify-center">
                                      <Loader2 className="h-5 w-5 animate-spin text-[#0A1F1B]" />
                                    </div>
                                  )}
                                </div>
                                <p className="text-[11px] leading-5 text-yellow-200/90">
                                  请使用<strong>微信</strong>扫码完成支付
                                </p>
                                <p className="flex items-center gap-1 text-[10px] text-yellow-200/50">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  支付完成后将自动解锁 VIP…
                                </p>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-[11px] text-yellow-200/80">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                已打开收银台，支付完成后将自动解锁…
                                <span className="ml-auto flex items-center gap-1">
                                  <ExternalLink className="h-3 w-3" />
                                  订单 {payingOrderNo.slice(-6)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {payState === "paid" && (
                          <div className="flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300/[0.08] px-3 py-2.5 text-[11px] text-emerald-200">
                            <CheckCircle2 className="h-4 w-4" />
                            支付成功，VIP 已开通！🎉
                          </div>
                        )}

                        {payState === "failed" && (
                          <p className="text-[11px] text-red-400">
                            未检测到支付完成，请确认后重试，或联系客服。
                          </p>
                        )}

                        {payError && (
                          <div className={`rounded-xl border px-3 py-2.5 text-[11px] ${firstPurchaseUnavailable ? "border-yellow-300/20 bg-yellow-300/[0.06] text-yellow-200/80" : "border-red-400/20 bg-red-400/[0.06] text-red-300"}`}>
                            {payError}
                            {firstPurchaseUnavailable && <button type="button" onClick={() => { setPlan("m1"); setPayError(""); setFirstPurchaseUnavailable(false); }} className="ml-2 font-semibold text-yellow-100 underline underline-offset-2">选择标准月卡</button>}
                          </div>
                        )}

                        {/* 订单记录 */}

                        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                          <p className="flex items-center gap-1.5 text-xs font-semibold text-white/60">
                            <ReceiptText className="h-3.5 w-3.5 text-white/40" />
                            支付记录
                          </p>

                          {ordersLoading ? (
                            <div className="mt-3 flex items-center justify-center py-3">
                              <Loader2 className="h-4 w-4 animate-spin text-white/30" />
                            </div>
                          ) : orders.length === 0 ? (
                            <p className="mt-3 text-[10px] text-white/25">
                              暂无支付记录
                            </p>
                          ) : (
                            <div className="mt-3 space-y-2">
                              {orders.slice(0, 5).map((o) => {
                                const meta =
                                  ORDER_STATUS[o.status] ||
                                  ORDER_STATUS.pending;

                                return (
                                  <div
                                    key={o.id || o.orderNo}
                                    className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-black/20 px-3 py-2"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[11px] font-semibold text-white/70">
                                        {CHANNEL_META[o.channel]?.label ||
                                          "在线支付"}{" "}
                                        · ¥{o.amount}
                                      </p>
                                      <p className="mt-0.5 text-[9px] text-white/25">
                                        {o.createdAt}
                                      </p>
                                    </div>

                                    <span
                                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold ${meta.cls}`}
                                    >
                                      {meta.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* 在线支付未配置：提示用激活码 */
                      <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4 text-center">
                        <p className="text-xs text-white/40">
                          在线支付即将上线
                        </p>
                        <p className="mt-1 text-[10px] text-white/25">
                          当前请使用激活码开通，或联系管理员获取支付方式
                        </p>
                      </div>
                    )
                  ) : (
                    <>
                      {/* 激活码输入 */}

                      <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-white/60">
                          <KeyRound className="h-3.5 w-3.5 text-yellow-300/70" />
                          输入激活码开通 VIP
                        </p>

                        <div className="mt-3 flex gap-2">
                          <input
                            value={code}
                            onChange={(e) => {
                              setCode(e.target.value);
                              setError("");
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleActivate();
                            }}
                            placeholder="例如 THAI-VIP-0000"
                            disabled={activating}
                            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-yellow-300/30 focus:outline-none disabled:opacity-50"
                          />

                          <button
                            onClick={handleActivate}
                            disabled={activating}
                            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-yellow-300 to-amber-400 px-4 py-2.5 text-sm font-bold text-[#172018] transition hover:-translate-y-0.5 disabled:opacity-50"
                          >
                            {activating ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Crown className="h-4 w-4" />
                            )}
                            开通
                          </button>
                        </div>

                        {error && (
                          <p className="mt-2 text-[11px] text-red-400">
                            {error}
                          </p>
                        )}

                        {justActivated && (
                          <p className="mt-2 flex items-center gap-1 text-[11px] text-emerald-300">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            VIP 开通成功！🎉
                          </p>
                        )}

                        <p className="mt-2 text-[10px] leading-4 text-white/25">
                          激活码由管理员发放。演示环境可在后端控制台查看启动时生成的激活码。
                        </p>
                      </div>

                      {/* 客服引导：人工收款购买 */}

                      <div className="mt-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.04] p-4">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-white/70">
                          <Users className="h-3.5 w-3.5 text-emerald-300/80" />
                          还没有激活码？联系客服购买
                        </p>

                        <p className="mt-2 text-[10px] leading-4 text-white/35">
                          加客服微信 → 转账对应金额 → 10 分钟内收到激活码，粘贴上方即可开通。
                          <span className="mt-1 block text-yellow-200/75">🎁 首次购买月卡仅 ¥9.9（每位用户限享一次）</span>
                        </p>

                        {/* 价格表 */}

                        <div className="mt-2.5 flex gap-2">
                          {pricePlans.map((p) => (
                            <div
                              key={p.label}
                              className="flex-1 rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5 text-center"
                            >
                              <p className="text-[9px] text-white/40">{p.label}</p>
                              <p className="text-[11px] font-bold text-white/80">
                                ¥{p.amount}
                              </p>
                            </div>
                          ))}
                        </div>

                        {/* 客服微信号 + 复制 */}

                        <button
                          onClick={copyWechat}
                          className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-300/[0.08] px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-300/[0.14]"
                        >
                          {copiedWechat ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              已复制，去微信粘贴添加
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              复制客服微信号：{SUPPORT_CONFIG.wechatId}
                            </>
                          )}
                        </button>

                        {SUPPORT_CONFIG.groupQrUrl && (
                          <div className="mt-2.5 flex flex-col items-center gap-1.5">
                            <img
                              src={SUPPORT_CONFIG.groupQrUrl}
                              alt="客服群二维码"
                              className="h-28 w-28 rounded-lg border border-white/10"
                            />
                            <p className="text-[9px] text-white/30">
                              扫码加入泰语学习交流群
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* 权益列表 */}

              <div className="mt-5 space-y-2.5">
                {benefits.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.text}
                      className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3"
                    >
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-400/[0.08]">
                        <Icon className="h-4 w-4 text-emerald-300" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">
                          {item.text}
                        </p>

                        <p className="mt-0.5 text-[10px] text-white/30">
                          {item.desc}
                        </p>
                      </div>

                      <Check className="h-4 w-4 flex-shrink-0 text-emerald-300/60" />
                    </div>
                  );
                })}
              </div>

              {/* 免费说明 */}

              <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <p className="text-[11px] leading-5 text-white/35">
                  免费用户仍可学习
                  <span className="text-white/60"> 3 门基础课程 </span>
                  与
                  <span className="text-white/60"> VIP 课程试看视频</span>
                  ，随时可以升级。
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
