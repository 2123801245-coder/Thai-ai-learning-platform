import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

export default async function (req: Request) {
  try {
    // ============================================================
    // 1. 初始化 Base44
    // ============================================================

    const base44 = createClientFromRequest(req);

    // ============================================================
    // 2. 登录验证
    // ============================================================

    const user = await base44.auth.me();

    if (!user) {
      return Response.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    // ============================================================
    // 3. 获取请求参数
    // ============================================================

    const body = await req.json();

    const audio_url = body?.audio_url;
    const target_text = body?.target_text;

    if (!audio_url || !target_text) {
      return Response.json(
        {
          error: "Missing audio_url or target_text",
        },
        {
          status: 400,
        }
      );
    }

    // ============================================================
    // 4. 清理文本
    // ============================================================

    const normalizeThai = (text: string) => {
      return String(text || "")
        .trim()
        .toLowerCase()
        // 删除空格
        .replace(/\s+/g, "")
        // 删除常见标点
        .replace(
          /[.,!?，。！？、；：:;"'“”‘’()[\]{}<>《》「」『』]/g,
          ""
        );
    };

    const target = normalizeThai(target_text);

    // ============================================================
    // 5. 语音识别
    // ============================================================

    let transcription = "";

    try {
      const result =
        await base44.asServiceRole.integrations.Core.TranscribeAudio({
          audio_url,
        });

      transcription = String(result?.text || "").trim();
    } catch (error) {
      console.error(
        "TranscribeAudio error:",
        error
      );

      return Response.json(
        {
          error: "语音识别失败，请重新录音",
          details:
            error instanceof Error
              ? error.message
              : String(error),
        },
        {
          status: 500,
        }
      );
    }

    // ============================================================
    // 6. 没有识别到内容
    // ============================================================

    if (!transcription) {
      return Response.json({
        transcription: "",
        score: 0,
        feedback:
          "没有清楚识别到你的发音。请靠近麦克风，再清晰地朗读一次。",
        tips:
          "建议先听一遍标准发音，然后放慢速度，完整读出每一个音节。",
      });
    }

    const recognized =
      normalizeThai(transcription);

    // ============================================================
    // 7. 完全相同
    // ============================================================

    if (recognized === target) {
      return Response.json({
        transcription,
        score: 100,
        feedback:
          "语音识别结果与目标词完全一致，说明你朗读得非常完整。",
        tips:
          "继续保持。下一步可以重点注意泰语声调、长短元音以及送气与不送气辅音的细节。",
      });
    }

    // ============================================================
    // 8. Levenshtein 编辑距离
    //
    // 用于计算两个泰语字符串之间需要多少次：
    // 插入 / 删除 / 替换
    //
    // 例如：
    //
    // target:      ภาษา
    // recognized:  ภาสา
    //
    // 可以计算两者有多接近。
    // ============================================================

    const levenshteinDistance = (
      a: string,
      b: string
    ): number => {
      const aChars = Array.from(a);
      const bChars = Array.from(b);

      const rows = aChars.length + 1;
      const cols = bChars.length + 1;

      const matrix: number[][] = Array.from(
        {
          length: rows,
        },
        () => Array(cols).fill(0)
      );

      for (let i = 0; i < rows; i++) {
        matrix[i][0] = i;
      }

      for (let j = 0; j < cols; j++) {
        matrix[0][j] = j;
      }

      for (let i = 1; i < rows; i++) {
        for (let j = 1; j < cols; j++) {
          const cost =
            aChars[i - 1] === bChars[j - 1]
              ? 0
              : 1;

          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j - 1] + cost
          );
        }
      }

      return matrix[rows - 1][cols - 1];
    };

    // ============================================================
    // 9. 计算文本相似度
    // ============================================================

    const distance = levenshteinDistance(
      target,
      recognized
    );

    const maxLength = Math.max(
      Array.from(target).length,
      Array.from(recognized).length
    );

    let similarity = 0;

    if (maxLength > 0) {
      similarity =
        1 - distance / maxLength;
    }

    similarity = Math.max(
      0,
      Math.min(1, similarity)
    );

    // ============================================================
    // 10. 长度差异
    // ============================================================

    const targetLength =
      Array.from(target).length;

    const recognizedLength =
      Array.from(recognized).length;

    const lengthDifference =
      Math.abs(
        targetLength -
          recognizedLength
      );

    // ============================================================
    // 11. 基础评分
    //
    // 不使用 AI。
    //
    // 相似度：
    // 100% → 100
    // 90%  → 90左右
    // 70%  → 70左右
    // 50%  → 50左右
    //
    // 同时根据长度差进行轻微修正。
    // ============================================================

    let score =
      similarity * 100;

    // 长度明显不一致时额外扣分
    if (
      targetLength > 0 &&
      lengthDifference >= 1
    ) {
      score -= 5;
    }

    if (
      targetLength > 0 &&
      lengthDifference >= 2
    ) {
      score -= 8;
    }

    if (
      targetLength > 0 &&
      lengthDifference >= 3
    ) {
      score -= 10;
    }

    // ============================================================
    // 12. 特殊情况处理
    // ============================================================

    // 完全没有重合
    if (
      similarity <= 0.2
    ) {
      score = Math.min(
        score,
        25
      );
    }

    // 只有一点相似
    else if (
      similarity <= 0.4
    ) {
      score = Math.min(
        score,
        45
      );
    }

    // ============================================================
    // 13. 限制分数范围
    // ============================================================

    score = Math.round(
      Math.max(
        0,
        Math.min(
          100,
          score
        )
      )
    );

    // ============================================================
    // 14. 生成反馈
    // ============================================================

    let feedback = "";
    let tips = "";

    if (score >= 95) {
      feedback =
        "朗读结果与目标词非常接近，整体识别准确，发音完成度很好。";

      tips =
        "继续保持。下一步可以重点练习声调的准确性，以及长短元音的区别。";
    } else if (score >= 85) {
      feedback =
        "整体朗读比较准确，目标词的大部分音节都被正确识别。还有少量细节可以继续调整。";

      tips =
        "建议再听一遍标准发音，重点注意声调、长短元音以及每个音节的完整度。";
    } else if (score >= 70) {
      feedback =
        "基本能够读出目标词，但语音识别结果与目标词存在一定差异，部分音节可能没有读清楚。";

      tips =
        "建议降低朗读速度，把每个音节读完整，再逐渐恢复正常语速。";
    } else if (score >= 50) {
      feedback =
        "能够识别出部分目标发音，但存在比较明显的音节差异。";

      tips =
        "建议先反复听标准发音，再分音节慢速跟读，不要一次追求完整速度。";
    } else if (score >= 30) {
      feedback =
        "当前朗读与目标词存在较明显差异，部分音节可能遗漏、替换或没有被清楚识别。";

      tips =
        "建议重新听标准发音，逐个音节模仿，然后再进行完整朗读。";
    } else {
      feedback =
        "当前语音识别结果与目标词差异较大，暂时无法判断为准确朗读。";

      tips =
        "请先听标准发音，然后放慢速度，清楚、完整地读出目标词。";
    }

    // ============================================================
    // 15. 如果识别结果长度明显不同
    // ============================================================

    if (
      lengthDifference >= 2
    ) {
      feedback +=
        " 另外，识别到的音节数量与目标词存在明显差异。";
    } else if (
      lengthDifference === 1
    ) {
      feedback +=
        " 另外，有一个音节可能没有被完整识别。";
    }

    // ============================================================
    // 16. 返回结果
    // ============================================================

    return Response.json({
      transcription,
      score,
      feedback,
      tips,
    });
  } catch (error) {
    console.error(
      "analyzePronunciation error:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}