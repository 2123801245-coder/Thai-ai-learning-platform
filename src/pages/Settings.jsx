import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Settings as SettingsIcon,
  User,
  Bell,
  Volume2,
  Shield,
  ChevronRight,
  Bot,
  Loader2,
  Check,
  AlertCircle,
  Crown,
  Copy,
  MessageCircle,
  CalendarClock,
  Mic,
  Newspaper,
  Gauge,
} from "lucide-react";

import { useAuth } from "@/lib/AuthContext";
import {
  useFeatureFlag,
  updateFeatureFlag,
} from "@/lib/features";
import {
  SUPPORT_CONFIG,
  DEFAULT_PLANS,
  FIRST_PURCHASE_PLAN,
  copyText,
} from "@/lib/vipConfig";
import {
  getQuotaSettings,
  updateQuotaSettings,
} from "@/lib/quotaSettings";
import AppearanceSettings from "@/components/theme/AppearanceSettings";

const sections = [
  {
    title: "账户设置",
    items: [
      {
        label: "个人资料",
        description: "修改昵称、头像等个人信息",
        icon: User,
      },
    ],
  },
  {
    title: "学习设置",
    items: [
      {
        label: "学习提醒",
        description: "设置每日学习提醒",
        icon: Bell,
      },
      {
        label: "发音设置",
        description: "调整泰语语音播放速度",
        icon: Volume2,
      },
    ],
  },
  {
    title: "隐私与安全",
    items: [
      {
        label: "账户安全",
        description: "管理登录与账户安全",
        icon: Shield,
      },
    ],
  },
];

/* =========================================================
   VIP 与购买信息（价格表 + 客服引导）
   与 VipPanel 共用 src/lib/vipConfig.js，全站一处维护
========================================================= */

