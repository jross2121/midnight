import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Circle, Svg } from "react-native-svg";

import { AddQuestForm } from "./_components/AddQuestForm";
import { DayScoreRing } from "./_components/DayScoreRing";
import { EditQuestForm } from "./_components/EditQuestForm";
import { MidnightEvaluationModal } from "./_components/MidnightEvaluationModal";
import { QuestCard } from "./_components/QuestCard";
import { createStyles } from "./_styles";
import { getCategoryDisplayName } from "./_utils/categoryLabels";
import { diffDays, localDateKey, parseDateKey } from "./_utils/dateHelpers";
import {
  defaultAchievements,
  defaultCategories,
  defaultDisciplineRating,
  defaultDrHistory,
  defaultLastCompletionPct,
  defaultLastDrDelta,
  defaultLastDrUpdateDate,
  defaultQuests,
} from "./_utils/defaultData";
import { withAlpha } from "./_utils/designSystem";
import {
  DAILY_STANDARD,
  getCompletionPercent,
  getDRChangeFromPercent,
} from "./_utils/discipline";
import {
  appendEvaluationHistoryItem,
  buildCategoryStatsFromQuests,
  DAILY_EVALUATION_HISTORY_STORAGE_KEY,
  getStrongestAndWeakestCategories,
} from "./_utils/evaluationHistory";
import { levelUp } from "./_utils/gameHelpers";
import {
  buildMidnightEvaluation,
  MIDNIGHT_EVALUATION_STORAGE_KEY,
  shouldShowMidnightEvaluation,
  type MidnightEvaluationData,
} from "./_utils/midnightEvaluation";
import { getNextRank, getRankFromDR, getRankMeta } from "./_utils/rank";
import { useTheme } from "./_utils/themeContext";
import type { Achievement, Category, DrHistoryEntry, Quest, StoredState } from "./_utils/types";
import { STORAGE_KEY } from "./_utils/types";

function applyDrChange(current: number, delta: number): number {
  return Math.max(0, current + delta);
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const d = parseDateKey(dateKey);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isDrHistoryEntry(value: unknown): value is DrHistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<DrHistoryEntry>;
  return (
    typeof candidate.date === "string" &&
    typeof candidate.dr === "number" &&
    typeof candidate.delta === "number" &&
    typeof candidate.pct === "number"
  );
}

function loadDrHistory(value: unknown): DrHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is DrHistoryEntry => isDrHistoryEntry(entry))
    .slice(-30);
}

type MoonMarkProps = {
  size: number;
  color: string;
  cutoutColor: string;
};

function MoonMark({ size, color, cutoutColor }: MoonMarkProps) {
  const outerR = size * 0.43;
  const innerR = size * 0.36;
  const cx = size * 0.5;
  const cy = size * 0.5;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={cx} cy={cy} r={outerR} fill={color} />
      <Circle cx={cx + size * 0.15} cy={cy - size * 0.06} r={innerR} fill={cutoutColor} />
    </Svg>
  );
}

