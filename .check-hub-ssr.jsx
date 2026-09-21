// 临时验收：ThaiProfessionalHub 真实 DOM 渲染（含已选方向的路线并入展示）
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import ThaiProfessionalHub from "@/pages/ThaiProfessionalHub";

const PROFILE_KEY = "thai_ai_user_profile_v1";
const TRACK_KEY = "thai_ai_professional_tracks_v1";

const store = new Map([
  [
    PROFILE_KEY,
    JSON.stringify({
      userId: null,
      profile: {
      thaiLevel: "A2",
      learningGoal: "study",
      professionalDirection: [],
      mediaInterest: ["drama"],
      learningStyle: ["visual", "listening"],
      targetScenario: "校园选课 · 小组讨论",
      testDetail: {},
      },
    }),
  ],
  [
    TRACK_KEY,
    JSON.stringify({ tracks: ["business", "news"], updatedAt: "2026-09-19T00:00:00.000Z" }),
  ],
]);

globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

const html = renderToStaticMarkup(
  <MemoryRouter>
    <ThaiProfessionalHub />
  </MemoryRouter>
);

const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const checks = [
  ["页面标题", "专业泰语 · 自由组合方向"],
  ["方向统计", "5 个方向"],
  ["已选计数", "已选 2 / 3"],
  ["已选方向 chip（商务）", "商务泰语"],
  ["已选方向 chip（新闻）", "新闻泰语"],
  ["路线并入区块", "已并入我的学习路线"],
  ["路线阶段卡片（商务）", "5 个内容板块 · 预计 10 小时"],
  ["路线阶段标记", "已在路线"],
  ["板块 chip 带难度", "商务交流 B1"],
  ["五个方向区块", "五个专业方向"],
  ["学术方向", "学术泰语"],
  ["旅游服务方向", "旅游服务泰语"],
  ["新媒体方向", "新媒体泰语"],
  ["板块说明文案", "网络流行语"],
  ["专题课区块", "来自 professional_courses"],
  ["专题课本地兜底", "政策词汇"],
  ["入口按钮文案", "选择这个方向"],
];

let pass = 0;

for (const [name, needle] of checks) {
  const ok = text.includes(needle);
  if (ok) pass += 1;
  console.log(`${ok ? "PASS" : "MISS"}  ${name}  「${needle}」`);
}

console.log(`\n命中 ${pass}/${checks.length}`);

/* 诊断：路线区块到底走了哪个分支 */
const idx = text.indexOf("已并入我的学习路线");
console.log("\n[route 区块片段]", text.slice(idx, idx + 260));
console.log(
  "分支：",
  ["正在装配路线", "路线需要先知道你的泰语等级", "选中方向后"].filter((s) =>
    text.includes(s)
  ).join(" / ") || "已渲染阶段卡片"
);
console.log("内容板块字样:", /个内容板块/.test(text), "| 预计:", /预计/.test(text));
console.log("未选方向的引导存在:", text.includes("还没有选方向"));
console.log("渲染字符数:", html.length);
