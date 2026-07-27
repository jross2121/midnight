import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CONTRACT_GOLD, HOME_GOLD } from "@/src/styles";
import { DisciplineCalendar, type DisciplineCalendarDay } from "@/src/components/DisciplineCalendar";
import { DisciplinePatterns } from "@/src/components/DisciplinePatterns";
import { RankBadge } from "@/src/components/RankBadge";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { ScreenLoading } from "@/src/components/ScreenLoading";
import { IconSymbol } from "@/components/ui/icon-symbol";
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
import { getNextRank, getRankFromDR, getRankMeta } from "@/src/utils/rank";
import { buildStreakSummary } from "@/src/utils/planning";
import { useTheme } from "@/src/utils/themeContext";
import type { Category, DrHistoryEntry, Quest, StoredState } from "@/src/utils/types";
import { STORAGE_KEY } from "@/src/utils/types";

const MAIN_CATEGORIES = getMainCategoryDisplayEntries();
const INSIGHTS_TONE = HOME_GOLD;
const INSIGHT_MINT = "#34D399";
const INSIGHT_CONTRACT = CONTRACT_GOLD;
const INSIGHT_VIOLET = "#A78BFA";

type CategoryInsight = {
  id: string;
  label: string;
  completionPct: number;
  completed: number;
  total: number;
};

type InsightMode = "today" | "history";

