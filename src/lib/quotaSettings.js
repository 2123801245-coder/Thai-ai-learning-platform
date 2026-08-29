// =========================================================
// 免费额度设置（管理员）—— 设置中心可视化调整
//
// 读取 / 更新 /api/admin/settings，持久化到后端 settings 表。
// 未配置的额度项返回 null，消费方自动回退到环境变量 / 默认值。
// =========================================================

import { API_BASE_URL } from "@/lib/api";

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/* 读取全部额度设置 */
export async function getQuotaSettings() {
  const response = await fetch(`${API_BASE_URL}/admin/settings`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "读取额度设置失败");
  }

  return response.json();
}

/* 更新额度设置，例如 { speakingFreeDaily: 15, newsListeningFreeDaily: 20 }
   传 null / "" 可清除该设置（回退到环境变量 / 默认值） */
export async function updateQuotaSettings(patch) {
  const response = await fetch(`${API_BASE_URL}/admin/settings`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "更新额度设置失败");
  }

  return response.json();
}
