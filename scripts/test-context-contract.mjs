import assert from "node:assert/strict";
import { buildContextSystemPrompt, normalizeContextOptions } from "../backend/contextPrompts.js";
import { normalizeThaiContext } from "../src/lib/thaiContext.js";
import { buildAiTeacherRequest, requireAiTeacherResponse } from "../src/lib/aiTeacherContext.js";

const validCases = [
  ["explain", "casual", "bangkok"],
  ["natural", "polite", "office"],
  ["culture", "very-formal", "couple"],
];

for (const [task, tone, persona] of validCases) {
  assert.deepEqual(normalizeContextOptions({ task, tone, persona }), { task, tone, persona });
  const prompt = buildContextSystemPrompt({ task, tone, persona });
  assert.match(prompt, /Native Feeling/);
  assert.match(prompt, /场景与关系/);
  assert.match(prompt, /为什么不能直译/);
  assert.match(prompt, /不要编造百分比/);
}

assert.deepEqual(
  normalizeContextOptions({ task: "invalid", tone: "invalid", persona: "invalid" }),
  { task: "explain", tone: "natural", persona: "bangkok" }
);

const contextRequest = buildAiTeacherRequest({
  message: "ใช่ว่า...",
  action: "chat",
  task: "natural",
  tone: "polite",
  persona: "office",
  profile: { level: "beginner" },
  history: [{ role: "user", content: "ก่อนหน้านี้" }],
});
assert.deepEqual(contextRequest, {
  message: "ใช่ว่า...",
  action: "context",
  task: "natural",
  tone: "polite",
  persona: "office",
  profile: { level: "beginner" },
  history: [{ role: "user", content: "ก่อนหน้านี้" }],
});

const chatRequest = buildAiTeacherRequest({ message: "สวัสดี", action: "chat" });
assert.deepEqual(chatRequest, {
  message: "สวัสดี",
  action: "chat",
  profile: {},
  history: [],
});
assert.equal(requireAiTeacherResponse({ data: { response: "  好的  " } }), "好的");
assert.throws(() => requireAiTeacherResponse({ data: { response: { text: "错误结构" } } }), /无效内容/);
assert.throws(() => requireAiTeacherResponse({ data: {} }), /无效内容/);

const legacy = normalizeThaiContext({
  thai_word: "旧词",
  chinese_meaning: "旧释义",
  example_thai: "ตัวอย่าง",
  example_chinese: "例句",
});
assert.equal(legacy.source, "legacy");
assert.equal(legacy.coreMeaning, "旧释义");
assert.equal(legacy.naturalness.label, "待补充");
assert.equal(legacy.relationships.length, 6);
assert.match(legacy.naturalness.note, /不代表/);

const curated = normalizeThaiContext({ thai_word: "ใช่ว่า..." });
assert.equal(curated.source, "curated");
assert.ok(curated.whyNotLiteral);

const unauthenticatedRequests = [
  { action: "context", task: "natural" },
  { action: "chat" },
];
for (const request of unauthenticatedRequests) {
  const response = await fetch("https://thai-ai.online/api/ai/teacher", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "ใช่ว่า...", ...request }),
  });
  assert.equal(response.status, 401, `未登录 ${request.action} 应返回 401，实际为 ${response.status}`);
}

console.log("Thai Context contract tests passed (including live unauthenticated boundaries)");