/* =======================
   SCREEN
======================= */
export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const drHeroAnim = useRef(new Animated.Value(0)).current;
  const rankProgressAnim = useRef(new Animated.Value(0)).current;
  const [showDevActions, setShowDevActions] = useState(false);

  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [quests, setQuests] = useState<Quest[]>(defaultQuests);
  const [lastResetDate, setLastResetDate] = useState<string>(localDateKey());
  const [hydrated, setHydrated] = useState(false);

  const [disciplineRating, setDisciplineRating] = useState<number>(defaultDisciplineRating);
  const [lastDrDelta, setLastDrDelta] = useState<number>(defaultLastDrDelta);
  const [lastCompletionPct, setLastCompletionPct] = useState<number>(defaultLastCompletionPct);
  const [lastDrUpdateDate, setLastDrUpdateDate] = useState<string>(defaultLastDrUpdateDate);
  const [drHistory, setDrHistory] = useState<DrHistoryEntry[]>(defaultDrHistory);
  const [pendingEvaluation, setPendingEvaluation] = useState<MidnightEvaluationData | null>(null);
  const [isSavingEvaluation, setIsSavingEvaluation] = useState(false);

  const [achievements, setAchievements] = useState<Achievement[]>(defaultAchievements);

  // Add quest form state
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<string>("health");
  const [newXP, setNewXP] = useState("10");
  const [newDifficulty, setNewDifficulty] = useState<"easy" | "medium" | "hard">("easy");

  // Edit quest state
  const [editingQuestId, setEditingQuestId] = useState<string | null>(null);
  const [openQuestId, setOpenQuestId] = useState<string | null>(null);

  const normalizeDifficulty = (d: unknown): "easy" | "medium" | "hard" => {
    if (d === "medium" || d === "hard") return d;
    return "easy";
  };

  function getDifficultyMultiplier(difficulty: "easy" | "medium" | "hard") {
    switch (difficulty) {
      case "easy":
        return 1;
      case "medium":
        return 1.5;
      case "hard":
        return 2;
    }
  }

  const unlockAchievement = (achievementId: string) => {
    setAchievements((prev) =>
      prev.map((a) =>
        a.id === achievementId && !a.unlockedAt
          ? { ...a, unlockedAt: new Date().toISOString() }
          : a
      )
    );
  };

  const checkAchievements = (updatedQuests: typeof quests, updatedCategories: typeof categories) => {
    const completedTotal = updatedQuests.filter((q) => q.done).length;
    const todayXPTotal = updatedQuests.filter((q) => q.done).reduce((sum, q) => sum + q.xp, 0);
    const questsDone = updatedQuests.filter((q) => q.done);

    // first_quest: Complete first quest
    if (completedTotal === 1 && !achievements.find((a) => a.id === "first_quest")?.unlockedAt) {
      unlockAchievement("first_quest");
    }

    // hard_mode: Complete hard difficulty quest
    if (
      questsDone.some((q) => q.difficulty === "hard") &&
      !achievements.find((a) => a.id === "hard_mode")?.unlockedAt
    ) {
      unlockAchievement("hard_mode");
    }

    // 100_xp: Earn 100 XP in single day
    if (todayXPTotal >= 100 && !achievements.find((a) => a.id === "100_xp")?.unlockedAt) {
      unlockAchievement("100_xp");
    }

    // perfect_day: Complete all quests in one day
    if (
      updatedQuests.length > 0 &&
      updatedQuests.every((q) => q.done) &&
      !achievements.find((a) => a.id === "perfect_day")?.unlockedAt
    ) {
      unlockAchievement("perfect_day");
    }

    // level_5: Reach level 5 in any category
    if (
      updatedCategories.some((c) => c.level >= 5) &&
      !achievements.find((a) => a.id === "level_5")?.unlockedAt
    ) {
      unlockAchievement("level_5");
    }

    // all_categories: Level 3 in all categories
    if (
      updatedCategories.every((c) => c.level >= 3) &&
      updatedCategories.length > 0 &&
      !achievements.find((a) => a.id === "all_categories")?.unlockedAt
    ) {
      unlockAchievement("all_categories");
    }

    // 30_quests: Complete 30 quests total
    if (completedTotal >= 30 && !achievements.find((a) => a.id === "30_quests")?.unlockedAt) {
      unlockAchievement("30_quests");
    }

  };

  /*
    DEV TEST CHECKLIST:
    a) Complete some quests, change device date to tomorrow, relaunch app:
       expect DR recap line + DR delta + one new DR history entry.
    b) Skip 2 days, relaunch app:
       expect multiple missed-day entries in DR history with pct=0 and delta=-8.
  */
  // LOAD (and apply daily reset if needed + update DR)
  useEffect(() => {
    (async () => {
      const today = localDateKey();

      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);

        if (!raw) {
          setLastResetDate(today);
          setHydrated(true);
          return;
        }

        const parsed = JSON.parse(raw) as Partial<StoredState>;
        const lastEvaluatedDate = await AsyncStorage.getItem(MIDNIGHT_EVALUATION_STORAGE_KEY);

        const loadedCategories =
          Array.isArray(parsed.categories) && parsed.categories.length
            ? parsed.categories
            : defaultCategories;

        const loadedQuests =
          Array.isArray(parsed.quests) && parsed.quests.length
            ? parsed.quests
            : defaultQuests;

        const savedResetDate =
          typeof parsed.lastResetDate === "string" ? parsed.lastResetDate : today;

        const loadedAchievements = Array.isArray(parsed.achievements)
          ? parsed.achievements
          : defaultAchievements;

        const loadedDR =
          typeof parsed.disciplineRating === "number" ? parsed.disciplineRating : defaultDisciplineRating;
        const loadedLastDrDelta =
          typeof parsed.lastDrDelta === "number" ? parsed.lastDrDelta : defaultLastDrDelta;
        const loadedLastCompletionPct =
          typeof parsed.lastCompletionPct === "number"
            ? Math.max(0, Math.min(100, Math.round(parsed.lastCompletionPct)))
            : defaultLastCompletionPct;
        const loadedLastDrUpdateDate =
          typeof parsed.lastDrUpdateDate === "string" ? parsed.lastDrUpdateDate : defaultLastDrUpdateDate;
        const loadedHistory = loadDrHistory(parsed.drHistory);

        const gap = diffDays(savedResetDate, today);
        const shouldGateForEvaluation = shouldShowMidnightEvaluation(
          savedResetDate,
          today,
          lastEvaluatedDate
        );

        let nextDR = loadedDR;
        let nextLastDrDelta = loadedLastDrDelta;
        let nextLastCompletionPct = loadedLastCompletionPct;
        let nextLastDrUpdateDate = loadedLastDrUpdateDate;
        let nextHistory = loadedHistory;

        if (gap >= 1 && !shouldGateForEvaluation) {
          // Day 1 (the "previous day" based on saved quests)
          const donePrev = loadedQuests.filter((q) => q.done).length;
          const pctPrev = getCompletionPercent(donePrev, DAILY_STANDARD);
          const deltaPrev = getDRChangeFromPercent(pctPrev, loadedQuests.length, DAILY_STANDARD);
          nextDR = applyDrChange(nextDR, deltaPrev);
          nextHistory = [
            ...nextHistory,
            {
              date: savedResetDate,
              dr: nextDR,
              delta: deltaPrev,
              pct: pctPrev,
            },
          ];

          // Additional missed days (if you were away multiple days)
          // Treat each missed day as 0% => -8
          for (let i = 1; i < gap; i++) {
            const missedDate = addDaysToDateKey(savedResetDate, i);
            nextDR = applyDrChange(nextDR, -8);
            nextHistory.push({
              date: missedDate,
              dr: nextDR,
              delta: -8,
              pct: 0,
            });
          }

          if (nextHistory.length > 30) {
            nextHistory = nextHistory.slice(-30);
          }

          const latestEntry = nextHistory[nextHistory.length - 1];
          if (latestEntry) {
            nextLastDrDelta = latestEntry.delta;
            nextLastCompletionPct = latestEntry.pct;
          }
          nextLastDrUpdateDate = today;
        }

        // Daily reset + normalize difficulty
        const finalQuests =
          savedResetDate !== today && !shouldGateForEvaluation
            ? loadedQuests.map((q) => ({ ...q, done: false }))
            : loadedQuests;

        const normalizedFinalQuests = finalQuests.map((q) => ({
          ...q,
          difficulty: normalizeDifficulty(q.difficulty),
          pinned: Boolean(q.pinned),
          target: typeof q.target === "string" ? q.target : "",
        }));

        if (shouldGateForEvaluation) {
          setPendingEvaluation(buildMidnightEvaluation(savedResetDate, normalizedFinalQuests));
        }

        setCategories(loadedCategories);
        setQuests(normalizedFinalQuests);
        setAchievements(loadedAchievements);
        setDisciplineRating(nextDR);
        setLastDrDelta(nextLastDrDelta);
        setLastCompletionPct(nextLastCompletionPct);
        setLastDrUpdateDate(nextLastDrUpdateDate);
        setDrHistory(nextHistory);
        setLastResetDate(shouldGateForEvaluation ? savedResetDate : today);
      } catch (e) {
        console.log("Failed to load storage:", e);
        setLastResetDate(today);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  // SAVE on changes
  useEffect(() => {
    if (!hydrated) return;

    (async () => {
      try {
        const state: StoredState = {
          categories,
          quests,
          lastResetDate,
          achievements,
          disciplineRating,
          lastDrDelta,
          lastCompletionPct,
          lastDrUpdateDate,
          drHistory,
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.log("Failed to save storage:", e);
      }
    })();
  }, [
    categories,
    quests,
    lastResetDate,
    achievements,
    disciplineRating,
    lastDrDelta,
    lastCompletionPct,
    lastDrUpdateDate,
    drHistory,
    hydrated,
  ]);

  const commitMidnightEvaluation = async () => {
    if (!pendingEvaluation || isSavingEvaluation) return;

    setIsSavingEvaluation(true);

    try {
      const drBeforeEvaluation = disciplineRating;
      const today = localDateKey();
      const gap = diffDays(pendingEvaluation.date, today);
      const drAfterEvaluation = applyDrChange(drBeforeEvaluation, pendingEvaluation.drDelta);
      const rankAfterEvaluation = getRankFromDR(drAfterEvaluation);
      const { strongestCategory, weakestCategory } = getStrongestAndWeakestCategories(quests);
      const categoryStats = buildCategoryStatsFromQuests(quests);
      const completionRate =
        pendingEvaluation.totalCount > 0
          ? Math.round((pendingEvaluation.completedCount / pendingEvaluation.totalCount) * 100)
          : 0;

      let nextDR = drAfterEvaluation;
      let nextHistory: DrHistoryEntry[] = [
        ...drHistory,
        {
          date: pendingEvaluation.date,
          dr: nextDR,
          delta: pendingEvaluation.drDelta,
          pct: pendingEvaluation.completionPercent,
        },
      ];

      for (let i = 1; i < gap; i += 1) {
        const missedDate = addDaysToDateKey(pendingEvaluation.date, i);
        nextDR = applyDrChange(nextDR, -8);
        nextHistory.push({
          date: missedDate,
          dr: nextDR,
          delta: -8,
          pct: 0,
        });
      }

      if (nextHistory.length > 30) {
        nextHistory = nextHistory.slice(-30);
      }

      const latestEntry = nextHistory[nextHistory.length - 1];
      setDisciplineRating(nextDR);
      setDrHistory(nextHistory);
      setLastDrDelta(latestEntry?.delta ?? pendingEvaluation.drDelta);
      setLastCompletionPct(latestEntry?.pct ?? pendingEvaluation.completionPercent);
      setLastDrUpdateDate(today);
      setQuests((prev) => prev.map((q) => ({ ...q, done: false })));
      setLastResetDate(today);
      setPendingEvaluation(null);

      await appendEvaluationHistoryItem({
        date: pendingEvaluation.date,
        completedQuestCount: pendingEvaluation.completedCount,
        totalQuestCount: pendingEvaluation.totalCount,
        completionRate,
        drBefore: drBeforeEvaluation,
        drChange: pendingEvaluation.drDelta,
        drAfter: drAfterEvaluation,
        currentRank: rankAfterEvaluation,
        strongestCategory,
        weakestCategory,
        categoryStats,
      });

      await AsyncStorage.setItem(MIDNIGHT_EVALUATION_STORAGE_KEY, pendingEvaluation.date);
    } catch (error) {
      console.log("Failed to commit midnight evaluation:", error);
    } finally {
      setIsSavingEvaluation(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      let active = true;

      if (!hydrated || pendingEvaluation || isSavingEvaluation) {
        return () => {
          active = false;
        };
      }

      (async () => {
        try {
          const today = localDateKey();
          const raw = await AsyncStorage.getItem(STORAGE_KEY);
          if (!raw) return;

          const parsed = JSON.parse(raw) as Partial<StoredState>;
          const savedResetDate =
            typeof parsed.lastResetDate === "string" ? parsed.lastResetDate : lastResetDate;
          const savedQuests =
            Array.isArray(parsed.quests) && parsed.quests.length ? parsed.quests : quests;
          const normalizedSavedQuests = savedQuests.map((q) => ({
            ...q,
            difficulty: normalizeDifficulty(q.difficulty),
            pinned: Boolean(q.pinned),
            target: typeof q.target === "string" ? q.target : "",
          }));

          const lastEvaluatedDate = await AsyncStorage.getItem(MIDNIGHT_EVALUATION_STORAGE_KEY);
          const shouldGate = shouldShowMidnightEvaluation(savedResetDate, today, lastEvaluatedDate);

          if (active && shouldGate) {
            setQuests(normalizedSavedQuests);
            setLastResetDate(savedResetDate);
            setPendingEvaluation(buildMidnightEvaluation(savedResetDate, normalizedSavedQuests));
          }
        } catch (error) {
          console.log("Failed to re-check midnight evaluation:", error);
        }
      })();

      return () => {
        active = false;
      };
    }, [hydrated, isSavingEvaluation, lastResetDate, pendingEvaluation, quests])
  );

  useEffect(() => {
    Animated.timing(drHeroAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [drHeroAnim]);

  const doneCount = useMemo(() => quests.filter((q) => q.done).length, [quests]);
  const totalQuestCount = quests.length;
  const dayScorePercent = useMemo(
    () => (totalQuestCount > 0 ? Math.round((doneCount / totalQuestCount) * 100) : 0),
    [doneCount, totalQuestCount]
  );
  const rankName = useMemo(() => getRankFromDR(disciplineRating), [disciplineRating]);
  const rankLabel = rankName.toUpperCase();
  const nextRank = useMemo(() => getNextRank(disciplineRating), [disciplineRating]);
  const currentRankMeta = useMemo(() => getRankMeta(rankName), [rankName]);
  const nextRankMeta = useMemo(
    () => (nextRank ? getRankMeta(nextRank.name) : null),
    [nextRank]
  );
  const rankProgress = useMemo(() => {
    if (!nextRankMeta) return 1;
    const tierSpan = Math.max(1, nextRankMeta.minDr - currentRankMeta.minDr);
    const intoTier = Math.max(0, Math.min(tierSpan, disciplineRating - currentRankMeta.minDr));
    return intoTier / tierSpan;
  }, [currentRankMeta.minDr, disciplineRating, nextRankMeta]);
  const rankProgressDrValue = useMemo(() => {
    if (!nextRankMeta) return Math.max(0, disciplineRating);
    return Math.max(0, disciplineRating - currentRankMeta.minDr);
  }, [currentRankMeta.minDr, disciplineRating, nextRankMeta]);
  const rankProgressDrGoal = useMemo(() => {
    if (!nextRankMeta) return Math.max(1, disciplineRating);
    return Math.max(1, nextRankMeta.minDr - currentRankMeta.minDr);
  }, [currentRankMeta.minDr, disciplineRating, nextRankMeta]);
  useEffect(() => {
    Animated.timing(rankProgressAnim, {
      toValue: Math.max(0, Math.min(1, rankProgress)),
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [rankProgress, rankProgressAnim]);

  const animatedRankProgressWidth = useMemo(
    () =>
      rankProgressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["0%", "100%"],
      }),
    [rankProgressAnim]
  );

  const categoryName = (id: string) =>
    getCategoryDisplayName(categories.find((c) => c.id === id) ?? { id, name: "Category" });

  const completeQuest = (questId: string) => {
    const quest = quests.find((q) => q.id === questId);
    if (!quest || quest.done) return;

    // Add haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const difficultyMultiplier = getDifficultyMultiplier(quest.difficulty);
    const xpAwarded = Math.floor(quest.xp * difficultyMultiplier);

    const updatedQuests = quests.map((q) =>
      q.id === questId ? { ...q, done: true } : q
    );

    const updatedCategories = categories.map((c) =>
      c.id === quest.categoryId ? levelUp({ ...c, xp: c.xp + xpAwarded }) : c
    );

    setQuests(updatedQuests);
    setCategories(updatedCategories);
    checkAchievements(updatedQuests, updatedCategories);
    setOpenQuestId(null);
  };

  const deleteQuest = (questId: string) => {
    setQuests((prev) => prev.filter((q) => q.id !== questId));
    setOpenQuestId((prev) => (prev === questId ? null : prev));
  };

  const editQuest = (
    questId: string,
    title: string,
    categoryId: string,
    xp: number,
    difficulty: "easy" | "medium" | "hard",
    target: string
  ) => {
    const safeDifficulty = normalizeDifficulty(difficulty);
    setQuests((prev) =>
      prev.map((q) =>
        q.id === questId
          ? { ...q, title, categoryId, xp, difficulty: safeDifficulty, target }
          : q
      )
    );
    setEditingQuestId(null);
    setOpenQuestId(null);
  };

  const resetToday = () => {
    setQuests((prev) => prev.map((q) => ({ ...q, done: false })));
    setLastResetDate(localDateKey());
  };

  const togglePin = (questId: string) => {
    setQuests((prev) =>
      prev.map((q) => (q.id === questId ? { ...q, pinned: !q.pinned } : q))
    );
  };

  const toggleQuestOpen = (questId: string) => {
    setOpenQuestId((prev) => (prev === questId ? null : questId));
  };

  useEffect(() => {
    if (!openQuestId) return;
    if (!quests.some((q) => q.id === openQuestId)) {
      setOpenQuestId(null);
    }
  }, [openQuestId, quests]);

  const resetDemo = async () => {
    const resetCategories = defaultCategories.map((c) => ({
      ...c,
      level: 0,
      xp: 0,
      xpToNext: 90,
    }));
    setCategories(resetCategories);
    setQuests(defaultQuests);

    // wipe DR
    setDisciplineRating(defaultDisciplineRating);
    setLastDrDelta(defaultLastDrDelta);
    setLastCompletionPct(defaultLastCompletionPct);
    setLastDrUpdateDate(defaultLastDrUpdateDate);
    setDrHistory(defaultDrHistory);
    setPendingEvaluation(null);
    setIsSavingEvaluation(false);

    setShowAdd(false);
    setEditingQuestId(null);
    setOpenQuestId(null);
    setNewTitle("");
    setNewCategory("health");
    setNewXP("10");
    setNewDifficulty("easy");
    setLastResetDate(localDateKey());

    // Save reset state to AsyncStorage
    try {
      await AsyncStorage.removeItem(MIDNIGHT_EVALUATION_STORAGE_KEY);
      await AsyncStorage.removeItem(DAILY_EVALUATION_HISTORY_STORAGE_KEY);
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          categories: resetCategories,
          quests: defaultQuests,
          achievements: defaultAchievements,
          disciplineRating: defaultDisciplineRating,
          lastDrDelta: defaultLastDrDelta,
          lastCompletionPct: defaultLastCompletionPct,
          lastDrUpdateDate: defaultLastDrUpdateDate,
          drHistory: defaultDrHistory,
          lastResetDate: localDateKey(),
        })
      );
    } catch (e) {
      console.error("Failed to save reset state:", e);
    }
  };

  const addQuest = () => {
    const title = newTitle.trim();
    if (!title) return;

    const xpNum = Number(newXP);
    const safeXP = Number.isFinite(xpNum) && xpNum > 0 ? Math.floor(xpNum) : 10;

    const safeDifficulty = normalizeDifficulty(newDifficulty);
    setQuests((prev) => [
      ...prev,
      {
        id: "q" + Date.now(),
        title,
        categoryId: newCategory,
        xp: safeXP,
        target: "",
        difficulty: safeDifficulty,
        done: false,
        pinned: false,
      },
    ]);

    setNewTitle("");
    setNewXP("10");
    setNewDifficulty("easy");
    setShowAdd(false);
  };

  if (pendingEvaluation) {
    return (
      <MidnightEvaluationModal
        evaluation={pendingEvaluation}
        currentRank={rankName}
        isSaving={isSavingEvaluation}
        onStartNewDay={commitMidnightEvaluation}
      />
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: "transparent" }]}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={[styles.sectionBand, styles.sectionBandTight]}>
            <View style={styles.homeTopBar}>
              <Pressable
                style={styles.homeTitleWrap}
                onLongPress={() => __DEV__ && setShowDevActions((prev) => !prev)}
              >
                <View style={styles.brandTitleRow}>
                  <MoonMark size={16} color={colors.accentPrimary} cutoutColor={colors.bg} />
                  <Text style={[styles.title, { color: colors.textPrimary }]}>MIDNIGHT</Text>
                </View>
                <Text style={styles.homeSubtitle}>Performance Log</Text>
              </Pressable>
              <Pressable onPress={() => undefined} hitSlop={8}>
                <Text style={styles.homeMetaText}>Daily View</Text>
              </Pressable>
            </View>

            <View style={styles.dayScoreCard}>
              <View pointerEvents="none" style={styles.dayScoreWatermarkWrap}>
                <MoonMark
                  size={172}
                  color={withAlpha(colors.accentPrimary, 0.06)}
                  cutoutColor={withAlpha(colors.surface2, 0.96)}
                />
              </View>
              <View pointerEvents="none" style={styles.dayScoreWatermarkSoftWrap}>
                <MoonMark
                  size={190}
                  color={withAlpha(colors.accentPrimary, 0.03)}
                  cutoutColor={withAlpha(colors.surface2, 0.96)}
                />
              </View>
              <DayScoreRing
                completionPercent={dayScorePercent}
                completedCount={doneCount}
                totalCount={totalQuestCount}
                colors={colors}
              />
            </View>

            <View style={styles.statusHeader}>
              <View style={styles.statusHeaderTop}>
                <View style={styles.statusHeaderMain}>
                  <Text style={styles.statusLabel}>DISCIPLINE RATING</Text>
                  <Animated.Text
                    style={[
                      styles.statusDrValue,
                      {
                        color: "#E6EDF3",
                        opacity: drHeroAnim,
                        transform: [
                          {
                            scale: drHeroAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.985, 1],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    {disciplineRating}
                  </Animated.Text>
                  <View style={styles.statusRankBadge}>
                    <Text style={styles.statusRankBadgeText}>{rankLabel}</Text>
                  </View>
                  {nextRank ? (
                    <Text style={styles.statusRankNext}>+{nextRank.remainingDr} to {nextRank.name.toUpperCase()}</Text>
                  ) : (
                    <Text style={styles.statusRankNext}>TOP RANK</Text>
                  )}

                  <View style={styles.rankProgressBlock}>
                    <Text style={styles.rankProgressCurrent}>{rankName}</Text>
                    <Text style={styles.rankProgressTarget}>
                      {nextRank ? `Progress to ${nextRank.name}` : "Maximum rank reached"}
                    </Text>
                    <View style={styles.rankProgressTrack}>
                      <Animated.View
                        style={[
                          styles.rankProgressFill,
                          { width: animatedRankProgressWidth, backgroundColor: colors.accentPrimary },
                        ]}
                      />
                    </View>
                    <Text style={styles.rankProgressMeta}>
                      {nextRank ? `${rankProgressDrValue} / ${rankProgressDrGoal} DR` : `${disciplineRating} DR`}
                    </Text>
                  </View>
                </View>
              </View>

            </View>

            {__DEV__ && showDevActions ? (
              <View style={styles.devActionRow}>
                <Pressable style={styles.devActionChip} onPress={resetToday}>
                  <Text style={styles.devActionText}>Reset Today</Text>
                </Pressable>
                <Pressable style={styles.devActionChip} onPress={resetDemo}>
                  <Text style={styles.devActionText}>Reset Demo</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={[styles.sectionBand, styles.dailySection]}>
            {/* TODAY'S QUESTS HEADER */}
            <View style={styles.dailyHeaderCard}>
              <View style={styles.sectionRow}>
                <Text style={[styles.sectionSecondary, { marginBottom: 0 }]}>Daily Inputs</Text>
                <Pressable onPress={() => setShowAdd((s) => !s)}>
                  <Text style={[styles.link, { color: colors.accentPrimary }]}>{showAdd ? "Cancel" : "+ Add"}</Text>
                </Pressable>
              </View>
              <Text style={styles.sectionSubtext}>
                Priority list for today.
              </Text>
            </View>

            {/* ADD/EDIT QUEST FORM */}
            {showAdd && (
              <AddQuestForm
                categories={categories}
                newTitle={newTitle}
                newCategory={newCategory}
                newXP={newXP}
                newDifficulty={newDifficulty}
                onTitleChange={setNewTitle}
                onCategoryChange={setNewCategory}
                onXPChange={setNewXP}
                onDifficultyChange={setNewDifficulty}
                onAdd={addQuest}
              />
            )}

            {editingQuestId && (
              <EditQuestForm
                quest={quests.find((q) => q.id === editingQuestId)!}
                categories={categories}
                onSave={editQuest}
                onCancel={() => setEditingQuestId(null)}
              />
            )}

            {/* QUEST LIST */}
            <View style={styles.list}>
              {[...quests]
                .sort((a, b) => {
                  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
                  if (a.done !== b.done) return Number(a.done) - Number(b.done);
                  return 0;
                })
                .map((q) => (
                  <QuestCard
                    key={q.id}
                    quest={q}
                    categoryName={categoryName(q.categoryId)}
                    isOpen={openQuestId === q.id}
                    onToggle={toggleQuestOpen}
                    onComplete={completeQuest}
                    onEdit={(questId) => {
                      setEditingQuestId(questId);
                      setOpenQuestId(null);
                    }}
                    onPin={togglePin}
                    onDelete={deleteQuest}
                  />
                ))}
            </View>
            <View style={styles.homeHintCard}>
              <Text style={styles.homeHintText}>
                DR updates only at midnight judgment.
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}


