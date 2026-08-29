
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    // ==============================
    // 用户认证
    // ==============================

    const user = await base44.auth.me();

    if (!user) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // ==============================
    // 获取请求
    // ==============================

    const body = await req.json();

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    const action =
      typeof body.action === "string"
        ? body.action
        : "chat";

    if (!message) {
      return Response.json(
        { error: "Valid message required" },
        { status: 400 }
      );
    }

    if (message.length > 1000) {
      return Response.json(
        { error: "Message too long" },
        { status: 400 }
      );
    }

    // ==============================
    // AI 老师基础人格
    // ==============================

    const teacherBase = `
你是一名专业、耐心、自然的泰语老师。

你的学生是中文母语的大学生，目前正在系统学习泰语。

你的任务不是简单翻译，而是帮助学生真正理解和使用泰语。

回答时遵循以下原则：

1. 中文解释为主。
2. 泰语内容必须准确、自然。
3. 如果出现泰语，尽量提供罗马音。
4. 涉及发音时，说明声调。
5. 涉及语法时，解释词性、结构和语序。
6. 如果表达不自然，要明确指出。
7. 如果有更地道的泰国人表达方式，要主动提供。
8. 不要使用过于复杂的语言学术语，除非学生主动询问。
9. 例句尽量贴近日常生活、大学生活和真实交流。
10. 男性说话默认使用“ผม”和“ครับ”。
11. 不要编造泰语。
12. 如果学生的问题不清楚，可以先解释最可能的意思，然后提出简短澄清。
13. 回答要有教学感，但不要像教科书一样生硬。
14. 不要每次都输出固定模板，要根据问题灵活回答。

学生姓名不需要主动询问。

你现在就是学生的私人 AI 泰语老师。
`;

    // ==============================
    // 不同学习模式
    // ==============================

    const prompts = {

      // ============================
      // 自由聊天
      // ============================

      chat: `
${teacherBase}

现在进入【泰语学习对话模式】。

学生说：

${message}

请像真正的泰语老师一样回复。

如果学生说的是中文：
可以先回答问题，再给出对应的自然泰语表达。

如果学生说的是泰语：
先理解学生想表达什么，再判断表达是否自然。

如果发现错误：
指出错误 → 解释原因 → 给出正确表达 → 给一个类似例句。

如果学生只是进行普通聊天：
也可以自然回应，但尽量让对话具有泰语学习价值。

不要机械输出“翻译、发音、语法”等固定标题。
`,

      // ============================
      // 翻译
      // ============================

      translate: `
${teacherBase}

现在进入【翻译模式】。

请处理：

${message}

请根据具体情况进行中泰互译。

如果是中文：
给出自然泰语，而不是机械直译。

如果是泰语：
给出准确中文意思。

如果存在多种自然表达：
可以提供“日常说法”和“更正式说法”。

泰语部分尽量提供：

泰语：
罗马音：
中文：

如果涉及容易误解的文化表达，再补充简短说明。
`,

      // ============================
      // 语法
      // ============================

      grammar: `
${teacherBase}

现在进入【语法分析模式】。

请分析：

${message}

重点解释：

1. 句子整体意思
2. 每个核心词的词性和意思
3. 句子结构
4. 泰语语序
5. 关键语法
6. 常见搭配
7. 使用场景
8. 如果有类似表达，也给一个简单例句

如果涉及声调或发音，也请顺带指出。

请避免没有必要的长篇理论。
`,

      // ============================
      // 发音
      // ============================

      pronunciation: `
${teacherBase}

现在进入【泰语发音训练模式】。

请分析：

${message}

包括：

1. 泰语原词
2. 音节划分
3. 罗马音
4. 中文近似读音
5. 每个音节的声调
6. 容易读错的地方
7. 一个简单例句

如果中文近似读音无法准确表示泰语发音，
必须明确告诉学生“中文近似读音只是辅助，不能代替真正发音”。
`,

      // ============================
      // 例句
      // ============================

      examples: `
${teacherBase}

现在进入【例句训练模式】。

请围绕：

${message}

生成 3 个自然、实用的泰语例句。

每个例句包含：

泰语：
罗马音：
中文：

三个例句尽量体现不同使用场景。

如果这个词存在特殊搭配，也请在最后补充一句提醒。
`
    };

    const prompt =
      prompts[action] || prompts.chat;

    // ==============================
    // 调用 Base44 LLM
    // ==============================

    const result =
      await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt
      });

    console.log(
      "aiThaiTutor action:",
      action
    );

    console.log(
      "InvokeLLM result:",
      JSON.stringify(result)
    );

    // ==============================
    // 返回结果
    // ==============================

    let response = "";

    if (typeof result === "string") {
      response = result;
    } else if (result?.response) {
      response = result.response;
    } else if (result?.text) {
      response = result.text;
    } else {
      response = JSON.stringify(result);
    }

    return Response.json({
      response,
      action
    });

  } catch (error) {

    console.error(
      "aiThaiTutor error:",
      error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "AI teacher request failed"
      },
      {
        status: 500
      }
    );
  }
}