function VipInfoPanel() {
  const [copied, setCopied] = useState(false);

  const copyWechat = async () => {
    const ok = await copyText(SUPPORT_CONFIG.wechatId);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-3xl border border-yellow-300/[0.15] bg-gradient-to-br from-yellow-400/[0.05] via-white/[0.03] to-emerald-400/[0.04] backdrop-blur-xl"
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-yellow-300" />
          <p className="text-xs font-semibold text-yellow-200/80">
            VIP 会员与购买
          </p>
        </div>

        <span className="rounded-full border border-yellow-300/20 bg-yellow-300/[0.08] px-2 py-0.5 text-[9px] font-semibold text-yellow-200/70">
          解锁全部进阶内容
        </span>
      </div>

      <div className="px-5 py-4">
        <div className="mb-3 rounded-xl border border-yellow-300/25 bg-yellow-300/[0.07] px-3 py-2 text-[11px] leading-5 text-yellow-100/80">
          🎁 {FIRST_PURCHASE_PLAN.label}：首次购买仅 ¥{FIRST_PURCHASE_PLAN.amount}，每位用户限享一次
        </div>

        {/* 价格表 */}

        <div className="grid grid-cols-3 gap-2">
          {DEFAULT_PLANS.map((p) => (
            <div
              key={p.days}
              className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-3 text-center"
            >
              <p className="flex items-center justify-center gap-1 text-[11px] font-semibold text-white/60">
                <Crown className="h-3 w-3 text-yellow-300/70" />
                {p.label}会员
              </p>
              <p className="mt-1 text-lg font-black text-white">
                ¥{p.amount}
              </p>
              <p className="mt-0.5 text-[10px] text-white/30">
                {p.days} 天
              </p>
            </div>
          ))}
        </div>

        {/* 购买流程 */}

        <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white/60">
            <MessageCircle className="h-3.5 w-3.5 text-emerald-300/70" />
            如何购买
          </p>
          <p className="mt-1.5 text-[11px] leading-5 text-white/40">
            加客服微信 → 转账对应金额 →
            <span className="text-white/60"> 10 分钟内收到激活码</span>
            ，在「VIP 会员 → 激活码」粘贴即可开通。
          </p>
        </div>

        {/* 客服微信号 + 复制 */}

        <button
          onClick={copyWechat}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-yellow-300/25 bg-yellow-300/[0.08] px-4 py-2.5 text-xs font-semibold text-yellow-200 transition hover:bg-yellow-300/[0.14]"
        >
          {copied ? (
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
          <div className="mt-3 flex flex-col items-center gap-1.5">
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

        {/* 到期说明 */}

        <p className="mt-3 flex items-center gap-1.5 text-[10px] text-white/25">
          <CalendarClock className="h-3 w-3" />
          到期前 3 天会收到续费提醒；到期后免费课程仍可学习。
        </p>
      </div>
    </motion.div>
  );
}

/* =========================================================
   管理员功能管理：AI 老师可视化开关（无需改代码）
========================================================= */

function AdminFeaturePanel() {
  const { user } = useAuth();
  const aiTeacher = useFeatureFlag("aiTeacher");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  /* 仅管理员可见 */

  if (user?.role !== "admin") {
    return null;
  }

  const handleToggle = async () => {
    setSaving(true);
    setMessage(null);

    try {
      await updateFeatureFlag("aiTeacher", !aiTeacher);

      setMessage({
        type: "success",
        text: aiTeacher
          ? "AI 老师已隐藏，全站入口即时移除。"
          : "AI 老师已开放，全站入口即时恢复。",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "更新失败，请重试",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-3xl border border-yellow-300/[0.12] bg-gradient-to-br from-yellow-400/[0.05] via-white/[0.03] to-emerald-400/[0.04] backdrop-blur-xl"
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-yellow-300" />
          <p className="text-xs font-semibold text-yellow-200/80">
            功能管理（管理员）
          </p>
        </div>

        <span className="rounded-full border border-yellow-300/20 bg-yellow-300/[0.08] px-2 py-0.5 text-[9px] font-semibold text-yellow-200/70">
          即时生效
        </span>
      </div>

      <div className="px-5 py-4">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-300/15 bg-emerald-400/[0.08]">
            <Bot className="h-5 w-5 text-emerald-300" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-white/85">
                AI 老师
              </p>

              <span
                className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${
                  aiTeacher
                    ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-200"
                    : "border-white/[0.08] bg-white/[0.04] text-white/35"
                }`}
              >
                {aiTeacher ? "已开放" : "已隐藏"}
              </span>
            </div>

            <p className="mt-1 text-xs leading-5 text-white/30">
              开启后：首页显示 AI 老师卡片、侧边栏出现「对话练习」入口、移动端出现「对话」tab。
              关闭后入口即时移除（路由与数据保留）。
            </p>
          </div>

          {/* 开关 */}

          <button
            type="button"
            onClick={handleToggle}
            disabled={saving}
            aria-label="切换 AI 老师功能"
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 disabled:opacity-60 ${
              aiTeacher
                ? "bg-gradient-to-r from-emerald-400 to-teal-400"
                : "bg-white/[0.10]"
            }`}
          >
            <span
              className={`absolute top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md transition-all duration-300 ${
                aiTeacher ? "left-6" : "left-1"
              }`}
            >
              {saving && (
                <Loader2 className="h-3 w-3 animate-spin text-emerald-500" />
              )}
            </span>
          </button>
        </div>

        {message && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
              message.type === "success"
                ? "border-emerald-300/20 bg-emerald-400/[0.06] text-emerald-200"
                : "border-red-400/20 bg-red-400/[0.06] text-red-200"
            }`}
          >
            {message.type === "success" ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5" />
            )}
            {message.text}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/* =========================================================
   管理员免费额度管理：口语 / 新闻听力每日免费次数
   （无需改代码，保存后即时生效；留空回退环境变量 / 默认值）
========================================================= */

function AdminQuotaPanel() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [speakingInput, setSpeakingInput] = useState("");
  const [newsInput, setNewsInput] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  /* 仅管理员可见 */

  if (user?.role !== "admin") {
    return null;
  }

  /* 首次挂载读取当前配置 */

  React.useEffect(() => {
    let alive = true;
    getQuotaSettings()
      .then((data) => {
        if (!alive) return;
        setSettings(data || {});
        setSpeakingInput(data?.speakingFreeDaily ?? "");
        setNewsInput(data?.newsListeningFreeDaily ?? "");
      setAiInput(data?.aiTeacherFreeDaily ?? "");
        setAiInput(data?.aiTeacherFreeDaily ?? "");
      })
      .catch(() => {
        if (!alive) return;
        setMessage({
          type: "error",
          text: "读取额度设置失败，请检查网络",
        });
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage(null);

    const patch = {};
    if (speakingInput.trim() !== "") {
      const n = Number(speakingInput);
      if (!Number.isInteger(n) || n < 0) {
        setMessage({ type: "error", text: "口语每日次数必须是非负整数" });
        setSaving(false);
        return;
      }
      patch.speakingFreeDaily = n;
    } else {
      patch.speakingFreeDaily = null; // 清除 → 回退默认
    }

    if (newsInput.trim() !== "") {
      const n = Number(newsInput);
      if (!Number.isInteger(n) || n < 0) {
        setMessage({ type: "error", text: "新闻听力每日题数必须是非负整数" });
        setSaving(false);
        return;
      }
      patch.newsListeningFreeDaily = n;
    } else {
      patch.newsListeningFreeDaily = null;
    }

    if (aiInput.trim() !== "") {
      const n = Number(aiInput);
      if (!Number.isInteger(n) || n < 0) {
        setMessage({ type: "error", text: "AI 老师每日对话次数必须是非负整数" });
        setSaving(false);
        return;
      }
      patch.aiTeacherFreeDaily = n;
    } else {
      patch.aiTeacherFreeDaily = null;
    }

    try {
      const data = await updateQuotaSettings(patch);
      setSettings(data || {});
      setSpeakingInput(data?.speakingFreeDaily ?? "");
      setNewsInput(data?.newsListeningFreeDaily ?? "");
      setMessage({
        type: "success",
        text: "额度已更新，全站即时生效（已配置额度优先于环境变量）",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "更新失败，请重试",
      });
    } finally {
      setSaving(false);
    }
  };

  const quotaRow = (label, desc, Icon, value, onChange, configured) => (
    <div className="flex items-start gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-300/15 bg-emerald-400/[0.08]">
        <Icon className="h-5 w-5 text-emerald-300" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-white/85">{label}</p>
          <span
            className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${
              configured
                ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-200"
                : "border-white/[0.08] bg-white/[0.04] text-white/35"
            }`}
          >
            {configured ? `已配置 ${value}` : "使用默认（10）"}
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-white/30">{desc}</p>
      </div>
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="留空 = 默认"
        className="w-24 shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-center text-sm font-semibold text-white outline-none placeholder:text-[10px] placeholder:text-white/20 focus:border-emerald-300/40"
      />
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-3xl border border-yellow-300/[0.12] bg-gradient-to-br from-yellow-400/[0.05] via-white/[0.03] to-emerald-400/[0.04] backdrop-blur-xl"
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-yellow-300" />
          <p className="text-xs font-semibold text-yellow-200/80">
            免费额度管理（管理员）
          </p>
        </div>

        <span className="rounded-full border border-yellow-300/20 bg-yellow-300/[0.08] px-2 py-0.5 text-[9px] font-semibold text-yellow-200/70">
          即时生效
        </span>
      </div>

      <div className="space-y-4 px-5 py-4">
        {!loaded ? (
          <div className="flex items-center gap-2 py-3 text-xs text-white/30">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-300" />
            读取当前额度配置…
          </div>
        ) : (
          <>
            {quotaRow(
              "口语练习（单词模式）",
              "免费用户每天可练的次数，超出提示开通 VIP；VIP 不受限制。",
              Mic,
              speakingInput,
              setSpeakingInput,
              settings?.speakingFreeDaily != null
            )}

            {quotaRow(
              "新闻听力（听音填空）",
              "免费用户每天可做的题数，超出提示开通 VIP；VIP 无限。",
              Newspaper,
              newsInput,
              setNewsInput,
              settings?.newsListeningFreeDaily != null
            )}

            {quotaRow(
              "AI 老师（自由对话）",
              "免费用户每天可自由对话的次数，超出提示开通 VIP；VIP 无限。",
              Bot,
              aiInput,
              setAiInput,
              settings?.aiTeacherFreeDaily != null
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                保存设置
              </button>
              <p className="text-[10px] leading-4 text-white/25">
                留空保存 = 恢复服务器默认（环境变量或 10），修改立即生效无需重启。
              </p>
            </div>
          </>
        )}

        {message && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
              message.type === "success"
                ? "border-emerald-300/20 bg-emerald-400/[0.06] text-emerald-200"
                : "border-red-400/20 bg-red-400/[0.06] text-red-200"
            }`}
          >
            {message.type === "success" ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5" />
            )}
            {message.text}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default function Settings() {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl space-y-6">

      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-emerald-300/70">
          <SettingsIcon className="h-4 w-4" />
          THAI AI SETTINGS
        </div>

        <h1 className="mt-3 text-3xl font-black text-white">
          设置中心
        </h1>

        <p className="mt-2 text-sm text-white/40">
          管理你的 ThaiAI 学习体验
        </p>
      </motion.div>

      {/* 外观与主题（Theme Studio） */}

      <AppearanceSettings />

      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => navigate("/plan")} className="premium-glass card-lift flex items-center justify-between rounded-2xl p-4 text-left">
          <span><span className="block text-sm font-semibold text-white/85">学习计划</span><span className="mt-1 block text-[11px] text-white/35">管理每日目标与连续学习</span></span><span className="text-emerald-300">→</span>
        </button>
        <button type="button" onClick={() => navigate("/ranking")} className="premium-glass card-lift flex items-center justify-between rounded-2xl p-4 text-left">
          <span><span className="block text-sm font-semibold text-white/85">学习排行榜</span><span className="mt-1 block text-[11px] text-white/35">查看学习进度与排名</span></span><span className="text-yellow-200">→</span>
        </button>
      </div>

      {/* VIP 与购买信息（价格表 + 客服引导） */}

      <VipInfoPanel />

      {/* 管理员功能管理（仅管理员可见） */}

      <AdminFeaturePanel />

      {/* 管理员免费额度管理（仅管理员可见） */}

      <AdminQuotaPanel />

      <div className="space-y-4">

        {sections.map((section, sectionIndex) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: sectionIndex * 0.08 }}
            className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.035] backdrop-blur-xl"
          >

            <div className="border-b border-white/[0.06] px-5 py-4">
              <p className="text-xs font-semibold text-white/40">
                {section.title}
              </p>
            </div>

            {section.items.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.label}
                  className="flex w-full items-center gap-4 border-b border-white/[0.04] px-5 py-4 text-left transition hover:bg-white/[0.04] last:border-0"
                >

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/[0.08]">
                    <Icon className="h-4 w-4 text-emerald-300" />
                  </div>

                  <div className="flex-1">
                    <p className="text-sm font-medium text-white/80">
                      {item.label}
                    </p>

                    <p className="mt-1 text-xs text-white/25">
                      {item.description}
                    </p>
                  </div>

                  <ChevronRight className="h-4 w-4 text-white/20" />

                </button>
              );
            })}

          </motion.div>
        ))}

      </div>

    </div>
  );
}
