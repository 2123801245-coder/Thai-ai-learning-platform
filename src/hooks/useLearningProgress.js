import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "thai_ai_learning_progress";
const DAILY_GOAL = 20;
const MAX_REVIEW_QUEUE = 100;
const MAX_HISTORY_DAYS = 30;

const getToday = () => {
  const date = new Date();
  return date.toISOString().split("T")[0];
};

const getYesterday = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().split("T")[0];
};

const createDefaultProgress = () => ({
  today_words: 0,
  daily_goal: DAILY_GOAL,

  total_vocabulary: 0,
  accuracy_rate: 0,

  learning_streak: 0,
  last_study_date: null,

  xp: 0,
  level: 1,
  level_name: "初学者",

  review_queue: [],

  daily_history: [],
});

/*
 * =========================
 * 等级
 * =========================
 */

const calculateLevel = (xp = 0) => {
  if (xp >= 5000) {
    return {
      level: 10,
      name: "泰语大师",
    };
  }

  if (xp >= 4000) {
    return {
      level: 9,
      name: "高级学习者",
    };
  }

  if (xp >= 3000) {
    return {
      level: 8,
      name: "高级学习者",
    };
  }

  if (xp >= 2200) {
    return {
      level: 7,
      name: "进阶学习者",
    };
  }

  if (xp >= 1600) {
    return {
      level: 6,
      name: "进阶学习者",
    };
  }

  if (xp >= 1100) {
    return {
      level: 5,
      name: "中级学习者",
    };
  }

  if (xp >= 700) {
    return {
      level: 4,
      name: "中级学习者",
    };
  }

  if (xp >= 400) {
    return {
      level: 3,
      name: "基础学习者",
    };
  }

  if (xp >= 150) {
    return {
      level: 2,
      name: "基础学习者",
    };
  }

  return {
    level: 1,
    name: "初学者",
  };
};

/*
 * =========================
 * XP
 * =========================
 */

const getXpForKnown = () => 10;

const getXpForReview = () => 5;

/*
 * =========================
 * 安全获取单词 ID
 * =========================
 */

const getWordId = (word) => {
  if (!word) return null;

  return (
    word.id ||
    word._id ||
    word.thai_word ||
    null
  );
};

/*
 * =========================
 * Hook
 * =========================
 */

