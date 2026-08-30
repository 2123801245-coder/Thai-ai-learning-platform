import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import db from "../database.js";
import { authenticate } from "./auth.js";
import { getQuotaSetting } from "./features.js";
import { createNotification } from "./notifications.js";

const router = express.Router();

/* ============================================================
   VIP 鉴权
============================================================ */

function isVipActive(user) {
  if (!user || !user.is_vip) return false;

  if (!user.vip_expires_at) return false;

  const expiry = new Date(
    String(user.vip_expires_at).replace(" ", "T") + "Z"
  );

  if (Number.isNaN(expiry.getTime())) return false;

  return expiry.getTime() > Date.now();
}

/* ============================================================
   单词模式免费额度
   （每天每用户 N 次；超出提示开通 VIP。）
   优先级：设置中心管理员配置 > 环境变量 SPEAKING_FREE_DAILY > 默认 10
============================================================ */

function getFreeWordDaily() {
  return getQuotaSetting(
    "speakingFreeDaily",
    Number(process.env.SPEAKING_FREE_DAILY) || 10
  );
}

/* 泰国时区（GMT+7）的今天，格式 YYYY-MM-DD */
function todayBangkok() {
  const now = new Date(
    Date.now() + 7 * 3600 * 1000
  );

  return now.toISOString().slice(0, 10);
}

function getWordUsage(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT word_count FROM speaking_usage WHERE user_id = ? AND usage_date = ?",
      [userId, todayBangkok()],
      (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.word_count : 0);
      }
    );
  });
}

