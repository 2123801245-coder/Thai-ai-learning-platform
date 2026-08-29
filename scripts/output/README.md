# ThaiAI 课程视频脚本

## 📊 汇总

| 课程 | 课节数 | 免费课 | 总时长 |
|------|--------|--------|--------|
| thai-pronunciation | 8 | 4 | 155 分钟 |
| daily-thai | 8 | 3 | 170 分钟 |
| thai-culture | 6 | 1 | 120 分钟 |

**总计**: 22 节课

## 📁 文件结构

```
scripts/output/
├── README.md (本文件)
├── thai-pronunciation/
│   ├── thai-pronunciation-01.md
│   ├── thai-pronunciation-02.md
│   └── ...
├── daily-thai/
│   ├── daily-thai-01.md
│   ├── daily-thai-02.md
│   └── ...
├── thai-culture/
│   ├── thai-culture-01.md
│   ├── thai-culture-02.md
│   └── ...
```

## 🚀 使用方法

1. 打开对应课程的 `.md` 文件
2. 按照脚本模板填写内容
3. 使用 AI 配音工具生成语音
4. 使用视频工具生成画面
5. 导出字幕文件
6. 上传到 CDN/OSS
7. 更新 `src/data/lessons.js` 的 `videoUrl`

## 🛠️ AI 配音工具

- **剪映**: 免费，支持中泰双语
- **Azure TTS**: 项目已接入，按量计费
- **ElevenLabs**: 最自然，$5/月起

## 🎬 视频生成工具

- **剪映图文成片**: 免费，输入文案自动生成
- **HeyGen**: 数字人讲解，$24/月
- **可灵 AI**: 国产最强，支持中文提示词