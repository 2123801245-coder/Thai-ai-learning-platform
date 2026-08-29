#!/usr/bin/env node
/* =========================================================
   ThaiAI 课程视频脚本生成器
   
   用法：
     node scripts/generate-scripts.js                    # 生成所有课程脚本
     node scripts/generate-scripts.js --course thai-pronunciation  # 只生成某门课
     node scripts/generate-scripts.js --with-ai          # 用 AI 生成完整脚本（需要 OPENAI_API_KEY）
   
   输出目录：scripts/output/
========================================================= */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =========================================================
// 课程数据（从 lessons.js 提取）
// =========================================================

const lessonData = {
  "thai-pronunciation": [
    { id: "pronunciation-01", chapter: "第一章 · 泰语发音基础", title: "认识泰语发音系统", description: "了解泰语辅音、元音和声调的基本组成。", duration: "12:35", free: true },
    { id: "pronunciation-02", chapter: "第一章 · 泰语发音基础", title: "泰语辅音入门", description: "认识泰语辅音以及高、中、低辅音的基本概念。", duration: "18:20", free: true },
    { id: "pronunciation-03", chapter: "第一章 · 泰语发音基础", title: "泰语元音", description: "学习泰语常见元音以及元音位置。", duration: "21:10", free: true },
    { id: "pronunciation-04", chapter: "第二章 · 泰语声调", title: "认识泰语五个声调", description: "理解泰语声调系统，为正确发音打下基础。", duration: "16:45", free: true },
    { id: "pronunciation-05", chapter: "第二章 · 泰语声调", title: "声调规则入门", description: "学习辅音类别、元音长短与声调之间的关系。", duration: "22:30", free: false },
    { id: "pronunciation-06", chapter: "第二章 · 泰语声调", title: "综合发音练习", description: "通过词汇和短句进行综合发音训练。", duration: "19:15", free: false },
    { id: "pronunciation-07", chapter: "第三章 · 拼读训练", title: "泰语音节结构", description: "掌握泰语音节的组成方式。", duration: "20:40", free: false },
    { id: "pronunciation-08", chapter: "第三章 · 拼读训练", title: "从拼读到开口", description: "将发音规则应用到真实泰语词汇中。", duration: "24:10", free: false },
  ],
  "daily-thai": [
    { id: "daily-01", chapter: "第一章 · 打招呼", title: "你好、谢谢与再见", description: "掌握最基础的日常泰语表达。", duration: "14:20", free: true },
    { id: "daily-02", chapter: "第一章 · 打招呼", title: "第一次认识别人", description: "学习介绍自己和询问对方信息。", duration: "17:35", free: true },
    { id: "daily-03", chapter: "第二章 · 日常交流", title: "你在做什么？", description: "学习生活中高频出现的简单句型。", duration: "18:50", free: true },
    { id: "daily-04", chapter: "第二章 · 日常交流", title: "时间与日期", description: "学习时间、日期和日程相关表达。", duration: "20:15", free: false },
    { id: "daily-05", chapter: "第三章 · 生活场景", title: "在便利店买东西", description: "掌握便利店购物时的常见泰语。", duration: "21:40", free: false },
    { id: "daily-06", chapter: "第三章 · 生活场景", title: "在餐厅点餐", description: "学习点菜、询价和结账。", duration: "23:10", free: false },
    { id: "daily-07", chapter: "第四章 · 综合会话", title: "完整生活对话", description: "将前面学到的表达组合起来。", duration: "25:30", free: false },
    { id: "daily-08", chapter: "第四章 · 综合会话", title: "真实场景挑战", description: "模拟真实生活中的泰语交流。", duration: "28:20", free: false },
  ],
  "thai-culture": [
    { id: "culture-01", chapter: "第一章 · 文化入门", title: "泰国文化概览", description: "从历史、宗教与社会了解泰国。", duration: "17:20", free: true },
    { id: "culture-02", chapter: "第一章 · 文化入门", title: "泰式礼仪", description: "学习合十礼、称呼与社交礼仪。", duration: "19:05", free: false },
    { id: "culture-03", chapter: "第一章 · 文化入门", title: "宗教与语言", description: "理解佛教文化对泰语的影响。", duration: "20:40", free: false },
    { id: "culture-04", chapter: "第二章 · 语言与文化", title: "敬语系统", description: "掌握泰语中的礼貌等级体系。", duration: "21:30", free: false },
    { id: "culture-05", chapter: "第二章 · 语言与文化", title: "俗语与谚语", description: "通过俗语了解泰式思维方式。", duration: "18:45", free: false },
    { id: "culture-06", chapter: "第二章 · 语言与文化", title: "语言中的文化思维", description: "从语言现象理解泰国文化逻辑。", duration: "22:10", free: false },
  ],
};