function incrementWordUsage(userId) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO speaking_usage (user_id, usage_date, word_count)
       VALUES (?, ?, 1)
       ON CONFLICT(user_id, usage_date)
       DO UPDATE SET word_count = word_count + 1`,
      [userId, todayBangkok()],
      (err) => (err ? reject(err) : resolve())
    );
  });
}

/* 返回给前端的配额信息 */
async function quotaPayload(userId) {
  const used = await getWordUsage(userId);
  const freeWordDaily = await getFreeWordDaily();

  return {
    freeWordDaily,
    usedToday: used,
    remainingToday: Math.max(0, freeWordDaily - used),
  };
}



/* ============================================================
   当前文件目录
============================================================ */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ============================================================
   上传目录
   backend/uploads/speaking
============================================================ */

const uploadsDir = path.join(
  __dirname,
  "..",
  "uploads",
  "speaking"
);

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, {
    recursive: true,
  });
}

/* ============================================================
   Multer
============================================================ */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },

  filename: (req, file, cb) => {
    const ext =
      path.extname(file.originalname) || ".webm";

    const filename =
      `speaking-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}${ext}`;

    cb(null, filename);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 15 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    const allowed = [
      "audio/webm",
      "audio/wav",
      "audio/wave",
      "audio/x-wav",
      "audio/mpeg",
      "audio/mp3",
      "audio/mp4",
      "audio/m4a",
      "audio/ogg",
      "audio/aac",
    ];

    if (
      allowed.includes(file.mimetype) ||
      file.mimetype.startsWith("audio/")
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `不支持的音频格式：${file.mimetype}`
        )
      );
    }
  },
});

/* ============================================================
   文本标准化
============================================================ */

function normalizeThai(text = "") {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(
      /[.,!?，。！？、；：:;"'“”‘’()[\]{}<>《》「」『』]/g,
      ""
    );
}

/* ============================================================
   Levenshtein Distance
============================================================ */

function levenshteinDistance(a, b) {
  const aChars = Array.from(a);
  const bChars = Array.from(b);

  const matrix = Array.from(
    {
      length: aChars.length + 1,
    },
    () =>
      Array(
        bChars.length + 1
      ).fill(0)
  );

  for (
    let i = 0;
    i <= aChars.length;
    i++
  ) {
    matrix[i][0] = i;
  }

  for (
    let j = 0;
    j <= bChars.length;
    j++
  ) {
    matrix[0][j] = j;
  }

  for (
    let i = 1;
    i <= aChars.length;
    i++
  ) {
    for (
      let j = 1;
      j <= bChars.length;
      j++
    ) {
      const cost =
        aChars[i - 1] ===
        bChars[j - 1]
          ? 0
          : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[
    aChars.length
  ][bChars.length];
}

/* ============================================================
   根据识别结果计算基础评分
============================================================ */

function calculateScore(
  targetText,
  transcription
) {
  const target =
    normalizeThai(targetText);

  const recognized =
    normalizeThai(transcription);

  if (!target || !recognized) {
    return {
      score: 0,
      similarity: 0,
      feedback:
        "没有清楚识别到你的发音。",
      tips:
        "请靠近麦克风，先听一遍标准发音，然后清晰、完整地朗读。",
    };
  }

  if (target === recognized) {
    return {
      score: 100,
      similarity: 1,
      feedback:
        "语音识别结果与目标词完全一致，朗读完成度很好。",
      tips:
        "继续保持。接下来可以进一步注意泰语声调、长短元音以及送气与不送气辅音。",
    };
  }

  const distance =
    levenshteinDistance(
      target,
      recognized
    );

  const targetLength =
    Array.from(target).length;

  const recognizedLength =
    Array.from(recognized).length;

  const maxLength = Math.max(
    targetLength,
    recognizedLength
  );

  let similarity =
    maxLength === 0
      ? 0
      : 1 -
        distance /
          maxLength;

  similarity = Math.max(
    0,
    Math.min(1, similarity)
  );

  let score =
    similarity * 100;

  const lengthDifference =
    Math.abs(
      targetLength -
        recognizedLength
    );

  if (lengthDifference === 1) {
    score -= 4;
  }

  if (lengthDifference === 2) {
    score -= 8;
  }

  if (lengthDifference >= 3) {
    score -= 12;
  }

  if (similarity <= 0.2) {
    score = Math.min(
      score,
      25
    );
  } else if (
    similarity <= 0.4
  ) {
    score = Math.min(
      score,
      45
    );
  }

  score = Math.round(
    Math.max(
      0,
      Math.min(100, score)
    )
  );

  let feedback;
  let tips;

  if (score >= 90) {
    feedback =
      "整体朗读非常接近目标词，语音识别结果基本准确。";

    tips =
      "继续保持。可以进一步练习泰语声调和元音长短，让发音更加自然。";
  } else if (score >= 80) {
    feedback =
      "整体发音比较准确，目标词的大部分音节都被正确识别。";

    tips =
      "建议再听一次标准发音，重点模仿声调和音节结尾。";
  } else if (score >= 60) {
    feedback =
      "基本能够读出目标词，但部分音节与标准发音存在差异。";

    tips =
      "建议放慢速度，把每一个音节完整读出来，再逐渐恢复正常语速。";
  } else if (score >= 40) {
    feedback =
      "当前朗读与目标词存在比较明显的差异，部分音节可能没有读清楚。";

    tips =
      "建议先听标准发音，再进行分音节跟读。";
  } else {
    feedback =
      "当前识别结果与目标词差异较大，暂时无法判断为准确朗读。";

    tips =
      "请重新听标准发音，并慢速、清晰地完整朗读目标词。";
  }

  if (lengthDifference >= 2) {
    feedback +=
      " 识别到的音节数量与目标词存在明显差异。";
  } else if (
    lengthDifference === 1
  ) {
    feedback +=
      " 可能有一个音节没有被完整识别。";
  }

  return {
    score,
    similarity,
    feedback,
    tips,
  };
}

/* ============================================================
   Azure 发音评估（专业声学评分）

   环境变量：
     SPEECH_KEY       Azure Speech 资源密钥
     SPEECH_REGION    区域，或 SPEECH_ENDPOINT 自定义

   区域写法（自动识别国内版）：
     全球版：eastasia / southeastasia / japaneast …
       → https://{region}.stt.speech.microsoft.com
     国内版（azure.cn 世纪互联）：chinaeast2 / chinanorth2 / chinanorth3 …
       → https://{region}.stt.speech.azure.cn（国内直连、实名注册、F0 免费层）

   音频要求：WAV / PCM / 16kHz / mono（前端 audioRecorder 按此采集）
   评分通过 Pronunciation-Assessment header 传递（base64 JSON）。
============================================================ */

function getSpeechEndpoint() {
  if (process.env.SPEECH_ENDPOINT) {
    return process.env.SPEECH_ENDPOINT.replace(/\/+$/, "");
  }

  const region = process.env.SPEECH_REGION;

  if (!region) return null;

  // azure.cn 世纪互联：区域以 china 开头，端点域名不同
  const host =
    region.startsWith("china") ? "stt.speech.azure.cn" : "stt.speech.microsoft.com";

  return `https://${region}.${host}`;
}

