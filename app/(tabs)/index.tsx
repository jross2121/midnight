import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  Text,
  UIManager,
  View,
} from "react-native";
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
  questTemplates,
} from "./_utils/defaultData";
import {
  DAILY_STANDARD,
  getCompletionPercent,
  getCountdownToMidnight,
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
import { buildPlanSummary, buildStreakSummary } from "./_utils/planning";
import { getNextRank, getRankFromDR, getRankMeta } from "./_utils/rank";
import { useTheme } from "./_utils/themeContext";
import type { Achievement, Category, DrHistoryEntry, Quest, StoredState } from "./_utils/types";
import { STORAGE_KEY } from "./_utils/types";

const FAST_TEMPLATE_VISIBLE_COUNT = 3;

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

function mergeAchievements(saved: unknown): Achievement[] {
  if (!Array.isArray(saved)) return defaultAchievements;

  const savedById = new Map(
    saved
      .filter((item): item is Achievement => {
        if (typeof item !== "object" || item === null) return false;
        const candidate = item as Partial<Achievement>;
        return (
          typeof candidate.id === "string" &&
          typeof candidate.name === "string" &&
          typeof candidate.description === "string" &&
          typeof candidate.icon === "string" &&
          (typeof candidate.unlockedAt === "string" || candidate.unlockedAt === null)
        );
      })
      .map((item) => [item.id, item])
  );

  return defaultAchievements.map((achievement) => ({
    ...achievement,
    unlockedAt: savedById.get(achievement.id)?.unlockedAt ?? achievement.unlockedAt,
  }));
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
  const [countdownToMidnight, setCountdownToMidnight] = useState(() => getCountdownToMidnight());

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

  const normalizeDifficulty = React.useCallback((d: unknown): "easy" | "medium" | "hard" => {
    if (d === "medium" || d === "hard") return d;
    return "easy";
  }, []);

  const normalizeQuest = React.useCallback((quest: Quest): Quest => ({
    ...quest,
    difficulty: normalizeDifficulty(quest.difficulty),
    pinned: Boolean(quest.pinned),
    contract: Boolean(quest.contract),
    target: typeof quest.target === "string" ? quest.target : "",
  }), [normalizeDifficulty]);

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

    const contractQuestsForDay = updatedQuests.filter((q) => q.contract);
    if (
      contractQuestsForDay.length > 0 &&
      contractQuestsForDay.every((q) => q.done) &&
      !achievements.find((a) => a.id === "first_contract")?.unlockedAt
    ) {
      unlockAchievement("first_contract");
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

        const loadedAchievements = mergeAchievements(parsed.achievements);

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
        const previousCompletionForBonus = loadedHistory.length > 0 ? loadedLastCompletionPct : null;

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
              title: "Auto Judgment",
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
              title: "Midnight Claimed",
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

        const normalizedFinalQuests = finalQuests.map(normalizeQuest);

        if (shouldGateForEvaluation) {
          setPendingEvaluation(buildMidnightEvaluation(savedResetDate, normalizedFinalQuests, previousCompletionForBonus));
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
  }, [normalizeQuest]);

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
          title: pendingEvaluation.runTitle,
          contractCompletedCount: pendingEvaluation.contractCompletedCount,
          contractTotalCount: pendingEvaluation.contractTotalCount,
          comebackBonus: pendingEvaluation.comebackBonus,
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
          title: "Midnight Claimed",
          contractCompletedCount: 0,
          contractTotalCount: 0,
          comebackBonus: 0,
        });
      }

      if (nextHistory.length > 30) {
        nextHistory = nextHistory.slice(-30);
      }

      const latestEntry = nextHistory[nextHistory.length - 1];
      const nextStreakSummary = buildStreakSummary(nextHistory);
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
        runTitle: pendingEvaluation.runTitle,
        contractCompletedCount: pendingEvaluation.contractCompletedCount,
        contractTotalCount: pendingEvaluation.contractTotalCount,
        comebackBonus: pendingEvaluation.comebackBonus,
        drBefore: drBeforeEvaluation,
        drChange: pendingEvaluation.drDelta,
        drAfter: drAfterEvaluation,
        currentRank: rankAfterEvaluation,
        strongestCategory,
        weakestCategory,
        categoryStats,
      });

      await AsyncStorage.setItem(MIDNIGHT_EVALUATION_STORAGE_KEY, pendingEvaluation.date);

      if (nextStreakSummary.solidDayStreak >= 3) {
        unlockAchievement("three_solid_days");
      }
      if (pendingEvaluation.comebackBonus > 0) {
        unlockAchievement("comeback_day");
      }
      if (getRankMeta(rankAfterEvaluation).tier >= 2) {
        unlockAchievement("rank_climber");
      }
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
          const normalizedSavedQuests = savedQuests.map(normalizeQuest);
          const savedLastCompletionPct =
            typeof parsed.lastCompletionPct === "number" ? parsed.lastCompletionPct : lastCompletionPct;
          const savedHistory = loadDrHistory(parsed.drHistory);
          const previousCompletionForBonus = savedHistory.length > 0 ? savedLastCompletionPct : null;

          const lastEvaluatedDate = await AsyncStorage.getItem(MIDNIGHT_EVALUATION_STORAGE_KEY);
          const shouldGate = shouldShowMidnightEvaluation(savedResetDate, today, lastEvaluatedDate);

          if (active && shouldGate) {
            setQuests(normalizedSavedQuests);
            setLastResetDate(savedResetDate);
            setPendingEvaluation(buildMidnightEvaluation(savedResetDate, normalizedSavedQuests, previousCompletionForBonus));
          }
        } catch (error) {
          console.log("Failed to re-check midnight evaluation:", error);
        }
      })();

      return () => {
        active = false;
      };
    }, [hydrated, isSavingEvaluation, lastCompletionPct, lastResetDate, normalizeQuest, pendingEvaluation, quests])
  );

  useEffect(() => {
    Animated.timing(drHeroAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [drHeroAnim]);

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdownToMidnight(getCountdownToMidnight());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const doneCount = useMemo(() => quests.filter((q) => q.done).length, [quests]);
  const totalQuestCount = quests.length;
  const contractQuests = useMemo(() => quests.filter((q) => q.contract), [quests]);
  const contractDoneCount = useMemo(
    () => contractQuests.filter((q) => q.done).length,
    [contractQuests]
  );
  const contractStatusText = useMemo(() => {
    if (contractQuests.length === 0) return "Choose up to 3 promises before midnight.";
    if (contractDoneCount === contractQuests.length) return "Contract protected. Midnight has less to take.";
    return `${contractQuests.length - contractDoneCount} promise${contractQuests.length - contractDoneCount === 1 ? "" : "s"} still exposed.`;
  }, [contractDoneCount, contractQuests.length]);
  const dayScorePercent = useMemo(
    () => (totalQuestCount > 0 ? Math.round((doneCount / totalQuestCount) * 100) : 0),
    [doneCount, totalQuestCount]
  );
  const planSummary = useMemo(() => buildPlanSummary(quests), [quests]);
  const streakSummary = useMemo(() => buildStreakSummary(drHistory), [drHistory]);
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

  const sortedQuests = useMemo(
    () =>
      [...quests].sort((a, b) => {
        if (a.done !== b.done) return Number(a.done) - Number(b.done);
        if (a.contract !== b.contract) return a.contract ? -1 : 1;
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (a.difficulty !== b.difficulty) {
          const weight = { hard: 3, medium: 2, easy: 1 };
          return weight[b.difficulty] - weight[a.difficulty];
        }
        return 0;
      }),
    [quests]
  );

  const nextMove = useMemo(() => sortedQuests.find((quest) => !quest.done) ?? null, [sortedQuests]);
  const nextMoveReason = useMemo(() => {
    if (!nextMove) return "All quests cleared. Hold the line until midnight.";
    if (nextMove.contract) return "Contract quest. Protect this before anything else.";
    if (nextMove.pinned) return "Pinned priority. Clear it while momentum is available.";
    if (nextMove.difficulty === "hard") return "Hard quest. Taking it now lowers tonight's pressure.";
    return "Fastest useful move for the current run.";
  }, [nextMove]);

  const availableQuestTemplates = useMemo(
    () =>
      questTemplates.filter(
        (template) => !quests.some((quest) => quest.id.endsWith(`-${template.id}`))
      ),
    [quests]
  );
  const displayedFastTemplates = useMemo(
    () => availableQuestTemplates.slice(0, FAST_TEMPLATE_VISIBLE_COUNT),
    [availableQuestTemplates]
  );

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

  const toggleContract = (questId: string) => {
    setQuests((prev) => {
      const selectedCount = prev.filter((q) => q.contract).length;
      return prev.map((q) => {
        if (q.id !== questId) return q;
        if (q.contract) return { ...q, contract: false };
        if (selectedCount >= 3) return q;
        return { ...q, contract: true, pinned: true };
      });
    });
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
        contract: false,
      },
    ]);

    setNewTitle("");
    setNewXP("10");
    setNewDifficulty("easy");
    setShowAdd(false);
  };

  const addQuestFromTemplate = (templateId: string) => {
    const template = questTemplates.find((item) => item.id === templateId);
    if (!template) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setQuests((prev) => {
      if (prev.some((quest) => quest.id.endsWith(`-${template.id}`))) {
        return prev;
      }

      const activeContracts = prev.filter((quest) => quest.contract).length;
      const shouldContract = Boolean(template.contract) && activeContracts < 3;

      return [
        ...prev,
        {
          id: `q${Date.now()}-${template.id}`,
          title: template.title,
          categoryId: template.categoryId,
          xp: template.xp,
          target: template.target,
          difficulty: template.difficulty,
          done: false,
          pinned: shouldContract,
          contract: shouldContract,
        },
      ];
    });
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
              <Pressable style={styles.homeMetaPill} onPress={() => undefined} hitSlop={8}>
                <Text style={styles.homeMetaText}>Daily Run</Text>
              </Pressable>
            </View>

            <View style={styles.missionHero}>
              <View style={styles.missionHeroHeader}>
                <View>
                  <Text style={styles.missionEyebrow}>Today&apos;s Run</Text>
                  <Text style={styles.missionTitle}>
                    {contractDoneCount === contractQuests.length && contractQuests.length > 0
                      ? "Contract secure"
                      : "Mission active"}
                  </Text>
                </View>
                <View style={styles.missionCountdownPill}>
                  <Text style={styles.missionCountdownLabel}>Midnight</Text>
                  <Text style={styles.missionCountdownValue}>{countdownToMidnight}</Text>
                </View>
              </View>

              <View style={styles.missionHeroBody}>
                <View style={styles.missionRingSlot}>
                  <DayScoreRing
                    completionPercent={dayScorePercent}
                    completedCount={doneCount}
                    totalCount={totalQuestCount}
                    colors={colors}
                  />
                </View>

                <View style={styles.missionStatsPanel}>
                  <View style={styles.missionStatRow}>
                    <Text style={styles.missionStatLabel}>DR</Text>
                    <Animated.Text
                      style={[
                        styles.missionDrValue,
                        {
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
                  </View>
                  <View style={styles.statusRankBadge}>
                    <Text
                      style={styles.statusRankBadgeText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.72}
                    >
                      {rankLabel}
                    </Text>
                  </View>
                  <Text style={styles.statusRankNext}>
                    {nextRank ? `+${nextRank.remainingDr} to ${nextRank.name.toUpperCase()}` : "TOP RANK"}
                  </Text>

                  <View style={styles.rankProgressBlock}>
                    <View style={styles.rankProgressTrack}>
                      <Animated.View
                        style={[
                          styles.rankProgressFill,
                          { width: animatedRankProgressWidth, backgroundColor: colors.accentPrimary },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              </View>

            <View style={styles.contractPanel}>
                <View style={styles.contractHeaderRow}>
                  <View>
                    <Text style={styles.contractEyebrow}>Midnight Contract</Text>
                    <Text style={styles.contractTitle}>
                      {contractDoneCount} / {contractQuests.length || 3} protected
                    </Text>
                  </View>
                  <View style={styles.contractCounterPill}>
                    <Text style={styles.contractCounterText}>{contractQuests.length}/3</Text>
                  </View>
                </View>
                <View style={styles.contractProgressTrack}>
                  <View
                    style={[
                      styles.contractProgressFill,
                      {
                        width: `${contractQuests.length > 0 ? Math.round((contractDoneCount / contractQuests.length) * 100) : 0}%`,
                        backgroundColor: colors.accentPrimary,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.contractStatusText}>{contractStatusText}</Text>
              </View>

              <View style={styles.morningPlanPanel}>
                <View style={styles.morningPlanHeader}>
                  <View>
                    <Text style={styles.contractEyebrow}>Morning Plan</Text>
                    <Text style={styles.morningPlanTitle}>{planSummary.title}</Text>
                  </View>
                  <View style={styles.morningPlanDeltaPill}>
                    <Text style={styles.morningPlanDeltaLabel}>Now</Text>
                    <Text style={styles.morningPlanDeltaValue}>
                      {planSummary.projectedDelta >= 0 ? `+${planSummary.projectedDelta}` : planSummary.projectedDelta}
                    </Text>
                  </View>
                </View>
                <Text style={styles.morningPlanBody}>{planSummary.body}</Text>
                <View style={styles.morningPlanMetricRow}>
                  <View style={styles.morningPlanMetric}>
                    <Text style={styles.morningPlanMetricValue}>
                      {planSummary.completedCount}/{planSummary.targetQuestCount}
                    </Text>
                    <Text style={styles.morningPlanMetricLabel}>standard</Text>
                  </View>
                  <View style={styles.morningPlanMetric}>
                    <Text style={styles.morningPlanMetricValue}>{streakSummary.solidDayStreak}</Text>
                    <Text style={styles.morningPlanMetricLabel}>solid streak</Text>
                  </View>
                  <View style={styles.morningPlanMetric}>
                    <Text style={styles.morningPlanMetricValue}>{streakSummary.contractStreak}</Text>
                    <Text style={styles.morningPlanMetricLabel}>contract streak</Text>
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
            <View style={styles.dailyHeaderCard}>
              <View style={styles.sectionRow}>
                <Text style={[styles.sectionSecondary, { marginBottom: 0 }]}>Quest Queue</Text>
                <Pressable onPress={() => setShowAdd((s) => !s)}>
                  <Text style={[styles.link, { color: colors.accentPrimary }]}>{showAdd ? "Cancel" : "+ Add"}</Text>
                </Pressable>
              </View>
              <Text style={styles.sectionSubtext}>
                Contracts first. Then pinned priorities. Then everything else.
              </Text>
            </View>

            <View style={styles.nextMoveCard}>
              <View style={styles.nextMoveTopRow}>
                <View>
                  <Text style={styles.nextMoveEyebrow}>Next Move</Text>
                  <Text style={styles.nextMoveTitle} numberOfLines={2}>
                    {nextMove ? nextMove.title : "Run complete"}
                  </Text>
                </View>
                {nextMove ? (
                  <Pressable style={styles.nextMoveButton} onPress={() => completeQuest(nextMove.id)}>
                    <Text style={styles.nextMoveButtonText}>Complete</Text>
                  </Pressable>
                ) : (
                  <View style={styles.nextMoveCompletePill}>
                    <Text style={styles.nextMoveCompleteText}>Clear</Text>
                  </View>
                )}
              </View>
              {nextMove?.contract ? (
                <View style={styles.nextMoveBadge}>
                  <Text style={styles.nextMoveBadgeText}>Contract Target</Text>
                </View>
              ) : null}
              <Text style={styles.nextMoveMeta}>
                {nextMove
                  ? `${categoryName(nextMove.categoryId)} - ${nextMove.difficulty.toUpperCase()} - ${nextMove.xp} XP`
                  : "No exposed quests remain."}
              </Text>
              <Text style={styles.nextMoveReason}>{nextMoveReason}</Text>
            </View>

            {displayedFastTemplates.length > 0 ? (
              <View style={styles.templatePanel}>
                <View style={styles.sectionRow}>
                  <Text style={[styles.sectionSecondary, { marginBottom: 0 }]}>Fast Templates</Text>
                  <Text style={styles.templateHint}>Tap to add</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.templateRail}
                >
                  {displayedFastTemplates.map((template) => (
                    <Pressable
                      key={template.id}
                      style={styles.templateChip}
                      onPress={() => addQuestFromTemplate(template.id)}
                    >
                      <Text style={styles.templateTitle} numberOfLines={2}>
                        {template.title}
                      </Text>
                      <Text style={styles.templateMeta} numberOfLines={1}>
                        {categoryName(template.categoryId)} - {template.xp} XP
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

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
              {sortedQuests.map((q) => (
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
                    onContract={toggleContract}
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