// =========================================================
// 解析命令行参数
// =========================================================

const args = process.argv.slice(2);
const courseFilter = args.includes('--course') ? args[args.indexOf('--course') + 1] : null;
const useAI = args.includes('--with-ai');

// =========================================================
// 脚本模板生成器
// =========================================================

function generateScriptTemplate(lesson, courseName) {
  const [min, sec] = lesson.duration.split(':').map(Number);
  const totalMinutes = min + sec / 60;
  
  return `# ${lesson.title}

> **课程**: ${courseName}  
> **章节**: ${lesson.chapter}  
> **时长**: ${lesson.duration}  
> **ID**: ${lesson.id}  
> **免费**: ${lesson.free ? '是' : '否'}

---

## 📋 视频信息

| 项目 | 内容 |
|------|------|
| 标题 | ${lesson.title} |
| 描述 | ${lesson.description} |
| 目标时长 | ${totalMinutes.toFixed(1)} 分钟 |
| 难度 | ${lesson.free ? '入门' : '进阶'} |

---

## 🎬 视频脚本

### 开场白 (0:00 - 0:30)

**画面**: 泰国文化元素 + 课程标题动画

**配音**:
> 大家好，欢迎来到 ThaiAI 泰语学习课程。
> 今天我们要学习的是：${lesson.title}。
> ${lesson.description}

---

### 第一部分 (0:30 - ${Math.floor(totalMinutes * 0.4)}:${String(Math.floor((totalMinutes * 0.4 % 1) * 60)).padStart(2, '0')})

**画面**: 知识点讲解 + 图文动画

**配音**:
> <!-- 在这里填写第一个知识点的讲解内容 -->
> <!-- 建议：先用中文解释概念，再给出泰语示例 -->

**泰语示例**:
| 泰语 | 发音 | 中文 |
|------|------|------|
| <!-- 泰语单词 --> | <!-- 发音 --> | <!-- 中文意思 --> |

---

### 第二部分 (${Math.floor(totalMinutes * 0.4)}:${String(Math.floor((totalMinutes * 0.4 % 1) * 60)).padStart(2, '0')} - ${Math.floor(totalMinutes * 0.7)}:${String(Math.floor((totalMinutes * 0.7 % 1) * 60)).padStart(2, '0')})

**画面**: 实例演示 + 对话场景

**配音**:
> <!-- 在这里填写第二个知识点的讲解内容 -->
> <!-- 建议：加入真实场景对话 -->

**对话示例**:
| 角色 | 泰语 | 中文 |
|------|------|------|
| A | <!-- 泰语对话 --> | <!-- 中文翻译 --> |
| B | <!-- 泰语对话 --> | <!-- 中文翻译 --> |

---

### 第三部分 (${Math.floor(totalMinutes * 0.7)}:${String(Math.floor((totalMinutes * 0.7 % 1) * 60)).padStart(2, '0')} - ${Math.floor(totalMinutes * 0.9)}:${String(Math.floor((totalMinutes * 0.9 % 1) * 60)).padStart(2, '0')})

**画面**: 练习环节 + 互动提示

**配音**:
> <!-- 在这里填写练习或总结内容 -->
> <!-- 建议：让观众跟读或做小测验 -->

---

### 总结 (${Math.floor(totalMinutes * 0.9)}:${String(Math.floor((totalMinutes * 0.9 % 1) * 60)).padStart(2, '0')} - ${lesson.duration})

**画面**: 知识点回顾 + 下节课预告

**配音**:
> 好的，今天我们学习了 ${lesson.title}。
> 记住要点：
> 1. <!-- 要点 1 -->
> 2. <!-- 要点 2 -->
> 3. <!-- 要点 3 -->
>
> 下节课我们将学习 <!-- 下节课主题 -->，敬请期待！
> สวัสดีครับ/ค่ะ（再见）！

---

## 🎤 配音文本（纯文本版）

将以下文本复制到 AI 配音工具（如剪映、Azure TTS）：

---

大家好，欢迎来到 ThaiAI 泰语学习课程。今天我们要学习的是：${lesson.title}。${lesson.description}

<!-- 在这里添加完整的配音文本 -->

好的，今天我们学习了 ${lesson.title}。下节课再见！

---

## 📝 字幕时间轴（SRT 格式参考）

\`\`\`
1
00:00:00,000 --> 00:00:05,000
大家好，欢迎来到 ThaiAI 泰语学习课程

2
00:00:05,000 --> 00:00:10,000
今天我们要学习的是：${lesson.title}

3
00:00:10,000 --> 00:00:15,000
${lesson.description}

<!-- 继续添加时间轴 -->
\`\`\`

---

## 🛠️ 制作工具推荐

1. **配音**: 剪映 AI 朗读 / Azure TTS / ElevenLabs
2. **画面**: 剪映图文成片 / HeyGen 数字人
3. **字幕**: 剪映自动识别 → 导出 .vtt
4. **剪辑**: 剪映 / Premiere Pro

---

## 📦 上传清单

- [ ] 视频文件: \`${lesson.id}.mp4\`
- [ ] 泰语字幕: \`${lesson.id}_th.vtt\`
- [ ] 中文字幕: \`${lesson.id}_zh.vtt\`
- [ ] 视频 URL: 填入 \`lessons.js\` 的 \`videoUrl\`
- [ ] 字幕 URL: 填入 \`subtitleUrlTh\` 和 \`subtitleUrlZh\`
`;
}

