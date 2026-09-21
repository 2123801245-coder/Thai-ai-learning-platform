// 临时验收：Hub 选择 → 自动并入学习路线（真跑路线引擎，非 mock）
import { getSelectedTracks, setSelectedTracks } from "@/lib/professionalTracks";
import { generateLearningPath } from "@/lib/learningPath";

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

const profile = {
  thaiLevel: "A2",
  learningGoal: "travel",
  professionalDirection: [],
  mediaInterest: ["drama"],
  learningStyle: ["visual"],
  targetScenario: "机场值机 · 酒店入住",
  testDetail: {},
};

const label = (path) =>
  path.stages
    .map((stage) => `${stage.id}${stage.source === "track" ? "★" : ""}`)
    .join(" → ");

console.log("[1] 未选方向:", label(generateLearningPath(profile)));

setSelectedTracks(["business", "news", "newmedia"]);
const after = generateLearningPath(profile);

console.log("[2] 选中 商务+新闻+新媒体:", label(after));
console.log(
  "    三个方向全部进路线:",
  ["business", "news", "newmedia"].every((id) =>
    after.stages.some((stage) => stage.id === id && stage.source === "track")
  )
);
console.log("    阶段总数（≤5）:", after.stageCount);
console.log(
  "    专业方向字段:",
  JSON.stringify(after.professionalTracks.map((t) => `${t.emoji}${t.title}(${t.moduleCount})`))
);

const trackStage = after.stages.find((stage) => stage.source === "track");
console.log(
  "    阶段详情:",
  JSON.stringify({
    id: trackStage.id,
    title: trackStage.title,
    why: trackStage.why,
    emoji: trackStage.trackEmoji,
    modules: trackStage.modules.map((m) => `${m.title}/${m.level}/${m.lessons}节`),
    hours: trackStage.hours,
    cta: trackStage.cta,
    to: trackStage.to,
  })
);

console.log(
  "    自动阶段仍在（goal/media）:",
  after.stages.filter((stage) => stage.source !== "track").map((stage) => stage.id)
);

/* Hub 选择与入学画像方向并存：两者都进路线且不重复 */
setSelectedTracks(["tourism"]);
const mixed = generateLearningPath({ ...profile, professionalDirection: ["academic"] });
console.log("[3] Hub=旅游服务 + 画像=学术:", label(mixed));

/* 只选一个方向时路线依然完整（不塌陷） */
setSelectedTracks(["news"]);
const single = generateLearningPath({ ...profile, mediaInterest: [] });
console.log("[4] 只选新闻:", label(single), "| 阶段数:", single.stageCount);

/* 清空选择 → 回到画像驱动 */
setSelectedTracks([]);
console.log("[5] 清空后:", label(generateLearningPath(profile)));

/* 上限保护：超过 3 个方向时截断 */
setSelectedTracks(["academic", "tourism", "news", "business"]);
console.log(
  "[6] 超过上限时截断:",
  JSON.stringify(getSelectedTracks()),
  "| 路线阶段数:",
  generateLearningPath({ ...profile, professionalDirection: [], mediaInterest: [] }).stageCount
);