export function useLearningProgress() {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  const progressRef = useRef(null);
  const updatingRef = useRef(false);

  /*
   * 保证 ref 永远是最新数据
   */

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  /*
   * =========================
   * 加载
   * =========================
   */

  const loadProgress = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      /*
       * 没有旧数据
       */

      if (!saved) {
        const initial = createDefaultProgress();

        setProgress(initial);
        progressRef.current = initial;

        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(initial)
        );

        return;
      }

      const parsed = JSON.parse(saved);

      /*
       * 合并默认数据
       */

      const result = {
        ...createDefaultProgress(),
        ...(parsed || {}),
      };

      /*
       * =========================
       * 数据类型修复
       * =========================
       */

      if (!Array.isArray(result.review_queue)) {
        result.review_queue = [];
      }

      if (!Array.isArray(result.daily_history)) {
        result.daily_history = [];
      }

      if (
        typeof result.today_words !== "number" ||
        Number.isNaN(result.today_words)
      ) {
        result.today_words = 0;
      }

      if (
        typeof result.total_vocabulary !== "number" ||
        Number.isNaN(result.total_vocabulary)
      ) {
        result.total_vocabulary = 0;
      }

      if (
        typeof result.accuracy_rate !== "number" ||
        Number.isNaN(result.accuracy_rate)
      ) {
        result.accuracy_rate = 0;
      }

      if (
        typeof result.xp !== "number" ||
        Number.isNaN(result.xp)
      ) {
        result.xp = 0;
      }

      /*
       * =========================
       * 今日日期
       * =========================
       */

      const today = getToday();

      /*
       * 如果跨天，
       * 今日学习数量归零。
       */

      if (result.last_study_date !== today) {
        result.today_words = 0;
      }

      /*
       * =========================
       * 每日目标
       * =========================
       */

      result.daily_goal =
        Number(result.daily_goal) > 0
          ? Number(result.daily_goal)
          : DAILY_GOAL;

      /*
       * =========================
       * 修复等级
       * =========================
       */

      const levelInfo =
        calculateLevel(result.xp);

      result.level = levelInfo.level;
      result.level_name = levelInfo.name;

      /*
       * =========================
       * 限制复习队列
       * =========================
       */

      result.review_queue =
        result.review_queue
          .filter((item) => item && item.id)
          .slice(-MAX_REVIEW_QUEUE);

      /*
       * =========================
       * 限制历史
       * =========================
       */

      result.daily_history =
        result.daily_history.slice(-MAX_HISTORY_DAYS);

      /*
       * =========================
       * 保存修复后的数据
       * =========================
       */

      setProgress(result);
      progressRef.current = result;

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(result)
      );
    } catch (error) {
      console.error(
        "读取学习进度失败:",
        error
      );

      const fallback = createDefaultProgress();

      setProgress(fallback);
      progressRef.current = fallback;

      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(fallback)
        );
      } catch {
        // 忽略 localStorage 错误
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  /*
   * =========================
   * 保存
   * =========================
   */

  const saveProgress = useCallback((data) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
      );

      setProgress(data);
      progressRef.current = data;
    } catch (error) {
      console.error(
        "保存学习进度失败:",
        error
      );
    }
  }, []);

  /*
   * =========================
   * 记录单词
   *
   * known = true
   * 认识
   *
   * known = false
   * 不认识
   *
   * isReview = 是否属于复习
   * =========================
   */

  const recordWord = useCallback(
    async (
      known = true,
      word = null,
      isReview = false
    ) => {
      if (updatingRef.current) {
        return;
      }

      const current = progressRef.current;

      if (!current) {
        return;
      }

      updatingRef.current = true;

      try {
        const today = getToday();
        const yesterday = getYesterday();

        const isNewDay =
          current.last_study_date !== today;

        /*
         * =========================
         * 今日新词数量
         *
         * 只有新词 + 认识
         * 才增加
         * =========================
         */

        let todayWords =
          current.today_words || 0;

        if (!isReview && known) {
          if (isNewDay) {
            todayWords = 1;
          } else {
            todayWords += 1;
          }
        }

        /*
         * =========================
         * 连续学习
         *
         * 只要当天第一次
         * 完成一个新词即可更新
         * =========================
         */

        let streak =
          current.learning_streak || 0;

        let lastStudyDate =
          current.last_study_date;

        if (known) {
          if (!current.last_study_date) {
            streak = 1;
            lastStudyDate = today;
          } else if (isNewDay) {
            if (
              current.last_study_date ===
              yesterday
            ) {
              streak += 1;
            } else {
              streak = 1;
            }

            lastStudyDate = today;
          }
        }

        /*
         * =========================
         * XP
         * =========================
         */

        let xp = current.xp || 0;

        if (isReview) {
          /*
           * 复习答对
           * +5 XP
           */

          if (known) {
            xp += getXpForReview();
          }
        } else {
          /*
           * 新词答对
           * +10 XP
           */

          if (known) {
            xp += getXpForKnown();
          }
        }

        /*
         * =========================
         * 复习队列
         * =========================
         */

        let reviewQueue = [
          ...(current.review_queue || []),
        ];

        const wordId = getWordId(word);

        /*
         * 不认识
         */

        if (!known && wordId) {
          const exists =
            reviewQueue.some(
              (item) =>
                item.id === wordId
            );

          if (!exists) {
            reviewQueue.push({
              id: wordId,

              thai_word:
                word?.thai_word || "",

              pronunciation:
                word?.pronunciation || "",

              chinese_meaning:
                word?.chinese_meaning || "",

              example_thai:
                word?.example_thai || "",

              example_chinese:
                word?.example_chinese || "",

              category:
                word?.category || "学习",

              added_at:
                new Date().toISOString(),

              review_count: 0,
            });
          } else {
            /*
             * 如果已经存在，
             * 增加 review_count
             */

            reviewQueue =
              reviewQueue.map((item) => {
                if (item.id !== wordId) {
                  return item;
                }

                return {
                  ...item,
                  review_count:
                    (item.review_count || 0) + 1,
                  last_reviewed_at:
                    new Date().toISOString(),
                };
              });
          }
        }

        /*
         * =========================
         * 认识
         *
         * 从复习队列删除
         * =========================
         */

        if (known && wordId) {
          reviewQueue =
            reviewQueue.filter(
              (item) =>
                item.id !== wordId
            );
        }

        /*
         * =========================
         * 限制复习队列
         * =========================
         */

        reviewQueue =
          reviewQueue.slice(-MAX_REVIEW_QUEUE);

        /*
         * =========================
         * 总学习次数
         *
         * 新词回答才统计
         *
         * 复习不重复计算
         * =========================
         */

        let totalVocabulary =
          current.total_vocabulary || 0;

        if (!isReview) {
          totalVocabulary += 1;
        }

        /*
         * =========================
         * 正确率
         *
         * 新词和复习都算回答次数
         * =========================
         */

        const previousTotal =
          current.total_vocabulary || 0;

        const previousCorrect =
          Math.round(
            previousTotal *
              ((current.accuracy_rate || 0) /
                100)
          );

        const newTotal =
          previousTotal +
          (isReview ? 0 : 1);

        const newCorrect =
          !isReview && known
            ? previousCorrect + 1
            : previousCorrect;

        const accuracyRate =
          newTotal > 0
            ? Math.round(
                (newCorrect /
                  newTotal) *
                  100
              )
            : 0;

        /*
         * =========================
         * 每日历史
         * =========================
         */

        const history = [
          ...(current.daily_history || []),
        ];

        const todayIndex =
          history.findIndex(
            (item) =>
              item.date === today
          );

        /*
         * 新词记录
         */

        if (todayIndex >= 0) {
          const todayRecord =
            history[todayIndex];

          history[todayIndex] = {
            ...todayRecord,

            words:
              !isReview && known
                ? (todayRecord.words || 0) + 1
                : todayRecord.words || 0,

            correct:
              !isReview && known
                ? (todayRecord.correct || 0) + 1
                : todayRecord.correct || 0,

            xp:
              (todayRecord.xp || 0) +
              (isReview
                ? known
                  ? getXpForReview()
                  : 0
                : known
                  ? getXpForKnown()
                  : 0),

            review_correct:
              isReview && known
                ? (todayRecord.review_correct || 0) + 1
                : todayRecord.review_correct || 0,
          };
        } else {
          history.push({
            date: today,

            words:
              !isReview && known
                ? 1
                : 0,

            correct:
              !isReview && known
                ? 1
                : 0,

            xp:
              isReview
                ? known
                  ? getXpForReview()
                  : 0
                : known
                  ? getXpForKnown()
                  : 0,

            review_correct:
              isReview && known
                ? 1
                : 0,
          });
        }

        /*
         * 最近 30 天
         */

        const recentHistory =
          history.slice(-MAX_HISTORY_DAYS);

        /*
         * =========================
         * 等级
         * =========================
         */

        const levelInfo =
          calculateLevel(xp);

        /*
         * =========================
         * 新数据
         * =========================
         */

        const updated = {
          ...current,

          today_words:
            todayWords,

          daily_goal:
            current.daily_goal ||
            DAILY_GOAL,

          total_vocabulary:
            totalVocabulary,

          accuracy_rate:
            accuracyRate,

          learning_streak:
            streak,

          last_study_date:
            lastStudyDate,

          xp,

          level:
            levelInfo.level,

          level_name:
            levelInfo.name,

          review_queue:
            reviewQueue,

          daily_history:
            recentHistory,
        };

        saveProgress(updated);
      } catch (error) {
        console.error(
          "记录学习进度失败:",
          error
        );
      } finally {
        updatingRef.current = false;
      }
    },
    [saveProgress]
  );

  /*
   * =========================
   * 新词：认识
   * =========================
   */

  const recordKnown = useCallback(
    (word = null) => {
      return recordWord(
        true,
        word,
        false
      );
    },
    [recordWord]
  );

  /*
   * =========================
   * 新词：不认识
   * =========================
   */

  const recordUnknown = useCallback(
    (word = null) => {
      return recordWord(
        false,
        word,
        false
      );
    },
    [recordWord]
  );

  /*
   * =========================
   * 复习：认识
   * =========================
   */

  const recordReviewKnown = useCallback(
    (word = null) => {
      return recordWord(
        true,
        word,
        true
      );
    },
    [recordWord]
  );

  /*
   * =========================
   * 复习：不认识
   * =========================
   */

  const recordReviewUnknown = useCallback(
    (word = null) => {
      return recordWord(
        false,
        word,
        true
      );
    },
    [recordWord]
  );

  /*
   * =========================
   * 完成复习
   *
   * 保留兼容接口
   * =========================
   */

  const completeReview = useCallback(
    async (word = null) => {
      if (!word) return;

      return recordReviewKnown(word);
    },
    [recordReviewKnown]
  );

  /*
   * =========================
   * 今日进度
   * =========================
   */

  const getDailyProgress =
    useCallback(() => {
      const current =
        progressRef.current;

      if (!current) {
        return 0;
      }

      const goal =
        current.daily_goal ||
        DAILY_GOAL;

      const words =
        current.today_words || 0;

      if (goal <= 0) {
        return 0;
      }

      return Math.min(
        Math.round(
          (words / goal) * 100
        ),
        100
      );
    }, []);

  /*
   * =========================
   * 今日目标
   * =========================
   */

  const isDailyGoalComplete =
    !!progress &&
    (progress.today_words || 0) >=
      (progress.daily_goal || DAILY_GOAL);

  /*
   * =========================
   * 重置
   * =========================
   */

  const resetProgress = useCallback(() => {
    const initial =
      createDefaultProgress();

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(initial)
      );
    } catch (error) {
      console.error(
        "重置学习进度失败:",
        error
      );
    }

    setProgress(initial);
    progressRef.current = initial;
  }, []);

  /*
   * =========================
   * 返回
   * =========================
   */

  return {
    progress,
    loading,

    /*
     * 今日目标
     */

    dailyGoal:
      progress?.daily_goal ||
      DAILY_GOAL,

    dailyProgress:
      progress
        ? Math.min(
            (progress.today_words || 0) /
              (progress.daily_goal ||
                DAILY_GOAL),
            1
          )
        : 0,

    isDailyGoalComplete,

    /*
     * 新词
     */

    recordWord: recordKnown,

    recordKnown,

    recordUnknown,

    /*
     * 复习
     */

    recordReviewKnown,

    recordReviewUnknown,

    completeReview,

    /*
     * 工具
     */

    getDailyProgress,

    reload: loadProgress,

    resetProgress,
  };
}
