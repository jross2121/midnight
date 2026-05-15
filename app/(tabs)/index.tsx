import AsyncStorage from "@react-native-async-storage/async-storage";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Alert,
  Easing,
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
import { HOME_GOLD, createStyles } from "./_styles";
import { getCategoryDisplayName } from "./_utils/categoryLabels";
import { diffDays, localDateKey, parseDateKey } from "./_utils/dateHelpers";
import { withAlpha } from "./_utils/designSystem";
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
import {
  DAILY_STANDARD,
  getCompletionPercent,
  getCountdownToMidnight,
  getDailyScoringTarget,
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
import { buildNextDayPlan, buildStreakSummary } from "./_utils/planning";
import {
  findDailyQuestLimitConflict,
  formatQuestLimitDate,
  getUpcomingDateKeys,
  type QuestLimitConflict,
} from "./_utils/questLimits";
import { getQuestXpForDifficulty } from "./_utils/questXp";
import {
  getCompletedOneTimeArchives,
  getQuestRepeatLabel,
  getScheduledQuestsForDate,
  getTodayWeekday,
  isQuestScheduledForDate,
  normalizeQuestRepeat,
  normalizeQuestSchedule,
  normalizeScheduledWeekday,
  rollQuestsForNewDay,
} from "./_utils/recurrence";
import { getNextRank, getRankFromDR, getRankMeta } from "./_utils/rank";
import { useTheme } from "./_utils/themeContext";
import type {
  Achievement,
  ArchivedQuest,
  Category,
  DrHistoryEntry,
  Quest,
  QuestRepeat,
  StoredState,
} from "./_utils/types";
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

function isArchivedQuest(value: unknown): value is ArchivedQuest {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ArchivedQuest>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.categoryId === "string" &&
    typeof candidate.xp === "number" &&
    typeof candidate.done === "boolean" &&
    typeof candidate.archivedAt === "string"
  );
}

