import React, { Suspense, lazy, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { warmUpSpeech } from "@/lib/thaiSpeech";
import {
  loadFeatureFlags,
  subscribeFeaturesStream,
} from "@/lib/features";

// 布局与核心依赖保持同步加载（首屏必需）
import MainLayout from "@/layouts/MainLayout";

import { useAuth } from "@/lib/AuthContext";

import { AIOrb } from "@/components/ui/premium";

/* =========================================================
   路由级懒加载：页面按需分包，首屏只加载当前页面
========================================================= */

const Home = lazy(() => import("@/pages/Home"));
const LessonVideo = lazy(() => import("@/pages/LessonVideo"));
const Course = lazy(() => import("@/pages/Course"));
const SpeakingPractice = lazy(() =>
  import("@/pages/SpeakingPractice")
);
const Vocabulary = lazy(() => import("@/pages/Vocabulary"));
const ThaiCorpus = lazy(() => import("@/pages/ThaiCorpus"));
const NewsListening = lazy(() => import("@/pages/NewsListening"));
const NewsArticle = lazy(() => import("@/pages/NewsArticle"));
const LessonText = lazy(() => import("@/pages/LessonText"));
const Conversation = lazy(() => import("@/pages/Conversation"));
const Plan = lazy(() => import("@/pages/Plan"));
const Ranking = lazy(() => import("@/pages/Ranking"));
const Settings = lazy(() => import("@/pages/Settings"));
const Profile = lazy(() => import("@/pages/Profile"));
const AdminCodes = lazy(() => import("@/pages/AdminCodes"));
const CourseDetail = lazy(() => import("@/pages/CourseDetail"));
const Login = lazy(() => import("@/pages/Login"));
const ThaiLanding = lazy(() => import("@/pages/ThaiLanding"));
const Register = lazy(() => import("@/pages/Register"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const Challenges = lazy(() => import("@/pages/Challenges"));
const WrongNotebook = lazy(() => import("@/pages/WrongNotebook"));
const OAuthConsent = lazy(() => import("@/pages/OAuthConsent"));
const ThaiAlphabet = lazy(() => import("@/pages/ThaiAlphabet"));
const VocabMatch = lazy(() => import("@/pages/VocabMatch"));
const SentenceFill = lazy(() => import("@/pages/SentenceFill"));
const WordSegment = lazy(() => import("@/pages/WordSegment"));
const LearnLoop = lazy(() => import("@/pages/LearnLoop"));


/* =========================================================
   品牌化加载占位（Suspense fallback）
========================================================= */

function PageLoading() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#061312] text-white">

      {/* 氛围光晕 */}

      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-500/[0.08] blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-yellow-400/[0.06] blur-[120px]" />

      <div className="relative text-center">

        {/* AI 核心球 */}

        <div className="mx-auto w-fit">
          <AIOrb size={110} />
        </div>

        <div className="mt-6 text-3xl font-black tracking-wide">
          <span className="
            bg-gradient-to-r
            from-yellow-300
            via-white
            to-emerald-300
            bg-clip-text
            text-transparent
          ">
            ThaiAI
          </span>
        </div>

        <p className="mt-2 text-sm text-white/45">
          กำลังเข้าสู่พื้นที่เรียนรู้ภาษาไทย…
        </p>

        <p className="mt-1 text-xs tracking-wide text-white/30">
          正在进入你的泰语学习空间
        </p>

        <div className="
          mx-auto
          mt-6
          h-1
          w-36
          overflow-hidden
          rounded-full
          bg-white/10
        ">
          <div className="
            h-full
            w-1/2
            animate-pulse
            rounded-full
            bg-gradient-to-r
            from-emerald-400
            to-yellow-300
          " />
        </div>

      </div>

    </div>
  );
}


/* =========================================================
   根路径
========================================================= */

function RootRoute() {
  const {
    isAuthenticated,
    isLoadingAuth,
  } = useAuth();


  /* 正在检查登录状态 */

  if (isLoadingAuth) {
    return <PageLoading />;
  }


  /* 没有登录 */

  if (!isAuthenticated) {
    return <Login />;
  }


  /* 已登录 */

  return (
    <MainLayout>
      <Home />
    </MainLayout>
  );
}


/* =========================================================
   App
========================================================= */

export default function App() {

  /* =====================================================
     启动时加载功能开关（如 AI 老师是否开放），
     并订阅 SSE 实时同步（多端修改开关自动刷新）
  ===================================================== */

  useEffect(() => {
    loadFeatureFlags().then(() => {
      subscribeFeaturesStream();
    });
  }, []);

  /* =====================================================
     全局语音预热：浏览器要求用户先交互才能合成语音
     （autoplay 策略）。首次点击/按键时解锁 speechSynthesis，
     让课文听力的自动播放发音也能出声。
  ===================================================== */

  useEffect(() => {
    const warm = () => {
      warmUpSpeech();
    };

    window.addEventListener("pointerdown", warm, {
      once: true,
      passive: true,
    });
    window.addEventListener("keydown", warm, {
      once: true,
      passive: true,
    });

    return () => {
      window.removeEventListener("pointerdown", warm);
      window.removeEventListener("keydown", warm);
    };
  }, []);

  return (
    <BrowserRouter>

      <Suspense fallback={<PageLoading />}>

      <Routes>


        {/* =================================================
            首页
        ================================================= */}

        <Route
          path="/"
          element={<RootRoute />}
        />


        {/* =================================================
            登录
        ================================================= */}

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/thai-landing"
          element={<ThaiLanding />}
        />


        {/* =================================================
            注册
        ================================================= */}

        <Route
          path="/register"
          element={<Register />}
        />


        {/* =================================================
            忘记密码
        ================================================= */}

        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />


        {/* =================================================
            重置密码
        ================================================= */}

        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />


        {/* =================================================
            OAuth 授权页（平台 MCP 授权回调）
        ================================================= */}

        <Route
          path="/oauth/consent"
          element={<OAuthConsent />}
        />


        {/* =================================================
            课程学习
        ================================================= */}

        <Route
          path="/course"
          element={
            <MainLayout>
              <Course />
            </MainLayout>
          }
        />
<Route
  path="/course/:courseId"
  element={
    <MainLayout>
      <CourseDetail />
    </MainLayout>
  }
/>
<Route
  path="/course/:courseId/lesson/:lessonId"
  element={
    <MainLayout>
      <LessonVideo />
    </MainLayout>
  }
/>

        {/* =================================================
            口语练习
        ================================================= */}

        <Route
          path="/speaking"
          element={
            <MainLayout>
              <SpeakingPractice />
            </MainLayout>
          }
        />


        {/* =================================================
            词汇学习
        ================================================= */}

        <Route
          path="/vocabulary"
          element={
            <MainLayout>
              <Vocabulary />
            </MainLayout>
          }
        />


        {/* =================================================
            本地泰语语料库
        ================================================= */}

        <Route
          path="/corpus"
          element={
            <MainLayout>
              <ThaiCorpus />
            </MainLayout>
          }
        />

        <Route
          path="/corpus/listening"
          element={
            <MainLayout>
              <NewsListening />
            </MainLayout>
          }
        />

        <Route
          path="/corpus/read"
          element={
            <MainLayout>
              <NewsArticle />
            </MainLayout>
          }
        />


        {/* =================================================
            课文教学
        ================================================= */}

        <Route
          path="/lessons"
          element={
            <MainLayout>
              <LessonText />
            </MainLayout>
          }
        />

        <Route
          path="/lessons/:lessonId"
          element={
            <MainLayout>
              <LessonText />
            </MainLayout>
          }
        />


        {/* =================================================
            对话练习
        ================================================= */}

        <Route
          path="/conversation"
          element={
            <MainLayout>
              <Conversation />
            </MainLayout>
          }
        />


        {/* =================================================
            泰语字母表
        ================================================= */}

        <Route
          path="/alphabet"
          element={
            <MainLayout>
              <ThaiAlphabet />
            </MainLayout>
          }
        />


        {/* =================================================
            词汇配对练习
        ================================================= */}

        <Route
          path="/vocab-match"
          element={
            <MainLayout>
              <VocabMatch />
            </MainLayout>
          }
        />


        {/* =================================================
            句子填空练习
        ================================================= */}

        <Route
          path="/sentence-fill"
          element={
            <MainLayout>
              <SentenceFill />
            </MainLayout>
          }
        />


        {/* =================================================
            分词练习
        ================================================= */}

        <Route
          path="/word-segment"
          element={
            <MainLayout>
              <WordSegment />
            </MainLayout>
          }
        />


        {/* =================================================
            今日学习闭环（学→练→测→复习）
        ================================================= */}

        <Route
          path="/loop"
          element={
            <MainLayout>
              <LearnLoop />
            </MainLayout>
          }
        />


        {/* =================================================
            学习计划
        ================================================= */}

        <Route
          path="/plan"
          element={
            <MainLayout>
              <Plan />
            </MainLayout>
          }
        />


        {/* =================================================
            学习排行榜
        ================================================= */}

        <Route
          path="/ranking"
          element={
            <MainLayout>
              <Ranking />
            </MainLayout>
          }
        />


        {/* =================================================
            学习挑战赛（自带顶部导航）
        ================================================= */}

        <Route
          path="/challenges"
          element={<Challenges />}
        />


        {/* =================================================
            错题本（自带顶部导航）
        ================================================= */}

        <Route
          path="/wrong-notebook"
          element={<WrongNotebook />}
        />


        {/* =================================================
            口语练习（顶部导航版）
        ================================================= */}

        <Route
          path="/speaking-practice"
          element={<SpeakingPractice />}
        />


        {/* =================================================
            设置中心
        ================================================= */}

        <Route
          path="/settings"
          element={
            <MainLayout>
              <Settings />
            </MainLayout>
          }
        />


        {/* =================================================
            个人中心
        ================================================= */}

        <Route
          path="/profile"
          element={
            <MainLayout>
              <Profile />
            </MainLayout>
          }
        />


        {/* =================================================
            管理端：激活码管理
        ================================================= */}

        <Route
          path="/admin/codes"
          element={
            <MainLayout>
              <AdminCodes />
            </MainLayout>
          }
        />


        {/* =================================================
            未知地址
        ================================================= */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />

      </Routes>

      </Suspense>

    </BrowserRouter>
  );
}