const INSIGHT_MODES: { id: InsightMode; label: string }[] = [
  { id: "today", label: "Overview" },
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
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const usesLargeText = fontScale > 1.15;
  const styles = useMemo(() => createInsightsStyles(colors, usesLargeText), [colors, usesLargeText]);
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
    return <ScreenLoading label="Loading progress" />;
  }

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
  const activeCategoryBreakdown = categoryBreakdown.filter((item) => item.total > 0);
  const openCategoryBreakdown = activeCategoryBreakdown.filter((item) => item.completed < item.total);
  const bestCategory = activeCategoryBreakdown[0] ?? null;
  const riskCategory =
    activeCategoryBreakdown.length > 1
      ? activeCategoryBreakdown[activeCategoryBreakdown.length - 1]
      : null;
  const strongestCategory = categoryFromHistory.strongestCategory ?? bestCategory?.label ?? "No signal yet";
  const weakestCategory =
    categoryFromHistory.weakestCategory ??
    riskCategory?.label ??
    "No signal yet";
  const currentRank = getRankFromDR(disciplineRating);
  const currentDrValue = disciplineRating;
  const currentRankMeta = getRankMeta(currentRank);
  const nextRank = getNextRank(currentDrValue);
  const nextRankMeta = nextRank ? getRankMeta(nextRank.name) : null;
  const rankTierSpan = nextRankMeta
    ? Math.max(1, nextRankMeta.minDr - currentRankMeta.minDr)
    : 1;
  const rankProgressPercent = nextRankMeta
    ? clampPercent(((currentDrValue - currentRankMeta.minDr) / rankTierSpan) * 100)
    : 100;
  const completedToday = todaysQuests.filter((quest) => quest.done).length;
  const totalToday = todaysQuests.length;
  const todayRate = getCompletionPercent(
    completedToday,
    getDailyScoringTarget(totalToday, DAILY_STANDARD)
  );
  const latestEvaluation = latest7History[latest7History.length - 1] ?? null;
  const latestCompletion = latestEvaluation?.completionRate ?? todayRate;
  const recentJudgments = drHistory.slice(-8).reverse();
  const streakSummary = buildStreakSummary(drHistory);
  const bestRecordedDr = Math.max(
    disciplineRating,
    ...drHistory.map((entry) => entry.dr),
    ...evaluationHistory.map((entry) => entry.drAfter)
  );
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
    !hasHistory && totalToday === 0
      ? colors.textSecondary
      : latestCompletion >= 80
        ? colors.positive
        : latestCompletion >= 50
          ? INSIGHTS_TONE
          : colors.negative;
  const categoryToneForPercent = (percent: number) =>
    percent >= 80 ? colors.positive : percent >= 50 ? INSIGHTS_TONE : INSIGHT_CONTRACT;
  const contractPercent = latest7History.length
    ? clampPercent((weeklyContractDays / latest7History.length) * 100)
    : 0;
  const trendPercent = hasSufficientTrend ? clampPercent(50 + weekDelta * 4) : 0;
  const completionTone =
    weeklyAvgCompletion >= 80
      ? colors.positive
      : weeklyAvgCompletion >= 50
        ? INSIGHTS_TONE
        : latest7History.length
          ? colors.negative
          : colors.textSecondary;
  const weeklySnapshotStats = [
    {
      label: "Finish rate",
      value: latest7History.length ? `${weeklyAvgCompletion}%` : "—",
      detail: latest7History.length ? `${latest7History.length} judged days` : "No judgments yet",
      tone: completionTone,
      percent: latest7History.length ? weeklyAvgCompletion : 0,
    },
    {
      label: "DR movement",
      value: hasSufficientTrend ? formatDelta(weeklyDrDelta) : "—",
      detail: hasSufficientTrend ? "Across recent judgments" : "Needs 2 judgments",
      tone: trendLabelTone,
      percent: trendPercent,
    },
    {
      label: "Contracts",
      value: latest7History.length ? `${weeklyContractDays}/${latest7History.length}` : "—",
      detail: latest7History.length ? "Protected days" : "No judgments yet",
      tone: INSIGHT_CONTRACT,
      percent: contractPercent,
    },
  ];
  const historyStats = [
    {
      label: "7-day average",
      value: latest7History.length ? `${weeklyAvgCompletion}%` : "—",
      tone: completionTone,
      percent: latest7History.length ? weeklyAvgCompletion : 0,
    },
    {
      label: "DR change",
      value: hasSufficientTrend ? formatDelta(weeklyDrDelta) : "—",
      tone: trendLabelTone,
      percent: trendPercent,
    },
    {
      label: "Solid streak",
      value: `${streakSummary.solidDayStreak}d`,
      tone: INSIGHT_VIOLET,
      percent: clampPercent((streakSummary.solidDayStreak / 7) * 100),
    },
    {
      label: "Best DR",
      value: `${bestRecordedDr}`,
      percent: currentDrValue > 0 ? clampPercent((currentDrValue / Math.max(1, bestRecordedDr)) * 100) : 0,
      tone: INSIGHTS_TONE,
    },
  ];
  const progressHeroStats = [
    {
      label: "Today",
      value: totalToday > 0 ? `${todayRate}%` : "—",
      tone: totalToday > 0 ? latestCompletionTone : colors.textSecondary,
    },
    {
      label: "7-day avg",
      value: latest7History.length ? `${weeklyAvgCompletion}%` : "—",
      tone: latest7History.length ? INSIGHT_MINT : colors.textSecondary,
    },
    {
      label: "Solid streak",
      value: `${streakSummary.solidDayStreak}d`,
      tone: INSIGHT_VIOLET,
    },
  ];
  const progressHero = (
    <View style={styles.progressHero}>
      <View style={styles.progressHeroHeader}>
        <View style={styles.progressRankIdentity}>
          <View style={styles.progressRankPlate}>
            <RankBadge rank={currentRank} size={36} color={INSIGHTS_TONE} active />
          </View>
          <View style={styles.dashboardTitleCopy}>
            <Text style={styles.eyebrow}>Current rank</Text>
            <Text style={styles.progressRankName}>{currentRank}</Text>
          </View>
        </View>
        <View style={styles.progressDrBlock}>
          <Text style={styles.progressDrValue}>{currentDrValue}</Text>
          <Text style={styles.progressDrLabel}>Discipline Rating</Text>
        </View>
      </View>

      <View style={styles.rankPath}>
        <View style={styles.rankPathHeader}>
          <Text style={styles.rankPathLabel}>
            {nextRank ? `${nextRank.remainingDr} DR to ${nextRank.name}` : "Highest rank reached"}
          </Text>
          <Text style={styles.rankPathValue}>{rankProgressPercent}%</Text>
        </View>
        <View style={styles.rankPathTrack}>
          <View style={[styles.rankPathFill, { width: `${rankProgressPercent}%` }]} />
        </View>
      </View>

      <View style={styles.progressHeroGrid}>
        {progressHeroStats.map((item, index) => (
          <React.Fragment key={item.label}>
            {index > 0 ? <View style={styles.progressHeroDivider} /> : null}
            <View style={styles.progressHeroStat}>
              <Text style={[styles.progressHeroStatValue, { color: item.tone }]}>{item.value}</Text>
              <Text style={styles.progressHeroStatLabel}>{item.label}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader
          title="Progress"
          subtitle="Rank, recent execution, and history"
          icon="chart.bar.fill"
          accent={INSIGHTS_TONE}
        />

        {progressHero}

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
              <View style={styles.weeklyPeriodPill}>
                <Text style={styles.weeklyPeriodText}>
                  {latest7History.length}/7 days
                </Text>
              </View>
            </View>
            <Text style={styles.dashboardBody}>{compactInsightMessage}</Text>
          </View>

          <View style={styles.weeklySnapshotGrid}>
            {weeklySnapshotStats.map((stat) => (
              <View
                key={stat.label}
                style={[
                  styles.weeklySnapshotCard,
                  {
                    borderColor: withAlpha(stat.tone, 0.26),
                    backgroundColor: withAlpha(stat.tone, 0.06),
                  },
                ]}
              >
                <Text style={styles.weeklySnapshotLabel}>{stat.label}</Text>
                <Text style={[styles.weeklySnapshotValue, { color: stat.tone }]}>{stat.value}</Text>
                <Text style={styles.weeklySnapshotDetail}>{stat.detail}</Text>
                <View style={styles.weeklySnapshotTrack}>
                  <View
                    style={[
                      styles.weeklySnapshotFill,
                      {
                        width: stat.percent > 0 ? `${Math.max(4, stat.percent)}%` : "0%",
                        backgroundColor: stat.tone,
                      },
                    ]}
                  />
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
              <Text style={styles.cardTitle}>Today&apos;s category progress</Text>
            </View>
            <Text style={styles.mutedMeta}>{activeCategoryBreakdown.length} active</Text>
          </View>
          {openCategoryBreakdown.length > 0 ? (
            <View style={styles.categoryWarning}>
              <View style={styles.categoryWarningIcon}>
                <IconSymbol name="flag.fill" size={16} color={INSIGHT_CONTRACT} />
              </View>
              <View style={styles.categoryWarningCopy}>
                <Text style={styles.categoryWarningTitle}>
                  {openCategoryBreakdown.length === 1
                    ? `${openCategoryBreakdown[0].label} still has an open quest`
                    : `${openCategoryBreakdown.length} categories still have open quests`}
                </Text>
                <Text style={styles.categoryWarningBody}>
                  This is a progress signal, not a penalty. Finish what matters and let the rest wait.
                </Text>
              </View>
            </View>
          ) : null}
          {activeCategoryBreakdown.length ? (
            <View style={styles.categoryGrid}>
            {activeCategoryBreakdown.map((item) => {
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
                    <Text style={styles.categoryLabel}>{item.label}</Text>
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
                    {item.completed}/{item.total} complete
                  </Text>
                </View>
              );
            })}
            </View>
          ) : (
            <View style={styles.categoryEmptyState}>
              <View style={styles.categoryEmptyDot} />
              <View style={styles.categoryEmptyCopy}>
                <Text style={styles.categoryEmptyTitle}>No categories active today</Text>
                <Text style={styles.categoryEmptyBody}>
                  Add a quest on Today and its category progress will appear here.
                </Text>
              </View>
            </View>
          )}
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
                      width: item.percent > 0 ? `${Math.max(4, item.percent)}%` : "0%",
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
                <Text style={styles.pulseMetaValue}>
                  {hasHistory ? `${Math.round(latestCompletion)}% completion` : "No data yet"}
                </Text>
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
            <Text style={styles.mutedMeta}>
              {hasHistory
                ? `Last ${Math.min(7, latest7History.length)} evaluations`
                : "Waiting for first evaluation"}
            </Text>
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

function createInsightsStyles(colors: ReturnType<typeof useTheme>["colors"], usesLargeText: boolean) {
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
    progressHero: {
      ...heroSurface,
      gap: 13,
      borderColor: withAlpha(INSIGHTS_TONE, 0.32),
      backgroundColor: withAlpha(colors.surface2, 0.92),
    },
    progressHeroHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: ui.spacing.sm,
    },
    progressRankIdentity: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: ui.spacing.sm,
    },
    progressRankPlate: {
      width: 56,
      height: 56,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: withAlpha(INSIGHTS_TONE, 0.38),
      backgroundColor: withAlpha(INSIGHTS_TONE, 0.1),
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    progressRankName: {
      color: colors.textPrimary,
      fontSize: 22,
      lineHeight: 26,
      fontWeight: "900",
      marginTop: 2,
    },
    progressDrBlock: {
      minWidth: 78,
      alignItems: "flex-end",
      justifyContent: "center",
      flexShrink: 0,
    },
    progressDrValue: {
      color: INSIGHTS_TONE,
      fontSize: 34,
      lineHeight: 37,
      fontWeight: "900",
    },
    progressDrLabel: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 8,
      lineHeight: 12,
      fontWeight: "900",
      textTransform: "uppercase",
      textAlign: "right",
    },
    rankPath: {
      gap: 6,
      borderTopWidth: 1,
      borderTopColor: withAlpha(colors.border, 0.2),
      paddingTop: 11,
    },
    rankPathHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: ui.spacing.sm,
    },
    rankPathLabel: {
      flex: 1,
      minWidth: 0,
      color: withAlpha(colors.textSecondary, 0.88),
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "800",
    },
    rankPathValue: {
      color: INSIGHTS_TONE,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "900",
    },
    rankPathTrack: {
      height: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: withAlpha(INSIGHTS_TONE, 0.2),
      backgroundColor: withAlpha(colors.bg, 0.76),
      overflow: "hidden",
    },
    rankPathFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: INSIGHTS_TONE,
    },
    progressHeroGrid: {
      flexDirection: "row",
      alignItems: "stretch",
      borderTopWidth: 1,
      borderTopColor: withAlpha(colors.border, 0.2),
      paddingTop: ui.spacing.sm,
    },
    progressHeroStat: {
      flex: 1,
      minWidth: 0,
      minHeight: 50,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
      gap: 2,
    },
    progressHeroDivider: {
      width: 1,
      backgroundColor: withAlpha(colors.border, 0.22),
      marginVertical: 5,
    },
    progressHeroStatValue: {
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "900",
      textAlign: "center",
    },
    progressHeroStatLabel: {
      color: withAlpha(colors.textSecondary, 0.82),
      fontSize: 9,
      lineHeight: 13,
      fontWeight: "900",
      textTransform: "uppercase",
      textAlign: "center",
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
    weeklyPeriodPill: {
      minHeight: 32,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: withAlpha(INSIGHTS_TONE, 0.28),
      backgroundColor: withAlpha(INSIGHTS_TONE, 0.09),
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: ui.spacing.sm,
      flexShrink: 0,
    },
    weeklyPeriodText: {
      color: INSIGHTS_TONE,
      fontSize: 10,
      lineHeight: 14,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    weeklySnapshotGrid: {
      flexDirection: usesLargeText ? "column" : "row",
      alignItems: "stretch",
      gap: 7,
    },
    weeklySnapshotCard: {
      ...tileSurface,
      flex: 1,
      minWidth: 0,
      minHeight: 116,
      paddingHorizontal: 9,
      paddingVertical: 9,
      gap: 4,
      justifyContent: "space-between",
    },
    weeklySnapshotLabel: {
      color: withAlpha(colors.textSecondary, 0.8),
      fontSize: 9,
      lineHeight: 13,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    weeklySnapshotValue: {
      fontSize: 21,
      lineHeight: 24,
      fontWeight: "900",
    },
    weeklySnapshotDetail: {
      color: withAlpha(colors.textSecondary, 0.82),
      fontSize: 9,
      lineHeight: 13,
      fontWeight: "700",
    },
    weeklySnapshotTrack: {
      height: 5,
      borderRadius: 999,
      backgroundColor: withAlpha(colors.bg, 0.7),
      overflow: "hidden",
    },
    weeklySnapshotFill: {
      height: "100%",
      borderRadius: 999,
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
    categoryWarning: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: ui.spacing.sm,
      borderWidth: 1,
      borderColor: withAlpha(INSIGHT_CONTRACT, 0.3),
      borderRadius: ui.radius.md,
      backgroundColor: withAlpha(INSIGHT_CONTRACT, 0.07),
      paddingHorizontal: ui.spacing.sm,
      paddingVertical: ui.spacing.sm,
    },
    categoryWarningIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(INSIGHT_CONTRACT, 0.11),
      flexShrink: 0,
    },
    categoryWarningCopy: {
      flex: 1,
      minWidth: 0,
    },
    categoryWarningTitle: {
      color: colors.textPrimary,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "900",
    },
    categoryWarningBody: {
      color: withAlpha(colors.textSecondary, 0.82),
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "700",
      marginTop: 2,
    },
    categoryCard: {
      ...tileSurface,
      width: usesLargeText ? "100%" : "48%",
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
    categoryEmptyState: {
      flexDirection: "row",
      alignItems: "center",
      gap: ui.spacing.sm,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.18),
      borderRadius: ui.radius.md,
      backgroundColor: withAlpha(colors.bg, 0.22),
      paddingHorizontal: ui.spacing.sm,
      paddingVertical: ui.spacing.sm,
    },
    categoryEmptyDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      backgroundColor: withAlpha(INSIGHTS_TONE, 0.7),
      flexShrink: 0,
    },
    categoryEmptyCopy: {
      flex: 1,
      minWidth: 0,
    },
    categoryEmptyTitle: {
      color: colors.textPrimary,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: "900",
    },
    categoryEmptyBody: {
      color: withAlpha(colors.textSecondary, 0.8),
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "700",
      marginTop: 2,
    },
  });
}
