// src/components/culture/ThailandExplorer.jsx
//
// =========================================================
// ThaiAI Culture Universe · 04 泰国探索者（地图）
// =========================================================
//
// 一张真实的泰国地图艺术图 + 一层真实控件：
//
//   底图      public/images/explorer/thailand-map.webp（1536×1024，烘焙的 UI 已在
//             生成素材时抹掉，只剩下地图本身与九枚金色地点针）
//   地图坐标系 九块城市标签按 x/y 百分比贴在图上，**与地图同一个坐标系**，
//             所以拖动 / 缩放时标签和地点针永远咬合，不会各走各的
//   视口控件  罗盘、标题、探索路线栏、探索进度卡、左下提示条——参考稿里的那套
//             HUD，全部是真控件（可点、可聚焦、有 hover / 选中态）
//
// 交互：
//   - 单指 / 鼠标拖动平移，双指捏合或 ⌘/Ctrl + 滚轮缩放，右下角有 − / % / + / 归位
//   - 点地图标签或路线栏 → 选中城市 → 左侧浮出该城市的语言与文化面板
//   - 面板里：点句子朗读（真实 TTS）、点场景进 /conversation?scene=…；
//     这两种动作都会写入 mediaProgress 的探索记录，于是「探索进度」是真实数据，
//     首页能力雷达 / 今日活动也跟着一起动（见 src/lib/explorerProgress.js）
// =========================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Locate,
  Minus,
  MousePointerClick,
  Navigation,
  Plus,
  Volume2,
  X,
} from "lucide-react";

import {
  cityAtlas,
  cultureForCity,
  THAILAND_MAP_IMAGE,
} from "@/lib/cultureUniverse";
import { cityVolumeMeta } from "@/data/cityProfiles";
import { useExplorerProgress, markCityExplored } from "@/lib/explorerProgress";
import { speakThai } from "@/lib/thaiSpeech";
/* PAPER 世界的文化页版式层（与 /culture 共用同一份）。探险者的地图板 / 轨道 /
   面板本身是"深色展柜"，四世界共用，本层只把它外围的目录与图录做成纸本语言；
   文件内每条规则都带 html[data-visual-mode="paper"] 前缀，另外三个世界不受影响。 */
import "@/themes/culture-paper.css";

const MIN_SCALE = 1;
const MAX_SCALE = 3.4;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/* 手机端的初始取景：放大到半岛，让标签大到能读 */
const NARROW_QUERY = "(max-width: 1023px)";
const NARROW_VIEW = { scale: 1.95, focusX: 0.46, focusY: 0.42 };

