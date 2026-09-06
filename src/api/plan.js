// src/api/plan.js
// 学习计划 / 连续打卡 / 7 天 VIP 奖励 API 客户端
import api from "./auth";

// 获取计划概览（连续天数 / 本周打卡 / 奖励进度）
export const getPlanOverview = () => api.get("/plan/overview");

// 每日打卡（完成计划后同步到服务端，连续 7 天解锁 3 天 VIP）
// data: { date?, completedTasks, totalTasks, planCompleted }
export const checkInPlan = (data) => api.post("/plan/checkin", data);
