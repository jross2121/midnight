import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CONTRACT_GOLD, HOME_GOLD } from "@/src/styles";
import { DisciplineCalendar, type DisciplineCalendarDay } from "@/src/components/DisciplineCalendar";
import { DisciplinePatterns } from "@/src/components/DisciplinePatterns";
import { RankBadge } from "@/src/components/RankBadge";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { ScreenLoading } from "@/src/components/ScreenLoading";
import { getMainCategoryDisplayEntries } from "@/src/utils/categoryLabels";
import {
    defaultCategories,
    defaultDisciplineRating,
    defaultDrHistory,
    defaultQuests,
} from "@/src/utils/defaultData";
import { createCardSurface, createTileSurface, ui, withAlpha } from "@/src/utils/designSystem";
import {
  DAILY_STANDARD,
  formatDelta,
  getCompletionPercent,
  getDailyScoringTarget,
} from "@/src/utils/discipline";
import { buildCoachResponse, COACH_PROMPTS, type CoachPromptId } from "@/src/utils/coach";
import {
    buildCalendarFromHistory,
    getAverageCompletionRate,
    getLatestCategoriesFromHistory,
    getLatestHistoryEntries,
    getSevenDayDrChange,
    getTrendPointsFromHistory,
    sortEvaluationHistory,
} from "@/src/utils/evaluationAnalytics";
import { readEvaluationHistory, type DailyEvaluationHistoryItem } from "@/src/utils/evaluationHistory";
import { localDateKey } from "@/src/utils/dateHelpers";
import { getScheduledQuestsForDate } from "@/src/utils/recurrence";
import { getRankFromDR, getRankMeta } from "@/src/utils/rank";
import { buildStreakSummary } from "@/src/utils/planning";
import { useTheme } from "@/src/utils/themeContext";
import type { Category, DrHistoryEntry, Quest, StoredState } from "@/src/utils/types";
import { STORAGE_KEY } from "@/src/utils/types";

const MAIN_CATEGORIES = getMainCategoryDisplayEntries();
const INSIGHTS_UNLOCK_RANK = "Focused";
const INSIGHTS_TONE = HOME_GOLD;
const INSIGHTS_UNLOCK_TONE = HOME_GOLD;
const INSIGHT_MINT = "#34D399";
const INSIGHT_CONTRACT = CONTRACT_GOLD;
const INSIGHT_VIOLET = "#A78BFA";
const INSIGHT_ROSE = "#FB7185";

const LOCKED_INSIGHT_PREVIEWS = [
  {
    title: "Pattern readout",
    body: "See what your recent judgments say about momentum, pressure, and next moves.",
  },
  {
    title: "Weekly review",
    body: "Compare finish rate, contract protection, and DR changes across your latest week.",
  },
  {
    title: "Execution balance",
    body: "Spot which life domains are carrying the run and which ones need attention.",
  },
];

type CategoryInsight = {
  id: string;
  label: string;
  completionPct: number;
  completed: number;
  total: number;
};

type InsightMode = "today" | "history";

const INSIGHT_MODES: { id: InsightMode; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "history", label: "History" },
];

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
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

function getJudgmentTitle(entry: DrHistoryEntry): string {
  if (entry.title) return entry.title;
  if (entry.pct >= 100) return "Perfect Day";
  if (entry.pct >= 85) return "Clean Victory";
  if (entry.pct < 30) return "Midnight Claimed";
  return "Daily Judgment";
}

function getContractSummary(entry: DrHistoryEntry): string | null {
  if (typeof entry.contractCompletedCount !== "number" || typeof entry.contractTotalCount !== "number") {
    return null;
  }
  if (entry.contractTotalCount <= 0) return "No contract";
  return `${entry.contractCompletedCount}/${entry.contractTotalCount} contract`;
}

function formatWeekChange(delta: number, hasSufficientHistory: boolean): string {
  if (!hasSufficientHistory) return "Need 2+ evaluations";
  if (delta > 0) return `+${delta} vs 7d ago`;
  if (delta < 0) return `${delta} vs 7d ago`;
  return "No change in 7d";
}

function buildCompactInsight({
  averageCompletionRate,
  hasHistory,
  weekDelta,
}: {
  averageCompletionRate: number;
  hasHistory: boolean;
  weekDelta: number;
}): string {
  if (!hasHistory) return "Complete today's board. Your first Midnight Evaluation sets the baseline.";
  if (weekDelta > 0) return "Momentum is rising. Protect it with one clean win.";
  if (weekDelta < 0) return "Pressure is up. Shrink the plan and secure one must-do quest.";
  if (averageCompletionRate >= 80) return "Steady trend. One more quest can push momentum up.";
  if (averageCompletionRate >= 50) return "Stable base. Pick one anchor quest to lift the trend.";
  return "Low signal. Start with the smallest quest that still counts.";
}

function MiniTrendChart({
  points,
  chartWrapStyle,
  chartBarStyle,
}: {
  points: number[];
  chartWrapStyle: object;
  chartBarStyle: object;
}) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(1, max - min);

  return (
    <View style={chartWrapStyle}>
      {points.map((value, idx) => {
        const normalized = (value - min) / range;
        const height = 10 + normalized * 36;
        return <View key={`trend-${idx}`} style={[chartBarStyle, { height }]} />;
      })}
    </View>
  );
}

