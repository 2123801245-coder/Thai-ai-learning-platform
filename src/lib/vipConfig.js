// ============================================================
// ThaiAI 全站共享：VIP 价格表 + 客服联系方式
//
// 修改这里即可同步到所有入口：
//   - VipPanel（VIP 面板：在线支付价格 / 激活码客服引导）
//   - Settings（设置中心：VIP 与购买信息）
//
// 人工收款期（无执照）：
//   用户加客服微信 → 转账对应金额 → 10 分钟内收到激活码 → 粘贴开通。
// ============================================================

/* 客服联系方式（人工收款引导）——按需修改这里即可：
   wechatId    你的客服微信号（加好友购买）
   groupQrUrl  客服群/收款码二维码图片，放 public/ 目录后填路径
               （如 "/support-qr.png"）；留空则只显示微信号
   purchaseTip 客服话术：发给用户的开通引导 */
export const SUPPORT_CONFIG = {
  wechatId: "ThaiAI_Official",
  groupQrUrl: "", // 例："/support-qr.png"
  purchaseTip:
    "感谢购买 ThaiAI VIP 🎉\n你的激活码：{CODE}\n开通方式：登录后 → 我的 → VIP 会员 → 激活码 → 粘贴输入 → 立即开通\n有问题随时找我！",
};

/* 默认价格表（元）——在线支付可用时以后端套餐价为准；
   后端未配置时使用此默认价（与后端 VIP_PLANS 默认一致） */
export const FIRST_PURCHASE_PLAN = {
  label: "首充月卡",
  days: 30,
  amount: 9.9,
};

export const DEFAULT_PLANS = [
  { label: "月度", days: 30, amount: 49 },
  { label: "季度", days: 90, amount: 128 },
  { label: "年度", days: 365, amount: 399 },
];

/* 生成「购买话术」：用户一键复制后粘贴到微信发给客服
   plans 传入 [{ label, days, amount }, ...]（可传后端实时价格） */
export function buildPurchaseScript(plans = DEFAULT_PLANS) {
  const priceLine = [FIRST_PURCHASE_PLAN, ...plans]
    .map((p) => `${p.label} ¥${p.amount}（${p.days} 天）`)
    .join(" · ");

  return (
    `你好，我想购买 ThaiAI VIP 会员 🎉\n` +
    `客服微信号：${SUPPORT_CONFIG.wechatId}\n` +
    `套餐价格：${priceLine}\n` +
    `请问怎么付款？`
  );
}

/* 复制文本：优先 Clipboard API，失败退回 execCommand（无 https 环境兼容） */
export function copyText(text) {
  return new Promise((resolve) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => resolve(true))
        .catch(() => resolve(fallbackCopy(text)));
    } else {
      resolve(fallbackCopy(text));
    }
  });
}

function fallbackCopy(text) {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch (err) {
    return false;
  }
}
