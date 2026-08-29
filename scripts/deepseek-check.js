// scripts/deepseek-check.js
//
// DeepSeek 翻译接口连通性测试（零依赖，只需 Node 18+，无需 node_modules）
//
// 用途：在部署服务器上验证能否访问 api.deepseek.com 并完成一次真实翻译。
// 上传本文件到服务器后运行（key 从环境变量或命令行参数传入）：
//   DEEPSEEK_API_KEY=sk-xxx node deepseek-check.js
//   或
//   node deepseek-check.js sk-xxx
//
// 退出码：0 = 全部通过；1 = 网络/认证失败；2 = 能连通但翻译响应异常。

const API_KEY =
  process.env.DEEPSEEK_API_KEY || process.argv[2] || "";
const BASE_URL = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

// 一条真实泰语新闻标题，用于验证「中文译文 + 罗马音注音」都返回
const TEST_NEWS = {
  title: "อินโดนีเซียวิกฤต ไฟป่าเผาผลาญ 1.2 ล้านไร่ กระทบประชาชนกว่า 5 ล้านคน",
  lede: "กู้ภัยอินโดนีเซียต้องเสี่ยงชีวิตฝ่าวงล้อมไฟป่า เพื่อช่วยเหลือชาวบ้านบนเกาะกาลิมันตัน",
};

async function main() {
  console.log("=== DeepSeek 翻译接口测试 ===");
  console.log("接口地址:", `${BASE_URL}/chat/completions`);
  console.log("模型:", MODEL);
  console.log("时间:", new Date().toISOString());
  console.log("Node 版本:", process.version);
  console.log("---");

  if (!API_KEY) {
    console.log("❌ 未提供 API key。请用 DEEPSEEK_API_KEY=sk-xxx 环境变量或命令行参数传入。");
    process.exit(1);
  }
  console.log(`1) API key: ✅ 已提供 (${API_KEY.slice(0, 6)}..., 长度 ${API_KEY.length})`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "你是资深泰语教学专家。把泰语新闻标题翻译成简体中文并给出罗马音注音（带声调符号）。只输出 JSON：{\"items\":[{\"id\":\"1\",\"zh_title\":\"...\",\"roman_title\":\"...\"}]}",
          },
          {
            role: "user",
            content: JSON.stringify({
              items: [{ id: "1", title: TEST_NEWS.title, lede: TEST_NEWS.lede }],
            }),
          },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
        max_tokens: 300,
      }),
      signal: controller.signal,
    });
    const ms = Date.now() - t0;

    if (res.status === 401 || res.status === 403) {
      console.log(`2) HTTP ${res.status}: ❌ API key 无效或没有权限（请检查 key 是否正确、账户是否有余额）。`);
      process.exit(1);
    }
    if (res.status === 429) {
      console.log(`2) HTTP 429: ❌ 请求过于频繁或余额不足。`);
      process.exit(1);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.log(`2) HTTP ${res.status}: ❌ 请求失败。${body.slice(0, 200)}`);
      process.exit(1);
    }

    console.log(`2) 连通性: ✅ 成功访问 api.deepseek.com (HTTP 200, 耗时 ${ms}ms)`);

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "";
    console.log("3) 模型返回: ✅ 有响应内容");
    if (!content) {
      console.log("   ❌ 响应内容为空");
      process.exit(2);
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.log("4) JSON 解析: ❌ 模型未返回合法 JSON");
      console.log("   原始内容:", content.slice(0, 200));
      process.exit(2);
    }

    const item = parsed?.items?.[0];
    if (!item) {
      console.log("4) 响应结构: ❌ 缺少 items 字段");
      process.exit(2);
    }
    const zh = item.zh_title || "";
    const roman = item.roman_title || "";
    console.log("4) 中文译文: ✅", zh || "(空)");
    console.log("5) 罗马音注音: ✅", roman || "(空)");
    if (!zh || !roman) {
      console.log("   ❌ 译文或注音为空，翻译不完整");
      process.exit(2);
    }
    console.log("---");
    console.log("✅ 全部通过：服务器可以正常访问 DeepSeek 并完成泰语新闻翻译。");
    process.exit(0);
  } catch (err) {
    console.log(`2) 请求失败: ${err.name}: ${err.message}`);
    if (err.name === "AbortError") {
      console.log("   ❌ 请求超时（60s）——服务器可能无法访问 api.deepseek.com（被墙/防火墙/DNS）。");
    } else if (err.cause && err.cause.code) {
      console.log(`   ❌ 网络层错误: ${err.cause.code}`);
      console.log("      常见：ENOTFOUND(DNS失败) / ETIMEDOUT(超时) / ECONNREFUSED(拒绝)");
    }
    console.log("   ❌ 结论：服务器当前无法访问 DeepSeek。");
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }
}

main();