function loadArchivedQuests(value: unknown): ArchivedQuest[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isArchivedQuest).slice(0, 100);
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
  const [lifetimeCompletedQuestCount, setLifetimeCompletedQuestCount] = useState(0);
  const [archivedQuests, setArchivedQuests] = useState<ArchivedQuest[]>([]);

  const [achievements, setAchievements] = useState<Achievement[]>(defaultAchievements);

  // Add quest form state
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<string>("health");
  const [newDifficulty, setNewDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [newRepeat, setNewRepeat] = useState<QuestRepeat>("daily");
  const [newScheduledWeekday, setNewScheduledWeekday] = useState(() => getTodayWeekday());

  // Edit quest state
  const [editingQuestId, setEditingQuestId] = useState<string | null>(null);
  const [openQuestId, setOpenQuestId] = useState<string | null>(null);
  const observedDateRef = useRef(localDateKey());
  const liveMidnightCheckRef = useRef(false);

  const normalizeDifficulty = React.useCallback((d: unknown): "easy" | "medium" | "hard" => {
    if (d === "medium" || d === "hard") return d;
    return "easy";
  }, []);

  const normalizeQuest = React.useCallback((quest: Quest): Quest => ({
    ...normalizeQuestSchedule(
      {
        ...quest,
        difficulty: normalizeDifficulty(quest.difficulty),
        xp: getQuestXpForDifficulty(normalizeDifficulty(quest.difficulty)),
        pinned: Boolean(quest.pinned),
        contract: Boolean(quest.contract),
        paused: Boolean(quest.paused),
        target: typeof quest.target === "string" ? quest.target : "",
      },
      localDateKey()
    ),
  }), [normalizeDifficulty]);

  const unlockAchievement = (achievementId: string) => {
    setAchievements((prev) =>
      prev.map((a) =>
        a.id === achievementId && !a.unlockedAt
          ? { ...a, unlockedAt: new Date().toISOString() }
          : a
      )
    );
  };

  const showQuestLimitAlert = (conflict: QuestLimitConflict) => {
    Alert.alert(
      "Daily quest limit",
      `${formatQuestLimitDate(conflict.dateKey)} would have ${conflict.totalCount}/${conflict.maxCount} active quests. Pause or move a quest first.`
    );
  };

  const checkAchievements = (
    updatedQuests: typeof quests,
    updatedCategories: typeof categories,
    nextLifetimeCompletedCount: number
  ) => {
    const todaysUpdatedQuests = getScheduledQuestsForDate(updatedQuests, localDateKey());
    const todayXPTotal = todaysUpdatedQuests
      .filter((q) => q.done)
      .reduce((sum, q) => sum + q.xp, 0);
    const questsDone = todaysUpdatedQuests.filter((q) => q.done);
    const hardQuestDoneCount = questsDone.filter((q) => q.difficulty === "hard").length;
    const completedCategoryCount = new Set(questsDone.map((q) => q.categoryId)).size;

    // first_quest: Complete first quest
    if (
      nextLifetimeCompletedCount >= 1 &&
      !achievements.find((a) => a.id === "first_quest")?.unlockedAt
    ) {
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
      todaysUpdatedQuests.length > 0 &&
      todaysUpdatedQuests.every((q) => q.done) &&
      !achievements.find((a) => a.id === "perfect_day")?.unlockedAt
    ) {
      unlockAchievement("perfect_day");
    }

    // level_5: Reach level 5 in any category
    if (
      updatedCategories.some((c) => {
        const previousLevel = categories.find((previous) => previous.id === c.id)?.level ?? c.level;
        return previousLevel < 5 && c.level >= 5;
      }) &&
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
    if (
      nextLifetimeCompletedCount >= 30 &&
      !achievements.find((a) => a.id === "30_quests")?.unlockedAt
    ) {
      unlockAchievement("30_quests");
    }

    if (
      nextLifetimeCompletedCount >= 50 &&
      !achievements.find((a) => a.id === "quest_50")?.unlockedAt
    ) {
      unlockAchievement("quest_50");
    }

    if (
      nextLifetimeCompletedCount >= 10 &&
      !achievements.find((a) => a.id === "quest_10")?.unlockedAt
    ) {
      unlockAchievement("quest_10");
    }

    if (
      nextLifetimeCompletedCount >= 100 &&
      !achievements.find((a) => a.id === "quest_100")?.unlockedAt
    ) {
      unlockAchievement("quest_100");
    }

    if (
      hardQuestDoneCount >= 2 &&
      !achievements.find((a) => a.id === "double_hard")?.unlockedAt
    ) {
      unlockAchievement("double_hard");
    }

    if (todayXPTotal >= 150 && !achievements.find((a) => a.id === "xp_150")?.unlockedAt) {
      unlockAchievement("xp_150");
    }

    if (todayXPTotal >= 200 && !achievements.find((a) => a.id === "xp_200")?.unlockedAt) {
      unlockAchievement("xp_200");
    }

    if (
      completedCategoryCount >= 4 &&
      !achievements.find((a) => a.id === "balanced_day")?.unlockedAt
    ) {
      unlockAchievement("balanced_day");
    }

    if (
      updatedCategories.some((c) => c.level >= 10) &&
      !achievements.find((a) => a.id === "level_10")?.unlockedAt
    ) {
      unlockAchievement("level_10");
    }

    if (
      updatedCategories.every((c) => c.level >= 5) &&
      updatedCategories.length > 0 &&
      !achievements.find((a) => a.id === "all_categories_5")?.unlockedAt
    ) {
      unlockAchievement("all_categories_5");
    }

    const contractQuestsForDay = todaysUpdatedQuests.filter((q) => q.contract);
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

        const loadedQuests = Array.isArray(parsed.quests) ? parsed.quests : defaultQuests;

        const savedResetDate =
          typeof parsed.lastResetDate === "string" ? parsed.lastResetDate : today;
        const normalizedLoadedQuests = loadedQuests.map((quest) =>
          normalizeQuestSchedule(
            {
              ...quest,
              difficulty: normalizeDifficulty(quest.difficulty),
              pinned: Boolean(quest.pinned),
              contract: Boolean(quest.contract),
              paused: Boolean(quest.paused),
              target: typeof quest.target === "string" ? quest.target : "",
            },
            savedResetDate
          )
        );

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
        const loadedLifetimeCompletedQuestCount =
          typeof parsed.lifetimeCompletedQuestCount === "number"
            ? Math.max(0, Math.floor(parsed.lifetimeCompletedQuestCount))
            : 0;
        let nextArchivedQuests = loadArchivedQuests(parsed.archivedQuests);
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
          const previousDayQuests = getScheduledQuestsForDate(normalizedLoadedQuests, savedResetDate);
          const donePrev = previousDayQuests.filter((q) => q.done).length;
          const pctPrev = getCompletionPercent(
            donePrev,
            getDailyScoringTarget(previousDayQuests.length, DAILY_STANDARD)
          );
          const deltaPrev = getDRChangeFromPercent(pctPrev, previousDayQuests.length, DAILY_STANDARD);
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
            ? rollQuestsForNewDay(normalizedLoadedQuests)
            : normalizedLoadedQuests;

        if (savedResetDate !== today && !shouldGateForEvaluation) {
          nextArchivedQuests = [
            ...getCompletedOneTimeArchives(normalizedLoadedQuests, new Date().toISOString()),
            ...nextArchivedQuests,
          ].slice(0, 100);
        }

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
        setLifetimeCompletedQuestCount(loadedLifetimeCompletedQuestCount);
        setArchivedQuests(nextArchivedQuests);
        setLastResetDate(shouldGateForEvaluation ? savedResetDate : today);
      } catch (e) {
        if (__DEV__) console.warn("Failed to load storage:", e);
        setLastResetDate(today);
      } finally {
        setHydrated(true);
      }
    })();
  }, [normalizeDifficulty, normalizeQuest]);

  // SAVE on changes
  useEffect(() => {
    if (!hydrated) return;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const persisted = raw ? (JSON.parse(raw) as Partial<StoredState>) : {};
        const persistedEquippedBadgeIds = Array.isArray(persisted.equippedBadgeIds)
          ? persisted.equippedBadgeIds.slice(0, 3)
          : undefined;
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
          lifetimeCompletedQuestCount,
          archivedQuests,
        };
        if (persistedEquippedBadgeIds) {
          state.equippedBadgeIds = persistedEquippedBadgeIds;
        }
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        if (__DEV__) console.warn("Failed to save storage:", e);
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
    lifetimeCompletedQuestCount,
    archivedQuests,
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
      const evaluatedQuests = getScheduledQuestsForDate(quests, pendingEvaluation.date);
      const { strongestCategory, weakestCategory } = getStrongestAndWeakestCategories(evaluatedQuests);
      const categoryStats = buildCategoryStatsFromQuests(evaluatedQuests);
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
      setArchivedQuests((prev) =>
        [
          ...getCompletedOneTimeArchives(quests, new Date().toISOString()),
          ...prev,
        ].slice(0, 100)
      );
      setQuests((prev) => rollQuestsForNewDay(prev));
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
      if (nextStreakSummary.solidDayStreak >= 7) {
        unlockAchievement("solid_7");
      }
      if (nextStreakSummary.solidDayStreak >= 14) {
        unlockAchievement("solid_14");
      }
      if (nextStreakSummary.solidDayStreak >= 21) {
        unlockAchievement("solid_21");
      }
      if (nextStreakSummary.contractStreak >= 3) {
        unlockAchievement("contract_3");
      }
      if (nextStreakSummary.contractStreak >= 7) {
        unlockAchievement("contract_7");
      }
      if (nextStreakSummary.contractStreak >= 14) {
        unlockAchievement("contract_14");
      }
      if (nextStreakSummary.contractStreak >= 21) {
        unlockAchievement("contract_21");
      }
      if (nextHistory.filter((entry) => entry.pct >= 100).length >= 3) {
        unlockAchievement("perfect_3");
      }
      if (pendingEvaluation.comebackBonus > 0) {
        unlockAchievement("comeback_day");
      }
      const rankTier = getRankMeta(rankAfterEvaluation).tier;
      if (rankTier >= 2) {
        unlockAchievement("rank_climber");
      }
      if (rankTier >= 3) {
        unlockAchievement("rank_focused");
      }
      if (rankTier >= 4) {
        unlockAchievement("rank_driven");
      }
      if (rankTier >= 5) {
        unlockAchievement("rank_relentless");
      }
      if (rankTier >= 6) {
        unlockAchievement("rank_elite");
      }
      if (rankTier >= 7) {
        unlockAchievement("rank_grand");
      }
    } catch (error) {
      if (__DEV__) console.warn("Failed to commit midnight evaluation:", error);
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
            typeof parsed.lastResetDate === "string" ? parsed.lastResetDate : today;
          const savedCategories =
            Array.isArray(parsed.categories) && parsed.categories.length
              ? parsed.categories
              : defaultCategories;
          const savedQuests = Array.isArray(parsed.quests) ? parsed.quests : defaultQuests;
          const normalizedSavedQuests = savedQuests.map((quest) =>
            normalizeQuestSchedule(
              {
                ...quest,
                difficulty: normalizeDifficulty(quest.difficulty),
                pinned: Boolean(quest.pinned),
                contract: Boolean(quest.contract),
                paused: Boolean(quest.paused),
                target: typeof quest.target === "string" ? quest.target : "",
              },
              savedResetDate
            )
          );
          const normalizedFinalQuests = normalizedSavedQuests.map(normalizeQuest);
          const savedAchievements = mergeAchievements(parsed.achievements);
          const savedDR =
            typeof parsed.disciplineRating === "number" ? parsed.disciplineRating : defaultDisciplineRating;
          const savedLastDrDelta =
            typeof parsed.lastDrDelta === "number" ? parsed.lastDrDelta : defaultLastDrDelta;
          const savedLastCompletionPct =
            typeof parsed.lastCompletionPct === "number"
              ? Math.max(0, Math.min(100, Math.round(parsed.lastCompletionPct)))
              : defaultLastCompletionPct;
          const savedLastDrUpdateDate =
            typeof parsed.lastDrUpdateDate === "string" ? parsed.lastDrUpdateDate : defaultLastDrUpdateDate;
          const savedHistory = loadDrHistory(parsed.drHistory);
          const previousCompletionForBonus = savedHistory.length > 0 ? savedLastCompletionPct : null;
          const savedLifetimeCompletedQuestCount =
            typeof parsed.lifetimeCompletedQuestCount === "number"
              ? Math.max(0, Math.floor(parsed.lifetimeCompletedQuestCount))
              : 0;
          const savedArchivedQuests = loadArchivedQuests(parsed.archivedQuests);

          const lastEvaluatedDate = await AsyncStorage.getItem(MIDNIGHT_EVALUATION_STORAGE_KEY);
          const shouldGate = shouldShowMidnightEvaluation(savedResetDate, today, lastEvaluatedDate);

          if (!active) return;

          setCategories(savedCategories);
          setQuests(normalizedFinalQuests);
          setAchievements(savedAchievements);
          setDisciplineRating(savedDR);
          setLastDrDelta(savedLastDrDelta);
          setLastCompletionPct(savedLastCompletionPct);
          setLastDrUpdateDate(savedLastDrUpdateDate);
          setDrHistory(savedHistory);
          setLifetimeCompletedQuestCount(savedLifetimeCompletedQuestCount);
          setArchivedQuests(savedArchivedQuests);
          setLastResetDate(savedResetDate);

          if (shouldGate) {
            setLastResetDate(savedResetDate);
            setPendingEvaluation(buildMidnightEvaluation(savedResetDate, normalizedFinalQuests, previousCompletionForBonus));
          }
        } catch (error) {
          if (__DEV__) console.warn("Failed to re-check midnight evaluation:", error);
        }
      })();

      return () => {
        active = false;
      };
    }, [hydrated, isSavingEvaluation, normalizeDifficulty, normalizeQuest, pendingEvaluation])
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

  const checkForLiveMidnightEvaluation = React.useCallback(async () => {
    const today = localDateKey();
    if (observedDateRef.current === today) return;
    if (!hydrated || pendingEvaluation || isSavingEvaluation || liveMidnightCheckRef.current) return;

    liveMidnightCheckRef.current = true;

    try {
      const lastEvaluatedDate = await AsyncStorage.getItem(MIDNIGHT_EVALUATION_STORAGE_KEY);
      if (!shouldShowMidnightEvaluation(lastResetDate, today, lastEvaluatedDate)) {
        observedDateRef.current = today;
        return;
      }

      const previousCompletionForBonus = drHistory.length > 0 ? lastCompletionPct : null;
      observedDateRef.current = today;
      setPendingEvaluation(buildMidnightEvaluation(lastResetDate, quests, previousCompletionForBonus));
    } catch (error) {
      if (__DEV__) console.warn("Failed to check live midnight evaluation:", error);
    } finally {
      liveMidnightCheckRef.current = false;
    }
  }, [
    drHistory.length,
    hydrated,
    isSavingEvaluation,
    lastCompletionPct,
    lastResetDate,
    pendingEvaluation,
    quests,
  ]);

  useEffect(() => {
    void checkForLiveMidnightEvaluation();
  }, [checkForLiveMidnightEvaluation, countdownToMidnight]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") {
        void checkForLiveMidnightEvaluation();
      }
    });

    return () => subscription.remove();
  }, [checkForLiveMidnightEvaluation]);

  const todayDateKey = localDateKey();
  const questLimitDateKeys = useMemo(() => getUpcomingDateKeys(todayDateKey), [todayDateKey]);
  const todaysQuests = useMemo(
    () => getScheduledQuestsForDate(quests, todayDateKey),
    [quests, todayDateKey]
  );
  const pausedQuestCount = useMemo(() => quests.filter((quest) => quest.paused).length, [quests]);
  const hiddenScheduledQuestCount = useMemo(
    () => quests.filter((quest) => !quest.paused && !isQuestScheduledForDate(quest, todayDateKey)).length,
    [quests, todayDateKey]
  );
  const doneCount = useMemo(() => todaysQuests.filter((q) => q.done).length, [todaysQuests]);
  const totalQuestCount = todaysQuests.length;
  const dayScoreTarget = useMemo(
    () => getDailyScoringTarget(totalQuestCount, DAILY_STANDARD),
    [totalQuestCount]
  );
  const contractQuests = useMemo(() => todaysQuests.filter((q) => q.contract), [todaysQuests]);
  const contractDoneCount = useMemo(
    () => contractQuests.filter((q) => q.done).length,
    [contractQuests]
  );
  const contractStatusText = useMemo(() => {
    if (contractQuests.length === 0) return "Choose up to 3 contracts before midnight.";
    if (contractDoneCount === contractQuests.length) return "Contract protected. Midnight has less to take.";
    return `${contractQuests.length - contractDoneCount} contract${contractQuests.length - contractDoneCount === 1 ? "" : "s"} still exposed.`;
  }, [contractDoneCount, contractQuests.length]);
  const dayScorePercent = useMemo(
    () => getCompletionPercent(doneCount, dayScoreTarget),
    [dayScoreTarget, doneCount]
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
      [...todaysQuests].sort((a, b) => {
        if (a.done !== b.done) return Number(a.done) - Number(b.done);
        if (a.contract !== b.contract) return a.contract ? -1 : 1;
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (a.difficulty !== b.difficulty) {
          const weight = { hard: 3, medium: 2, easy: 1 };
          return weight[b.difficulty] - weight[a.difficulty];
        }
        return 0;
      }),
    [todaysQuests]
  );

  const nextMove = useMemo(() => sortedQuests.find((quest) => !quest.done) ?? null, [sortedQuests]);
  const nextMoveReason = useMemo(() => {
    if (!nextMove) return "All quests cleared. Hold the line until midnight.";
    if (nextMove.contract) return "Contract quest. Protect this before anything else.";
    if (nextMove.pinned) return "Pinned priority. Clear it while momentum is available.";
    if (nextMove.difficulty === "hard") return "Hard quest. Taking it now lowers tonight's pressure.";
    return "Fastest useful move for the current run.";
  }, [nextMove]);
  const nextDayPlan = useMemo(
    () => buildNextDayPlan(getScheduledQuestsForDate(rollQuestsForNewDay(quests), todayDateKey), drHistory),
    [drHistory, quests, todayDateKey]
  );

  const completeQuest = (questId: string) => {
    const quest = quests.find((q) => q.id === questId);
    if (!quest || quest.done) return;

    // Add haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const xpAwarded = quest.xp;

    const updatedQuests = quests.map((q) =>
      q.id === questId ? { ...q, done: true } : q
    );

    const updatedCategories = categories.map((c) =>
      c.id === quest.categoryId ? levelUp({ ...c, xp: c.xp + xpAwarded }) : c
    );
    const nextLifetimeCompletedCount = lifetimeCompletedQuestCount + 1;

    setQuests(updatedQuests);
    setCategories(updatedCategories);
    setLifetimeCompletedQuestCount(nextLifetimeCompletedCount);
    checkAchievements(updatedQuests, updatedCategories, nextLifetimeCompletedCount);
    setOpenQuestId(null);
  };

  const deleteQuest = (questId: string) => {
    const quest = quests.find((q) => q.id === questId);
    if (quest) {
      setArchivedQuests((prev) =>
        [
          {
            ...quest,
            archivedAt: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 100)
      );
    }
    setQuests((prev) => prev.filter((q) => q.id !== questId));
    setOpenQuestId((prev) => (prev === questId ? null : prev));
  };

  const editQuest = (
    questId: string,
    title: string,
    categoryId: string,
    difficulty: "easy" | "medium" | "hard",
    target: string,
    repeat: QuestRepeat,
    scheduledWeekday?: number
  ) => {
    const safeDifficulty = normalizeDifficulty(difficulty);
    const safeRepeat = normalizeQuestRepeat(repeat);
    const nextQuests = quests.map((q) =>
        q.id === questId
          ? {
              ...q,
              title,
              categoryId,
              xp: getQuestXpForDifficulty(safeDifficulty),
              difficulty: safeDifficulty,
              target,
              repeat: safeRepeat,
              scheduledWeekday:
                safeRepeat === "weekly"
                  ? normalizeScheduledWeekday(scheduledWeekday, getTodayWeekday())
                  : undefined,
            }
          : q
    );
    const conflict = findDailyQuestLimitConflict(nextQuests, questLimitDateKeys);
    if (conflict) {
      showQuestLimitAlert(conflict);
      return;
    }

    setQuests(nextQuests);
    setEditingQuestId(null);
    setOpenQuestId(null);
  };

  const resetToday = () => {
    setQuests((prev) =>
      prev.map((q) =>
        isQuestScheduledForDate(q, localDateKey()) ? { ...q, done: false } : q
      )
    );
    setLastResetDate(localDateKey());
  };

  const confirmResetToday = () => {
    Alert.alert(
      "Reset today's completions?",
      "Completed quests will be marked open again. Your DR history stays intact.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset", style: "destructive", onPress: resetToday },
      ]
    );
  };

  const togglePin = (questId: string) => {
    setQuests((prev) =>
      prev.map((q) => (q.id === questId ? { ...q, pinned: !q.pinned } : q))
    );
  };

  const toggleContract = (questId: string) => {
    setQuests((prev) => {
      const selectedCount = prev.filter((q) => q.contract && !q.paused).length;
      const target = prev.find((q) => q.id === questId);
      if (target && !target.contract && selectedCount >= 3) {
        Alert.alert("Contract limit reached", "Keep the active contract list to three contracts.");
        return prev;
      }
      return prev.map((q) => {
        if (q.id !== questId) return q;
        if (q.contract) return { ...q, contract: false };
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
    setLifetimeCompletedQuestCount(0);
    setArchivedQuests([]);
    setPendingEvaluation(null);
    setIsSavingEvaluation(false);

    setShowAdd(false);
    setEditingQuestId(null);
    setOpenQuestId(null);
    setNewTitle("");
    setNewCategory("health");
    setNewDifficulty("easy");
    setNewRepeat("daily");
    setNewScheduledWeekday(getTodayWeekday());
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
          lifetimeCompletedQuestCount: 0,
          archivedQuests: [],
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

    const safeDifficulty = normalizeDifficulty(newDifficulty);
    const safeRepeat = normalizeQuestRepeat(newRepeat);
    const nextQuest: Quest = {
      id: "q" + Date.now(),
      title,
      categoryId: newCategory,
      xp: getQuestXpForDifficulty(safeDifficulty),
      target: "",
      difficulty: safeDifficulty,
      repeat: safeRepeat,
      scheduledWeekday:
        safeRepeat === "weekly"
          ? normalizeScheduledWeekday(newScheduledWeekday, getTodayWeekday())
          : undefined,
      done: false,
      pinned: false,
      contract: false,
      paused: false,
    };
    const conflict = findDailyQuestLimitConflict([...quests, nextQuest], questLimitDateKeys);
    if (conflict) {
      showQuestLimitAlert(conflict);
      return;
    }

    setQuests((prev) => [...prev, nextQuest]);

    setNewTitle("");
    setNewDifficulty("easy");
    setNewRepeat("daily");
    setNewScheduledWeekday(getTodayWeekday());
    setShowAdd(false);
  };

  const confirmResetDemo = () => {
    Alert.alert(
      "Reset all demo data?",
      "This clears quests, ranks, achievements, and evaluation history on this device.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset Demo", style: "destructive", onPress: resetDemo },
      ]
    );
  };

  if (pendingEvaluation) {
    return (
      <MidnightEvaluationModal
        evaluation={pendingEvaluation}
        currentRank={rankName}
        nextDayPlan={nextDayPlan}
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
                accessibilityRole="button"
                accessibilityLabel="Midnight performance log"
              >
                <View style={styles.brandTitleRow}>
                  <MoonMark size={16} color={HOME_GOLD} cutoutColor={colors.bg} />
                  <Text style={[styles.title, { color: colors.textPrimary }]}>MIDNIGHT</Text>
                </View>
                <Text style={styles.homeSubtitle}>Performance Log</Text>
              </Pressable>
              <View style={styles.homeMetaPill}>
                <Text style={styles.homeMetaText}>Daily Run</Text>
              </View>
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
                    totalCount={dayScoreTarget}
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
                          { width: animatedRankProgressWidth, backgroundColor: HOME_GOLD },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.contractPanel}>
                <View style={styles.contractHeaderRow}>
                  <View style={styles.contractTitleRow}>
                    <View style={styles.contractArtBadge}>
                      <IconSymbol name="pin.fill" size={18} color={HOME_GOLD} />
                    </View>
                    <View>
                      <Text style={styles.contractEyebrow}>Midnight Contract</Text>
                      <Text style={styles.contractTitle}>
                        {contractDoneCount} / {contractQuests.length || 3} protected
                      </Text>
                    </View>
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
                        backgroundColor: HOME_GOLD,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.contractStatusText}>{contractStatusText}</Text>
              </View>

            </View>

            {__DEV__ && showDevActions ? (
              <View style={styles.devActionRow}>
                <Pressable
                  style={styles.devActionChip}
                  onPress={confirmResetToday}
                  accessibilityRole="button"
                  accessibilityLabel="Reset today's quest completions"
                >
                  <Text style={styles.devActionText}>Reset Today</Text>
                </Pressable>
                <Pressable
                  style={styles.devActionChip}
                  onPress={confirmResetDemo}
                  accessibilityRole="button"
                  accessibilityLabel="Reset all demo data"
                >
                  <Text style={styles.devActionText}>Reset Demo</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={[styles.sectionBand, styles.dailySection]}>
            <View style={styles.dailyHeaderCard}>
              <View style={styles.sectionRow}>
                <Text style={[styles.sectionSecondary, { marginBottom: 0 }]}>Quest Queue</Text>
                <Pressable
                  onPress={() => setShowAdd((s) => !s)}
                  accessibilityRole="button"
                  accessibilityLabel={showAdd ? "Cancel adding quest" : "Add a new quest"}
                >
                  <Text style={[styles.link, { color: HOME_GOLD }]}>{showAdd ? "Cancel" : "+ Add"}</Text>
                </Pressable>
              </View>
              <Text style={styles.sectionSubtext}>
                Contracts first. Then pinned priorities. Then everything else.
              </Text>
              {hiddenScheduledQuestCount > 0 ? (
                <Text style={styles.sectionSubtext}>
                  {hiddenScheduledQuestCount} quest{hiddenScheduledQuestCount === 1 ? "" : "s"} scheduled for another day.
                </Text>
              ) : null}
              {pausedQuestCount > 0 ? (
                <Text style={styles.sectionSubtext}>
                  {pausedQuestCount} paused quest{pausedQuestCount === 1 ? "" : "s"} waiting in Plan.
                </Text>
              ) : null}
            </View>

            <View style={styles.nextMoveCard}>
              <View style={styles.nextMoveTopRow}>
                <View style={styles.nextMoveIdentity}>
                  <View
                    style={[
                      styles.nextMoveArtBadge,
                      {
                        backgroundColor: withAlpha(HOME_GOLD, 0.11),
                        borderColor: withAlpha(HOME_GOLD, 0.32),
                      },
                    ]}
                  >
                    <IconSymbol
                      name={nextMove?.contract ? "pin.fill" : "checkmark.circle.fill"}
                      size={22}
                      color={HOME_GOLD}
                    />
                  </View>
                  <View style={styles.nextMoveTextWrap}>
                    <Text style={styles.nextMoveEyebrow}>Next Move</Text>
                    <Text style={styles.nextMoveTitle} numberOfLines={2}>
                      {nextMove ? nextMove.title : "Run complete"}
                    </Text>
                  </View>
                </View>
                {nextMove ? (
                  <Pressable
                    style={styles.nextMoveButton}
                    onPress={() => completeQuest(nextMove.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Complete next move: ${nextMove.title}`}
                  >
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
                  <IconSymbol name="pin.fill" size={12} color={HOME_GOLD} />
                  <Text style={styles.nextMoveBadgeText}>Contract Target</Text>
                </View>
              ) : null}
              <Text style={styles.nextMoveMeta}>
                {nextMove
                  ? `${categoryName(nextMove.categoryId)} - ${nextMove.difficulty.toUpperCase()} - ${nextMove.xp} XP - ${getQuestRepeatLabel(nextMove)}`
                  : "No exposed quests remain."}
              </Text>
              <Text style={styles.nextMoveReason}>{nextMoveReason}</Text>
            </View>

            {/* ADD/EDIT QUEST FORM */}
            {showAdd && (
              <AddQuestForm
                categories={categories}
                newTitle={newTitle}
                newCategory={newCategory}
                newDifficulty={newDifficulty}
                newRepeat={newRepeat}
                newScheduledWeekday={newScheduledWeekday}
                onTitleChange={setNewTitle}
                onCategoryChange={setNewCategory}
                onDifficultyChange={setNewDifficulty}
                onRepeatChange={setNewRepeat}
                onScheduledWeekdayChange={setNewScheduledWeekday}
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
              {sortedQuests.length === 0 ? (
                <View style={styles.emptyQuestCard}>
                  <Text style={styles.emptyQuestTitle}>No quests queued</Text>
                  <Text style={styles.emptyQuestText}>
                    Add one small action so the day has something concrete to judge.
                  </Text>
                  <Pressable
                    style={styles.emptyQuestButton}
                    onPress={() => setShowAdd(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Add your first quest"
                  >
                    <Text style={styles.emptyQuestButtonText}>Add Quest</Text>
                  </Pressable>
                </View>
              ) : (
                sortedQuests.map((q) => (
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
                ))
              )}
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