function isAzureConfigured() {
  return Boolean(
    process.env.SPEECH_KEY &&
      getSpeechEndpoint()
  );
}

async function azurePronunciationAssessment(
  filePath,
  referenceText
) {
  if (!isAzureConfigured()) {
    throw new Error(
      "服务器尚未配置 Azure 语音评测（SPEECH_KEY / SPEECH_REGION）。"
    );
  }

  const audioBuffer =
    await fs.promises.readFile(filePath);

  /*
   * Pronunciation-Assessment header：
   * base64(JSON)，Granularity=Phoneme 拿音素级分数，
   * Dimension=Comprehensive 拿流利度/完整度。
   */

  const assessmentParams = JSON.stringify({
    ReferenceText: referenceText,
    GradingSystem: "HundredMark",
    Granularity: "Phoneme",
    Dimension: "Comprehensive",
    EnableMiscue: "True",
  });

  const assessmentHeader = Buffer.from(
    assessmentParams,
    "utf-8"
  ).toString("base64");

  const endpoint = getSpeechEndpoint();

  const url =
    `${endpoint}/speech/recognition/conversation/cognitiveservices/v1` +
    `?language=th-TH&format=detailed`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key":
        process.env.SPEECH_KEY,
      "Content-Type":
        "audio/wav; codecs=audio/pcm; samplerate=16000",
      "Accept": "application/json",
      "Pronunciation-Assessment":
        assessmentHeader,
    },
    body: audioBuffer,
  });

  if (!response.ok) {
    const errorText = await response
      .text()
      .catch(() => "");

    throw new Error(
      `Azure 语音评测错误 ${response.status}: ${errorText}`
    );
  }

  const data = await response.json();

  if (
    data.RecognitionStatus &&
    data.RecognitionStatus !== "Success"
  ) {
    throw new Error(
      `Azure 语音评测未识别到语音：${data.RecognitionStatus}`
    );
  }

  const best = data.NBest?.[0];

  if (!best) {
    throw new Error(
      "Azure 语音评测返回为空。"
    );
  }

  /*
   * 收集词级错误（ErrorType: Omission/Insertion/Mispronunciation）
   * 用于逐词反馈。
   */

  const words = (best.Words || []).map((w) => ({
    word: w.Word || "",
    accuracy: Math.round(w.AccuracyScore ?? 0),
    errorType: w.ErrorType || "None",
    offset: w.Offset || 0,
    duration: w.Duration || 0,
  }));

  return {
    transcription:
      data.DisplayText || best.Display || "",
    accuracy: Math.round(
      best.AccuracyScore ?? 0
    ),
    fluency: Math.round(
      best.FluencyScore ?? 0
    ),
    completeness: Math.round(
      best.CompletenessScore ?? 0
    ),
    score: Math.round(
      best.PronScore ?? best.AccuracyScore ?? 0
    ),
    words,
  };
}

/* ============================================================
   语音识别
============================================================ */

/* ============================================================
   Azure 语音识别（纯转写，无发音评估）
   入参语言如 th-TH / zh-CN / en-US
============================================================ */