export default function ThailandExplorer({ onBack, initialCity, onCity }) {
  const navigate = useNavigate();
  const cities = cityAtlas;
  const progress = useExplorerProgress(cities);

  const [cityId, setCityId] = useState(() =>
    cities.some((c) => c.id === initialCity) ? initialCity : cities[0].id
  );
  const [panelOpen, setPanelOpen] = useState(false);
  const [volume, setVolume] = useState("history");
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const appliedInitial = useRef(false);

  const boardRef = useRef(null);
  const pointers = useRef(new Map());
  const gesture = useRef(null);

  const city = useMemo(
    () => cities.find((c) => c.id === cityId) || cities[0],
    [cities, cityId]
  );
  const cultures = useMemo(() => cultureForCity(city.id), [city.id]);
  /* 城市志：历史底蕴 / 文化 / 风味 三卷 + 必知 + 语汇（数据在 src/data/cityProfiles.js） */
  const profile = city.profile || null;
  const explored = progress.byCity[city.id] || null;

  /* 换城市时回到「历史底蕴」，避免上一座城的标签页状态串味 */
  useEffect(() => {
    setVolume("history");
  }, [cityId]);

  /* ── 板子尺寸：一切 px 尺寸都以板宽为基准（--exp-u），标签才能跟着板子缩放 ── */
  useEffect(() => {
    const node = boardRef.current;
    if (!node) return undefined;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  /* ── 平移范围：地图始终铺满板子，不露底 ── */
  const clampView = useCallback(
    (next) => {
      const scale = clamp(next.scale, MIN_SCALE, MAX_SCALE);
      const maxX = (size.w * (scale - 1)) / 2;
      const maxY = (size.h * (scale - 1)) / 2;
      return {
        scale,
        x: clamp(next.x, -maxX, maxX),
        y: clamp(next.y, -maxY, maxY),
      };
    },
    [size.w, size.h]
  );

  /* ── 首次拿到尺寸后设置取景：窄屏放大到半岛，宽屏全图 ── */
  useEffect(() => {
    if (!size.w || appliedInitial.current) return;
    appliedInitial.current = true;
    if (typeof window !== "undefined" && window.matchMedia(NARROW_QUERY).matches) {
      const { scale, focusX, focusY } = NARROW_VIEW;
      setView(
        clampView({
          scale,
          x: -(focusX - 0.5) * size.w * scale,
          y: -(focusY - 0.5) * size.h * scale,
        })
      );
    }
  }, [size.w, size.h, clampView]);

  const zoomBy = useCallback(
    (factor) => setView((v) => clampView({ ...v, scale: v.scale * factor })),
    [clampView]
  );

  const resetView = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia(NARROW_QUERY).matches) {
      const { scale, focusX, focusY } = NARROW_VIEW;
      setView(clampView({
        scale,
        x: -(focusX - 0.5) * size.w * scale,
        y: -(focusY - 0.5) * size.h * scale,
      }));
      return;
    }
    setView({ scale: 1, x: 0, y: 0 });
  }, [clampView, size.w, size.h]);

  /* ── 拖动 / 捏合（Pointer Events：鼠标与触摸同一套） ──
   * 注意：pointerdown 时**不能**立刻 setPointerCapture——捕获会把后续
   * pointer 事件重定向到板子，浏览器派生的 click 也会跟着改目标，
   * 城市标签（按钮）就再也点不到了。所以先记手势，拖过 3px 才捕获。 */
  const onPointerDown = (e) => {
    const node = boardRef.current;
    if (!node) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      gesture.current = { type: "pan", startX: e.clientX, startY: e.clientY, view, captured: false };
      setDragging(true);
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        type: "pinch",
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        view,
        captured: false,
      };
      setDragging(false);
    }
  };

  const capturePointer = (pointerId) => {
    try {
      boardRef.current?.setPointerCapture?.(pointerId);
    } catch {
      /* 合成事件等没有真实 pointerId 的场景：不影响拖动本身 */
    }
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;

    if (g.type === "pan" && pointers.current.size === 1) {
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      // 拖过阈值才捕获：点按（≈0px 位移）永远不捕获，click 才能落到标签上
      if (!g.captured && Math.hypot(dx, dy) > 3) {
        g.captured = true;
        capturePointer(e.pointerId);
      }
      setView(
        clampView({
          scale: g.view.scale,
          x: g.view.x + dx,
          y: g.view.y + dy,
        })
      );
      return;
    }

    if (g.type === "pinch" && pointers.current.size === 2) {
      if (!g.captured) {
        g.captured = true;
        for (const id of pointers.current.keys()) capturePointer(id);
      }
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const ratio = distance / (g.distance || distance);
      setView(clampView({ ...g.view, scale: g.view.scale * ratio }));
    }
  };

  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      gesture.current = null;
      setDragging(false);
    } else if (pointers.current.size === 1) {
      const [only] = [...pointers.current.values()];
      gesture.current = { type: "pan", startX: only.x, startY: only.y, view };
    }
  };

  const onWheel = (e) => {
    if (!(e.ctrlKey || e.metaKey)) return; // 不抢页面滚动
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12);
  };

  /* ── 选中城市：更新 URL 深链 + 打开面板（手机端面板就在地图下面） ── */
  const selectCity = useCallback(
    (id, { open = true } = {}) => {
      setCityId(id);
      if (open) setPanelOpen(true);
      onCity?.(id);
    },
    [onCity]
  );

  useEffect(() => {
    if (initialCity && cities.some((c) => c.id === initialCity)) {
      setCityId(initialCity);
      setPanelOpen(true);
    }
    // 只在深链变化时同步；用户点选走 selectCity
  }, [initialCity, cities]);

  /* ── 两个真实动作：听句子、进场景 —— 都会写探索进度 ── */
  const handleSpeak = (phrase) => {
    speakThai(phrase.th, { rate: 0.72 });
    markCityExplored(city.id, {
      title: `${city.name} · 旅行语言`,
      action: `听了「${phrase.th}」`,
      minutes: 1,
    });
  };

  const handleScene = (scenario) => {
    markCityExplored(city.id, {
      title: `${city.name} · ${scenario.label}`,
      action: `练了「${scenario.label}」场景对话`,
      minutes: 3,
    });
    navigate(`/conversation?scene=${scenario.id}`);
  };

  /* ── 已探索城市的虚线航路（地图坐标系，跟着地图一起缩放） ── */
  const routePoints = useMemo(
    () =>
      cities
        .filter((c) => progress.exploredIds.includes(c.id))
        .map((c) => `${c.x},${c.y}`)
        .join(" "),
    [cities, progress.exploredIds]
  );

  return (
    <div
      className="culp-exp exp-shell"
      data-dragging={dragging ? "1" : undefined}
      /* --exp-u = 板宽（px）：板内所有尺寸都以它为基准，整块板随容器等比缩放 */
      style={{ "--exp-u": `${size.w || 1100}px` }}
    >
      {/* 桌面端在板子上浮着，手机端落到下面（见 index.css 的 .exp-side） */}
      <div className="exp-side">
        <nav className="exp-rail" aria-label="探索路线">
          <p className="exp-rail-head">探索路线</p>
          <ul className="exp-rail-list">
            {cities.map((c, i) => {
              const active = c.id === city.id;
              const done = Boolean(progress.byCity[c.id]);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className="exp-rail-row"
                    data-active={active ? "1" : undefined}
                    data-done={done ? "1" : undefined}
                    onClick={() => selectCity(c.id)}
                  >
                    {/* PAPER 展区编号（目录行左侧的序号）。hidden **属性** →
                        另外三个世界不参与盒模型（行是 flex，display:none 不占位）；
                        若用 hidden 类，父级若挂 space-y 类选择器就会凭空多出间距。 */}
                    <span className="exp-rail-index" hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="exp-rail-thumb">
                      <img src={c.thumb} alt="" loading="lazy" draggable={false} />
                    </span>
                    <span className="exp-rail-name">
                      {c.name}
                      <em>{c.en}</em>
                    </span>
                    {done ? <Check className="exp-rail-check" aria-hidden="true" /> : null}
                    <ArrowRight className="exp-rail-arrow" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="exp-progress">
          <div className="exp-ring" role="img" aria-label={`探索进度 ${progress.percent}%`}>
            <svg viewBox="0 0 42 42" aria-hidden="true">
              <circle className="exp-ring-track" cx="21" cy="21" r="17.5" />
              <circle
                className="exp-ring-fill"
                cx="21"
                cy="21"
                r="17.5"
                style={{ strokeDashoffset: 110 - (110 * progress.percent) / 100 }}
              />
            </svg>
            <span className="exp-ring-value">{progress.percent}%</span>
          </div>
          <div className="exp-progress-text">
            <p className="exp-progress-label">探索进度</p>
            <p className="exp-progress-count">
              {progress.explored} / {progress.total}
            </p>
            <p className="exp-progress-sub">已探索城市</p>
          </div>
        </div>
      </div>

      {/* ── 地图板 ── */}
      <section
        ref={boardRef}
        className="exp-board"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        aria-label="泰国地图：点城市开始探索，拖动平移，⌘ 加滚轮缩放"
      >
        <div
          className="exp-plane"
          style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})` }}
        >
          <img
            className="exp-map"
            src={THAILAND_MAP_IMAGE}
            alt="泰国地图：从北到南标出九座可以探索的城市"
            draggable={false}
            decoding="async"
          />

          {routePoints ? (
            <svg className="exp-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline className="exp-route-line" points={routePoints} vectorEffect="non-scaling-stroke" />
            </svg>
          ) : null}

          {cities.map((c) => {
            const active = c.id === city.id;
            const done = Boolean(progress.byCity[c.id]);
            return (
              <button
                key={c.id}
                type="button"
                className="exp-chip"
                data-active={active ? "1" : undefined}
                data-done={done ? "1" : undefined}
                style={{ left: `${c.x}%`, top: `${c.y}%`, "--exp-city": c.color }}
                onClick={() => selectCity(c.id)}
                aria-pressed={active}
                aria-label={`${c.name} ${c.en}：${c.tags.join("、")}`}
              >
                <span className="exp-chip-icon" aria-hidden="true">
                  {c.emoji}
                </span>
                <span className="exp-chip-body">
                  <span className="exp-chip-title">
                    {c.name}
                    <em>{c.en}</em>
                  </span>
                  <span className="exp-chip-tags">{c.tags.join(" · ")}</span>
                </span>
                {done ? (
                  <span className="exp-chip-done" aria-label="已探索">
                    <Check />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* 罗盘（参考稿左上角那枚，改成真实矢量） */}
        <svg className="exp-compass" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id="expGold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f6dfae" />
              <stop offset="52%" stopColor="#d8b46a" />
              <stop offset="100%" stopColor="#8a6a2e" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(232,198,132,0.30)" strokeWidth="0.8" />
          <circle cx="50" cy="50" r="39" fill="none" stroke="rgba(232,198,132,0.16)" strokeWidth="0.6" />
          <polygon points="50,4 55,45 96,50 55,55 50,96 45,55 4,50 45,45" fill="url(#expGold)" />
          <polygon points="50,17 53.6,46.4 83,50 53.6,53.6 50,83 46.4,53.6 17,50 46.4,46.4"
            fill="url(#expGold)" opacity="0.72" />
          <circle cx="50" cy="50" r="2.6" fill="#0a0f0d" />
          <text x="50" y="13" className="exp-compass-letter">N</text>
          <text x="50" y="94" className="exp-compass-letter">S</text>
          <text x="9" y="53" className="exp-compass-letter">W</text>
          <text x="87" y="53" className="exp-compass-letter">E</text>
        </svg>

        {/* 左侧的两个圆按钮：返回空间选择 / 回到全图 */}
        <div className="exp-actions">
          <button type="button" className="exp-round" onClick={onBack} aria-label="返回空间选择">
            <ArrowLeft />
          </button>
          <button type="button" className="exp-round" onClick={resetView} aria-label="回到全图">
            <Locate />
          </button>
        </div>

        {/* 左下提示条：真实按钮，点开/收起城市面板 */}
        <button
          type="button"
          className="exp-badge"
          onClick={() => setPanelOpen((v) => !v)}
          aria-expanded={panelOpen}
        >
          <span className="exp-badge-thumb">
            <img src={city.thumb} alt="" loading="lazy" draggable={false} />
          </span>
          <span className="exp-badge-text">
            <MousePointerClick aria-hidden="true" />
            {panelOpen ? `收起 ${city.name} 的细节` : "点击城市开始探索"}
          </span>
          <span className="exp-badge-go" aria-hidden="true">
            <Navigation />
          </span>
        </button>

        {/* 缩放控件 */}
        <div className="exp-zoom">
          <button type="button" onClick={() => zoomBy(1 / 1.3)} aria-label="缩小">
            <Minus />
          </button>
          <span className="exp-zoom-value">{Math.round(view.scale * 100)}%</span>
          <button type="button" onClick={() => zoomBy(1.3)} aria-label="放大">
            <Plus />
          </button>
        </div>
      </section>

      {/* ── 页面标题（桌面端浮在地图右上，手机端落在地图上方） ── */}
      <header className="exp-title">
        <p className="exp-eyebrow">Thailand Explorer</p>
        <h1 className="exp-h1">泰国探索者</h1>
        <p className="exp-sub">从语言进入文化，从文化理解泰国。</p>
        <span className="exp-orn" aria-hidden="true">
          <i />
          <b>◆</b>
          <i />
        </span>
      </header>

      {/* ── 城市面板：语言 / 文化 / 场景对话 ── */}
      <AnimatePresence>
        {panelOpen ? (
          <motion.aside
            className="exp-panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22 }}
            aria-label={`${city.name} 的语言与文化`}
          >
            <div className="exp-panel-head">
              <div>
                <p className="exp-panel-en" style={{ color: city.color }}>
                  {city.emoji} {city.en}
                </p>
                <h2 className="exp-panel-name">
                  {city.name}
                  <span className="exp-panel-thai">{city.thai}</span>
                </h2>
                <p className="exp-panel-roman">{city.roman}</p>
              </div>
              <button
                type="button"
                className="exp-round exp-round-sm"
                onClick={() => setPanelOpen(false)}
                aria-label="收起城市面板"
              >
                <X />
              </button>
            </div>

            <p className="exp-panel-tagline">{city.tagline}</p>

            <div className="exp-panel-tags">
              {city.tags.map((t) => (
                <span key={t} className="exp-tag">
                  {t}
                </span>
              ))}
            </div>

            {/* ── 城市志：历史底蕴 / 文化 / 风味 三卷 ── */}
            {profile ? (
              <div className="exp-chronicle">
                <div className="exp-seal">
                  <span className="exp-seal-th">{profile.seal}</span>
                  <span className="exp-seal-meta">
                    {profile.sealCn}
                    <em>{profile.sealRoman}</em>
                  </span>
                </div>

                <p className="exp-intro">{profile.intro}</p>

                <div className="exp-facts">
                  {profile.facts.map((fact) => (
                    <p key={fact.label} className="exp-fact">
                      <b>{fact.label}</b>
                      {fact.value}
                    </p>
                  ))}
                </div>

                <nav className="exp-volumes" aria-label={`${city.name} 城市志卷目`}>
                  {cityVolumeMeta.map((meta) => (
                    <button
                      key={meta.id}
                      type="button"
                      className="exp-volume"
                      data-active={volume === meta.id ? "1" : undefined}
                      aria-pressed={volume === meta.id}
                      onClick={() => setVolume(meta.id)}
                    >
                      <span aria-hidden="true">{meta.emoji}</span>
                      {meta.label}
                    </button>
                  ))}
                </nav>

                {volume === "history" ? (
                  <div className="exp-volume-body">
                    {profile.history.map((item) => (
                      <article key={item.h} className="exp-era">
                        <h3 className="exp-era-head">{item.h}</h3>
                        <p className="exp-era-text">{item.p}</p>
                      </article>
                    ))}
                  </div>
                ) : null}

                {volume === "culture" ? (
                  <div className="exp-volume-body">
                    {profile.culture.map((text) => (
                      <p key={text.slice(0, 12)} className="exp-culture-p">
                        {text}
                      </p>
                    ))}
                  </div>
                ) : null}

                {volume === "flavor" ? (
                  <div className="exp-volume-body">
                    <ul className="exp-dishes">
                      {profile.flavor.map((dish) => (
                        <li key={dish.th} className="exp-dish">
                          <p className="exp-dish-head">
                            <span className="exp-dish-name">{dish.name}</span>
                            <span className="exp-dish-th">{dish.th}</span>
                            <em className="exp-dish-roman">{dish.roman}</em>
                          </p>
                          <p className="exp-dish-note">{dish.note}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="exp-panel-block">
              <p className="exp-panel-label">这座城市这样说</p>
              {city.language.map((line) => (
                <button
                  key={line.th}
                  type="button"
                  className="exp-line"
                  onClick={() => handleSpeak(line)}
                >
                  <span className="exp-line-text">
                    <span className="exp-line-thai">{line.th}</span>
                    <span className="exp-line-cn">
                      {line.cn}
                      <em>{line.roman}</em>
                    </span>
                  </span>
                  <Volume2 className="exp-line-icon" aria-hidden="true" />
                </button>
              ))}
            </div>

            {cultures.length ? (
              <div className="exp-panel-block">
                <p className="exp-panel-label">城市文化</p>
                <ul className="exp-culture">
                  {cultures.map((point) => (
                    <li key={point.id}>
                      <p className="exp-culture-title">
                        {point.emoji} {point.title}
                      </p>
                      <p className="exp-culture-text">{point.meaning}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="exp-panel-block">
              <p className="exp-panel-label">在这里练对话</p>
              <div className="exp-scenes">
                {[city.scenario, ...city.extraScenarios].map((scenario) => (
                  <button
                    key={scenario.id}
                    type="button"
                    className="exp-scene"
                    onClick={() => handleScene(scenario)}
                  >
                    {scenario.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="exp-panel-foot">
              {explored
                ? `已探索 ${explored.visits} 次 · 最近：${explored.lastAction}`
                : "还没在这里做过练习——听一句或进一次场景对话就算探索过"}
            </p>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
