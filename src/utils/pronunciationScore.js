/**
 * 泰语朗读匹配评分
 *
 * 注意：
 * 这里评分的是：
 * 「浏览器语音识别结果」与「目标文本」之间的匹配程度。
 *
 * 它不是专业声学/声调分析。
 */

/**
 * 清理文本
 */
export function normalizeThaiText(text = "") {
  return String(text)
    .trim()
    .toLowerCase()
    // 去掉标点、空格以及部分特殊符号
    .replace(
      /[\s.,!?;:'"“”‘’()（）[\]{}<>《》、，。！？；：·…\-—_]/g,
      ""
    );
}

/**
 * Levenshtein 编辑距离
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from(
    { length: m + 1 },
    () => new Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }

  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost =
        a[i - 1] === b[j - 1] ? 0 : 1;

      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

/**
 * 计算两个泰语文本的匹配度
 */
export function calculatePronunciationScore(
  targetText = "",
  recognizedText = ""
) {
  const target = normalizeThaiText(targetText);
  const recognized = normalizeThaiText(recognizedText);

  if (!target && !recognized) {
    return 0;
  }

  if (!target) {
    return 0;
  }

  if (!recognized) {
    return 0;
  }

  if (target === recognized) {
    return 100;
  }

  const distance = levenshtein(
    target,
    recognized
  );

  const maxLength = Math.max(
    target.length,
    recognized.length
  );

  if (maxLength === 0) {
    return 0;
  }

  const similarity =
    1 - distance / maxLength;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(similarity * 100)
    )
  );
}

/**
 * 根据分数生成反馈
 */
export function getPronunciationFeedback(
  score,
  targetText,
  recognizedText
) {
  if (!recognizedText) {
    return {
      level: "再试一次",
      feedback:
        "没有识别到清晰的泰语语音。请靠近麦克风，再大声、清晰地朗读一次。",
      tips:
        "先点击“听标准发音”，然后模仿标准发音的声调、长短音和节奏。",
    };
  }

  if (score >= 95) {
    return {
      level: "非常准确",
      feedback:
        `识别结果与目标「${targetText}」高度一致，朗读匹配度非常好。`,
      tips:
        "可以继续练习自然语速和泰语声调，让发音更加自然。",
    };
  }

  if (score >= 85) {
    return {
      level: "很好",
      feedback:
        `整体朗读比较准确。系统识别为「${recognizedText}」，与目标「${targetText}」比较接近。`,
      tips:
        "继续注意声调、长短元音以及词尾辅音。",
    };
  }

  if (score >= 70) {
    return {
      level: "还不错",
      feedback:
        `识别结果为「${recognizedText}」，与目标「${targetText}」存在一些差异。`,
      tips:
        "建议重新听一次标准发音，重点模仿每个音节的声调和长短。",
    };
  }

  if (score >= 50) {
    return {
      level: "需要练习",
      feedback:
        `系统识别为「${recognizedText}」，与目标「${targetText}」差异比较明显。`,
      tips:
        "先降低朗读速度，一个音节一个音节地练习，不要急着连读。",
    };
  }

  return {
    level: "再练一次",
    feedback:
      `系统没有准确识别目标词。识别结果为「${recognizedText}」。`,
    tips:
      "请先听标准发音，再大声朗读。重点注意声调、长短元音和词尾辅音。",
  };
}