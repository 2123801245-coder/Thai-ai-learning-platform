// src/hooks/usePracticeReward.js
//
// =========================================================
// 练习结算层 · usePracticeReward
// =========================================================
//
// 解决的问题（审计结论 Top 1）
// --------------------------
// `/vocabulary` 的六种练习模式**一个都不写学习进度**：
//
//   VocabMatch   只做 setScore(s => s + 10 + streak * 2)
//   SentenceFill 只做 setScore(s => s + 10)
//   WordSegment  只做 setScore(s => s + 15)
//
// 这三个 score 是组件内存状态，刷新即清零，且永远不进
// `useLearningProgress`（XP / 连续天数 / 今日目标的唯一写入口）。
// 结果：用户在主力页面练一整天，等级与连续天数一动不动；
// 只有去 `/loop` 练才算数。同一个站里「练词汇」有两种结算结果。
//
// 另外三个模式对「答错」的处理也不一致——VocabMatch 与 SentenceFill
// 调 recordWrongWord，WordSegment 不调，于是分词练错的词永久丢失。
//
// 这一层把两件事收敛成一句话：
//
//   const reward = usePracticeReward();
//   reward.correct(word);   // +XP / +今日词量 / +连续天数
//   reward.wrong(word);     // 记错题本（本地主存储，任何环境都可用）
//
// 约定
// ----
//   • 传入的 word 用**练习页的通用形状**（thai/roman/chinese/sentence/sentenceCn），
//     本层负责转成 useLearningProgress 认识的结构，页面不需要知道。
//   • 答题瞬间就要出反馈，所以写入是 fire-and-forget，不阻塞 UI。
//   • 同一题重复点不重复计分：由页面自己保证每题只结算一次，
//     这里额外用一个 key 集合兜底（含"重练"场景会 reset）。
//   • 不做任何 UI —— 分数展示仍由各练习页自己负责。

import { useCallback, useRef } from "react";

import { useLearningProgress } from "@/hooks/useLearningProgress";
import { recordWrongWord } from "@/lib/wordBooks";

/** 练习页通用词形状 → useLearningProgress 期望的形状 */
function toProgressWord(word) {
  if (!word) return null;
  return {
    thai_word: word.thai || word.thai_word || "",
    pronunciation: word.roman || word.pronunciation || "",
    chinese_meaning: word.chinese || word.chinese_meaning || "",
    example_thai: word.sentence || word.example_thai || "",
    example_chinese: word.sentenceCn || word.example_chinese || "",
  };
}

/** 词的身份键：结算去重用（同一个词只用一次，跨题不重复） */
function wordKey(word) {
  return (word?.thai || word?.thai_word || "").trim();
}

export function usePracticeReward() {
  const { recordKnown, recordUnknown } = useLearningProgress();

  /* 已结算过的词：避免"连点两下同一张卡"重复加 XP */
  const settled = useRef(new Set());

  /** 答对：计入 XP / 今日词量 / 连续天数 */
  const correct = useCallback(
    (word) => {
      const key = wordKey(word);
      if (key && settled.current.has(key)) return false;
      if (key) settled.current.add(key);

      const payload = toProgressWord(word);
      if (!payload?.thai_word) return false;

      Promise.resolve(recordKnown(payload)).catch(() => {});
      return true;
    },
    [recordKnown]
  );

  /** 答错：记进错题本（本地主存储） */
  const wrong = useCallback((word) => {
    const key = wordKey(word);
    if (key && settled.current.has(key)) return false;
    if (key) settled.current.add(key);

    if (key) {
      Promise.resolve(
        recordWrongWord({
          thai: key,
          roman: word?.roman || word?.pronunciation || "",
          chinese: word?.chinese || word?.chinese_meaning || "",
          sentence: word?.sentence || word?.example_thai || "",
          sentenceCn: word?.sentenceCn || word?.example_chinese || "",
        })
      ).catch(() => {});
    }
    return true;
  }, []);

  /**
   * 统一入口：一个动作同时完成「计 XP」与「记错题」。
   * 返回 true 表示这次结算生效（未被去重拦掉）。
   */
  const settle = useCallback(
    (word, isCorrect) => (isCorrect ? correct(word) : wrong(word)),
    [correct, wrong]
  );

  /**
   * 重新开始一轮练习时清空去重记录。
   * 否则"重练错题"第二轮不再计分——那是错的行为。
   */
  const resetRound = useCallback(() => {
    settled.current = new Set();
  }, []);

  return { correct, wrong, settle, resetRound };
}

export default usePracticeReward;
