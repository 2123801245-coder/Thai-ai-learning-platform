#!/usr/bin/env node
/**
 * 构建末尾：为「会被分享出去的公开落地页」各生成一份静态 HTML。
 *
 * 为什么必须这么做
 * ----------------
 * 这是一个纯 SPA，线上只有一份 index.html。微信 / Twitter 的抓取器**不执行
 * JavaScript**，所以不管分享的是 /login、/share 还是 /thai-landing，它们拿到的
 * 都是同一套 og 标签 —— 「按页面区分卡片」在 SPA 里只能靠**多份静态 HTML**。
 *
 * 做法
 * ----
 * 读 dist/index.html（此时 %SITE_URL% 已被 vite 插件替换、crossorigin 已被剥掉），
 * 为每个公开路由写一份 dist/<route>/index.html，只换 title 与 og/twitter 文案与图片。
 * nginx 的 `try_files $uri $uri/ /index.html` 会先命中同名目录，因此 /login 直接
 * 返回 dist/login/index.html —— nginx 配置无需改动。
 *
 * 绝对地址从 dist/index.html 里已有的 og:url 反推，不在本脚本里再读一次 .env：
 * 站点地址只有一个来源（VITE_SITE_URL → vite 插件 → index.html）。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const DIST = path.resolve(process.cwd(), "dist");
const SOURCE = path.join(DIST, "index.html");

/* 每个公开可分享路由一张卡片。
   卡片图放在 public/brand/ 下：
     og-image.png —— 品牌版（默认，`/` 与 /thai-landing 用）
     og-scene.png —— 产品场景版（对话界面，/login、/share 用） */
const PAGES = [
  {
    route: "login",
    title: "ThaiAI · AI 泰语老师，免费开始",
    description:
      "AI 对话陪练 · 声调发音打分 · 5,000+ 词汇与真实语料。每天 10 分钟，把泰语练成说得出口的语言。",
    image: "/brand/og-scene.png",
  },
  {
    route: "share",
    title: "朋友在 ThaiAI 学泰语 · 一起来",
    description:
      "一个用 AI 教泰语的老师：实时对话陪练、逐句纠音、文化宇宙。注册即可免费开始。",
    image: "/brand/og-scene.png",
  },
  {
    route: "thai-landing",
    title: "ThaiAI · 泰语学习空间",
    description:
      "从认字、发音到自由对话：词汇星球、口语练习、文化宇宙与每日学习闭环。",
    image: "/brand/og-image.png",
  },
];

const META_TAG = /<meta\b[^>]*\/?>/g;

/** 替换某个 meta（按 property/name 精确匹配），保留其它字段不动。 */
function setMeta(html, { property, name }, value) {
  const wanted = property ? ["property", property] : ["name", name];
  let hit = false;
  const out = html.replace(META_TAG, (tag) => {
    const attr = (key) => (tag.match(new RegExp(`${key}="([^"]*)"`)) || [])[1];
    if (attr(wanted[0]) !== wanted[1]) return tag;
    hit = true;
    return `<meta ${wanted[0]}="${wanted[1]}" content="${value}" />`;
  });
  return { html: out, hit };
}

function main() {
  if (!existsSync(SOURCE)) {
    console.warn(
      "[share-pages] 没找到 dist/index.html，跳过按路由生成分享页（先跑 vite build）。"
    );
    return;
  }

  const base = readFileSync(SOURCE, "utf8");
  /* og:url 是 `https://域名/`（结尾带斜杠），去掉它再拼，否则会出 `//brand/x.png` */
  const siteUrl = ((base.match(/<meta property="og:url" content="([^"]*)"/) || [])[1] || "").replace(
    /\/+$/,
    ""
  );

  for (const page of PAGES) {
    let html = base;

    html = html.replace(/<title>[^<]*<\/title>/, `<title>${page.title}</title>`);

    const edits = [
      [{ property: "og:url" }, `${siteUrl}/${page.route}`],
      [{ property: "og:title" }, page.title],
      [{ property: "og:description" }, page.description],
      [{ property: "og:image" }, `${siteUrl}${page.image}`],
      [{ name: "twitter:title" }, page.title],
      [{ name: "twitter:description" }, page.description],
      [{ name: "twitter:image" }, `${siteUrl}${page.image}`],
    ];

    for (const [key, value] of edits) {
      const res = setMeta(html, key, value);
      html = res.html;
      if (!res.hit) {
        console.warn(
          `[share-pages] ${page.route}: index.html 里没找到 ${
            key.property ? `property=${key.property}` : `name=${key.name}`
          }，已跳过该项`
        );
      }
    }

    const outDir = path.join(DIST, page.route);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      path.join(outDir, "index.html"),
      `<!-- 由 scripts/build-share-pages.mjs 生成：${page.route} 的分享卡片副本，勿手改 -->\n${html}`
    );
    console.log(
      `[share-pages] dist/${page.route}/index.html → ${page.image}${
        siteUrl ? ` (${siteUrl}/${page.route})` : " (未配置 VITE_SITE_URL：URL 仍是相对路径)"
      }`
    );
  }
}

main();
