// src/pages/AdminCodes.jsx

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  KeyRound,
  Plus,
  Download,
  RefreshCw,
  Copy,
  Check,
  Crown,
  ShieldCheck,
  Search,
  Zap,
  History,
  ReceiptText,
  Pencil,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  adminGenerateCodes,
  adminListCodes,
  adminExportCodes,
  adminListLedger,
  adminCreateLedger,
  adminUpdateLedger,
  adminExportLedger,
} from "@/api/auth";

/* =========================================================
   管理端：激活码发码页
   - 批量生成（数量 / 天数 / 前缀）
   - 列表查看（未使用 / 已使用 / 全部）
   - 一键复制、导出 CSV
========================================================= */

const STATUS_TABS = [
  { key: "all", label: "全部" },
  { key: "unused", label: "未使用" },
  { key: "used", label: "已使用" },
];

/* 套餐快捷生成（配合人工收款：月/季/年） */
const QUICK_PLANS = [
  { label: "首充月卡", days: 30, price: 9.9, firstPurchase: true },
  { label: "月度", days: 30, price: 49 },
  { label: "季度", days: 90, price: 128 },
  { label: "年度", days: 365, price: 399 },
];

export default function AdminCodes() {
  const navigate = useNavigate();

  const [count, setCount] = useState(1);
  const [days, setDays] = useState(30);
  const [prefix, setPrefix] = useState("THAI-VIP");

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [genResult, setGenResult] = useState(null);

  const [status, setStatus] = useState("all");
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState("");
  const [ledger, setLedger] = useState([]);
  const [ledgerForm, setLedgerForm] = useState({ customerName: "", customerContact: "", amount: "49", planDays: 30, vipCodeId: "", status: "paid", note: "" });
  const [ledgerBusy, setLedgerBusy] = useState(false);
  const [ledgerError, setLedgerError] = useState("");

  // =====================================================
  // 加载列表
  // =====================================================

  const load = async () => {
    setLoading(true);
    setLoadError("");

    try {
      const res = await adminListCodes(status);
      setCodes(res.data?.codes || []);
    } catch (err) {
      setLoadError(
        err?.response?.data?.message || "加载失败"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const loadLedger = async () => {
    try {
      const res = await adminListLedger();
      setLedger(res.data?.records || []);
    } catch (error) {
      setLedgerError(error?.response?.data?.message || "对账记录加载失败");
    }
  };

  useEffect(() => { loadLedger(); }, []);

  const handleCreateLedger = async (event) => {
    event.preventDefault();
    setLedgerBusy(true);
    setLedgerError("");
    try {
      await adminCreateLedger(ledgerForm);
      setLedgerForm((current) => ({ ...current, customerName: "", customerContact: "", vipCodeId: "", note: "" }));
      await loadLedger();
    } catch (error) {
      setLedgerError(error?.response?.data?.message || "保存对账记录失败");
    } finally { setLedgerBusy(false); }
  };

  const updateLedgerStatus = async (id, nextStatus) => {
    try { await adminUpdateLedger(id, { status: nextStatus }); await loadLedger(); }
    catch (error) { setLedgerError(error?.response?.data?.message || "更新失败"); }
  };

  const handleExportLedger = async () => {
    try {
      const res = await adminExportLedger();
      downloadCsv(res, `sales-ledger-${Date.now()}.csv`);
    } catch (error) { setLedgerError(error?.response?.data?.message || "导出失败"); }
  };

  // =====================================================
  // 生成
  // =====================================================

  const handleGenerate = async () => {
    if (count < 1 || count > 500) {
      setGenError("数量需在 1 ~ 500 之间");
      return;
    }

    if (days < 1 || days > 3650) {
      setGenError("天数需在 1 ~ 3650 之间");
      return;
    }

    setGenerating(true);
    setGenError("");
    setGenResult(null);

    try {
      const res = await adminGenerateCodes({
        count,
        days,
        prefix,
      });

      setGenResult(res.data);

      // 生成后刷新列表
      load();
    } catch (err) {
      setGenError(
        err?.response?.data?.message || "生成失败"
      );
    } finally {
      setGenerating(false);
    }
  };

  // =====================================================
  // 导出 CSV
  // =====================================================

  const downloadCsv = (res, filename) => {
    const blob = new Blob([res.data], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    setExporting(true);

    try {
      const res = await adminExportCodes(status);
      downloadCsv(res, `vip-codes-${status}-${Date.now()}.csv`);
    } catch (err) {
      alert(
        err?.response?.data?.message || "导出失败"
      );
    } finally {
      setExporting(false);
    }
  };

  // 导出全部发码历史台账（含使用者 / 使用时间，用于对账）
  const handleExportHistory = async () => {
    setExporting(true);

    try {
      const res = await adminExportCodes("all");
      downloadCsv(res, `vip-code-history-${Date.now()}.csv`);
    } catch (err) {
      alert(
        err?.response?.data?.message || "导出失败"
      );
    } finally {
      setExporting(false);
    }
  };

  // =====================================================
  // 按套餐一键生成（人工收款：点一下 → 生成 → 自动复制）
  // =====================================================

  const handleQuickGenerate = async (days) => {
    setGenerating(true);
    setGenError("");
    setGenResult(null);

    try {
      const n = Math.min(Math.max(count || 1, 1), 500);
      const res = await adminGenerateCodes({
        count: n,
        days,
        prefix,
      });

      setGenResult(res.data);

      // 自动复制生成的码，运营者直接粘贴到微信发给用户
      const newCodes = res.data?.codes || [];
      if (newCodes.length > 0) {
        await navigator.clipboard
          ?.writeText(newCodes.join("\n"))
          .then(() => {
            setCopied("__quick__");
            setTimeout(() => setCopied(""), 2500);
          })
          .catch(() => {});
      }

      load();
    } catch (err) {
      setGenError(
        err?.response?.data?.message || "生成失败"
      );
    } finally {
      setGenerating(false);
    }
  };

  // =====================================================
  // 复制
  // =====================================================

  const copyCode = (code) => {
    navigator.clipboard
      ?.writeText(code)
      .then(() => {
        setCopied(code);
        setTimeout(() => setCopied(""), 1500);
      })
      .catch(() => {});
  };

  const copyAll = () => {
    const text = codes
      .filter((c) => !c.used_by)
      .map((c) => c.code)
      .join("\n");

    if (!text) return;

    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied("__all__");
        setTimeout(() => setCopied(""), 1500);
      })
      .catch(() => {});
  };

  const inputCls =
    "w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-yellow-300/30 focus:outline-none";

  return (
    <div className="relative min-h-screen text-white">
      <main className="relative z-10 mx-auto max-w-4xl px-4 py-6 pb-28 sm:px-6">
        {/* 返回 */}

        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-white/35 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </button>

        {/* 标题 */}

        <div className="mt-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-yellow-300/20 bg-gradient-to-br from-yellow-300/[0.12] to-amber-500/[0.06]">
            <ShieldCheck className="h-5 w-5 text-yellow-300" />
          </div>

          <div>
            <h1 className="text-xl font-black">
              激活码管理
            </h1>
            <p className="mt-0.5 text-xs text-white/35">
              批量生成、导出 VIP 激活码（管理员）
            </p>
          </div>
        </div>

        {/* ===================== 生成表单 ===================== */}

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] shadow-xl backdrop-blur-xl"
        >
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-4">
            <Plus className="h-4 w-4 text-emerald-300" />
            <h2 className="text-sm font-semibold">
              批量生成
            </h2>
          </div>

          {/* 按套餐一键生成（配合人工收款） */}

          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-5 py-3">
            <span className="flex items-center gap-1 text-[11px] text-white/35">
              <Zap className="h-3 w-3 text-yellow-300/70" />
              按套餐一键生成（数量取上方「数量」值）
            </span>

            {QUICK_PLANS.map((p) => (
              <button
                key={p.days}
                onClick={() => handleQuickGenerate(p.days)}
                disabled={generating}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-40 ${p.firstPurchase ? "border-yellow-200/40 bg-yellow-300/[0.16] text-yellow-100" : "border-yellow-300/25 bg-yellow-300/[0.07] text-yellow-200/90 hover:bg-yellow-300/[0.14]"}`}
              >
                <Crown className="h-3 w-3" />
                {p.label} {p.days} 天 · ¥{p.price}
              </button>
            ))}

            {copied === "__quick__" && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-300">
                <Check className="h-3 w-3" />
                已生成并复制，直接粘贴到微信发送
              </span>
            )}
          </div>

          <div className="grid gap-4 px-5 py-5 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-[11px] text-white/40">
                数量
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={count}
                onChange={(e) =>
                  setCount(Number(e.target.value))
                }
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] text-white/40">
                有效天数
              </label>
              <input
                type="number"
                min={1}
                max={3650}
                value={days}
                onChange={(e) =>
                  setDays(Number(e.target.value))
                }
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] text-white/40">
                前缀
              </label>
              <input
                value={prefix}
                onChange={(e) =>
                  setPrefix(e.target.value)
                }
                placeholder="THAI-VIP"
                className={inputCls}
              />
            </div>
          </div>

          {genError && (
            <p className="px-5 pb-2 text-[11px] text-red-400">
              {genError}
            </p>
          )}

          {genResult && (
            <div className="mx-5 mb-2 rounded-xl border border-emerald-300/15 bg-emerald-400/[0.06] px-4 py-3">
              <p className="text-xs text-emerald-200">
                {genResult.message}
              </p>
              <p className="mt-1 break-all font-mono text-[11px] leading-5 text-emerald-100/60">
                {genResult.codes?.join("  ")}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 border-t border-white/[0.06] px-5 py-4">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-300 to-amber-400 px-5 py-2.5 text-sm font-bold text-[#172018] transition hover:-translate-y-0.5 disabled:opacity-50"
            >
              {generating ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              {generating ? "生成中..." : "生成激活码"}
            </button>

            <button
              onClick={copyAll}
              disabled={codes.length === 0}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/55 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-30"
            >
              {copied === "__all__" ? (
                <Check className="h-4 w-4 text-emerald-300" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              复制未使用
            </button>
          </div>
        </motion.section>

        {/* ===================== 列表 ===================== */}

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] shadow-xl backdrop-blur-xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-emerald-300" />
              <h2 className="text-sm font-semibold">
                激活码列表
              </h2>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] text-white/35">
                {codes.length} 条
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* 状态切换 */}

              <div className="flex rounded-lg border border-white/[0.08] bg-black/20 p-0.5">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setStatus(tab.key)}
                    className={`rounded-md px-3 py-1.5 text-[11px] transition ${
                      status === tab.key
                        ? "bg-emerald-400/15 text-emerald-200"
                        : "text-white/35 hover:text-white/60"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/55 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
              >
                {exporting ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                导出 CSV
              </button>

              <button
                onClick={handleExportHistory}
                disabled={exporting}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-300/20 bg-emerald-400/[0.06] px-3 py-1.5 text-[11px] text-emerald-200/80 transition hover:bg-emerald-400/[0.12] hover:text-emerald-100 disabled:opacity-40"
              >
                {exporting ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <History className="h-3 w-3" />
                )}
                导出全部台账
              </button>

              <button
                onClick={load}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/55 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
              >
                <RefreshCw
                  className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
                />
                刷新
              </button>
            </div>
          </div>

          {loadError && (
            <div className="px-5 py-4">
              <p className="text-xs text-red-400">
                {loadError}
              </p>
            </div>
          )}

          {!loadError && (
            <div className="max-h-[420px] divide-y divide-white/[0.04] overflow-y-auto">
              {codes.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <KeyRound className="mx-auto h-6 w-6 text-white/15" />
                  <p className="mt-3 text-xs text-white/30">
                    暂无激活码，先生成一批吧
                  </p>
                </div>
              ) : (
                codes.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono text-[13px] font-semibold text-emerald-100">
                          {item.code}
                        </span>

                        {item.used_by ? (
                          <span className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] text-white/35">
                            <Crown className="h-2.5 w-2.5" />
                            {item.duration_days} 天
                          </span>
                        ) : (
                          <span className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-300/15 bg-emerald-400/[0.07] px-2 py-0.5 text-[9px] text-emerald-200/70">
                            未使用 · {item.duration_days} 天
                          </span>
                        )}
                      </div>

                      <p className="mt-0.5 truncate text-[10px] text-white/25">
                        {item.used_by
                          ? `已使用 · ${item.used_by_email || "用户 #" + item.used_by} · ${item.used_at || ""}`
                          : `生成于 ${item.created_at || ""}`}
                      </p>
                    </div>

                    {!item.used_by && (
                      <button
                        onClick={() => copyCode(item.code)}
                        className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] text-white/45 transition hover:bg-white/[0.08] hover:text-white"
                      >
                        {copied === item.code ? (
                          <Check className="h-3 w-3 text-emerald-300" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        {copied === item.code ? "已复制" : "复制"}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </motion.section>

        {/* ===================== 收款对账 ===================== */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6 overflow-hidden rounded-2xl border border-yellow-300/10 bg-white/[0.035] shadow-xl backdrop-blur-xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-2"><ReceiptText className="h-4 w-4 text-yellow-300" /><h2 className="text-sm font-semibold">收款对账</h2><span className="text-[10px] text-white/30">手动记录 · 自动关联激活码使用情况</span></div>
            <button type="button" onClick={handleExportLedger} className="flex items-center gap-1.5 rounded-lg border border-yellow-300/20 bg-yellow-300/[0.06] px-3 py-1.5 text-[11px] text-yellow-100/80 transition hover:bg-yellow-300/[0.12]"><Download className="h-3 w-3" />导出台账</button>
          </div>
          <form onSubmit={handleCreateLedger} className="grid gap-3 border-b border-white/[0.06] px-5 py-4 sm:grid-cols-4">
            <input className={inputCls} placeholder="用户/昵称" value={ledgerForm.customerName} onChange={(e) => setLedgerForm({ ...ledgerForm, customerName: e.target.value })} />
            <input className={inputCls} placeholder="微信/联系方式" value={ledgerForm.customerContact} onChange={(e) => setLedgerForm({ ...ledgerForm, customerContact: e.target.value })} />
            <input className={inputCls} type="number" min="0" step="0.01" placeholder="金额（元）" value={ledgerForm.amount} onChange={(e) => setLedgerForm({ ...ledgerForm, amount: e.target.value })} />
            <select className={inputCls} value={ledgerForm.planDays} onChange={(e) => setLedgerForm({ ...ledgerForm, planDays: Number(e.target.value) })}><option value={30}>月度 / 30天</option><option value={90}>季度 / 90天</option><option value={365}>年度 / 365天</option></select>
            <input className={inputCls} placeholder="关联激活码 ID（可选）" value={ledgerForm.vipCodeId} onChange={(e) => setLedgerForm({ ...ledgerForm, vipCodeId: e.target.value })} />
            <select className={inputCls} value={ledgerForm.status} onChange={(e) => setLedgerForm({ ...ledgerForm, status: e.target.value })}><option value="paid">已收款</option><option value="pending">待收款</option><option value="refunded">已退款</option><option value="cancelled">已取消</option></select>
            <input className={`${inputCls} sm:col-span-2`} placeholder="备注（可选）" value={ledgerForm.note} onChange={(e) => setLedgerForm({ ...ledgerForm, note: e.target.value })} />
            <button disabled={ledgerBusy} className="rounded-xl bg-gradient-to-r from-yellow-300 to-amber-400 px-4 py-2 text-sm font-bold text-[#172018] disabled:opacity-50">{ledgerBusy ? "保存中…" : "记录收款"}</button>
          </form>
          {ledgerError && <p className="px-5 py-2 text-xs text-red-300">{ledgerError}</p>}
          <div className="max-h-[360px] overflow-y-auto">
            {ledger.length === 0 ? <p className="px-5 py-8 text-center text-xs text-white/30">还没有对账记录</p> : ledger.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center gap-3 border-b border-white/[0.04] px-5 py-3 text-xs">
                <div className="min-w-[120px] flex-1"><div className="font-medium text-white/85">{row.customer_name || "未填写用户"}</div><div className="mt-1 text-[10px] text-white/30">{row.customer_contact || "—"} · {row.created_at}</div></div>
                <span className="text-yellow-200">¥{(row.amount_cents / 100).toFixed(2)}</span><span className="text-white/50">{row.plan_days}天</span><span className="font-mono text-emerald-200/80">{row.vip_code || "未关联"}</span>
                <span className={`rounded-full px-2 py-1 text-[10px] ${row.status === "paid" ? "bg-emerald-400/10 text-emerald-200" : "bg-white/[0.06] text-white/50"}`}>{row.status === "paid" ? "已收款" : row.status === "pending" ? "待收款" : row.status === "refunded" ? "已退款" : "已取消"}</span>
                {row.status === "pending" && <button type="button" onClick={() => updateLedgerStatus(row.id, "paid")} className="text-[10px] text-emerald-300 hover:text-emerald-200">标记已收</button>}
              </div>
            ))}
          </div>
        </motion.section>

        {/* 说明 */}

        <p className="mt-5 text-[10px] leading-5 text-white/20">
          激活码为一次性使用；已使用的码不可再次生成。
          导出 CSV 已包含中文 BOM，可直接用 Excel 打开。
        </p>
      </main>
    </div>
  );
}
