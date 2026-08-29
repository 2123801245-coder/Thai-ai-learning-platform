// ============================================================
// VIP 过期自动失效任务
//
// 定期扫描 users 表，把已过期的 VIP 会员 is_vip 置 0，
// 让到期后的内容锁定自动恢复（不依赖前端判断）。
//
// - 启动时立即执行一次
// - 之后按 VIP_EXPIRY_CHECK_INTERVAL_MS 周期执行（默认 30 分钟）
// - vip_expires_at 为 UTC 时间（YYYY-MM-DD HH:mm:ss），
//   与 SQLite datetime('now') 同格式，可直接字符串比较
// ============================================================

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000; // 30 分钟

// 单次检查：把所有已过期但仍标记为 VIP 的用户置为普通用户
// 返回被失效的用户数
function expireOverdueVip(db) {
  return new Promise((resolve, reject) => {
    db.run(
      `
      UPDATE users
      SET is_vip = 0
      WHERE is_vip = 1
        AND vip_expires_at IS NOT NULL
        AND vip_expires_at != ''
        AND vip_expires_at <= datetime('now')
      `,
      function (err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes || 0);
      }
    );
  });
}

// 启动定时检查：
// 1. 启动时立即跑一次（清理遗留的过期 VIP）
// 2. 之后按间隔周期执行
function startVipExpiryCheck(db) {
  // 未设置时使用默认间隔（30 分钟）；设置 0 则禁用定时检查
  const rawInterval = Number(
    process.env.VIP_EXPIRY_CHECK_INTERVAL_MS
  );
  const intervalMs =
    Number.isFinite(rawInterval) && rawInterval >= 0
      ? rawInterval
      : DEFAULT_INTERVAL_MS;

  const run = async (label) => {
    try {
      const count = await expireOverdueVip(db);
      if (count > 0) {
        console.log(
          `[VIP 过期检查] ${label}：已将 ${count} 个过期 VIP 会员降级为免费用户`
        );
      }
    } catch (err) {
      console.error(
        "[VIP 过期检查] 执行失败：",
        err.message || err
      );
    }
  };

  // 启动时立即执行一次
  run("启动检查");

  if (intervalMs > 0) {
    setInterval(() => {
      run("定时检查");
    }, intervalMs);

    console.log(
      `[VIP 过期检查] 已启动，每 ${Math.round(
        intervalMs / 60000
      )} 分钟检查一次过期 VIP`
    );
  } else {
    console.log(
      "[VIP 过期检查] VIP_EXPIRY_CHECK_INTERVAL_MS 未设置或为 0，仅启动时执行一次"
    );
  }
}

export { expireOverdueVip, startVipExpiryCheck };