async function azureTranscribe(filePath, language) {
  if (!isAzureConfigured()) {
    throw new Error(
      "服务器尚未配置 Azure 语音识别（SPEECH_KEY / SPEECH_REGION）。"
    );
  }

  const audioBuffer = await fs.promises.readFile(filePath);
  const endpoint = getSpeechEndpoint();

  const url =
    `${endpoint}/speech/recognition/conversation/cognitiveservices/v1` +
    `?language=${encodeURIComponent(language || "th-TH")}&format=detailed`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": process.env.SPEECH_KEY,
      "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
      Accept: "application/json",
    },
    body: audioBuffer,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Azure 语音识别错误 ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  if (data.RecognitionStatus && data.RecognitionStatus !== "Success") {
    throw new Error(`Azure 语音识别失败：${data.RecognitionStatus}`);
  }

  const text = (
    data.DisplayText ||
    data.NBest?.[0]?.Display ||
    data.NBest?.[0]?.ITN ||
    ""
  ).trim();

  return text;
}

async function transcribeAudio(
  filePath,
  originalName,
  mimetype,
  language
) {
  const apiUrl =
    process.env.TRANSCRIBE_API_URL;

  /*
   * 如果你还没有配置语音识别服务，
   * 这里不会瞎返回一个分数。
   */

  if (!apiUrl) {
    throw new Error(
      "服务器尚未配置语音识别服务。请设置 TRANSCRIBE_API_URL。"
    );
  }

  const fileBuffer =
    await fs.promises.readFile(
      filePath
    );

  const formData =
    new FormData();

  const blob =
    new Blob(
      [fileBuffer],
      {
        type:
          mimetype ||
          "audio/webm",
      }
    );

  formData.append(
    "file",
    blob,
    originalName ||
      path.basename(filePath)
  );

  /*
   * 明确告诉识别服务：
   * 这是泰语。
   */

  formData.append(
    "language",
    language || "th"
  );

  const response =
    await fetch(
      apiUrl,
      {
        method: "POST",
        body: formData,
        headers:
          process.env
            .TRANSCRIBE_API_KEY
            ? {
                Authorization:
                  `Bearer ${process.env.TRANSCRIBE_API_KEY}`,
              }
            : undefined,
      }
    );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `语音识别服务错误 ${response.status}: ${errorText}`
    );
  }

  const data =
    await response.json();

  /*
   * 兼容几种常见返回结构：
   *
   * { text: "ภาษาไทย" }
   * { transcription: "ภาษาไทย" }
   * { result: { text: "ภาษาไทย" } }
   */

  const transcription =
    data?.text ??
    data?.transcription ??
    data?.result?.text ??
    "";

  return String(
    transcription
  ).trim();
}

/* ============================================================
   POST /api/speaking/analyze
============================================================ */

