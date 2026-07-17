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
import { EditQuestForm } from "./_components/EditQuestForm";
import { MidnightEvaluationModal } from "./_components/MidnightEvaluationModal";
import { QuestCard } from "./_components/QuestCard";
import { CONTRACT_GOLD, HOME_GOLD, createStyles } from "./_styles";
import { mergeAchievements } from "./_utils/achievements";
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
  appendEvaluationHistoryEntry,
  buildCategoryStatsFromQuests,
  DAILY_EVALUATION_HISTORY_STORAGE_KEY,
  getStrongestAndWeakestCategories,
  readEvaluationHistory,
} from "./_utils/evaluationHistory";
import {
  buildMidnightEvaluation,
  MIDNIGHT_EVALUATION_STORAGE_KEY,
  shouldShowMidnightEvaluation,
  type MidnightEvaluationData,
} from "./_utils/midnightEvaluation";
import { applyMidnightStateTransition } from "./_utils/midnightStateTransition";
import {
  findDailyQuestLimitConflict,
  formatQuestLimitDate,
  getUpcomingDateKeys,
  type QuestLimitConflict,
} from "./_utils/questLimits";
import { completeQuestInStoredState } from "./_utils/questCompletion";
import { getQuestXpForDifficulty } from "./_utils/questXp";
import {
  getCompletedOneTimeArchives,
  getScheduledQuestsForDate,
  getTodayWeekday,
  isQuestScheduledForDate,
  normalizeQuestRepeat,
  normalizeQuestSchedule,
  normalizeScheduledWeekday,
  rollQuestsForNewDay,
} from "./_utils/recurrence";
import { getNextRank, getRankFromDR, getRankMeta } from "./_utils/rank";
import {
  readStoredState,
  replaceStoredState,
  transactStoredState,
  updateStoredState,
} from "./_utils/storedState";
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
        pinned: false,
        contract: Boolean(quest.contract),
        paused: Boolean(quest.paused),
        target: typeof quest.target === "string" ? quest.target : "",
      },
      localDateKey()
    ),
  }), [normalizeDifficulty]);

  const showQuestLimitAlert = (conflict: QuestLimitConflict) => {
    Alert.alert(
      "Daily quest limit",
      `${formatQuestLimitDate(conflict.dateKey)} would have ${conflict.totalCount}/${conflict.maxCount} active quests. Pause or move a quest first.`
    );
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
        const [parsed, lastEvaluatedDate] = await Promise.all([
          readStoredState(),
          AsyncStorage.getItem(MIDNIGHT_EVALUATION_STORAGE_KEY),
        ]);

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
              pinned: false,
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
        const resetDateAlreadyScored = loadedHistory.some(
          (entry) => entry.date === savedResetDate
        );
        const shouldGateForEvaluation =
          shouldShowMidnightEvaluation(savedResetDate, today, lastEvaluatedDate) &&
          !resetDateAlreadyScored;

        if (resetDateAlreadyScored && lastEvaluatedDate !== savedResetDate) {
          await AsyncStorage.setItem(MIDNIGHT_EVALUATION_STORAGE_KEY, savedResetDate);
        }

        let nextDR = loadedDR;
        let nextLastDrDelta = loadedLastDrDelta;
        let nextLastCompletionPct = loadedLastCompletionPct;
        let nextLastDrUpdateDate = loadedLastDrUpdateDate;
        let nextHistory = loadedHistory;

        if (gap >= 1 && !shouldGateForEvaluation) {
          // Day 1 (the "previous day" based on saved quests)
          if (!nextHistory.some((entry) => entry.date === savedResetDate)) {
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
          }

          // Additional missed days (if you were away multiple days)
          // Treat each missed day as 0% => -8
          for (let i = 1; i < gap; i++) {
            const missedDate = addDaysToDateKey(savedResetDate, i);
            if (nextHistory.some((entry) => entry.date === missedDate)) continue;
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
        await updateStoredState((current) => ({
          ...current,
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
        }));
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
      const evaluation = pendingEvaluation;
      const today = localDateKey();
      const evaluatedAt = new Date().toISOString();
      const evaluatedQuests = getScheduledQuestsForDate(quests, evaluation.date);
      const { strongestCategory, weakestCategory } = getStrongestAndWeakestCategories(evaluatedQuests);
      const categoryStats = buildCategoryStatsFromQuests(evaluatedQuests);
      const completionRate =
        evaluation.totalCount > 0
          ? Math.round((evaluation.completedCount / evaluation.totalCount) * 100)
          : 0;
      const transition = await transactStoredState(async (current) => {
        const nextTransition = applyMidnightStateTransition(
          current,
          evaluation,
          today,
          evaluatedAt
        );
        const evaluationHistory = await readEvaluationHistory();
        const nextEvaluationHistory = appendEvaluationHistoryEntry(evaluationHistory, {
          date: evaluation.date,
          completedQuestCount: evaluation.completedCount,
          totalQuestCount: evaluation.totalCount,
          completionRate,
          runTitle: evaluation.runTitle,
          contractCompletedCount: evaluation.contractCompletedCount,
          contractTotalCount: evaluation.contractTotalCount,
          comebackBonus: evaluation.comebackBonus,
          drBefore: nextTransition.drBeforeEvaluation,
          drChange: evaluation.drDelta,
          drAfter: nextTransition.drAfterEvaluation,
          currentRank: nextTransition.rankAfterEvaluation,
          strongestCategory,
          weakestCategory,
          categoryStats,
        });

        return {
          state: nextTransition.state,
          result: nextTransition,
          additionalEntries: [
            [DAILY_EVALUATION_HISTORY_STORAGE_KEY, JSON.stringify(nextEvaluationHistory)],
            [MIDNIGHT_EVALUATION_STORAGE_KEY, evaluation.date],
          ],
        };
      });

      setCategories(transition.state.categories);
      setQuests(transition.state.quests);
      setAchievements(transition.state.achievements);
      setDisciplineRating(transition.state.disciplineRating);
      setLastDrDelta(transition.state.lastDrDelta);
      setLastCompletionPct(transition.state.lastCompletionPct);
      setLastDrUpdateDate(transition.state.lastDrUpdateDate);
      setDrHistory(transition.state.drHistory);
      setLifetimeCompletedQuestCount(transition.state.lifetimeCompletedQuestCount);
      setArchivedQuests(transition.state.archivedQuests);
      setLastResetDate(transition.state.lastResetDate);
      setPendingEvaluation(null);
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
          const parsed = await readStoredState();
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
                pinned: false,
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
    if (contractQuests.length === 0) {
      return "Optional: mark up to three must-do quests as contracts from any quest menu.";
    }
    if (contractDoneCount === contractQuests.length) {
      return "Every contract is complete. Your contract streak is protected.";
    }
    const remaining = contractQuests.length - contractDoneCount;
    return `Complete ${remaining} more before midnight to protect your contract streak.`;
  }, [contractDoneCount, contractQuests.length]);
  const dayScorePercent = useMemo(
    () => getCompletionPercent(doneCount, dayScoreTarget),
    [dayScoreTarget, doneCount]
  );
  const remainingForStandard = Math.max(0, dayScoreTarget - doneCount);
  const todayHeadline =
    totalQuestCount === 0
      ? "Give today one clear win"
      : remainingForStandard > 0
        ? `${remainingForStandard} ${remainingForStandard === 1 ? "quest" : "quests"} to meet your standard`
        : doneCount === totalQuestCount
          ? "Everything is complete"
          : "Your daily standard is met";
  const todaySummary =
    totalQuestCount === 0
      ? "Add a small, concrete action. Midnight only judges what is scheduled today."
      : remainingForStandard > 0
        ? `Complete ${dayScoreTarget} of today's ${totalQuestCount} quests to reach a full Day Score.`
        : doneCount === totalQuestCount
          ? "You cleared the board. Midnight will record the result after the day ends."
          : "Extra completions can finish the board, but your scoring target is already covered.";
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
        if (a.difficulty !== b.difficulty) {
          const weight = { hard: 3, medium: 2, easy: 1 };
          return weight[b.difficulty] - weight[a.difficulty];
        }
        return 0;
      }),
    [todaysQuests]
  );
  const questQueueGroups = useMemo(
    () => [
      {
        id: "contracts",
        title: "Contracts",
        tone: CONTRACT_GOLD,
        quests: sortedQuests.filter((quest) => quest.contract),
      },
      {
        id: "open",
        title: "Other quests",
        tone: colors.textSecondary,
        quests: sortedQuests.filter((quest) => !quest.contract),
      },
    ],
    [colors.textSecondary, sortedQuests]
  );

  const nextMove = useMemo(() => sortedQuests.find((quest) => !quest.done) ?? null, [sortedQuests]);
  const nextMoveReason = useMemo(() => {
    if (!nextMove && quests.length === 0) {
      return "Add one small quest you can finish today. That is enough to begin.";
    }
    if (!nextMove && totalQuestCount === 0) {
      return "No active quests are scheduled today. Add one here or adjust the week in Plan.";
    }
    if (!nextMove) return "All quests are complete. Your result will be recorded after midnight.";
    if (nextMove.contract) return "This is a contract, so it is the safest thing to finish first.";
    if (nextMove.difficulty === "hard") return "This is the hardest open quest. Do it while your energy is available.";
    return "This is the clearest next action on today's board.";
  }, [nextMove, quests.length, totalQuestCount]);
  const completeQuest = (questId: string) => {
    const quest = quests.find((q) => q.id === questId);
    if (!quest || quest.done) return;

    // Add haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const result = completeQuestInStoredState(
      {
        categories,
        quests,
        achievements,
        disciplineRating,
        lastDrDelta,
        lastCompletionPct,
        lastDrUpdateDate,
        drHistory,
        lastResetDate,
        lifetimeCompletedQuestCount,
        archivedQuests,
      },
      questId,
      todayDateKey
    );

    setQuests(result.state.quests);
    setCategories(result.state.categories);
    setLifetimeCompletedQuestCount(result.state.lifetimeCompletedQuestCount);
    setAchievements(result.state.achievements);
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
        return { ...q, contract: true, pinned: false };
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
      level: 1,
      xp: 0,
      xpToNext: 90,
    }));
    const resetState: StoredState = {
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
    };
    setCategories(resetCategories);
    setQuests(defaultQuests);
    setAchievements(defaultAchievements);

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

    try {
      await replaceStoredState(resetState);
      await AsyncStorage.multiRemove([
        MIDNIGHT_EVALUATION_STORAGE_KEY,
        DAILY_EVALUATION_HISTORY_STORAGE_KEY,
      ]);
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
      "Reset all profile data?",
      "This clears quests, DR, awards, equipped badges, and evaluation history on this device.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset Profile", style: "destructive", onPress: resetDemo },
      ]
    );
  };

  if (pendingEvaluation) {
    return (
      <MidnightEvaluationModal
        evaluation={pendingEvaluation}
        isSaving={isSavingEvaluation}
        onStartNewDay={commitMidnightEvaluation}
      />
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: "transparent" }]}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        >
          <View style={[styles.sectionBand, styles.sectionBandTight]}>
            <View style={styles.homeTopBar}>
              <Pressable
                style={styles.homeTitleWrap}
                onLongPress={() => __DEV__ && setShowDevActions((prev) => !prev)}
                accessible={__DEV__}
                accessibilityRole={__DEV__ ? "button" : undefined}
                accessibilityLabel={__DEV__ ? "Show developer actions" : undefined}
              >
                <View style={styles.brandTitleRow}>
                  <MoonMark size={16} color={HOME_GOLD} cutoutColor={colors.bg} />
                  <Text style={[styles.title, { color: colors.textPrimary }]}>MIDNIGHT</Text>
                </View>
                <Text style={styles.homeSubtitle}>Today</Text>
              </Pressable>
              <View style={styles.homeMetaPill}>
                <Text style={styles.homeMetaText}>Live</Text>
              </View>
            </View>

            <View style={styles.todayHero}>
              <View style={styles.todayHeroTop}>
                <View style={styles.todayHeroCopy}>
                  <Text style={styles.todayEyebrow}>Tonight&apos;s judgment</Text>
                  <Text style={styles.todayHeadline}>{todayHeadline}</Text>
                  <Text style={styles.todaySummary}>{todaySummary}</Text>
                </View>
                <View style={styles.todayScorePlate}>
                  <Text style={styles.todayScoreValue}>{dayScorePercent}%</Text>
                  <Text style={styles.todayScoreLabel}>Day Score</Text>
                </View>
              </View>

              <View style={styles.todayProgressTrack}>
                <View style={[styles.todayProgressFill, { width: `${dayScorePercent}%` }]} />
              </View>

              <View style={styles.todayMetricRow}>
                <View style={styles.todayMetric}>
                  <Text style={styles.todayMetricValue}>{doneCount}/{dayScoreTarget}</Text>
                  <Text style={styles.todayMetricLabel}>Toward standard</Text>
                </View>
                <View style={styles.todayMetricDivider} />
                <View style={styles.todayMetric}>
                  <Animated.Text
                    style={[
                      styles.todayMetricValue,
                      styles.todayDrValue,
                      {
                        opacity: drHeroAnim,
                        transform: [{ scale: drHeroAnim }],
                      },
                    ]}
                  >
                    {disciplineRating}
                  </Animated.Text>
                  <Text style={styles.todayMetricLabel}>Discipline Rating</Text>
                </View>
                <View style={styles.todayMetricDivider} />
                <View style={styles.todayMetric}>
                  <Text style={styles.todayMetricValue} numberOfLines={1} adjustsFontSizeToFit>
                    {countdownToMidnight}
                  </Text>
                  <Text style={styles.todayMetricLabel}>Until midnight</Text>
                </View>
              </View>

              <View style={styles.todayRankStrip}>
                <View style={styles.todayRankCopy}>
                  <Text style={styles.todayRankName}>{rankLabel}</Text>
                  <Text style={styles.todayRankNext}>
                    {nextRank ? `${nextRank.remainingDr} DR to ${nextRank.name}` : "Highest rank reached"}
                  </Text>
                </View>
                <View style={styles.todayRankTrack}>
                  <Animated.View style={[styles.todayRankFill, { width: animatedRankProgressWidth }]} />
                </View>
              </View>

              <Text style={styles.todayRuleText}>
                After midnight, today&apos;s completion rate changes your Discipline Rating once.
              </Text>
            </View>

            <View style={styles.nextMoveCard}>
              <View style={styles.nextMoveTopRow}>
                <View style={styles.nextMoveIdentity}>
                  <View
                    style={[
                      styles.nextMoveArtBadge,
                      {
                        backgroundColor: withAlpha(nextMove?.contract ? CONTRACT_GOLD : HOME_GOLD, 0.11),
                        borderColor: withAlpha(nextMove?.contract ? CONTRACT_GOLD : HOME_GOLD, 0.32),
                      },
                    ]}
                  >
                    <IconSymbol
                      name={nextMove?.contract ? "shield.fill" : totalQuestCount === 0 ? "plus" : "checkmark.circle.fill"}
                      size={22}
                      color={nextMove?.contract ? CONTRACT_GOLD : HOME_GOLD}
                    />
                  </View>
                  <View style={styles.nextMoveTextWrap}>
                    <Text style={styles.nextMoveEyebrow}>Do this next</Text>
                    <Text style={styles.nextMoveTitle} numberOfLines={2}>
                      {nextMove
                        ? nextMove.title
                        : totalQuestCount === 0
                          ? "Add your first quest"
                          : "Today is complete"}
                    </Text>
                  </View>
                </View>
                {nextMove?.contract ? (
                  <View style={styles.nextMoveBadge}>
                    <IconSymbol name="shield.fill" size={12} color={CONTRACT_GOLD} />
                    <Text style={styles.nextMoveBadgeText}>Contract</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.nextMoveReason}>{nextMoveReason}</Text>
              {nextMove ? (
                <Pressable
                  style={styles.nextMoveButtonWide}
                  onPress={() => completeQuest(nextMove.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Complete ${nextMove.title}`}
                >
                  <IconSymbol name="checkmark" size={18} color={colors.bg} />
                  <Text style={styles.nextMoveButtonText}>Mark complete</Text>
                </Pressable>
              ) : totalQuestCount === 0 ? (
                <Pressable
                  style={styles.nextMoveButtonWide}
                  onPress={() => setShowAdd(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Add a quest for today"
                >
                  <IconSymbol name="plus" size={18} color={colors.bg} />
                  <Text style={styles.nextMoveButtonText}>Add a quest</Text>
                </Pressable>
              ) : (
                <View style={styles.nextMoveCompleteRow}>
                  <IconSymbol name="checkmark.circle.fill" size={20} color={colors.positive} />
                  <Text style={styles.nextMoveCompleteText}>Nothing else needs your attention.</Text>
                </View>
              )}
            </View>

            <View style={styles.contractPanel}>
              <View style={styles.contractHeaderRow}>
                <View style={styles.contractTitleRow}>
                  <View style={styles.contractArtBadge}>
                    <IconSymbol name="shield.fill" size={18} color={CONTRACT_GOLD} />
                  </View>
                  <View style={styles.contractCopy}>
                    <Text style={styles.contractEyebrow}>Contracts</Text>
                    <Text style={styles.contractTitle}>
                      {contractQuests.length === 0
                        ? "No must-do quests selected"
                        : `${contractDoneCount} of ${contractQuests.length} protected`}
                    </Text>
                  </View>
                </View>
                <View style={styles.contractCounterPill}>
                  <Text style={styles.contractCounterText}>{contractQuests.length}/3</Text>
                </View>
              </View>
              {contractQuests.length > 0 ? (
                <View style={styles.contractProgressTrack}>
                  <View
                    style={[
                      styles.contractProgressFill,
                      {
                        width: `${Math.round((contractDoneCount / contractQuests.length) * 100)}%`,
                        backgroundColor: CONTRACT_GOLD,
                      },
                    ]}
                  />
                </View>
              ) : null}
              <Text style={styles.contractStatusText}>{contractStatusText}</Text>
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
                  accessibilityLabel="Reset all profile data"
                >
                  <Text style={styles.devActionText}>Reset Profile</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={[styles.sectionBand, styles.dailySection]}>
            <View style={styles.dailyHeaderCard}>
              <View style={styles.queueHeaderRow}>
                <View style={styles.queueHeaderIdentity}>
                  <View style={styles.queueHeaderIcon}>
                    <IconSymbol name="flag.fill" size={18} color={HOME_GOLD} />
                  </View>
                  <View style={styles.queueHeaderCopy}>
                    <Text style={styles.queueEyebrow}>Today&apos;s quests</Text>
                    <Text style={styles.queueHeadline}>
                      {totalQuestCount === 0 ? "Build your day" : `${doneCount} of ${totalQuestCount} complete`}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => setShowAdd((s) => !s)}
                  accessibilityRole="button"
                  accessibilityLabel={showAdd ? "Cancel adding quest" : "Add a new quest"}
                  style={({ pressed }) => [styles.queueAddButton, pressed && styles.btnPressed]}
                >
                  <IconSymbol name={showAdd ? "xmark" : "plus"} size={15} color={colors.bg} />
                  <Text style={styles.queueAddButtonText}>{showAdd ? "Cancel" : "Add"}</Text>
                </Pressable>
              </View>

              <Text style={styles.queueHelpText}>
                {totalQuestCount > 0
                  ? "Tap the circle when you finish. Tap a quest to edit it or make it a contract."
                  : "Add one clear action you can finish before midnight."}
              </Text>
              {hiddenScheduledQuestCount > 0 || pausedQuestCount > 0 ? (
                <View style={styles.queueNoticeStack}>
                  {hiddenScheduledQuestCount > 0 ? (
                    <Text style={styles.queueNoticeText}>
                      {hiddenScheduledQuestCount} quest{hiddenScheduledQuestCount === 1 ? "" : "s"} scheduled for another day.
                    </Text>
                  ) : null}
                  {pausedQuestCount > 0 ? (
                    <Text style={styles.queueNoticeText}>
                      {pausedQuestCount} paused quest{pausedQuestCount === 1 ? "" : "s"} waiting in Plan.
                    </Text>
                  ) : null}
                </View>
              ) : null}
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
                onClose={() => setShowAdd(false)}
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
                questQueueGroups
                  .filter((group) => group.quests.length > 0)
                  .map((group) => {
                    const completedInGroup = group.quests.filter((quest) => quest.done).length;
                    return (
                      <View key={group.id} style={styles.questQueueGroup}>
                        <View style={styles.questQueueHeader}>
                          <View style={styles.questQueueTitleRow}>
                            <View style={[styles.questQueueDot, { backgroundColor: group.tone }]} />
                            <Text style={styles.questQueueTitle}>{group.title}</Text>
                          </View>
                          <Text
                            style={[
                              styles.questQueueMeta,
                              {
                                color: group.tone,
                                borderColor: withAlpha(group.tone, 0.28),
                                backgroundColor: withAlpha(group.tone, 0.09),
                              },
                            ]}
                          >
                            {completedInGroup}/{group.quests.length}
                          </Text>
                        </View>
                        <View style={styles.questQueueList}>
                          {group.quests.map((q) => (
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
                              onContract={toggleContract}
                              onDelete={deleteQuest}
                            />
                          ))}
                        </View>
                      </View>
                    );
                  })
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}