export default function InsightsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createInsightsStyles(colors), [colors]);
  const [disciplineRating, setDisciplineRating] = useState<number>(defaultDisciplineRating);
  const [evaluationHistory, setEvaluationHistory] = useState<DailyEvaluationHistoryItem[]>([]);
  const [drHistory, setDrHistory] = useState<DrHistoryEntry[]>(defaultDrHistory);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [quests, setQuests] = useState<Quest[]>(defaultQuests);
  const [hydrated, setHydrated] = useState(false);
  const [selectedCoachPrompt, setSelectedCoachPrompt] = useState<CoachPromptId>("next");
  const [selectedInsightMode, setSelectedInsightMode] = useState<InsightMode>("today");

  const loadData = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<StoredState>;
      setDisciplineRating(
        typeof parsed.disciplineRating === "number"
          ? parsed.disciplineRating
          : defaultDisciplineRating
      );
      setCategories(
        Array.isArray(parsed.categories) && parsed.categories.length
          ? parsed.categories
          : defaultCategories
      );
      setQuests(Array.isArray(parsed.quests) ? parsed.quests : defaultQuests);
      setDrHistory(
        Array.isArray(parsed.drHistory)
          ? parsed.drHistory.filter((entry): entry is DrHistoryEntry => isDrHistoryEntry(entry)).slice(-30)
          : defaultDrHistory
      );
      const loadedHistory = await readEvaluationHistory();
      setEvaluationHistory(sortEvaluationHistory(loadedHistory));
    } catch (e) {
      if (__DEV__) console.warn("Failed to load storage:", e);
    } finally {
      setHydrated(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  if (!hydrated) {
    return <ScreenLoading label="Loading insights" />;
  }

  const focusedMinDr = getRankMeta(INSIGHTS_UNLOCK_RANK).minDr;
  const peakRecordedDr = Math.max(
    disciplineRating,
    ...drHistory.map((entry) => entry.dr),
    ...evaluationHistory.map((entry) => Math.max(entry.drBefore, entry.drAfter))
  );
  const insightsUnlocked = __DEV__ || peakRecordedDr >= focusedMinDr;
  const unlockProgressPercent = Math.min(
    100,
    Math.round((Math.max(0, peakRecordedDr) / focusedMinDr) * 100)
  );
  const unlockRemainingDr = Math.max(0, focusedMinDr - peakRecordedDr);

  const todaysQuests = getScheduledQuestsForDate(quests, localDateKey());
  const categoryBreakdown = MAIN_CATEGORIES.map((entry) => {
    const relatedQuests = todaysQuests.filter((quest) => quest.categoryId === entry.id);
    const doneCount = relatedQuests.filter((quest) => quest.done).length;
    const category = categories.find((item) => item.id === entry.id);
    const fallbackFromLevel = category
      ? Math.max(0, Math.min(100, Math.round((category.xp / Math.max(1, category.xpToNext)) * 100)))
      : 0;
    const completionPct =
      relatedQuests.length > 0 ? Math.round((doneCount / relatedQuests.length) * 100) : fallbackFromLevel;

    return {
      id: entry.id,
      label: entry.label,
      completionPct,
      completed: doneCount,
      total: relatedQuests.length,
    } as CategoryInsight;
  }).sort((a, b) => b.completionPct - a.completionPct);

  const latest7History = getLatestHistoryEntries(evaluationHistory, 7);
  const trendPointsRaw = getTrendPointsFromHistory(evaluationHistory, 7);
  const trendPoints =
    trendPointsRaw.length === 1 ? [trendPointsRaw[0], trendPointsRaw[0]] : trendPointsRaw;
  const disciplineCalendarDays: DisciplineCalendarDay[] = buildCalendarFromHistory(
    evaluationHistory,
    30
  );
  const hasHistory = evaluationHistory.length > 0;
  const hasSufficientTrend = latest7History.length >= 2;
  const weekDelta = getSevenDayDrChange(evaluationHistory);
  const trendLabelTone = weekDelta > 0 ? colors.positive : weekDelta < 0 ? colors.negative : colors.textSecondary;
  const averageCompletionRate = getAverageCompletionRate(evaluationHistory);
  const compactInsightMessage = buildCompactInsight({
    averageCompletionRate,
    hasHistory,
    weekDelta,
  });
  const categoryFromHistory = getLatestCategoriesFromHistory(evaluationHistory);
  const strongestCategory = categoryFromHistory.strongestCategory ?? categoryBreakdown[0]?.label ?? "N/A";
  const weakestCategory =
    categoryFromHistory.weakestCategory ??
    categoryBreakdown[categoryBreakdown.length - 1]?.label ??
    "N/A";
  const currentRank = getRankFromDR(disciplineRating);
  const currentDrValue = disciplineRating;
  const completedToday = todaysQuests.filter((quest) => quest.done).length;
  const totalToday = todaysQuests.length;
  const todayRate = getCompletionPercent(
    completedToday,
    getDailyScoringTarget(totalToday, DAILY_STANDARD)
  );
  const bestCategory = categoryBreakdown[0];
  const riskCategory = categoryBreakdown[categoryBreakdown.length - 1];
  const latestEvaluation = latest7History[latest7History.length - 1] ?? null;
  const latestCompletion = latestEvaluation?.completionRate ?? todayRate;
  const recentJudgments = drHistory.slice(-8).reverse();
  const streakSummary = buildStreakSummary(drHistory);
  const bestCompletionPercent = Math.max(
    todayRate,
    ...evaluationHistory.map((entry) => entry.completionRate)
  );
  const bestRecordedDr = Math.max(
    disciplineRating,
    ...drHistory.map((entry) => entry.dr),
    ...evaluationHistory.map((entry) => entry.drAfter)
  );
  const positiveJudgmentCount = drHistory.filter(
    (entry) => !entry.recoveryDay && entry.delta > 0
  ).length;
  const recoverySignal =
    latest7History.length >= 3
      ? latest7History
          .slice(-3)
          .filter((entry) => entry.completionRate >= averageCompletionRate).length
      : 0;
  const weeklyAvgCompletion = latest7History.length
    ? Math.round(latest7History.reduce((sum, entry) => sum + entry.completionRate, 0) / latest7History.length)
    : 0;
  const weeklyDrDelta =
    latest7History.length >= 2
      ? latest7History[latest7History.length - 1].drAfter - latest7History[0].drBefore
      : 0;
  const weeklyContractDays = latest7History.filter(
    (entry) =>
      typeof entry.contractTotalCount === "number" &&
      entry.contractTotalCount > 0 &&
      entry.contractCompletedCount === entry.contractTotalCount
  ).length;
  const weeklyReviewTitle = (() => {
    if (latest7History.length === 0) return "Build the first week";
    if (weeklyAvgCompletion >= 85 && weeklyDrDelta > 0) return "Clean week";
    if (weeklyAvgCompletion >= 60) return "Stable week";
    if (weeklyDrDelta < 0) return "Recovery week";
    return "Calibration week";
  })();
  const weeklyNextAction = (() => {
    if (latest7History.length === 0) return "Finish one midnight judgment to unlock the weekly review.";
    if (weeklyAvgCompletion < 60) return `Shrink the board and protect one contract in ${weakestCategory}.`;
    if (weeklyContractDays < Math.max(1, Math.floor(latest7History.length / 2))) {
      return "Make contract protection the first action of each day.";
    }
    if (weeklyAvgCompletion >= 85) return `Add one harder rep in ${weakestCategory}.`;
    return `Keep the floor at 60% and push ${strongestCategory} for one extra completion.`;
  })();
  const coachResponse = buildCoachResponse(selectedCoachPrompt, {
    todaysQuests,
    evaluationHistory,
    strongestCategory,
    weakestCategory,
  });
  const coachToneColor =
    coachResponse.tone === "positive"
      ? colors.positive
      : coachResponse.tone === "warning"
        ? colors.negative
        : INSIGHTS_TONE;
  const latestCompletionTone =
    latestCompletion >= 80 ? colors.positive : latestCompletion >= 50 ? INSIGHTS_UNLOCK_TONE : colors.negative;
  const weeklyTrendLabel = weekDelta > 0 ? "Rising" : weekDelta < 0 ? "Under pressure" : "Flat";
  const categoryToneForPercent = (percent: number) =>
    percent >= 80 ? colors.positive : percent >= 50 ? INSIGHTS_TONE : colors.negative;
  const recoveryPercent = clampPercent((recoverySignal / 3) * 100);
  const contractPercent = latest7History.length
    ? clampPercent((weeklyContractDays / latest7History.length) * 100)
    : 0;
  const trendPercent = clampPercent(50 + weekDelta * 4);
  const momentumScore = clampPercent(
    (todayRate + averageCompletionRate + recoveryPercent + trendPercent) / 4
  );
  const momentumTone =
    momentumScore >= 75 ? INSIGHT_MINT : momentumScore >= 50 ? INSIGHTS_TONE : INSIGHT_ROSE;
  const strengthTone = bestCategory ? categoryToneForPercent(bestCategory.completionPct) : INSIGHT_MINT;
  const improveTone = riskCategory ? categoryToneForPercent(riskCategory.completionPct) : INSIGHT_ROSE;
  const dashboardCards = [
    {
      label: "Improve",
      title: weakestCategory,
      value: riskCategory ? `${riskCategory.completionPct}%` : "No data",
      body: riskCategory?.total
        ? `${riskCategory.completed}/${riskCategory.total} complete today`
        : "Needs a tracked quest to measure.",
      tone: improveTone,
      percent: riskCategory?.completionPct ?? 0,
      featured: true,
    },
    {
      label: "Good at",
      title: strongestCategory,
      value: bestCategory ? `${bestCategory.completionPct}%` : "No data",
      body: bestCategory?.total
        ? `${bestCategory.completed}/${bestCategory.total} complete today`
        : "Your strongest lane will appear here.",
      tone: strengthTone,
      percent: bestCategory?.completionPct ?? 0,
      featured: true,
    },
    {
      label: "Today",
      title: "Completion",
      value: `${todayRate}%`,
      body: `${completedToday}/${totalToday} quests complete`,
      percent: todayRate,
      tone: latestCompletionTone,
      featured: false,
    },
    {
      label: "Trend",
      title: weeklyTrendLabel,
      value: weekDelta > 0 ? `+${weekDelta}` : `${weekDelta}`,
      body: formatWeekChange(weekDelta, hasSufficientTrend),
      percent: trendPercent,
      tone: trendLabelTone,
      featured: false,
    },
  ];
  const actionPlan = [
    {
      label: "1",
      title: "Improve first",
      body: riskCategory
        ? `Put the next completed quest into ${weakestCategory}.`
        : weeklyNextAction,
      tone: improveTone,
    },
    {
      label: "2",
      title: "Keep doing",
      body: bestCategory
        ? `${strongestCategory} is carrying the run. Keep one easy win there.`
        : "Build one reliable category with a repeatable quest.",
      tone: strengthTone,
    },
    {
      label: "3",
      title: "Watch",
      body:
        weekDelta < 0
          ? "DR is slipping this week. Shrink the board and protect one contract."
          : `Momentum score is ${momentumScore}. Keep the average above 60%.`,
      tone: weekDelta < 0 ? colors.negative : momentumTone,
    },
  ];
  const historyStats = [
    {
      label: "Momentum",
      value: `${momentumScore}`,
      tone: momentumTone,
      percent: momentumScore,
    },
    {
      label: "Contracts",
      value: `${weeklyContractDays}/${latest7History.length || 0}`,
      tone: INSIGHT_CONTRACT,
      percent: contractPercent,
    },
    {
      label: "Recovery",
      value: `${recoverySignal}/3`,
      tone: INSIGHT_VIOLET,
      percent: recoveryPercent,
    },
    {
      label: "Trend",
      value: weeklyTrendLabel,
      percent: trendPercent,
      tone: trendLabelTone,
    },
  ];
  const baselineStats = [
    {
      label: "Today",
      value: `${todayRate}%`,
      body: `${completedToday}/${totalToday} quests complete`,
      tone: latestCompletionTone,
    },
    {
      label: "Personal best",
      value: `${bestCompletionPercent}%`,
      body: hasHistory ? "Highest recorded day" : "Current best so far",
      tone: INSIGHT_MINT,
    },
    {
      label: "Best DR",
      value: `${bestRecordedDr}`,
      body: `${currentDrValue} current DR`,
      tone: INSIGHTS_TONE,
    },
    {
      label: "Solid streak",
      value: `${streakSummary.solidDayStreak}`,
      body: positiveJudgmentCount > 0 ? `${positiveJudgmentCount} positive judgments` : "60%+ builds the streak",
      tone: INSIGHT_VIOLET,
    },
  ];
  const baselinePanel = (
    <View style={styles.baselinePanel}>
      <View style={styles.baselineHeader}>
        <View style={styles.dashboardTitleCopy}>
          <Text style={styles.eyebrow}>Your baseline</Text>
          <Text style={styles.dashboardTitle}>{currentRank} progress</Text>
        </View>
        <View style={styles.baselineDrPill}>
          <Text style={styles.baselineDrValue}>{currentDrValue}</Text>
          <Text style={styles.baselineDrLabel}>DR</Text>
        </View>
      </View>
      <Text style={styles.dashboardBody}>
        Progress tracks performance. Player Card shows your rank identity; Awards holds the milestones you earn.
      </Text>
      <View style={styles.baselineGrid}>
        {baselineStats.map((item) => (
          <View
            key={item.label}
            style={[
              styles.baselineStat,
              {
                borderColor: withAlpha(item.tone, 0.24),
                backgroundColor: withAlpha(item.tone, 0.055),
              },
            ]}
          >
            <Text style={[styles.baselineStatValue, { color: item.tone }]}>{item.value}</Text>
            <Text style={styles.baselineStatLabel}>{item.label}</Text>
            <Text style={styles.baselineStatBody}>{item.body}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  if (!insightsUnlocked) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container}>
          <ScreenHeader
            title="Progress"
            subtitle="Daily score, streaks, and personal bests"
            icon="chart.bar.fill"
            accent={INSIGHTS_UNLOCK_TONE}
          />

          {baselinePanel}

          <View style={styles.lockedPanel}>
            <View style={styles.lockedTopRow}>
              <View style={styles.lockedRankPlate}>
                <RankBadge rank={INSIGHTS_UNLOCK_RANK} size={44} color={INSIGHTS_UNLOCK_TONE} active />
              </View>
              <View style={styles.lockedCopy}>
                <Text style={styles.eyebrow}>Advanced patterns</Text>
                <Text style={styles.lockedTitle}>Reach Focused for deeper analysis</Text>
                <Text style={styles.lockedBody}>
                  Midnight needs enough judgments before it can interpret trends and recommend adjustments reliably.
                </Text>
              </View>
            </View>

            <View style={styles.unlockProgressBlock}>
              <View style={styles.unlockProgressHeader}>
                <Text style={styles.unlockProgressLabel}>Focused progress</Text>
                <Text style={styles.unlockProgressValue}>{unlockProgressPercent}%</Text>
              </View>
              <View style={styles.unlockTrack}>
                <View style={[styles.unlockFill, { width: `${unlockProgressPercent}%` }]} />
              </View>
              <View style={styles.unlockMetaRow}>
                <Text style={styles.unlockMeta}>{peakRecordedDr} DR</Text>
                <Text style={styles.unlockMeta}>
                  {unlockRemainingDr > 0 ? `${unlockRemainingDr} DR to unlock` : "Ready"}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => router.replace("/(tabs)")}
              accessibilityRole="button"
              accessibilityLabel="Open Today to build Discipline Rating"
              style={({ pressed }) => [styles.lockedAction, pressed && { opacity: 0.76 }]}
            >
              <Text style={styles.lockedActionText}>
                {drHistory.length === 0 ? "Complete your first day" : "Continue Today"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.lockedPreviewGrid}>
            {LOCKED_INSIGHT_PREVIEWS.map((item) => (
              <View key={item.title} style={styles.lockedPreviewCard}>
                <View style={styles.lockedPreviewDot} />
                <Text style={styles.lockedPreviewTitle}>{item.title}</Text>
                <Text style={styles.lockedPreviewBody}>{item.body}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader
          title="Progress"
          subtitle="See what is working and what to do next"
          icon="chart.bar.fill"
          accent={INSIGHTS_TONE}
        />

        {baselinePanel}

        <View style={styles.modeSwitch} accessibilityRole="tablist">
          {INSIGHT_MODES.map((mode) => {
            const selected = mode.id === selectedInsightMode;

            return (
              <Pressable
                key={mode.id}
                accessibilityRole="tab"
                accessibilityLabel={`Show ${mode.label}`}
                accessibilityState={{ selected }}
                onPress={() => setSelectedInsightMode(mode.id)}
                style={({ pressed }) => [
                  styles.modeButton,
                  selected && styles.modeButtonSelected,
                  pressed && styles.modeButtonPressed,
                ]}
              >
                <Text style={[styles.modeButtonText, selected && styles.modeButtonTextSelected]}>
                  {mode.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {selectedInsightMode === "today" ? (
          <>
        <View style={styles.dashboardPanel}>
          <View style={styles.dashboardHeader}>
            <View style={styles.dashboardTitleRow}>
              <View style={styles.dashboardTitleCopy}>
                <Text style={styles.eyebrow}>This week</Text>
                <Text
                  style={styles.dashboardTitle}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                >
                  {weeklyReviewTitle}
                </Text>
              </View>
              <View
                style={[
                  styles.dashboardScore,
                  {
                    borderColor: withAlpha(momentumTone, 0.42),
                    backgroundColor: withAlpha(momentumTone, 0.13),
                  },
                ]}
              >
                <Text style={styles.dashboardScoreLabel}>Momentum</Text>
                <Text style={[styles.dashboardScoreValue, { color: momentumTone }]}>{momentumScore}</Text>
              </View>
            </View>
            <Text style={styles.dashboardBody}>{compactInsightMessage}</Text>
          </View>

          <View style={styles.dashboardGrid}>
            {dashboardCards.map((card) => (
              <View
                key={card.label}
                style={[
                  styles.dashboardCard,
                  card.featured && styles.dashboardCardFeatured,
                  {
                    borderColor: withAlpha(card.tone, card.featured ? 0.34 : 0.24),
                    backgroundColor: withAlpha(card.tone, card.featured ? 0.1 : 0.055),
                  },
                ]}
              >
                <View style={styles.dashboardCardTop}>
                  <Text style={[styles.dashboardCardLabel, { color: card.tone }]}>{card.label}</Text>
                  <Text style={[styles.dashboardCardValue, { color: card.tone }]}>{card.value}</Text>
                </View>
                <Text style={styles.dashboardCardTitle} numberOfLines={1}>{card.title}</Text>
                <Text style={styles.dashboardCardBody}>{card.body}</Text>
                <View style={styles.dashboardTrack}>
                  <View
                    style={[
                      styles.dashboardFill,
                      {
                        width: `${Math.max(4, card.percent)}%`,
                        backgroundColor: card.tone,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.actionPanel}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.eyebrow}>What to do next</Text>
              <Text style={styles.cardTitle}>Three useful adjustments</Text>
            </View>
          </View>
          <View style={styles.actionList}>
            {actionPlan.map((item) => (
              <View
                key={item.label}
                style={[
                  styles.actionRow,
                  {
                    borderColor: withAlpha(item.tone, 0.28),
                    backgroundColor: withAlpha(item.tone, 0.055),
                  },
                ]}
              >
                <View style={[styles.actionIndex, { backgroundColor: withAlpha(item.tone, 0.16) }]}>
                  <Text style={[styles.actionIndexText, { color: item.tone }]}>{item.label}</Text>
                </View>
                <View style={styles.actionCopy}>
                  <Text style={styles.actionTitle}>{item.title}</Text>
                  <Text style={styles.actionBody}>{item.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.coachPanel}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.eyebrow}>Recommended next move</Text>
              <Text style={styles.cardTitle}>{coachResponse.title}</Text>
            </View>
            <View style={[styles.coachMetric, { borderColor: withAlpha(coachToneColor, 0.28) }]}>
              <Text style={[styles.coachMetricValue, { color: coachToneColor }]}>
                {coachResponse.metricValue}
              </Text>
              <Text style={styles.coachMetricLabel}>{coachResponse.metricLabel}</Text>
            </View>
          </View>

          <View style={styles.promptGrid}>
            {COACH_PROMPTS.map((prompt) => {
              const selected = prompt.id === selectedCoachPrompt;
              return (
                <Pressable
                  key={prompt.id}
                  onPress={() => setSelectedCoachPrompt(prompt.id)}
                  accessibilityRole="button"
                  accessibilityLabel={prompt.label}
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.promptButton,
                    selected && styles.promptButtonSelected,
                    pressed && styles.promptButtonPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.promptButtonText,
                      selected && styles.promptButtonTextSelected,
                    ]}
                  >
                    {prompt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.coachBody}>{coachResponse.body}</Text>
          <View style={styles.coachBulletList}>
            {coachResponse.bullets.map((item, index) => (
              <View key={`${selectedCoachPrompt}-${index}`} style={styles.coachBulletRow}>
                <View style={[styles.coachBulletDot, { backgroundColor: coachToneColor }]} />
                <Text style={styles.coachBulletText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.categoryPanel}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.eyebrow}>Categories</Text>
              <Text style={styles.cardTitle}>Today by category</Text>
            </View>
            <Text style={styles.mutedMeta}>{categoryBreakdown.length} domains</Text>
          </View>
          <View style={styles.categoryGrid}>
            {categoryBreakdown.map((item) => {
              const categoryTone = categoryToneForPercent(item.completionPct);

              return (
                <View
                  key={item.id}
                  style={[
                    styles.categoryCard,
                    {
                      borderColor: withAlpha(categoryTone, 0.2),
                      backgroundColor: withAlpha(categoryTone, 0.055),
                    },
                  ]}
                >
                  <View style={styles.categoryTopRow}>
                    <View style={[styles.categoryDot, { backgroundColor: categoryTone }]} />
                    <Text style={styles.categoryLabel} numberOfLines={1}>{item.label}</Text>
                    <Text style={[styles.categoryPct, { color: categoryTone }]}>{item.completionPct}%</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: item.completionPct === 0 ? "0%" : `${Math.max(3, item.completionPct)}%`,
                          backgroundColor: categoryTone,
                          opacity: 0.72 + item.completionPct / 360,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.categoryMeta}>
                    {item.total > 0 ? `${item.completed}/${item.total} complete` : "level progress"}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
          </>
        ) : (
          <>

        <View style={styles.historySummaryGrid}>
          {historyStats.map((item) => (
            <View
              key={item.label}
              style={[
                styles.historySummaryCard,
                {
                  borderColor: withAlpha(item.tone, 0.24),
                  backgroundColor: withAlpha(item.tone, 0.055),
                },
              ]}
            >
              <Text style={[styles.historySummaryValue, { color: item.tone }]}>{item.value}</Text>
              <Text style={styles.historySummaryLabel}>{item.label}</Text>
              <View style={styles.historySummaryTrack}>
                <View
                  style={[
                    styles.historySummaryFill,
                    {
                      width: `${Math.max(4, item.percent)}%`,
                      backgroundColor: item.tone,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.trendPanel}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.eyebrow}>Discipline Rating</Text>
              <Text style={styles.cardTitle}>Recent movement</Text>
            </View>
            <Text style={[styles.trendLabel, { color: trendLabelTone }]}>
              {formatWeekChange(weekDelta, hasSufficientTrend)}
            </Text>
          </View>

          <View style={styles.panelDivider} />

          <View style={styles.pulseReadout}>
            <View style={styles.drValueRow}>
              <Text style={styles.drValue}>{currentDrValue}</Text>
              <View style={styles.drValueCopy}>
                <Text style={styles.drLabel}>Current DR</Text>
                <Text style={styles.mutedMeta}>Current long-term score</Text>
              </View>
            </View>
            <View style={styles.pulseMetaGrid}>
              <View style={styles.pulseMetaTile}>
                <Text style={styles.pulseMetaLabel}>Last signal</Text>
                <Text style={styles.pulseMetaValue}>{Math.round(latestCompletion)}% completion</Text>
              </View>
              <View style={styles.pulseMetaTile}>
                <Text style={styles.pulseMetaLabel}>Rank</Text>
                <Text style={styles.pulseMetaValue} numberOfLines={1}>{currentRank}</Text>
              </View>
            </View>
          </View>

          {hasHistory ? (
            <View style={styles.chartBlock}>
              <MiniTrendChart
                points={trendPoints}
                chartWrapStyle={styles.chartWrap}
                chartBarStyle={styles.chartBar}
              />
            </View>
          ) : (
            <Text style={styles.mutedMeta}>No evaluation history yet.</Text>
          )}
          <View style={styles.trendFooter}>
            <Text style={styles.mutedMeta}>Last {Math.min(7, latest7History.length)} evaluations</Text>
            <Text style={styles.mutedMeta}>DR history</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.eyebrow}>Daily results</Text>
              <Text style={styles.cardTitle}>Latest evaluations</Text>
            </View>
            <Text style={styles.mutedMeta}>Latest {Math.min(8, recentJudgments.length)}</Text>
          </View>
          {recentJudgments.length ? (
            recentJudgments.map((entry, index) => {
              const deltaColor =
                entry.delta > 0 ? colors.positive : entry.delta < 0 ? colors.negative : colors.textSecondary;
              const contractSummary = getContractSummary(entry);

              return (
                <View key={`${entry.date}-${index}`} style={styles.judgmentRow}>
                  <View style={[styles.judgmentRail, { backgroundColor: deltaColor }]} />
                  <View style={styles.judgmentCopy}>
                    <Text style={styles.judgmentDate}>{entry.date.slice(5)}</Text>
                    <Text style={styles.judgmentTitle} numberOfLines={1}>
                      {getJudgmentTitle(entry)}
                    </Text>
                    {contractSummary ? (
                      <Text style={styles.judgmentMeta} numberOfLines={1}>
                        {contractSummary}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.judgmentStats}>
                    <Text style={styles.judgmentPct}>{entry.pct}%</Text>
                    <Text style={[styles.judgmentDelta, { color: deltaColor }]}>{formatDelta(entry.delta)}</Text>
                    <Text style={styles.judgmentDr}>{entry.dr} DR</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.mutedMeta}>No midnight judgments yet.</Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.eyebrow}>30-day view</Text>
              <Text style={styles.cardTitle}>Discipline calendar</Text>
            </View>
            <Text style={styles.mutedMeta}>30 days</Text>
          </View>
          <DisciplineCalendar days={disciplineCalendarDays} colors={colors} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.eyebrow}>Patterns</Text>
              <Text style={styles.cardTitle}>What your history shows</Text>
            </View>
          </View>
          <DisciplinePatterns days={disciplineCalendarDays} colors={colors} />
        </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createInsightsStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  const cardSurface = createCardSurface(colors, {
    padding: ui.spacing.md,
    radius: ui.radius.card,
    borderOpacity: 0.22,
    glowOpacity: 0.02,
    backgroundColor: withAlpha(colors.surface2, 0.8),
  });
  const heroSurface = createCardSurface(colors, {
    padding: ui.spacing.md + ui.spacing.xs,
    radius: ui.radius.card,
    borderOpacity: 0.26,
    glowOpacity: 0.03,
    backgroundColor: withAlpha(colors.surface2, 0.9),
  });
  const tileSurface = createTileSurface(colors, {
    padding: ui.spacing.sm,
    radius: ui.radius.md,
    borderOpacity: 0.18,
    backgroundOpacity: 0.18,
  });

  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    container: {
      paddingHorizontal: ui.spacing.screen,
      paddingTop: ui.spacing.md,
      paddingBottom: ui.spacing.lg,
      gap: ui.spacing.sm,
    },
    modeSwitch: {
      flexDirection: "row",
      gap: 6,
      padding: 4,
      borderRadius: ui.radius.md,
      borderWidth: 1,
      borderColor: withAlpha(INSIGHTS_TONE, 0.18),
      backgroundColor: withAlpha(colors.surface2, 0.58),
    },
    modeButton: {
      flex: 1,
      minHeight: 44,
      borderRadius: ui.radius.button,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: ui.spacing.xs,
      paddingVertical: 8,
    },
    modeButtonSelected: {
      backgroundColor: withAlpha(INSIGHTS_TONE, 0.14),
      borderWidth: 1,
      borderColor: withAlpha(INSIGHTS_TONE, 0.28),
    },
    modeButtonPressed: {
      opacity: 0.76,
    },
    modeButtonText: {
      color: withAlpha(colors.textSecondary, 0.82),
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    modeButtonTextSelected: {
      color: INSIGHTS_TONE,
    },
    dashboardPanel: {
      ...heroSurface,
      gap: ui.spacing.sm,
      borderColor: withAlpha(INSIGHTS_TONE, 0.24),
    },
    baselinePanel: {
      ...cardSurface,
      gap: ui.spacing.sm,
      borderColor: withAlpha(INSIGHTS_TONE, 0.24),
      backgroundColor: withAlpha(colors.surface2, 0.78),
    },
    baselineHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: ui.spacing.sm,
    },
    baselineDrPill: {
      minWidth: 68,
      minHeight: 48,
      borderRadius: ui.radius.md,
      borderWidth: 1,
      borderColor: withAlpha(INSIGHTS_TONE, 0.3),
      backgroundColor: withAlpha(INSIGHTS_TONE, 0.09),
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
    },
    baselineDrValue: {
      color: INSIGHTS_TONE,
      fontSize: 20,
      lineHeight: 23,
      fontWeight: "900",
    },
    baselineDrLabel: {
      color: colors.textSecondary,
      fontSize: 9,
      lineHeight: 12,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    baselineGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: ui.spacing.xs,
    },
    baselineStat: {
      ...tileSurface,
      width: "48%",
      minHeight: 104,
      paddingHorizontal: ui.spacing.sm,
      paddingVertical: ui.spacing.xs,
      gap: 3,
    },
    baselineStatValue: {
      fontSize: 20,
      lineHeight: 24,
      fontWeight: "900",
    },
    baselineStatLabel: {
      color: colors.textPrimary,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    baselineStatBody: {
      color: colors.textSecondary,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "700",
      marginTop: "auto",
    },
    dashboardHeader: {
      flexDirection: "column",
      gap: ui.spacing.xs,
    },
    dashboardTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: ui.spacing.sm,
    },
    dashboardTitleCopy: {
      flex: 1,
      minWidth: 0,
    },
    eyebrow: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    dashboardTitle: {
      color: colors.textPrimary,
      fontSize: 22,
      lineHeight: 27,
      fontWeight: "900",
      marginTop: 4,
    },
    dashboardBody: {
      color: withAlpha(colors.textSecondary, 0.9),
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "700",
    },
    dashboardScore: {
      minWidth: 104,
      minHeight: 42,
      borderRadius: ui.radius.md,
      borderWidth: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      paddingHorizontal: ui.spacing.sm,
      paddingVertical: 7,
      flexShrink: 0,
    },
    dashboardScoreValue: {
      fontSize: 22,
      lineHeight: 25,
      fontWeight: "900",
      letterSpacing: 0,
    },
    dashboardScoreLabel: {
      color: withAlpha(colors.textSecondary, 0.74),
      fontSize: 9,
      lineHeight: 12,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    dashboardGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: ui.spacing.xs,
    },
    dashboardCard: {
      ...tileSurface,
      width: "48%",
      paddingHorizontal: ui.spacing.sm,
      paddingVertical: ui.spacing.sm,
      minHeight: 132,
      gap: 7,
      justifyContent: "space-between",
    },
    dashboardCardFeatured: {
      minHeight: 146,
    },
    dashboardCardTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: ui.spacing.xs,
    },
    dashboardCardLabel: {
      fontSize: 9,
      lineHeight: 13,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    dashboardCardValue: {
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "900",
      textAlign: "right",
      flexShrink: 0,
    },
    dashboardCardTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      lineHeight: 20,
      fontWeight: "900",
    },
    dashboardCardBody: {
      color: withAlpha(colors.textSecondary, 0.82),
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "700",
    },
    dashboardTrack: {
      height: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.16),
      backgroundColor: withAlpha(colors.bg, 0.7),
      overflow: "hidden",
    },
    dashboardFill: {
      height: "100%",
      borderRadius: 999,
    },
    actionPanel: {
      ...cardSurface,
      gap: ui.spacing.sm,
      borderColor: withAlpha(INSIGHTS_TONE, 0.2),
    },
    actionList: {
      gap: ui.spacing.xs,
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: ui.spacing.sm,
      borderWidth: 1,
      borderRadius: ui.radius.md,
      paddingHorizontal: ui.spacing.sm,
      paddingVertical: ui.spacing.sm,
    },
    actionIndex: {
      width: 34,
      height: 34,
      borderRadius: ui.radius.md,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    actionIndexText: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "900",
      letterSpacing: 0,
    },
    actionCopy: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    actionTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      lineHeight: 19,
      fontWeight: "900",
    },
    actionBody: {
      color: withAlpha(colors.textSecondary, 0.9),
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "700",
    },
    historySummaryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: ui.spacing.xs,
    },
    historySummaryCard: {
      ...tileSurface,
      width: "48%",
      minHeight: 88,
      gap: 5,
      paddingHorizontal: ui.spacing.sm,
      paddingVertical: ui.spacing.xs,
    },
    historySummaryValue: {
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "900",
    },
    historySummaryLabel: {
      color: colors.textPrimary,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: 0,
    },
    historySummaryTrack: {
      height: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.16),
      backgroundColor: withAlpha(colors.bg, 0.7),
      overflow: "hidden",
      marginTop: "auto",
    },
    historySummaryFill: {
      height: "100%",
      borderRadius: 999,
    },
    lockedPanel: {
      ...heroSurface,
      gap: ui.spacing.md,
      borderColor: withAlpha(INSIGHTS_UNLOCK_TONE, 0.3),
      backgroundColor: withAlpha(colors.surface2, 0.88),
    },
    lockedTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: ui.spacing.sm,
    },
    lockedRankPlate: {
      width: 72,
      height: 72,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: withAlpha(INSIGHTS_UNLOCK_TONE, 0.5),
      backgroundColor: withAlpha(INSIGHTS_UNLOCK_TONE, 0.1),
      alignItems: "center",
      justifyContent: "center",
    },
    lockedCopy: {
      flex: 1,
      minWidth: 0,
    },
    lockedTitle: {
      color: colors.textPrimary,
      fontSize: 22,
      lineHeight: 27,
      fontWeight: "900",
      marginTop: 2,
    },
    lockedBody: {
      color: withAlpha(colors.textSecondary, 0.86),
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
      marginTop: 5,
    },
    unlockProgressBlock: {
      gap: ui.spacing.xs,
      borderTopWidth: 1,
      borderTopColor: withAlpha(colors.border, 0.2),
      paddingTop: ui.spacing.sm,
    },
    unlockProgressHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: ui.spacing.sm,
    },
    unlockProgressLabel: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    unlockProgressValue: {
      color: INSIGHTS_UNLOCK_TONE,
      fontSize: 12,
      lineHeight: 15,
      fontWeight: "900",
    },
    unlockTrack: {
      height: 11,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.2),
      backgroundColor: withAlpha(colors.bg, 0.76),
      overflow: "hidden",
    },
    unlockFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: INSIGHTS_UNLOCK_TONE,
    },
    unlockMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: ui.spacing.sm,
    },
    unlockMeta: {
      color: withAlpha(colors.textSecondary, 0.82),
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    lockedAction: {
      minHeight: 46,
      borderRadius: ui.radius.button,
      backgroundColor: INSIGHTS_UNLOCK_TONE,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: ui.spacing.md,
    },
    lockedActionText: {
      color: colors.bg,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "900",
    },
    lockedPreviewGrid: {
      gap: ui.spacing.xs,
    },
    lockedPreviewCard: {
      ...tileSurface,
      minHeight: 96,
      gap: 6,
      borderColor: withAlpha(INSIGHTS_UNLOCK_TONE, 0.18),
      backgroundColor: withAlpha(colors.surface2, 0.58),
    },
    lockedPreviewDot: {
      width: 22,
      height: 4,
      borderRadius: 999,
      backgroundColor: withAlpha(INSIGHTS_UNLOCK_TONE, 0.8),
    },
    lockedPreviewTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      lineHeight: 19,
      fontWeight: "900",
    },
    lockedPreviewBody: {
      color: withAlpha(colors.textSecondary, 0.82),
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
    },
    card: {
      ...cardSurface,
      gap: ui.spacing.sm,
    },
    trendPanel: {
      ...cardSurface,
      gap: ui.spacing.sm,
    },
    coachPanel: {
      ...cardSurface,
      gap: ui.spacing.sm,
      borderColor: withAlpha(INSIGHTS_TONE, 0.24),
      backgroundColor: withAlpha(colors.surface2, 0.84),
    },
    coachMetric: {
      minWidth: 76,
      minHeight: 52,
      borderRadius: ui.radius.md,
      borderWidth: 1,
      backgroundColor: withAlpha(colors.bg, 0.28),
      alignItems: "flex-end",
      justifyContent: "center",
      paddingHorizontal: ui.spacing.xs,
      paddingVertical: 6,
    },
    coachMetricValue: {
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "900",
    },
    coachMetricLabel: {
      color: withAlpha(colors.textSecondary, 0.76),
      fontSize: 8,
      lineHeight: 12,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
      marginTop: 1,
      textAlign: "right",
    },
    promptGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: ui.spacing.xs,
    },
    promptButton: {
      width: "48.7%",
      minHeight: 44,
      borderRadius: ui.radius.button,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.24),
      backgroundColor: withAlpha(colors.bg, 0.24),
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: ui.spacing.xs,
      paddingVertical: 7,
    },
    promptButtonSelected: {
      borderColor: withAlpha(INSIGHTS_TONE, 0.46),
      backgroundColor: withAlpha(INSIGHTS_TONE, 0.12),
    },
    promptButtonPressed: {
      opacity: 0.74,
    },
    promptButtonText: {
      color: withAlpha(colors.textSecondary, 0.84),
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "900",
      letterSpacing: 0,
      textAlign: "center",
    },
    promptButtonTextSelected: {
      color: colors.textPrimary,
    },
    coachBody: {
      color: withAlpha(colors.textSecondary, 0.92),
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "700",
    },
    coachBulletList: {
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: withAlpha(colors.border, 0.2),
      paddingTop: ui.spacing.xs,
    },
    coachBulletRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.16),
      borderRadius: ui.radius.md,
      backgroundColor: withAlpha(colors.bg, 0.2),
      paddingHorizontal: ui.spacing.sm,
      paddingVertical: ui.spacing.xs,
    },
    coachBulletDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      marginTop: 6,
    },
    coachBulletText: {
      flex: 1,
      minWidth: 0,
      color: colors.textPrimary,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "800",
    },
    cardHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: ui.spacing.sm,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: 19,
      lineHeight: 23,
      fontWeight: "900",
      marginTop: 1,
    },
    trendLabel: {
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
      textAlign: "right",
      maxWidth: 130,
    },
    panelDivider: {
      height: 1,
      backgroundColor: withAlpha(colors.border, 0.2),
    },
    pulseReadout: {
      gap: ui.spacing.sm,
    },
    drValueRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: ui.spacing.xs,
    },
    drValue: {
      ...ui.typography.drHero,
      color: colors.textPrimary,
      fontSize: 56,
      lineHeight: 58,
      fontWeight: "900",
      letterSpacing: 0,
    },
    drValueCopy: {
      flex: 1,
      minWidth: 0,
      paddingBottom: 8,
    },
    drLabel: {
      color: colors.textPrimary,
      fontSize: 12,
      lineHeight: 15,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    pulseMetaGrid: {
      flexDirection: "row",
      gap: ui.spacing.xs,
    },
    pulseMetaTile: {
      ...tileSurface,
      flex: 1,
      minWidth: 0,
      paddingHorizontal: ui.spacing.sm,
      paddingVertical: ui.spacing.xs,
      gap: 3,
    },
    pulseMetaLabel: {
      color: withAlpha(colors.textSecondary, 0.76),
      fontSize: 9,
      lineHeight: 13,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    pulseMetaValue: {
      color: colors.textPrimary,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "900",
    },
    trendFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: withAlpha(colors.border, 0.18),
      paddingTop: ui.spacing.xs,
      marginTop: 2,
    },
    mutedMeta: {
      color: withAlpha(colors.textSecondary, 0.86),
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "800",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    judgmentRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: ui.spacing.xs,
      minHeight: 58,
      borderTopWidth: 1,
      borderTopColor: withAlpha(colors.border, 0.2),
      paddingTop: ui.spacing.xs,
      marginTop: ui.spacing.xs,
    },
    judgmentRail: {
      width: 4,
      alignSelf: "stretch",
      borderRadius: 999,
    },
    judgmentCopy: {
      flex: 1,
      minWidth: 0,
    },
    judgmentDate: {
      color: withAlpha(colors.textSecondary, 0.74),
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    judgmentTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "900",
      marginTop: 1,
    },
    judgmentMeta: {
      color: withAlpha(INSIGHTS_TONE, 0.86),
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "700",
      marginTop: 1,
    },
    judgmentStats: {
      alignItems: "flex-end",
      minWidth: 72,
    },
    judgmentPct: {
      color: colors.textPrimary,
      fontSize: 15,
      lineHeight: 18,
      fontWeight: "900",
    },
    judgmentDelta: {
      fontSize: 12,
      lineHeight: 15,
      fontWeight: "900",
      marginTop: 1,
    },
    judgmentDr: {
      color: withAlpha(colors.textSecondary, 0.74),
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "800",
      marginTop: 1,
    },
    chartBlock: {
      paddingTop: ui.spacing.xs,
    },
    chartWrap: {
      height: 70,
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 6,
    },
    chartBar: {
      flex: 1,
      minHeight: 8,
      borderRadius: 999,
      backgroundColor: INSIGHTS_TONE,
      opacity: 0.86,
    },
    categoryPanel: {
      ...cardSurface,
      gap: ui.spacing.sm,
    },
    categoryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: ui.spacing.xs,
    },
    categoryCard: {
      ...tileSurface,
      width: "48%",
      paddingHorizontal: ui.spacing.sm,
      paddingVertical: ui.spacing.xs,
      gap: 7,
      minHeight: 72,
      justifyContent: "center",
    },
    categoryTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: ui.spacing.xs,
    },
    categoryDot: {
      width: 7,
      height: 7,
      borderRadius: 999,
    },
    categoryLabel: {
      color: colors.textPrimary,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: "900",
      flex: 1,
      minWidth: 0,
    },
    categoryPct: {
      color: INSIGHTS_TONE,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "900",
    },
    progressTrack: {
      width: "100%",
      height: 7,
      borderRadius: 999,
      backgroundColor: withAlpha(colors.bg, 0.92),
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.2),
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: INSIGHTS_TONE,
    },
    categoryMeta: {
      color: withAlpha(colors.textSecondary, 0.72),
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "800",
      letterSpacing: 0,
    },
  });
}
