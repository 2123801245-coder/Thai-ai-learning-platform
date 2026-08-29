import {
  createNotification,
} from "./routes/notifications.js";

// ============================================================
// VIP 开通共享服务
//
// 激活码（auth.js /vip/activate）与 Stripe 支付（payments.js）
// 共用同一套「叠加到期时间 + 写库 + 写通知」逻辑，保证行为一致。
// ============================================================

/**
 * 为用户叠加 VIP 天数（已是 VIP 时在现有到期时间上累加）。
 * @param {object} db sqlite3 数据库实例
 * @param {number} userId 用户 id
 * @param {number} days 开通天数
 * @param {string} source 开通来源：code / stripe
 * @returns {Promise<{expiresAtStr: string, ok: boolean}>}
 */
export function extendVipDays(db, userId, days, source) {
  return new Promise((resolve, reject) => {
    const amount = Number(days);

    if (!Number.isFinite(amount) || amount <= 0) {
      return reject(new Error("天数不合法"));
    }

    db.get(
      `
      SELECT is_vip, vip_expires_at
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [userId],
      (selectErr, user) => {
        if (selectErr || !user) {
          return reject(new Error("用户不存在"));
        }

        const now = Date.now();
        let base = now;

        if (user.is_vip && user.vip_expires_at) {
          const existing = new Date(
            String(user.vip_expires_at).replace(" ", "T") + "Z"
          );

          if (existing.getTime() > now) {
            base = existing.getTime();
          }
        }

        const expiresAt = new Date(
          base + amount * 24 * 60 * 60 * 1000
        );

        const expiresAtStr = expiresAt
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");

        db.run(
          `
          UPDATE users
          SET is_vip = 1,
              vip_expires_at = ?
          WHERE id = ?
          `,
          [expiresAtStr, userId],
          (updateErr) => {
            if (updateErr) {
              return reject(updateErr);
            }

            const channelLabel = {
              wechat: "微信支付",
              alipay: "支付宝",
              card: "在线支付（卡）",
              stripe: "在线支付",
            }[source] || "激活码";

            createNotification({
              userId,
              type: "VIP 提醒",
              title: "VIP 会员已激活",
              content: `欢迎加入 VIP！会员有效期至 ${expiresAtStr.slice(
                0,
                10
              )}，解锁全部课程、口语评测与高级功能`,
              icon: "👑",
              action: "vip",
              key: "vip-activated",
            });

            resolve({
              expiresAtStr,
              ok: true,
              sourceLabel: channelLabel,
            });
          }
        );
      }
    );
  });
}
