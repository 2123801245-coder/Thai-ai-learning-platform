// scripts/thaipbs-check.js
//
// ThaiPBS 连通性 + 抓取解析测试（零依赖，只需 Node 18+，无需 node_modules）
//
// 用途：在部署服务器上验证能否访问 thaipbs.or.th 并解析出新闻。
// 上传本文件到服务器后运行：
//   node thaipbs-check.js
//
// 退出码：0 = 成功；1 = 网络不通；2 = 通了但解析失败。

const THAIPBS_NEWS_URL = "https://www.thaipbs.or.th/news";

function decodeEntities(s) {
  return (s || "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNewsPage(html) {
  const map = new Map();
  const chunks = html.split(/<article\b/);
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];
    const idMatch = chunk.match(/\/news\/content\/(\d+)/);
    if (!idMatch) continue;
    const id = idMatch[1];
    const titleMatch = chunk.match(/content-information-title[^>]*>([\s\S]*?)<\/h3>/);
    const title = titleMatch ? decodeEntities(titleMatch[1].replace(/<[^>]+>/g, "")) : "";
    if (!title) continue;
    const descMatch = chunk.match(/content-information-description[^>]*>([\s\S]*?)<\/p>/);
    const desc = descMatch ? decodeEntities(descMatch[1].replace(/<[^>]+>/g, "")) : "";
    const timeMatch = chunk.match(/dateTime="([^"]+)"/);
    const pubAt = timeMatch ? timeMatch[1] : null;
    const catMatch = chunk.match(/href="\/news\/categories\/[^"]*"[^>]*>\s*([\s\S]*?)<\/a>/);
    const category = catMatch ? decodeEntities(catMatch[1].replace(/<[^>]+>/g, "")) : "ข่าว";
    const existing = map.get(id);
    if (existing) {
      if (!existing.lede && desc) existing.lede = desc;
      if (!existing.pub_at && pubAt) existing.pub_at = pubAt;
      continue;
    }
    map.set(id, {
      id: `thaipbs-${id}`,
      title,
      lede: desc,
      url: `https://www.thaipbs.or.th/news/content/${id}`,
      category,
      pub_at: pubAt,
    });
  }
  const items = [...map.values()].sort((a, b) => {
    if (!a.pub_at) return 1;
    if (!b.pub_at) return -1;
    return b.pub_at.localeCompare(a.pub_at);
  });
  return items.slice(0, 20);
}

async function main() {
  console.log("=== ThaiPBS 连通性测试 ===");
  console.log("目标:", THAIPBS_NEWS_URL);
  console.log("时间:", new Date().toISOString());
  console.log("Node 版本:", process.version);
  console.log("---");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const t0 = Date.now();
    const res = await fetch(THAIPBS_NEWS_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept-Language": "th-TH,th;q=0.9",
      },
      signal: controller.signal,
    });
    const ms = Date.now() - t0;
    console.log(`1) HTTP 状态: ${res.status} ${res.statusText}  (耗时 ${ms}ms)`);
    if (!res.ok) {
      console.log("   ❌ 服务器返回了非 200 状态码，可能被拦截或源站异常。");
      process.exit(1);
    }
    console.log("2) 连通性: ✅ 成功访问 thaipbs.or.th");
    console.log("   响应头: content-type =", res.headers.get("content-type"));

    const html = await res.text();
    console.log(`3) 页面大小: ${(html.length / 1024).toFixed(1)} KB`);

    const items = parseNewsPage(html);
    if (!items.length) {
      console.log("4) 解析: ❌ 页面拿到了，但没有解析出任何新闻（页面结构可能已改版）。");
      process.exit(2);
    }
    console.log(`4) 解析: ✅ 成功解析出 ${items.length} 条新闻`);
    for (const it of items.slice(0, 5)) {
      console.log(`   - [${it.category}] ${it.title}`);
      if (it.lede) console.log(`      ${it.lede.slice(0, 60)}`);
    }
    console.log("---");
    console.log("✅ 全部通过：服务器可以正常访问并抓取 ThaiPBS 每日新闻。");
    process.exit(0);
  } catch (err) {
    console.log(`1) HTTP 请求失败: ${err.name}: ${err.message}`);
    if (err.name === "AbortError") {
      console.log("   ❌ 请求超时（15s）——服务器可能无法访问 thaipbs.or.th（被墙/防火墙/DNS）。");
    } else if (err.cause && err.cause.code) {
      console.log(`   ❌ 网络层错误: ${err.cause.code}`);
      console.log("      常见：ENOTFOUND(DNS失败) / ETIMEDOUT(超时) / ECONNREFUSED(拒绝)");
    }
    console.log("   ❌ 结论：服务器当前无法访问 ThaiPBS。");
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }
}

main();