router.post(
  "/analyze",
  authenticate,
  upload.single("audio"),
  async (req, res) => {
    let uploadedFile = null;

    try {
      /* 练习模式：word 免费（有每日额度）；sentence / paragraph 需 VIP */
      const mode = req.body?.mode || "word";

      let isVip = false;

      if (mode !== "word") {
        const vipUser = await new Promise((resolve, reject) => {
          db.get(
            "SELECT is_vip, vip_expires_at FROM users WHERE id = ?",
            [req.userId],
            (err, user) => (err ? reject(err) : resolve(user))
          );
        });

        if (!vipUser) {
          return res.status(404).json({
            message: "用户不存在",
          });
        }

        isVip = isVipActive(vipUser);

        if (!isVip) {
          return res.status(403).json({
            message:
              "句子 / 段落练习为 VIP 专属功能，请先开通 VIP 会员",
          });
        }
      } else {
        /* 单词模式：VIP 无限次；免费用户每天 FREE_WORD_DAILY 次 */

        const vipUser = await new Promise((resolve, reject) => {
          db.get(
            "SELECT is_vip, vip_expires_at FROM users WHERE id = ?",
            [req.userId],
            (err, user) => (err ? reject(err) : resolve(user))
          );
        });

        isVip =
          vipUser && isVipActive(vipUser);

        if (!isVip) {
          const used =
            await getWordUsage(req.userId);
          const freeWordDaily =
            await getFreeWordDaily();

          if (used >= freeWordDaily) {
            if (uploadedFile?.path) {
              await fs.promises.unlink(
                uploadedFile.path
              ).catch(() => {});
            }

            /* 每日免费额度用尽提醒（同 key 去重：更新原通知而非堆积） */
            createNotification({
              userId: req.userId,
              type: "额度提醒",
              title: "今日口语免费次数已用完",
              content: `今日免费口语练习 ${freeWordDaily} 次已用完，开通 VIP 即可无限练习`,
              icon: "🎙️",
              action: "speaking-quota-exhausted",
              key: "speaking-quota-exhausted",
            });

            return res.status(429).json({
              message:
                `今日免费练习次数已用完（${freeWordDaily} 次），开通 VIP 即可无限练习`,
              used,
              limit: freeWordDaily,
            });
          }
        }
      }

      const targetText =
        req.body?.target_text;

      uploadedFile =
        req.file;

      if (!targetText) {
        if (uploadedFile?.path) {
          await fs.promises.unlink(
            uploadedFile.path
          ).catch(() => {});
        }

        return res.status(400).json({
          error:
            "缺少 target_text",
        });
      }

      if (!uploadedFile) {
        return res.status(400).json({
          error:
            "没有收到音频文件",
        });
      }

      console.log(
        "================================"
      );

      console.log(
        "Speaking analysis"
      );

      console.log(
        "Target:",
        targetText
      );

      console.log(
        "Audio:",
        uploadedFile.filename
      );

      console.log(
        "Size:",
        uploadedFile.size
      );

      console.log(
        "================================"
      );

      // ========================================================
      // 评分来源：Azure 发音评估优先（专业声学评分），
      // 未配置或失败时降级到转写 + 本地近似评分。
      // ========================================================

      const isWav =
        (uploadedFile.mimetype || "").includes(
          "wav"
        ) ||
        (uploadedFile.originalname || "")
          .toLowerCase()
          .endsWith(".wav");

      if (isAzureConfigured() && isWav) {
        try {
          const azure =
            await azurePronunciationAssessment(
              uploadedFile.path,
              targetText
            );

          console.log(
            "Azure assessment:",
            azure
          );

          /* 单词模式免费额度：非 VIP 每次成功评分扣 1 次 */

          if (mode === "word" && !isVip) {
            await incrementWordUsage(
              req.userId
            ).catch(() => {});
          }

          return res.json({
            source: "azure",
            transcription:
              azure.transcription,
            score: azure.score,
            accuracy:
              azure.accuracy,
            fluency:
              azure.fluency,
            completeness:
              azure.completeness,
            words: azure.words,
            feedback:
              azure.score >= 90
                ? "专业声学评测显示你的发音非常标准，与目标词高度一致。"
                : azure.score >= 80
                ? "专业声学评测显示你的发音整体准确，还有少量音素可再打磨。"
                : azure.score >= 60
                ? "专业声学评测显示你的发音基本可辨，部分音素与标准发音有差异。"
                : "专业声学评测显示你的发音与标准差距较大，建议对照标准发音逐音节模仿。",
            tips:
              azure.words.some(
                (w) =>
                  w.errorType ===
                  "Mispronunciation"
              )
                ? "有音素读错，建议先听标准发音，重点纠正标注错误的音。"
                : azure.words.some(
                    (w) =>
                      w.errorType === "Omission"
                  )
                ? "有音节被漏读，请放慢速度把每个音节读完整。"
                : "发音整体不错，继续保持并注意语速与声调。",
          });
        } catch (error) {
          console.error(
            "Azure assessment error:",
            error
          );

          /* 降级到下方转写 + 本地评分 */
        }
      }

      // ========================================================
      // 转写 + 本地近似评分（降级路径）
      // ========================================================

      let transcription = "";

      try {
        transcription =
          await transcribeAudio(
            uploadedFile.path,
            uploadedFile.originalname,
            uploadedFile.mimetype
          );
      } catch (error) {
        console.error(
          "Transcription error:",
          error
        );

        return res.status(503).json({
          error:
            error instanceof Error
              ? error.message
              : "语音识别失败",
        });
      }

      // ========================================================
      // 没识别出来
      // ========================================================

      if (!transcription) {
        /* 单词模式免费额度：非 VIP 每次成功评分扣 1 次 */

        if (mode === "word" && !isVip) {
          await incrementWordUsage(
            req.userId
          ).catch(() => {});
        }

        return res.json({
          transcription: "",
          score: 0,
          feedback:
            "没有清楚识别到你的发音。",
          tips:
            "请靠近麦克风，降低环境噪音，然后重新朗读。",
        });
      }

      // ========================================================
      // 评分
      // ========================================================

      const result =
        calculateScore(
          targetText,
          transcription
        );

      // ========================================================
      // 返回
      // ========================================================

      /* 单词模式免费额度：非 VIP 每次成功评分扣 1 次 */

      if (mode === "word" && !isVip) {
        await incrementWordUsage(
          req.userId
        ).catch(() => {});
      }

      return res.json({
        source: "local",
        transcription,

        score:
          result.score,

        feedback:
          result.feedback,

        tips:
          result.tips,

        similarity:
          Number(
            result.similarity.toFixed(
              3
            )
          ),
      });
    } catch (error) {
      console.error(
        "Speaking analyze error:",
        error
      );

      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "口语分析失败",
      });
    } finally {
      /*
       * 分析完成以后删除临时录音。
       *
       * 这样不会让 uploads/speaking
       * 越积越多。
       */

      if (
        uploadedFile?.path
      ) {
        await fs.promises
          .unlink(
            uploadedFile.path
          )
          .catch(() => {});
      }
    }
  }
);