// =========================================================
// AI 脚本生成器（需要 OPENAI_API_KEY）
// =========================================================

async function generateScriptWithAI(lesson, courseName) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('⚠️  未设置 OPENAI_API_KEY，使用模板模式');
    return generateScriptTemplate(lesson, courseName);
  }

  const prompt = `你是一位专业的泰语教学视频脚本作者。请为以下课程生成完整的视频脚本。

课程信息：
- 标题：${lesson.title}
- 章节：${lesson.chapter}
- 描述：${lesson.description}
- 时长：${lesson.duration}
- 难度：${lesson.free ? '入门' : '进阶'}

请生成包含以下部分的完整脚本：
1. 开场白（30秒）
2. 第一部分：知识点讲解（约40%时长）
3. 第二部分：实例演示（约30%时长）
4. 第三部分：练习环节（约20%时长）
5. 总结（约10%时长）

要求：
- 使用中文讲解，泰语示例用泰文+发音+中文翻译
- 语气亲切自然，像朋友聊天
- 每个知识点都要有具体例子
- 适合视频配音使用

请直接输出脚本内容，不需要额外说明。`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    const data = await response.json();
    const aiScript = data.choices?.[0]?.message?.content || '';

    return `# ${lesson.title}

> **课程**: ${courseName}  
> **章节**: ${lesson.chapter}  
> **时长**: ${lesson.duration}  
> **ID**: ${lesson.id}

---

${aiScript}

---

## 🛠️ 制作工具推荐

1. **配音**: 剪映 AI 朗读 / Azure TTS
2. **画面**: 剪映图文成片 / HeyGen
3. **字幕**: 剪映自动识别
`;
  } catch (error) {
    console.log(`⚠️  AI 生成失败: ${error.message}，使用模板`);
    return generateScriptTemplate(lesson, courseName);
  }
}

