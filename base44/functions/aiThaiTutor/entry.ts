
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

export default async function (req: Request) {
  try {
    console.log("[aiThaiTutor] Function started");

    const base44 = createClientFromRequest(req);

    // ==============================
    // 1. 检查用户
    // ==============================
    const user = await base44.auth.me();

    console.log(
      "[aiThaiTutor] User:",
      user ? user.email || user.id || "authenticated" : "none"
    );

    if (!user) {
      return Response.json(
        {
          error: "Unauthorized",
          message: "用户未登录",
        },
        { status: 401 }
      );
    }

    // ==============================
    // 2. 读取请求
    // ==============================
    let body;

    try {
      body = await req.json();
    } catch (error) {
      console.error("[aiThaiTutor] Invalid JSON:", error);

      return Response.json(
        {
          error: "Invalid JSON body",
        },
        { status: 400 }
      );
    }

    console.log(
      "[aiThaiTutor] Request body:",
      JSON.stringify(body)
    );

    const message = body?.message;
    const action = body?.action || "translate";

    // ==============================
    // 3. 检查 message
    // ==============================
    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      return Response.json(
        {
          error: "Valid message required",
          message: "请输入要学习的内容",
        },
        { status: 400 }
      );
    }

    if (message.length > 500) {
      return Response.json(
        {
          error: "Message too long",
          message: "输入内容不能超过 500 个字符",
        },
        { status: 400 }
      );
    }

    // ==============================
    // 4. AI Prompt
    // ==============================
    const prompts: Record<string, string> = {
      translate: `
你是一名专业的泰语老师。

请分析下面的内容：

${message}

请按照以下格式回答：

【翻译】
如果输入是中文，请翻译成自然的泰语。
如果输入是泰语，请翻译成自然的中文。

【发音】
给出泰语的罗马音或适合中国学生理解的中文近似读音。

【声调】
解释关键字的声调。

【说明】
简单解释词语、表达方式以及必要的文化背景。

要求：
- 以中文解释为主
- 泰语表达要自然
- 不要编造信息
- 回答清晰、适合大学泰语学习者
`,

      grammar: `
你是一名专业的泰语语法老师。

请分析：

${message}

请包括：

1. 词性
2. 词义
3. 语序
4. 语法结构
5. 声调
6. 常见搭配
7. 使用场景
8. 给出 1-2 个简单例句

请使用中文解释，泰语例句保留泰文。
`,

      pronunciation: `
你是一名专业的泰语发音老师。

请分析：

${message}

请包括：

1. 音节划分
2. 罗马音
3. 中文近似读音
4. 声调
5. 发音重点
6. 中国学生容易出现的发音错误

请使用中文解释。
`,

      examples: `
你是一名专业泰语老师。

请为下面的泰语词语或表达生成 3 个自然例句：

${message}

每个例句包含：

【泰语】
【发音】
【中文】
【使用说明】

例句难度适合大学泰语专业学生。
`,
    };

    const prompt =
      prompts[action] || prompts.translate;

    console.log(
      "[aiThaiTutor] Action:",
      action
    );

    console.log(
      "[aiThaiTutor] Calling InvokeLLM..."
    );

    // ==============================
    // 5. 调用 Base44 LLM
    // ==============================
    let result;

    try {
      result =
        await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt,
        });

      console.log(
        "[aiThaiTutor] InvokeLLM success"
      );

      console.log(
        "[aiThaiTutor] Result:",
        JSON.stringify(result)
      );
    } catch (llmError) {
      console.error(
        "[aiThaiTutor] InvokeLLM FAILED:",
        llmError
      );

      return Response.json(
        {
          error: "InvokeLLM failed",
          message:
            llmError instanceof Error
              ? llmError.message
              : String(llmError),
        },
        { status: 500 }
      );
    }

    // ==============================
    // 6. 处理 AI 返回结果
    // ==============================
    let responseText = "";

    if (typeof result === "string") {
      responseText = result;
    } else if (
      result &&
      typeof result === "object"
    ) {
      const r = result as any;

      responseText =
        r.response ||
        r.text ||
        r.output ||
        r.content ||
        JSON.stringify(result);
    } else {
      responseText = String(result);
    }

    // ==============================
    // 7. 返回前端
    // ==============================
    return Response.json({
      success: true,
      response: responseText,
    });
  } catch (error) {
    console.error(
      "[aiThaiTutor] FATAL ERROR:",
      error
    );

    return Response.json(
      {
        error: "Internal Server Error",
        message:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
