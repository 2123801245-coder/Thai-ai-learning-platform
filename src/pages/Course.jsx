// src/pages/Course.jsx

import React, {
  useMemo,
  useState,
} from "react";

import {
  motion,
} from "framer-motion";

import {
  BookOpen,
  Play,
  Clock3,
  ChevronRight,
  Sparkles,
  Target,
  Flame,
  GraduationCap,
  Lock,
  Crown,
  Video,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import {
  AnimatedProgress,
} from "@/components/ui/premium";

import {
  courses,
} from "@/data/courses";

import {
  getLessonsByCourseId,
} from "@/data/lessons";

import {
  getCourseStats,
} from "@/lib/courseProgress";

import { useAuth } from "@/lib/AuthContext";

import VipPanel from "@/components/common/VipPanel";

import {
  ThaiCorner,
  ThaiSectionDivider,
  BangkokSkyline,
} from "@/components/common/ThaiDecor";


// =========================================================
// 分类
// =========================================================

const categories = [
  "全部",
  "基础",
  "口语",
  "语法",
  "听力",
  "文化",
  "发音",
  "场景",
  "阅读",
  "商务",
  "外交",
];


// =========================================================
// 主页面
// =========================================================

export default function Course() {

  const navigate =
    useNavigate();

  const { user } = useAuth();
  const isVipUser = !!user?.isVip;

  const [
    category,
    setCategory,
  ] = useState("全部");

  const [
    vipOpen,
    setVipOpen,
  ] = useState(false);


  // =======================================================
  // 每门课程的实时进度（localStorage 持久化）
  // =======================================================

  const courseStats =
    useMemo(() => {
      const map = {};

      courses.forEach((course) => {
        map[course.id] =
          getCourseStats(
            course.id,
            getLessonsByCourseId(
              course.id
            )
          );
      });

      return map;
    }, []);


  // =======================================================
  // 已发布课程
  // =======================================================

  const publishedCourses =
    courses.filter(
      (course) =>
        course.status !== "coming"
    );


  // =======================================================
  // 正在学习（有真实进度，或标记为 learning）
  // =======================================================

  const learningCourses =
    courses.filter(
      (course) =>
        course.status ===
          "learning" ||
        (courseStats[
          course.id
        ]?.progressPercent ||
          0) > 0
    );


  // =======================================================
  // 未来课程
  // =======================================================

  const comingCourses =
    courses.filter(
      (course) =>
        course.status ===
        "coming"
    );


  // =======================================================
  // 当前筛选
  // =======================================================

  const filteredCourses =
    useMemo(() => {

      if (
        category ===
        "全部"
      ) {
        return publishedCourses;
      }

      return publishedCourses.filter(
        (course) =>
          course.category ===
          category
      );

    }, [
      category,
      publishedCourses.length,
    ]);


  // =======================================================
  // 总课程数（按真实视频数据）
  // =======================================================

  const totalLessons =
    courses.reduce(
      (
        sum,
        course
      ) =>
        sum +
        getLessonsByCourseId(
          course.id
        ).length,
      0
    );


  // =======================================================
  // 已完成课程（实时统计）
  // =======================================================

  const completedLessons =
    courses.reduce(
      (
        sum,
        course
      ) =>
        sum +
        (courseStats[
          course.id
        ]?.completedCount ||
          0),
      0
    );


  // =======================================================
  // 总进度
  // =======================================================

  const overallProgress =
    totalLessons > 0
      ? Math.round(
          (
            completedLessons /
            totalLessons
          ) * 100
        )
      : 0;


  return (

    <div className="relative space-y-7 pb-10">


      {/* =====================================================
          HERO
      ===================================================== */}

      <motion.div

        initial={{
          opacity: 0,
          y: -15,
        }}

        animate={{
          opacity: 1,
          y: 0,
        }}

        className="
          relative
          overflow-hidden
          rounded-[28px]
          border
          border-white/[0.08]
          bg-gradient-to-br
          from-emerald-400/[0.10]
          via-white/[0.035]
          to-yellow-300/[0.06]
          p-6
          backdrop-blur-xl
          sm:p-7
        "
      >


        {/* 光晕 */}

        <div className="
          pointer-events-none
          absolute
          -right-20
          -top-20
          h-56
          w-56
          rounded-full
          bg-emerald-400/[0.08]
          blur-3xl
        " />


        <div className="
          pointer-events-none
          absolute
          -bottom-24
          left-[40%]
          h-48
          w-48
          rounded-full
          bg-yellow-300/[0.05]
          blur-3xl
        " />

        {/* 泰式金线角饰（Temple Gold） */}

        <ThaiCorner
          corners={["tl", "tr", "bl", "br"]}
          size={28}
          className="z-10"
        />

        {/* 曼谷剪影（极淡，装饰课程 Hero 背景） */}

        <BangkokSkyline
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full opacity-[0.12]"
          opacity={0.6}
        />


        <div className="
          relative
          flex
          flex-col
          gap-6
          lg:flex-row
          lg:items-end
          lg:justify-between
        ">


          {/* 左侧 */}

          <div>

            <div className="
              flex
              items-center
              gap-2
              text-xs
              font-semibold
              tracking-[0.2em]
              text-emerald-300/70
            ">

              <Sparkles className="h-4 w-4" />

              THAI LEARNING COURSES

            </div>


            <h1 className="
              mt-3
              text-3xl
              font-black
              tracking-tight
              text-white
              sm:text-4xl
            ">
              课程学习
            </h1>


            <p className="
              mt-2
              max-w-xl
              text-sm
              leading-6
              text-white/40
              sm:text-base
            ">
              从泰语发音开始，
              逐步进入拼读、口语、
              听力与真实交流。
              每一门课程都以视频学习为核心。
            </p>


            <div className="
              mt-5
              flex
              flex-wrap
              gap-2
            ">


              {/* 学习路径 */}

              <span className="
                flex
                items-center
                gap-1.5
                rounded-full
                border
                border-emerald-300/10
                bg-emerald-400/[0.07]
                px-3
                py-1.5
                text-xs
                text-emerald-200/70
              ">

                <GraduationCap className="h-3.5 w-3.5" />

                泰语学习路径

              </span>


              {/* 视频 */}

              <span className="
                flex
                items-center
                gap-1.5
                rounded-full
                border
                border-white/[0.07]
                bg-white/[0.04]
                px-3
                py-1.5
                text-xs
                text-white/40
              ">

                <Video className="h-3.5 w-3.5" />

                视频课程

              </span>


              {/* 课程数量 */}

              <span className="
                flex
                items-center
                gap-1.5
                rounded-full
                border
                border-white/[0.07]
                bg-white/[0.04]
                px-3
                py-1.5
                text-xs
                text-white/40
              ">

                <BookOpen className="h-3.5 w-3.5" />

                {publishedCourses.length}
                {" "}门课程

              </span>

            </div>

          </div>


          {/* =================================================
              总进度
          ================================================= */}

          <div className="
            min-w-[220px]
            rounded-2xl
            border
            border-white/[0.08]
            bg-black/10
            p-4
          ">

            <div className="
              flex
              items-center
              justify-between
            ">

              <span className="
                text-[10px]
                uppercase
                tracking-widest
                text-white/30
              ">
                总体学习进度
              </span>

              <span className="
                text-sm
                font-bold
                text-emerald-300
              ">
                {overallProgress}%
              </span>

            </div>


            <div className="
              mt-3
              h-2
              overflow-hidden
              rounded-full
              bg-white/[0.06]
            ">

              <motion.div

                initial={{
                  width: 0,
                }}

                animate={{
                  width:
                    `${overallProgress}%`,
                }}

                transition={{
                  duration: 1,
                  ease: "easeOut",
                }}

                className="
                  h-full
                  rounded-full
                  bg-gradient-to-r
                  from-emerald-400
                  via-teal-300
                  to-yellow-300
                "
              />

            </div>


            <div className="
              mt-2
              text-[10px]
              text-white/25
            ">

              已完成{" "}
              {completedLessons}
              {" / "}
              {totalLessons}
              {" "}节课程

            </div>

          </div>

        </div>

      </motion.div>



      {/* =====================================================
          数据统计
      ===================================================== */}

      <div className="
        grid
        grid-cols-2
        gap-3
        lg:grid-cols-4
      ">


        <CourseStat
          icon={BookOpen}
          label="课程数量"
          value={publishedCourses.length}
          suffix="门"
        />


        <CourseStat
          icon={Video}
          label="视频课程"
          value={totalLessons}
          suffix="节"
        />


        <CourseStat
          icon={Target}
          label="平均进度"
          value={overallProgress}
          suffix="%"
        />


        <CourseStat
          icon={Flame}
          label="学习状态"
          value={
            learningCourses.length >
            0
              ? "进行中"
              : "待开始"
          }
        />

      </div>



      {/* =====================================================
          继续学习
      ===================================================== */}

      {learningCourses.length >
        0 && (

        <section>

          <div className="
            mb-4
            flex
            items-end
            justify-between
          ">

            <div>

              <div className="
                flex
                items-center
                gap-2
              ">

                <span className="
                  h-1.5
                  w-1.5
                  rounded-full
                  bg-emerald-300
                  shadow-[0_0_10px_rgba(110,231,183,.7)]
                " />

                <h2 className="
                  text-lg
                  font-bold
                  text-white
                ">
                  继续学习
                </h2>

              </div>


              <p className="
                mt-1
                text-xs
                text-white/30
              ">
                从上次停下的地方继续
              </p>

            </div>

          </div>


          <div className="
            grid
            gap-4
            lg:grid-cols-2
          ">

            {learningCourses
              .slice(0, 2)
              .map(
                (
                  course,
                  index
                ) => (

                  <LearningCard
                    key={
                      course.id
                    }
                    course={
                      course
                    }
                    index={
                      index
                    }
                    progress={
                      courseStats[
                        course.id
                      ]?.progressPercent ||
                      0
                    }
                    completedCount={
                      courseStats[
                        course.id
                      ]?.completedCount ||
                      0
                    }
                    onOpen={() =>
                      navigate(
                        `/course/${course.id}`
                      )
                    }
                  />

                )
              )}

          </div>

        </section>

      )}



      {/* =====================================================
          免费基础
      ===================================================== */}

      <section>

        <div className="mb-4">

          <div className="
            flex
            items-center
            gap-2
          ">

            <GraduationCap className="
              h-5
              w-5
              text-emerald-300
            " />

            <h2 className="
              text-lg
              font-bold
              text-white
            ">
              基础课程
            </h2>

          </div>


          <p className="
            mt-1
            text-xs
            text-white/30
          ">
            免费开放，适合刚开始学习泰语的同学
          </p>

        </div>


        <div className="
          grid
          gap-4
          sm:grid-cols-2
          xl:grid-cols-3
        ">

          {courses
            .filter(
              (course) =>
                course.levelKey ===
                "basic"
            )
            .map(
              (
                course,
                index
              ) => (

                <CourseCard
                  key={
                    course.id
                  }
                  course={
                    course
                  }
                  index={
                    index
                  }
                  isVipUser={isVipUser}
                  progress={
                    courseStats[
                      course.id
                    ]?.progressPercent ||
                    0
                  }
                  onOpen={() =>
                    navigate(
                      `/course/${course.id}`
                    )
                  }
                />

              )
            )}

        </div>

      </section>



      {/* =====================================================
          VIP
      ===================================================== */}

      <section>

        <div className="mb-4">

          <div className="
            flex
            items-center
            gap-2
          ">

            <Crown className="
              h-5
              w-5
              text-yellow-300
            " />

            <h2 className="
              text-lg
              font-bold
              text-white
            ">
              VIP 进阶课程
            </h2>

            <span className="
              rounded-full
              border
              border-yellow-300/10
              bg-yellow-300/[0.06]
              px-2
              py-0.5
              text-[9px]
              font-semibold
              text-yellow-200/60
            ">
              VIP
            </span>

          </div>


          <p className="
            mt-1
            text-xs
            text-white/30
          ">
            深入学习泰语，进入真实交流场景
          </p>

        </div>


        <div className="
          grid
          gap-4
          sm:grid-cols-2
          xl:grid-cols-3
        ">

          {courses
            .filter(
              (course) =>
                course.isVip &&
                course.status ===
                  "vip"
            )
            .map(
              (
                course,
                index
              ) => (

                <CourseCard
                  key={
                    course.id
                  }
                  course={
                    course
                  }
                  index={
                    index
                  }
                  isVipUser={isVipUser}
                  progress={
                    courseStats[
                      course.id
                    ]?.progressPercent ||
                    0
                  }
                  onOpen={() =>
                    navigate(
                      `/course/${course.id}`
                    )
                  }
                  onVip={() =>
                    setVipOpen(true)
                  }
                />

              )
            )}

        </div>

      </section>



      {/* 泰式装饰分隔线 */}

      <ThaiSectionDivider
        className="mx-auto max-w-2xl"
        compact
      />



      {/* =====================================================
          分类
      ===================================================== */}

      <section>

        <div className="mb-4">

          <h2 className="
            text-lg
            font-bold
            text-white
          ">
            全部课程
          </h2>

          <p className="
            mt-1
            text-xs
            text-white/30
          ">
            根据学习方向选择课程
          </p>

        </div>


        <div className="
          mb-5
          flex
          gap-2
          overflow-x-auto
          pb-1
        ">

          {categories.map(
            (
              item
            ) => {

              const active =
                category ===
                item;

              return (

                <button
                  key={
                    item
                  }

                  onClick={() =>
                    setCategory(
                      item
                    )
                  }

                  className={`
                    whitespace-nowrap
                    rounded-full
                    border
                    px-4
                    py-2
                    text-xs
                    font-medium
                    transition-all
                    ${
                      active
                        ? "border-emerald-300/20 bg-emerald-400/15 text-emerald-200 shadow-lg shadow-emerald-900/10"
                        : "border-white/[0.08] bg-white/[0.035] text-white/35 hover:bg-white/[0.07] hover:text-white/70"
                    }
                  `}
                >

                  {item}

                </button>

              );

            }
          )}

        </div>


        <div className="
          grid
          gap-4
          sm:grid-cols-2
          xl:grid-cols-3
        ">

          {filteredCourses.map(
            (
              course,
              index
            ) => (

              <CourseCard
                key={
                  course.id
                }
                course={
                  course
                }
                index={
                  index
                }
                isVipUser={isVipUser}
                progress={
                  courseStats[
                    course.id
                  ]?.progressPercent ||
                  0
                }
                onOpen={() =>
                  navigate(
                    `/course/${course.id}`
                  )
                }
                onVip={() =>
                  setVipOpen(true)
                }
              />

            )
          )}

        </div>

      </section>



      {/* =====================================================
          即将上线
      ===================================================== */}

      {comingCourses.length >
        0 && (

        <section>

          <div className="mb-4">

            <div className="
              flex
              items-center
              gap-2
            ">

              <Sparkles className="
                h-5
                w-5
                text-yellow-300/60
              " />

              <h2 className="
                text-lg
                font-bold
                text-white
              ">
                更多课程即将上线
              </h2>

            </div>


            <p className="
              mt-1
              text-xs
              text-white/30
            ">
              课程内容会持续增加
            </p>

          </div>


          <div className="
            grid
            gap-4
            sm:grid-cols-2
            xl:grid-cols-4
          ">

            {comingCourses.map(
              (
                course,
                index
              ) => (

                <ComingCard
                  key={
                    course.id
                  }
                  course={
                    course
                  }
                  index={
                    index
                  }
                />

              )
            )}

          </div>

        </section>

      )}

      {/* VIP 权益面板 */}

      <VipPanel
        open={vipOpen}
        onClose={() =>
          setVipOpen(false)
        }
      />

    </div>
  );
}


// =========================================================
// 数据统计卡片
// =========================================================

function CourseStat({
  icon: Icon,
  label,
  value,
  suffix = "",
}) {

  return (

    <motion.div

      whileHover={{
        y: -2,
      }}

      className="
        rounded-2xl
        border
        border-white/[0.08]
        bg-white/[0.035]
        p-4
        backdrop-blur-xl
      "
    >

      <div className="
        flex
        items-center
        justify-between
      ">

        <div className="
          flex
          h-9
          w-9
          items-center
          justify-center
          rounded-xl
          border
          border-emerald-300/10
          bg-emerald-400/[0.07]
        ">

          <Icon className="
            h-4
            w-4
            text-emerald-300
          " />

        </div>


        <Sparkles className="
          h-3.5
          w-3.5
          text-yellow-300/20
        " />

      </div>


      <div className="mt-3">

        <p className="
          text-[10px]
          text-white/30
        ">
          {label}
        </p>


        <div className="
          mt-1
          flex
          items-baseline
          gap-1
        ">

          <span className="
            text-xl
            font-black
            text-white
          ">
            {value}
          </span>


          {suffix && (

            <span className="
              text-xs
              text-white/30
            ">
              {suffix}
            </span>

          )}

        </div>

      </div>

    </motion.div>
  );
}


// =========================================================
// 继续学习
// =========================================================

function LearningCard({
  course,
  index,
  onOpen,
  progress,
  completedCount,
}) {

  return (

    <motion.div

      initial={{
        opacity: 0,
        y: 12,
      }}

      animate={{
        opacity: 1,
        y: 0,
      }}

      transition={{
        delay:
          index * 0.08,
      }}

      className="
        group
        relative
        overflow-hidden
        rounded-3xl
        border
        border-emerald-300/[0.10]
        bg-gradient-to-br
        from-emerald-400/[0.10]
        via-white/[0.035]
        to-teal-400/[0.06]
        p-5
        backdrop-blur-xl
      "
    >

      <div className="
        pointer-events-none
        absolute
        -right-10
        -top-10
        h-32
        w-32
        rounded-full
        bg-emerald-300/[0.08]
        blur-3xl
      " />


      <div className="relative">

        <div className="
          flex
          items-start
          justify-between
        ">

          <div>

            <span className="
              rounded-full
              border
              border-emerald-300/10
              bg-emerald-400/[0.08]
              px-2.5
              py-1
              text-[10px]
              text-emerald-200/70
            ">
              正在学习
            </span>


            <h3 className="
              mt-3
              text-lg
              font-bold
              text-white
            ">
              {course.title}
            </h3>


            <p className="
              mt-1
              text-xs
              text-white/35
            ">
              第{" "}
              {completedCount + 1}
              {" "}节 · 共{" "}
              {course.lessons}
              {" "}节
            </p>

          </div>


          <div className="
            flex
            h-11
            w-11
            items-center
            justify-center
            rounded-2xl
            bg-emerald-400/10
          ">

            <Video className="
              h-5
              w-5
              text-emerald-300
            " />

          </div>

        </div>


        <div className="mt-5">

          <div className="
            mb-2
            flex
            items-center
            justify-between
            text-[10px]
          ">

            <span className="text-white/30">
              学习进度
            </span>

            <span className="
              font-semibold
              text-emerald-300
            ">
              {progress}%
            </span>

          </div>


          <div className="
            h-2
            overflow-hidden
            rounded-full
            bg-white/[0.06]
          ">

            <motion.div

              initial={{
                width: 0,
              }}

              animate={{
                width:
                  `${progress}%`,
              }}

              transition={{
                duration: 0.8,
              }}

              className="
                h-full
                rounded-full
                bg-gradient-to-r
                from-emerald-400
                to-teal-300
              "
            />

          </div>

        </div>


        <button

          onClick={
            onOpen
          }

          className="
            mt-5
            flex
            w-full
            items-center
            justify-center
            gap-2
            rounded-xl
            bg-gradient-to-r
            from-emerald-400
            to-teal-400
            py-2.5
            text-sm
            font-semibold
            text-white
            shadow-lg
            shadow-emerald-900/20
            transition-all
            hover:-translate-y-0.5
            hover:shadow-emerald-400/20
          "
        >

          <Play className="
            h-4
            w-4
            fill-current
          " />

          继续学习

          <ChevronRight className="
            h-4
            w-4
          " />

        </button>

      </div>

    </motion.div>
  );
}


// =========================================================
// 普通课程
// =========================================================

/* 课程封面泰文字母池（抽象装饰） */
const COVER_THAI = ["สวัสดี", "ภาษาไทย", "เรียน", "อักษร", "เสียง", "คำ"];

/* 课程封面渐变（按课程 color 字段） */
const COVER_GRADS = {
  emerald: "from-emerald-400/[0.16] via-teal-500/[0.05] to-transparent",
  teal: "from-teal-400/[0.15] via-cyan-500/[0.05] to-transparent",
  amber: "from-yellow-300/[0.14] via-amber-500/[0.05] to-transparent",
  blue: "from-blue-400/[0.14] via-indigo-500/[0.05] to-transparent",
  purple: "from-purple-400/[0.14] via-fuchsia-500/[0.05] to-transparent",
  rose: "from-rose-400/[0.13] via-pink-500/[0.05] to-transparent",
  gold: "from-yellow-300/[0.16] via-amber-400/[0.06] to-transparent",
};

function CourseCover({ course, index }) {
  const grad =
    COVER_GRADS[course.color] || COVER_GRADS.emerald;
  const glyphs = [
    COVER_THAI[(index * 3) % COVER_THAI.length],
    COVER_THAI[(index * 3 + 1) % COVER_THAI.length],
    COVER_THAI[(index * 3 + 2) % COVER_THAI.length],
  ];

  /* 有 cover 图片时显示实景封面，无图优雅回退到渐变封面 */
  const hasCover = !!course.cover;

  return (
    <div
      className={`relative mb-5 h-24 overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br ${grad}`}
    >
      {hasCover ? (
        <>
          <img
            src={course.cover}
            alt={course.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-[#04110F]/80 via-transparent to-[#04110F]/30" />
        </>
      ) : (
        <>
          {/* 漂浮泰文字母（极淡） */}

          {glyphs.map((g, i) => (
            <span
              key={i}
              className="absolute font-black text-white/[0.06] thai-float"
              style={{
                left: `${14 + i * 32}%`,
                top: `${20 + (i % 2) * 22}%`,
                fontSize: `${22 + (i % 3) * 10}px`,
                animationDelay: `${i * 2}s`,
              }}
            >
              {g}
            </span>
          ))}
        </>
      )}

      {/* 金色音波（底部） */}

      <svg
        className="absolute inset-x-0 bottom-0 h-12 w-full"
        viewBox="0 0 240 48"
        preserveAspectRatio="none"
      >
        <path
          d="M 0 26 Q 20 8, 40 26 T 80 26 T 120 26 T 160 26 T 200 26 T 240 26"
          stroke="#F5D67B"
          strokeWidth="1.4"
          fill="none"
          opacity="0.35"
        />
        <path
          d="M 0 32 Q 24 18, 48 32 T 96 32 T 144 32 T 192 32 T 240 32"
          stroke="#6EE7B7"
          strokeWidth="1"
          fill="none"
          opacity="0.25"
        />
      </svg>

      {/* 顶部高光 */}

      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
    </div>
  );
}

function CourseCard({
  course,
  index,
  onOpen,
  onVip = () => {},
  isVipUser = false,
  progress,
}) {

  const isVip =
    course.isVip === true;

  const coming =
    course.status ===
    "coming";


  return (

    <motion.div

      initial={{
        opacity: 0,
        y: 15,
      }}

      animate={{
        opacity: 1,
        y: 0,
      }}

      transition={{
        delay:
          index * 0.06,
      }}

      whileHover={
        coming
          ? {}
          : {
              y: -4,
            }
      }

      className={`
        group
        relative
        overflow-hidden
        rounded-3xl
        p-5
        card-lift
        transition-all

        ${
          coming
            ? "border border-white/[0.05] bg-white/[0.02]"
            : isVip
            ? "premium-glass-gold card-glow-gold gold-shimmer"
            : "premium-glass card-glow-emerald"
        }
      `}
    >

      {!coming && (

        <div className={`
          pointer-events-none
          absolute
          -right-10
          -top-10
          h-28
          w-28
          rounded-full
          blur-3xl

          ${
            isVip
              ? "bg-yellow-300/[0.06]"
              : "bg-emerald-400/[0.06]"
          }
        `} />

      )}


      <div className="relative">

        {/* 课程封面视觉（泰文字母 + 金色音波） */}

        {!coming && <CourseCover course={course} index={index} />}


        {/* 顶部 */}

        <div className="
          flex
          items-center
          justify-between
        ">


          <div className="
            flex
            items-center
            gap-2
          ">


            <div className={`
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-xl
              border

              ${
                coming
                  ? "border-white/[0.05] bg-white/[0.03]"
                  : isVip
                  ? "border-yellow-300/10 bg-yellow-300/[0.06]"
                  : "border-emerald-300/10 bg-emerald-400/[0.08]"
              }
            `}>

              {coming ? (

                <Clock3 className="
                  h-4
                  w-4
                  text-white/20
                " />

              ) : isVip ? (

                <Crown className="
                  h-4
                  w-4
                  text-yellow-300/70
                " />

              ) : (

                <Video className="
                  h-4
                  w-4
                  text-emerald-300
                " />

              )}

            </div>


            <span className={`
              rounded-full
              px-2.5
              py-1
              text-[10px]

              ${
                coming
                  ? "bg-white/[0.04] text-white/20"
                  : isVip
                  ? "bg-yellow-300/[0.06] text-yellow-200/50"
                  : "bg-white/[0.05] text-white/40"
              }
            `}>

              {course.category}

            </span>

          </div>


          <span className="
            text-[10px]
            text-white/25
          ">

            {course.level}

          </span>

        </div>


        {/* 标题 */}

        <h3 className={`
          mt-5
          text-lg
          font-bold

          ${
            coming
              ? "text-white/30"
              : "text-white"
          }
        `}>

          {course.title}

        </h3>


        {/* 描述 */}

        <p className={`
          mt-2
          min-h-[42px]
          text-sm
          leading-5

          ${
            coming
              ? "text-white/15"
              : "text-white/35"
          }
        `}>

          {course.description}

        </p>


        {/* 信息 */}

        <div className="
          mt-5
          flex
          items-center
          gap-4
          text-xs
          text-white/25
        ">


          <span className="
            flex
            items-center
            gap-1.5
          ">

            <Video className="
              h-3.5
              w-3.5
            " />

            {course.lessons > 0
              ? `${course.lessons} 节视频`
              : "即将上线"}

          </span>


          <span className="
            flex
            items-center
            gap-1.5
          ">

            <Clock3 className="
              h-3.5
              w-3.5
            " />

            {course.duration}

          </span>

        </div>


        {/* 进度 */}

        <div className="mt-5">

          <div className="
            mb-2
            flex
            items-center
            justify-between
            text-[10px]
          ">

            <span className="
              text-white/25
            ">

              {coming
                ? "敬请期待"
                : isVip && !isVipUser
                ? "VIP 专属课程"
                : "课程进度"}

            </span>


            {!coming &&
              (!isVip || isVipUser) && (

                <span className="
                  text-emerald-300/60
                ">

                  {progress}%

                </span>

              )}

          </div>


          {!coming &&
            (!isVip || isVipUser) && (

              <AnimatedProgress
                value={progress}
                color={
                  isVip ? "gold" : "emerald"
                }
              />

            )}

        </div>


        {/* 按钮 */}

        <button

          disabled={
            coming
          }

          onClick={() => {

            if (
              coming
            ) {
              return;
            }

            if (isVip && !isVipUser) {
              onVip?.();
            } else {
              onOpen();
            }

          }}

          className={`
            mt-5
            flex
            w-full
            items-center
            justify-center
            gap-2
            rounded-xl
            border
            py-2.5
            text-sm
            font-medium
            transition-all

            ${
              coming
                ? "cursor-not-allowed border-white/[0.05] bg-white/[0.02] text-white/15"
                : isVip
                ? "border-yellow-300/10 bg-yellow-300/[0.05] text-yellow-100/60 hover:bg-yellow-300/[0.09] hover:text-yellow-100"
                : "border-white/[0.08] bg-white/[0.05] text-white/55 hover:bg-white/[0.09] hover:text-white"
            }
          `}
        >

          {coming ? (

            <>
              <Clock3 className="
                h-3.5
                w-3.5
              " />

              即将上线
            </>

          ) : isVip && !isVipUser ? (

            <>
              <Crown className="
                h-3.5
                w-3.5
              " />

              查看 VIP 课程

              <ChevronRight className="
                h-3.5
                w-3.5
              " />
            </>

          ) : (

            <>
              <Play className="
                h-3.5
                w-3.5
                fill-current
              " />

              进入课程

              <ChevronRight className="
                h-3.5
                w-3.5
              " />
            </>

          )}

        </button>

      </div>

    </motion.div>
  );
}


// =========================================================
// 即将上线卡片
// =========================================================

function ComingCard({
  course,
  index,
}) {

  return (

    <motion.div

      initial={{
        opacity: 0,
        y: 10,
      }}

      animate={{
        opacity: 1,
        y: 0,
      }}

      transition={{
        delay:
          index * 0.05,
      }}

      className="
        rounded-2xl
        border
        border-white/[0.05]
        bg-white/[0.02]
        p-4
      "
    >

      <div className="
        flex
        items-center
        justify-between
      ">

        <div className="
          flex
          h-9
          w-9
          items-center
          justify-center
          rounded-xl
          bg-white/[0.04]
        ">

          {course.category ===
          "外交" ? (

            <GraduationCap className="
              h-4
              w-4
              text-purple-300/30
            " />

          ) : (

            <Lock className="
              h-4
              w-4
              text-white/20
            " />

          )}

        </div>


        <span className="
          rounded-full
          bg-white/[0.04]
          px-2
          py-1
          text-[9px]
          text-white/20
        ">
          即将上线
        </span>

      </div>


      <h3 className="
        mt-4
        font-bold
        text-white/35
      ">
        {course.title}
      </h3>


      <p className="
        mt-1
        line-clamp-2
        text-xs
        leading-5
        text-white/20
      ">
        {course.description}
      </p>

    </motion.div>
  );
}