/* ============================================================
   GET /api/speaking/health
============================================================ */

router.get(
  "/health",
  (req, res) => {
    res.json({
      ok: true,
      service:
        "speaking",
      transcriptionConfigured:
        Boolean(
          process.env
            .TRANSCRIBE_API_URL
        ),
      azureConfigured:
        isAzureConfigured(),
    });
  }
);

/* ============================================================
   GET /api/speaking/quota
   今日单词模式免费额度
============================================================ */

router.get(
  "/quota",
  authenticate,
  async (req, res) => {
    try {
      res.json(
        await quotaPayload(
          req.userId
        )
      );
    } catch (error) {
      console.error(
        "Quota error:",
        error
      );

      res.status(500).json({
        message: "查询额度失败",
      });
    }
  }
);

export default router;
/* ============================================================
   POST /api/speaking/transcribe
   通用语音识别：浏览器不支持 Web Speech API 时，前端把 WAV 上传到这里，
   用 Azure STT（或 TRANSCRIBE_API_URL 兜底）转成文本。
   body: { audio(file), language? }  language: th-TH / zh-CN / en-US ...
============================================================ */

router.post(
  "/transcribe",
  authenticate,
  upload.single("audio"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "缺少音频文件" });
    }

    const language = String(req.body?.language || "th-TH");

    try {
      let text = "";

      if (isAzureConfigured()) {
        text = await azureTranscribe(req.file.path, language);
      } else {
        text = await transcribeAudio(
          req.file.path,
          req.file.originalname,
          req.file.mimetype,
          language
        );
      }

      if (!text) {
        return res
          .status(422)
          .json({ error: "未识别到语音，请靠近麦克风或调大音量后重试。" });
      }

      return res.json({ text });
    } catch (err) {
      const message = err instanceof Error ? err.message : "语音识别服务异常";
      return res.status(502).json({ error: message });
    } finally {
      fs.promises.unlink(req.file.path).catch(() => {});
    }
  }
);

