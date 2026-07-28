import AsyncStorage from "@react-native-async-storage/async-storage";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Alert,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Circle, Svg } from "react-native-svg";

import { AddQuestForm } from "@/src/components/AddQuestForm";
import { AwardUnlockCelebration } from "@/src/components/AwardUnlockCelebration";
import { FixedPercent } from "@/src/components/FixedPercent";
import { RankPromotionCelebration } from "@/src/components/RankPromotionCelebration";
import {
  GuidedSpotlightTour,
  PLAN_TOUR_ELIGIBLE_KEY,
  TODAY_TOUR_ELIGIBLE_KEY,
  TODAY_TOUR_STORAGE_KEY,
  type SpotlightStep,
} from "@/src/components/GuidedSpotlightTour";
import { EditQuestForm } from "@/src/components/EditQuestForm";
import { MidnightEvaluationModal } from "@/src/components/MidnightEvaluationModal";
import { AppActionDialog, AppInfoDialog, type AppDialogAction } from "@/src/components/AppInfoDialog";
import { QuestCard } from "@/src/components/QuestCard";
import { CONTRACT_GOLD, HOME_GOLD, createStyles } from "@/src/styles";
import { mergeAchievements } from "@/src/utils/achievements";
import { useReducedMotion } from "@/src/utils/accessibility";
import { getCategoryDisplayName } from "@/src/utils/categoryLabels";
import { diffDays, localDateKey, offsetDateKey, parseDateKey } from "@/src/utils/dateHelpers";
import { getContractConfirmationCopy } from "@/src/utils/contracts";
import { withAlpha } from "@/src/utils/designSystem";
import {
  defaultAchievements,
  defaultCategories,
  defaultDisciplineRating,
  defaultDrHistory,
  defaultLastCompletionPct,
  defaultLastDrDelta,
  defaultLastDrUpdateDate,
  defaultQuests,
} from "@/src/utils/defaultData";
import {
  DAILY_STANDARD,
  getCompletionPercent,
  getCountdownToMidnight,
  getDailyScoringTarget,
  getDRChangeFromPercent,
} from "@/src/utils/discipline";
import {
  appendEvaluationHistoryEntry,
  buildCategoryStatsFromQuests,
  DAILY_EVALUATION_HISTORY_STORAGE_KEY,
  getStrongestAndWeakestCategories,
  readEvaluationHistory,
} from "@/src/utils/evaluationHistory";
import {
  buildMidnightEvaluation,
  MIDNIGHT_EVALUATION_STORAGE_KEY,
  shouldShowMidnightEvaluation,
  type MidnightEvaluationData,
} from "@/src/utils/midnightEvaluation";
import { applyMidnightStateTransition } from "@/src/utils/midnightStateTransition";
import {
  findDailyQuestLimitConflict,
  formatQuestLimitDate,
  getUpcomingDateKeys,
  type QuestLimitConflict,
} from "@/src/utils/questLimits";
import {
  completeQuestInStoredState,
  uncompleteQuestInStoredState,
} from "@/src/utils/questCompletion";
import { getQuestXpForDifficulty } from "@/src/utils/questXp";
import {
  createQuestDuplicate,
  getTomorrowQuestAction,
  moveQuestToDate,
} from "@/src/utils/questActions";
import { getLatestReflectionBefore, upsertDailyReflection } from "@/src/utils/reflections";
import { normalizeRecoveryDays } from "@/src/utils/recoveryDays";
import {
  getCompletedOneTimeArchives,
  getScheduledQuestsForDate,
  getTodayWeekday,
  isQuestScheduledForDate,
  normalizeQuestRepeat,
  normalizeQuestSchedule,
  normalizeScheduledWeekday,
  rollQuestsForNewDay,
} from "@/src/utils/recurrence";
import { getNextRank, getRankFromDR, getRankMeta } from "@/src/utils/rank";
import {
  readStoredState,
  replaceStoredState,
  transactStoredState,
  updateStoredState,
} from "@/src/utils/storedState";
import { useTheme } from "@/src/utils/themeContext";
import type {
  Achievement,
  ArchivedQuest,
  Category,
  DailyReflection,
  DrHistoryEntry,
  Quest,
  QuestRepeat,
  RankPromotionRecord,
  StoredState,
} from "@/src/utils/types";

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
  const router = useRouter();
  const { startTour } = useLocalSearchParams<{ startTour?: string }>();
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const styles = createStyles(colors);
  const drHeroAnim = useRef(new Animated.Value(0)).current;
  const rankProgressAnim = useRef(new Animated.Value(0)).current;
  const todayScrollRef = useRef<ScrollView>(null);
  const progressTourRef = useRef<View>(null);
  const addQuestTourRef = useRef<View>(null);
  const questBoardTourRef = useRef<View>(null);
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
  const [dailyReflections, setDailyReflections] = useState<DailyReflection[]>([]);
  const [recoveryDays, setRecoveryDays] = useState<string[]>([]);
  const [reflectionDraft, setReflectionDraft] = useState("");
  const [showTodayDetails, setShowTodayDetails] = useState(false);
  const [showProgressInfo, setShowProgressInfo] = useState(false);
  const [showGuidedTour, setShowGuidedTour] = useState(false);
  const [actionDialog, setActionDialog] = useState<{
    title: string;
    body: string;
    actions: AppDialogAction[];
  } | null>(null);
  const [awardCelebration, setAwardCelebration] = useState<{ id: string; name: string } | null>(null);
  const [rankPromotionQueue, setRankPromotionQueue] = useState<RankPromotionRecord[]>([]);
  const [undoQuest, setUndoQuest] = useState<{
    id: string;
    title: string;
    xp: number;
    category: string;
    awardName?: string;
  } | null>(null);

  const [achievements, setAchievements] = useState<Achievement[]>(defaultAchievements);

  // Add quest form state
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newCategory, setNewCategory] = useState<string>("health");
  const [newDifficulty, setNewDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [newRepeat, setNewRepeat] = useState<QuestRepeat>("daily");
  const [newScheduledWeekday, setNewScheduledWeekday] = useState(() => getTodayWeekday());

  // Edit quest state
  const [editingQuestId, setEditingQuestId] = useState<string | null>(null);
  const [openQuestId, setOpenQuestId] = useState<string | null>(null);
  const observedDateRef = useRef(localDateKey());
  const liveMidnightCheckRef = useRef(false);

  const guidedTourSteps = useMemo<SpotlightStep[]>(
    () => [
      {
        title: "Read today at a glance",
        body: "Day Score shows how much of today’s board is complete. Open Today’s stats when you want the deeper DR view.",
        targetRef: progressTourRef,
      },
      {
        title: "Add one clear action",
        body: "Tap Add whenever you need a custom quest. Give it a schedule and difficulty, then it joins your board.",
        targetRef: addQuestTourRef,
      },
      {
        title: "Work the board",
        body: "Tap the circle on a quest to complete it. Tap the quest itself for details, editing, contracts, and tomorrow actions. Use Plan for your full schedule and library.",
        targetRef: questBoardTourRef,
      },
    ],
    []
  );

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
        const loadedReflections = Array.isArray(parsed.dailyReflections) ? parsed.dailyReflections : [];
        const loadedRecoveryDays = normalizeRecoveryDays(parsed.recoveryDays);
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
            const recoveryDay = loadedRecoveryDays.includes(savedResetDate);
            const deltaPrev = recoveryDay
              ? 0
              : getDRChangeFromPercent(pctPrev, previousDayQuests.length, DAILY_STANDARD);
            nextDR = applyDrChange(nextDR, deltaPrev);
            nextHistory = [
              ...nextHistory,
              {
                date: savedResetDate,
                dr: nextDR,
                delta: deltaPrev,
                pct: pctPrev,
                title: recoveryDay ? "Recovery Day" : "Auto Judgment",
                recoveryDay: recoveryDay || undefined,
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
          setPendingEvaluation(
            buildMidnightEvaluation(
              savedResetDate,
              normalizedFinalQuests,
              previousCompletionForBonus,
              loadedRecoveryDays.includes(savedResetDate)
            )
          );
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
        setDailyReflections(loadedReflections);
        setRecoveryDays(loadedRecoveryDays);
        setReflectionDraft(loadedReflections.find((item) => item.date === today)?.note ?? "");
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
          dailyReflections,
          recoveryDays,
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
    dailyReflections,
    recoveryDays,
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
      const completionRate = evaluation.completionPercent;
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
          recoveryDay: evaluation.recoveryDay || undefined,
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
      setRecoveryDays(transition.state.recoveryDays ?? []);
      setLastResetDate(transition.state.lastResetDate);
      setPendingEvaluation(null);
      if (transition.promotions.length > 0) {
        setRankPromotionQueue(transition.promotions);
      }
    } catch (error) {
      if (__DEV__) console.warn("Failed to commit midnight evaluation:", error);
      Alert.alert(
        "Evaluation not saved",
        "Your result is still on screen. Check available device storage, then try starting the new day again."
      );
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
          const savedReflections = Array.isArray(parsed.dailyReflections) ? parsed.dailyReflections : [];
          const savedRecoveryDays = normalizeRecoveryDays(parsed.recoveryDays);

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
          setDailyReflections(savedReflections);
          setRecoveryDays(savedRecoveryDays);
          setReflectionDraft(savedReflections.find((item) => item.date === today)?.note ?? "");
          setLastResetDate(savedResetDate);

          if (shouldGate) {
            setLastResetDate(savedResetDate);
            setPendingEvaluation(
              buildMidnightEvaluation(
                savedResetDate,
                normalizedFinalQuests,
                previousCompletionForBonus,
                savedRecoveryDays.includes(savedResetDate)
              )
            );
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

  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      if (!hydrated || pendingEvaluation || isSavingEvaluation) return () => undefined;

      const timer = setTimeout(async () => {
        const [eligible, completed] = await Promise.all([
          AsyncStorage.getItem(TODAY_TOUR_ELIGIBLE_KEY),
          AsyncStorage.getItem(TODAY_TOUR_STORAGE_KEY),
        ]);
        if (!active || completed === "true") return;
        if (eligible !== "true" && startTour !== "1") return;
        todayScrollRef.current?.scrollTo({ y: 0, animated: false });
        setShowTodayDetails(false);
        setShowAdd(false);
        setShowGuidedTour(true);
      }, 500);

      return () => {
        active = false;
        clearTimeout(timer);
      };
    }, [hydrated, isSavingEvaluation, pendingEvaluation, startTour])
  );

  const finishGuidedTour = React.useCallback(() => {
    setShowGuidedTour(false);
    void AsyncStorage.multiSet([
      [TODAY_TOUR_STORAGE_KEY, "true"],
      [PLAN_TOUR_ELIGIBLE_KEY, "true"],
    ]).then(() => AsyncStorage.removeItem(TODAY_TOUR_ELIGIBLE_KEY));
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      drHeroAnim.stopAnimation();
      drHeroAnim.setValue(1);
      return;
    }
    Animated.timing(drHeroAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [drHeroAnim, reducedMotion]);

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
      setPendingEvaluation(
        buildMidnightEvaluation(
          lastResetDate,
          quests,
          previousCompletionForBonus,
          recoveryDays.includes(lastResetDate)
        )
      );
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
    recoveryDays,
  ]);

  useEffect(() => {
    if (!undoQuest) return;
    const timeout = setTimeout(() => setUndoQuest(null), 6000);
    return () => clearTimeout(timeout);
  }, [undoQuest]);

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
  const tomorrowDateKey = offsetDateKey(todayDateKey, 1);
  const todayDisplayDate = useMemo(
    () =>
      new Date(`${todayDateKey}T12:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
    [todayDateKey]
  );
  const questLimitDateKeys = useMemo(() => getUpcomingDateKeys(todayDateKey), [todayDateKey]);
  const todayReflection = useMemo(
    () => dailyReflections.find((reflection) => reflection.date === todayDateKey) ?? null,
    [dailyReflections, todayDateKey]
  );
  const latestPastReflection = useMemo(
    () => getLatestReflectionBefore(dailyReflections, todayDateKey),
    [dailyReflections, todayDateKey]
  );
  const reflectionIsSaved = reflectionDraft.trim() === (todayReflection?.note ?? "");
  const saveReflection = () => {
    setDailyReflections((current) =>
      upsertDailyReflection(current, todayDateKey, reflectionDraft)
    );
    setReflectionDraft(reflectionDraft.trim().slice(0, 280));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
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
  const remainingQuestCount = Math.max(0, totalQuestCount - doneCount);
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
  const showBeginnerGuidance = currentRankMeta.tier < 3;
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
    const nextProgress = Math.max(0, Math.min(1, rankProgress));
    if (reducedMotion) {
      rankProgressAnim.stopAnimation();
      rankProgressAnim.setValue(nextProgress);
      return;
    }
    Animated.timing(rankProgressAnim, {
      toValue: nextProgress,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [rankProgress, rankProgressAnim, reducedMotion]);

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
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
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

  const showProgressHelp = () => {
    setShowProgressInfo(true);
  };
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
        recoveryDays,
      },
      questId,
      todayDateKey
    );
    if (!result.completed) return;
    const unlockedAward = result.state.achievements.find((award) => {
      const previous = achievements.find((item) => item.id === award.id);
      return Boolean(award.unlockedAt && !previous?.unlockedAt);
    });

    setQuests(result.state.quests);
    setCategories(result.state.categories);
    setLifetimeCompletedQuestCount(result.state.lifetimeCompletedQuestCount);
    setAchievements(result.state.achievements);
    setOpenQuestId(null);
    setUndoQuest({
      id: quest.id,
      title: quest.title,
      xp: quest.xp,
      category: categoryName(quest.categoryId),
      awardName: unlockedAward?.name,
    });
    if (unlockedAward) {
      setAwardCelebration({ id: unlockedAward.id, name: unlockedAward.name });
    }
  };

  const toggleQuestPriority = (questId: string) => {
    setQuests((current) => {
      const target = current.find((quest) => quest.id === questId);
      if (!target || target.done) return current;
      const shouldPin = !target.pinned;
      return current.map((quest) => ({
        ...quest,
        pinned: shouldPin ? quest.id === questId : false,
      }));
    });
    setOpenQuestId(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const addQuestCopy = (questId: string, scheduledDate?: string) => {
    const source = quests.find((quest) => quest.id === questId);
    if (!source) return;
    const suffix = scheduledDate ? "tomorrow" : "copy";
    const duplicate = createQuestDuplicate(source, `q${Date.now()}-${suffix}`, scheduledDate);
    const nextQuests = [...quests, duplicate];
    const conflict = findDailyQuestLimitConflict(nextQuests, questLimitDateKeys);
    if (conflict) {
      showQuestLimitAlert(conflict);
      return;
    }

    setQuests(nextQuests);
    setOpenQuestId(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (scheduledDate) {
      Alert.alert("Scheduled for tomorrow", `“${source.title}” will appear as a one-time quest tomorrow.`);
    }
  };

  const duplicateQuest = (questId: string) => addQuestCopy(questId);
  const doQuestTomorrow = (questId: string) => {
    const source = quests.find((quest) => quest.id === questId);
    if (!source) return;

    const action = getTomorrowQuestAction(source, tomorrowDateKey);
    if (!action) {
      setOpenQuestId(null);
      Alert.alert("Already scheduled", `“${source.title}” is already set to appear tomorrow.`);
      return;
    }

    if (action === "move") {
      setQuests((current) =>
        current.map((quest) =>
          quest.id === questId ? moveQuestToDate(quest, tomorrowDateKey) : quest
        )
      );
      setOpenQuestId(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert("Moved to tomorrow", `“${source.title}” will appear tomorrow instead of today.`);
      return;
    }

    addQuestCopy(questId, tomorrowDateKey);
  };

  const uncompleteQuest = (questId: string) => {
    const result = uncompleteQuestInStoredState(
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
        recoveryDays,
      },
      questId,
      todayDateKey
    );
    if (!result.uncompleted) return;

    setQuests(result.state.quests);
    setCategories(result.state.categories);
    setLifetimeCompletedQuestCount(result.state.lifetimeCompletedQuestCount);
    setAchievements(result.state.achievements);
    setUndoQuest(null);

    if (!result.rewardsReversed) {
      Alert.alert(
        "Quest reopened",
        "This completion came from an older app version, so Midnight reopened it without changing historical XP."
      );
    }
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
              scheduledDate: safeRepeat === "once" ? q.scheduledDate : undefined,
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
    let nextState: StoredState = {
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
      recoveryDays,
    };
    const completedQuestIds = quests
      .filter((quest) => quest.done && isQuestScheduledForDate(quest, todayDateKey))
      .map((quest) => quest.id);

    for (const questId of completedQuestIds) {
      nextState = uncompleteQuestInStoredState(nextState, questId, todayDateKey).state;
    }

    setQuests(nextState.quests);
    setCategories(nextState.categories);
    setAchievements(nextState.achievements);
    setLifetimeCompletedQuestCount(nextState.lifetimeCompletedQuestCount);
    setUndoQuest(null);
    setLastResetDate(localDateKey());
  };

  const confirmResetToday = () => {
    Alert.alert(
      "Reset today's completions?",
      "Today's completed quests will reopen. XP and lifetime credit earned from them will be reversed; your finalized DR history stays intact.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset", style: "destructive", onPress: resetToday },
      ]
    );
  };

  const applyContractToggle = (questId: string) => {
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

  const toggleContract = (questId: string) => {
    const target = quests.find((quest) => quest.id === questId);
    if (!target) return;
    if (target.contract) {
      applyContractToggle(questId);
      return;
    }

    const selectedCount = quests.filter((quest) => quest.contract && !quest.paused).length;
    if (selectedCount >= 3) {
      Alert.alert("Contract limit reached", "Keep the active contract list to three contracts.");
      return;
    }

    setActionDialog({
      title: "Protect as a contract?",
      body: getContractConfirmationCopy(target.title),
      actions: [
        { label: "Protect quest", emphasis: "primary", onPress: () => applyContractToggle(questId) },
        { label: "Not now", onPress: () => undefined },
      ],
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
      dailyReflections: [],
      recoveryDays: [],
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
    setDailyReflections([]);
    setRecoveryDays([]);
    setReflectionDraft("");
    setPendingEvaluation(null);
    setIsSavingEvaluation(false);

    setShowAdd(false);
    setEditingQuestId(null);
    setOpenQuestId(null);
    setNewTitle("");
    setNewTarget("");
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
      target: newTarget.trim(),
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
    setNewTarget("");
    setNewDifficulty("easy");
    setNewRepeat("daily");
    setNewScheduledWeekday(getTodayWeekday());
    setShowAdd(false);
  };

  const confirmResetDemo = () => {
    Alert.alert(
      "Reset all profile data?",
      "This clears quests, DR, awards, Recovery Days, and evaluation history on this device.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset profile", style: "destructive", onPress: resetDemo },
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
        <KeyboardAvoidingView
          style={styles.keyboardAvoiding}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            ref={todayScrollRef}
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
                <Text style={styles.homeSubtitle}>{todayDisplayDate}</Text>
              </Pressable>
              <View style={styles.homeMetaPill}>
                <View
                  style={[
                    styles.homeMetaDot,
                    { backgroundColor: remainingQuestCount === 0 && totalQuestCount > 0 ? colors.positive : HOME_GOLD },
                  ]}
                />
                <Text style={styles.homeMetaText}>
                  {totalQuestCount === 0
                    ? "Open"
                    : remainingQuestCount === 0
                      ? "Complete"
                      : `${remainingQuestCount} left`}
                </Text>
              </View>
            </View>

            <View ref={progressTourRef} collapsable={false} style={styles.todayHero}>
              <View style={styles.todayHeroTop}>
                <View style={styles.todayHeroCopy}>
                  <Text style={styles.todayEyebrow}>Today&apos;s progress</Text>
                  <Text style={styles.todayHeadline}>{todayHeadline}</Text>
                  <Text style={styles.todayCompletionLine}>
                    {totalQuestCount === 0
                      ? "No quests scheduled yet"
                      : `${doneCount} of ${totalQuestCount} completed`}
                  </Text>
                </View>
                <View style={styles.todayScorePlate}>
                  <FixedPercent
                    value={dayScorePercent}
                    textStyle={styles.todayScoreValue}
                    accessibilityLabel={`${dayScorePercent}% Day Score`}
                  />
                  <Text style={styles.todayScoreLabel}>Day Score</Text>
                </View>
              </View>

              <View style={styles.todayProgressTrack}>
                <View style={[styles.todayProgressFill, { width: `${dayScorePercent}%` }]} />
              </View>

              <Pressable
                onPress={() => setShowTodayDetails((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel={showTodayDetails ? "Hide scoring details" : "Show scoring details"}
                style={({ pressed }) => [styles.todayDetailsToggle, pressed && styles.btnPressed]}
              >
                <Text style={styles.todayDetailsToggleText}>
                  {showTodayDetails ? "Hide today’s stats" : "Today’s stats"}
                </Text>
                <IconSymbol name={showTodayDetails ? "chevron.left" : "chevron.right"} size={17} color={HOME_GOLD} />
              </Pressable>

              {showTodayDetails ? (
                <View style={styles.todayDetailsPanel}>
                  <Text style={styles.todaySummary}>{todaySummary}</Text>
                  <View style={styles.todayMetricRow}>
                    <View style={styles.todayMetric}>
                      <Text style={styles.todayMetricValue}>{doneCount}/{dayScoreTarget}</Text>
                      <Text style={styles.todayMetricLabel}>Toward standard</Text>
                    </View>
                    <View style={styles.todayMetricDivider} />
                    <View style={styles.todayMetric}>
                      {drHistory.length > 0 ? (
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
                      ) : (
                        <Text style={styles.todayMetricValue}>—</Text>
                      )}
                      <Text style={styles.todayMetricLabel}>
                        {drHistory.length > 0 ? "Discipline Rating" : "DR after midnight"}
                      </Text>
                    </View>
                    <View style={styles.todayMetricDivider} />
                    <View style={styles.todayMetric}>
                      <Text style={styles.todayMetricValue} numberOfLines={1} adjustsFontSizeToFit>
                        {countdownToMidnight}
                      </Text>
                      <Text style={styles.todayMetricLabel}>Until midnight</Text>
                    </View>
                  </View>
                  {drHistory.length > 0 ? (
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
                  ) : (
                    <View style={styles.firstDayHint}>
                      <View style={styles.firstDayHintCopy}>
                        <Text style={styles.firstDayHintTitle}>First-day mode</Text>
                        <Text style={styles.firstDayHintText}>
                          Finish quests now. Scores and ranks make sense after your first midnight review.
                        </Text>
                      </View>
                      <Pressable
                        onPress={showProgressHelp}
                        accessibilityRole="button"
                        accessibilityLabel="Explain XP, Discipline Rating, and ranks"
                        style={({ pressed }) => [styles.termHelpButton, pressed && styles.btnPressed]}
                      >
                        <Text style={styles.termHelpButtonText}>?</Text>
                      </Pressable>
                    </View>
                  )}
                  {showBeginnerGuidance ? (
                    <View style={styles.todayRuleRow}>
                      <Text style={[styles.todayRuleText, styles.todayRuleTextFlex]}>
                        Midnight records today&apos;s completion rate once.
                      </Text>
                      {drHistory.length > 0 ? (
                        <Pressable
                          onPress={showProgressHelp}
                          accessibilityRole="button"
                          accessibilityLabel="Explain XP, Discipline Rating, and ranks"
                          style={({ pressed }) => [styles.termHelpButton, pressed && styles.btnPressed]}
                        >
                          <Text style={styles.termHelpButtonText}>?</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            {__DEV__ && showDevActions ? (
              <View style={styles.devActionRow}>
                <Pressable
                  style={styles.devActionChip}
                  onPress={confirmResetToday}
                  accessibilityRole="button"
                  accessibilityLabel="Reset today's quest completions"
                >
                  <Text style={styles.devActionText}>Reset today</Text>
                </Pressable>
                <Pressable
                  style={styles.devActionChip}
                  onPress={confirmResetDemo}
                  accessibilityRole="button"
                  accessibilityLabel="Reset all profile data"
                >
                  <Text style={styles.devActionText}>Reset profile</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={[styles.sectionBand, styles.dailySection]}>
            <View ref={questBoardTourRef} collapsable={false} style={styles.dailyHeaderCard}>
              <View style={styles.queueHeaderRow}>
                <View style={styles.queueHeaderIdentity}>
                  <View style={styles.queueHeaderIcon}>
                    <IconSymbol name="flag.fill" size={18} color={HOME_GOLD} />
                  </View>
                  <View style={styles.queueHeaderCopy}>
                    <Text style={styles.queueEyebrow}>Your board</Text>
                    <Text style={styles.queueHeadline}>Today&apos;s quests</Text>
                  </View>
                </View>
                <View ref={addQuestTourRef} collapsable={false}>
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
              </View>

              {showBeginnerGuidance ? (
                <Text style={styles.queueHelpText}>
                  {totalQuestCount > 0
                    ? "Use the circle to complete. Tap a quest for details."
                    : "Add one clear action you can finish before midnight."}
                </Text>
              ) : null}
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
                newTarget={newTarget}
                newCategory={newCategory}
                newDifficulty={newDifficulty}
                newRepeat={newRepeat}
                newScheduledWeekday={newScheduledWeekday}
                onTitleChange={setNewTitle}
                onTargetChange={setNewTarget}
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
                reducedMotion={reducedMotion}
              />
            )}

            {/* QUEST LIST */}
            <View style={styles.list}>
              {sortedQuests.length === 0 ? (
                <View style={styles.emptyQuestCard}>
                  <Text style={styles.emptyQuestTitle}>No quests queued</Text>
                  <Text style={styles.emptyQuestText}>
                    Add one small action so today has a clear finish line.
                  </Text>
                  <View style={styles.emptyQuestActions}>
                    <Pressable
                      style={styles.emptyQuestButton}
                      onPress={() => setShowAdd(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Add a custom quest"
                    >
                      <Text style={styles.emptyQuestButtonText}>Add custom</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.emptyQuestButton, styles.emptyQuestButtonSecondary]}
                      onPress={() => router.push("/(tabs)/plan")}
                      accessibilityRole="button"
                      accessibilityLabel="Browse starter quests in Plan"
                    >
                      <Text style={[styles.emptyQuestButtonText, styles.emptyQuestButtonTextSecondary]}>Browse starters</Text>
                    </Pressable>
                  </View>
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
                        {group.id === "contracts" ? (
                          <Text style={styles.questQueueSupport}>{contractStatusText}</Text>
                        ) : null}
                        <View style={styles.questQueueList}>
                          {group.quests.map((q) => (
                            <QuestCard
                              key={q.id}
                              quest={q}
                              categoryName={categoryName(q.categoryId)}
                              isOpen={openQuestId === q.id}
                              onToggle={toggleQuestOpen}
                              onComplete={completeQuest}
                              onUncomplete={uncompleteQuest}
                              onEdit={(questId) => {
                                setEditingQuestId(questId);
                                setOpenQuestId(null);
                              }}
                              onContract={toggleContract}
                              onDelete={deleteQuest}
                              onPrioritize={toggleQuestPriority}
                              onDuplicate={duplicateQuest}
                              onDoTomorrow={doQuestTomorrow}
                              tomorrowAction={getTomorrowQuestAction(q, tomorrowDateKey)}
                              reducedMotion={reducedMotion}
                            />
                          ))}
                        </View>
                      </View>
                    );
                  })
              )}
            </View>

            <View style={styles.reflectionCard}>
              <View style={styles.reflectionHeaderRow}>
                <View style={styles.reflectionHeaderCopy}>
                  <Text style={styles.reflectionEyebrow}>Close the loop</Text>
                  <Text style={styles.reflectionTitle}>Daily reflection</Text>
                </View>
                <Text style={styles.reflectionCount}>{reflectionDraft.length}/280</Text>
              </View>
              {showBeginnerGuidance ? (
                <Text style={styles.reflectionHelp}>
                  Optional: note what helped, what got in the way, or what tomorrow should remember.
                </Text>
              ) : null}
              {latestPastReflection && !reflectionDraft.trim() ? (
                <View style={styles.previousReflection}>
                  <Text style={styles.previousReflectionLabel}>Previous note</Text>
                  <Text style={styles.previousReflectionText} numberOfLines={2}>
                    {latestPastReflection.note}
                  </Text>
                </View>
              ) : null}
              <TextInput
                value={reflectionDraft}
                onChangeText={(value) => setReflectionDraft(value.slice(0, 280))}
                onFocus={() => {
                  setTimeout(
                    () => todayScrollRef.current?.scrollToEnd({ animated: true }),
                    Platform.OS === "ios" ? 300 : 180,
                  );
                }}
                placeholder="One sentence is enough…"
                placeholderTextColor={colors.textSecondary}
                multiline
                maxLength={280}
                textAlignVertical="top"
                accessibilityLabel="Daily reflection note"
                style={styles.reflectionInput}
              />
              <View style={styles.reflectionFooter}>
                <Text style={styles.reflectionSavedText}>
                  {reflectionIsSaved ? (todayReflection ? "Saved for today" : "No note saved") : "Unsaved changes"}
                </Text>
                <Pressable
                  onPress={saveReflection}
                  disabled={reflectionIsSaved}
                  accessibilityRole="button"
                  accessibilityLabel="Save daily reflection"
                  accessibilityState={{ disabled: reflectionIsSaved }}
                  style={({ pressed }) => [
                    styles.reflectionSaveButton,
                    reflectionIsSaved && styles.reflectionSaveButtonDisabled,
                    pressed && styles.btnPressed,
                  ]}
                >
                  <Text style={styles.reflectionSaveButtonText}>Save note</Text>
                </Pressable>
              </View>
            </View>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      {undoQuest ? (
        <View
          style={styles.undoBanner}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          accessibilityLabel={
            undoQuest.awardName
              ? `${undoQuest.title} completed for ${undoQuest.xp} XP. Award unlocked: ${undoQuest.awardName}. Undo available.`
              : `${undoQuest.title} completed for ${undoQuest.xp} XP. Undo available.`
          }
        >
          <View style={styles.undoBannerCopy}>
            <Text style={styles.undoBannerTitle} numberOfLines={1}>
              {undoQuest.awardName ? `Award unlocked: ${undoQuest.awardName}` : `Quest completed: +${undoQuest.xp} XP`}
            </Text>
            <Text style={styles.undoBannerText} numberOfLines={1}>
              {undoQuest.awardName
                ? `+${undoQuest.xp} XP / ${undoQuest.category} / ${undoQuest.title}`
                : `${undoQuest.category} / ${undoQuest.title}`}
            </Text>
          </View>
          <Pressable
            onPress={() => uncompleteQuest(undoQuest.id)}
            accessibilityRole="button"
            accessibilityLabel={`Undo completion of ${undoQuest.title}`}
            style={({ pressed }) => [styles.undoBannerButton, pressed && styles.btnPressed]}
          >
            <Text style={styles.undoBannerButtonText}>Undo</Text>
          </Pressable>
        </View>
      ) : null}
      <AppInfoDialog
        visible={showProgressInfo}
        title="How progress works"
        body="Completing a quest gives category XP immediately. After midnight, your Day Score changes Discipline Rating (DR) once. DR raises your rank and eventually unlocks deeper Progress insights."
        onClose={() => setShowProgressInfo(false)}
      />
      <AppActionDialog
        visible={Boolean(actionDialog)}
        title={actionDialog?.title ?? ""}
        body={actionDialog?.body ?? ""}
        actions={actionDialog?.actions ?? []}
        onClose={() => setActionDialog(null)}
      />
      <AwardUnlockCelebration
        visible={Boolean(awardCelebration)}
        awardName={awardCelebration?.name ?? ""}
        onClose={() => setAwardCelebration(null)}
        onViewAward={() => {
          const awardId = awardCelebration?.id;
          setAwardCelebration(null);
          if (awardId) {
            router.push({ pathname: "/(tabs)/achievements", params: { awardId } });
          }
        }}
      />
      <RankPromotionCelebration
        promotion={rankPromotionQueue[0] ?? null}
        onContinue={() => setRankPromotionQueue((current) => current.slice(1))}
        onViewProgress={() => {
          setRankPromotionQueue((current) => current.slice(1));
          router.push("/(tabs)/insights");
        }}
      />
      <GuidedSpotlightTour
        visible={showGuidedTour}
        steps={guidedTourSteps}
        onFinish={finishGuidedTour}
      />
    </View>
  );
}