// =========================================================
// 主函数
// =========================================================

async function main() {
  const outputDir = path.join(__dirname, 'output');
  
  // 创建输出目录
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let totalGenerated = 0;

  for (const [courseId, lessons] of Object.entries(lessonData)) {
    // 如果指定了课程，只生成该课程
    if (courseFilter && courseId !== courseFilter) {
      continue;
    }

    const courseDir = path.join(outputDir, courseId);
    if (!fs.existsSync(courseDir)) {
      fs.mkdirSync(courseDir, { recursive: true });
    }

    console.log(`\n📚 生成课程: ${courseId}`);
    console.log(`   共 ${lessons.length} 节课`);

    for (const lesson of lessons) {
      const script = useAI
        ? await generateScriptWithAI(lesson, courseId)
        : generateScriptTemplate(lesson, courseId);

      const filename = `${lesson.id}.md`;
      const filepath = path.join(courseDir, filename);
      
      fs.writeFileSync(filepath, script, 'utf-8');
      totalGenerated++;
      
      console.log(`   ✅ ${lesson.title} → ${filename}`);
    }
  }

  console.log(`\n🎉 完成！共生成 ${totalGenerated} 个脚本文件`);
  console.log(`📁 输出目录: ${outputDir}`);
  
  // 生成汇总文件
  const summary = generateSummary();
  fs.writeFileSync(path.join(outputDir, 'README.md'), summary, 'utf-8');
  console.log(`📄 汇总文件: ${outputDir}/README.md`);
}

function generateSummary() {
  let total = 0;
  let lines = ['# ThaiAI 课程视频脚本\n'];

  lines.push('## 📊 汇总\n');
  lines.push('| 课程 | 课节数 | 免费课 | 总时长 |');
  lines.push('|------|--------|--------|--------|');

  for (const [courseId, lessons] of Object.entries(lessonData)) {
    const freeCount = lessons.filter(l => l.free).length;
    const totalMin = lessons.reduce((sum, l) => {
      const [m, s] = l.duration.split(':').map(Number);
      return sum + m + s / 60;
    }, 0);
    
    total += lessons.length;
    lines.push(`| ${courseId} | ${lessons.length} | ${freeCount} | ${totalMin.toFixed(0)} 分钟 |`);
  }

  lines.push(`\n**总计**: ${total} 节课\n`);
  
  lines.push('## 📁 文件结构\n');
  lines.push('```');
  lines.push('scripts/output/');
  lines.push('├── README.md (本文件)');
  
  for (const courseId of Object.keys(lessonData)) {
    lines.push(`├── ${courseId}/`);
    lines.push(`│   ├── ${courseId}-01.md`);
    lines.push(`│   ├── ${courseId}-02.md`);
    lines.push(`│   └── ...`);
  }
  
  lines.push('```\n');
  
  lines.push('## 🚀 使用方法\n');
  lines.push('1. 打开对应课程的 `.md` 文件');
  lines.push('2. 按照脚本模板填写内容');
  lines.push('3. 使用 AI 配音工具生成语音');
  lines.push('4. 使用视频工具生成画面');
  lines.push('5. 导出字幕文件');
  lines.push('6. 上传到 CDN/OSS');
  lines.push('7. 更新 `src/data/lessons.js` 的 `videoUrl`\n');
  
  lines.push('## 🛠️ AI 配音工具\n');
  lines.push('- **剪映**: 免费，支持中泰双语');
  lines.push('- **Azure TTS**: 项目已接入，按量计费');
  lines.push('- **ElevenLabs**: 最自然，$5/月起\n');
  
  lines.push('## 🎬 视频生成工具\n');
  lines.push('- **剪映图文成片**: 免费，输入文案自动生成');
  lines.push('- **HeyGen**: 数字人讲解，$24/月');
  lines.push('- **可灵 AI**: 国产最强，支持中文提示词');

  return lines.join('\n');
}

// =========================================================
// 运行
// =========================================================

main().catch(console.error);
