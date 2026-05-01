import { IconSymbol } from "@/components/ui/icon-symbol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DisciplineCalendar, type DisciplineCalendarDay } from "./_components/DisciplineCalendar";
import { DisciplinePatterns } from "./_components/DisciplinePatterns";
import { RankBadge } from "./_components/RankBadge";
import { getMainCategoryDisplayEntries } from "./_utils/categoryLabels";
import {
    defaultCategories,
    defaultDisciplineRating,
    defaultQuests,
} from "./_utils/defaultData";
import { createCardSurface, createTileSurface, ui, withAlpha } from "./_utils/designSystem";
import {
    buildCalendarFromHistory,
    buildInsightOfTheDay,
    getAverageCompletionRate,
    getCurrentRankFromHistory,
    getLatestCategoriesFromHistory,
    getLatestHistoryEntries,
    getSevenDayDrChange,
    getTrendPointsFromHistory,
    sortEvaluationHistory,
} from "./_utils/evaluationAnalytics";
import { readEvaluationHistory, type DailyEvaluationHistoryItem } from "./_utils/evaluationHistory";
import { getRankFromDR } from "./_utils/rank";
import { useTheme } from "./_utils/themeContext";
import type { Category, Quest, StoredState } from "./_utils/types";
import { STORAGE_KEY } from "./_utils/types";

const MAIN_CATEGORIES = getMainCategoryDisplayEntries();

type CategoryInsight = {
  id: string;
  label: string;
  completionPct: number;
  completed: number;
  total: number;
};
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
  if (!hasHistory) return "Signal is building. Win one priority quest to set the baseline.";
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
  const styles = useMemo(() => createInsightsStyles(colors), [colors]);
  const [disciplineRating, setDisciplineRating] = useState<number>(defaultDisciplineRating);
  const [evaluationHistory, setEvaluationHistory] = useState<DailyEvaluationHistoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [quests, setQuests] = useState<Quest[]>(defaultQuests);
  const [hydrated, setHydrated] = useState(false);
  const [readoutExpanded, setReadoutExpanded] = useState(false);

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
      setQuests(
        Array.isArray(parsed.quests) && parsed.quests.length ? parsed.quests : defaultQuests
      );
      const loadedHistory = await readEvaluationHistory();
      setEvaluationHistory(sortEvaluationHistory(loadedHistory));
    } catch (e) {
      console.log("Failed to load storage:", e);
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
    return null;
  }

  const categoryBreakdown = MAIN_CATEGORIES.map((entry) => {
    const relatedQuests = quests.filter((quest) => quest.categoryId === entry.id);
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
  const insightMessage = buildInsightOfTheDay(evaluationHistory);
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
  const currentRank = getCurrentRankFromHistory(evaluationHistory) ?? getRankFromDR(disciplineRating);
  const currentDrValue = latest7History[latest7History.length - 1]?.drAfter ?? disciplineRating;
  const rankForBadge = getRankFromDR(currentDrValue);
  const completedToday = quests.filter((quest) => quest.done).length;
  const totalToday = quests.length;
  const todayRate = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;
  const bestCategory = categoryBreakdown[0];
  const riskCategory = categoryBreakdown[categoryBreakdown.length - 1];
  const latestEvaluation = latest7History[latest7History.length - 1] ?? null;
  const latestCompletion = latestEvaluation?.completionRate ?? todayRate;
  const recoverySignal =
    latest7History.length >= 3
      ? latest7History
          .slice(-3)
          .filter((entry) => entry.completionRate >= averageCompletionRate).length
      : 0;

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <IconSymbol name="chart.bar.fill" size={18} color={colors.accentPrimary} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Insight Matrix</Text>
            <Text style={styles.subtitle}>Patterns, pressure points, and execution signals</Text>
          </View>
        </View>

        <View style={styles.commandPanel}>
          <View style={styles.commandTopRow}>
            <View style={styles.rankSlot}>
              <RankBadge rank={rankForBadge} size={42} active />
            </View>
            <View style={styles.commandCopy}>
              <View style={styles.commandEyebrowRow}>
                <Text style={styles.eyebrow}>Pattern Readout</Text>
                <Pressable
                  onPress={() => setReadoutExpanded((current) => !current)}
                  style={({ pressed }) => [styles.detailsButton, pressed && styles.detailsButtonPressed]}
                >
                  <Text style={styles.detailsButtonText}>{readoutExpanded ? "Hide" : "Details"}</Text>
                </Pressable>
              </View>
              <Text style={styles.commandTitle}>{compactInsightMessage}</Text>
            </View>
          </View>

          {readoutExpanded ? (
            <Text style={styles.commandDetails}>{insightMessage}</Text>
          ) : null}

          <View style={styles.commandDivider} />

          <View style={styles.commandMetrics}>
            <View style={styles.commandMetricPrimary}>
              <Text style={styles.commandMetricValue}>{currentDrValue}</Text>
              <Text style={styles.commandMetricLabel}>Current DR</Text>
            </View>
            <View style={styles.commandMetric}>
              <Text style={styles.commandMetricValue}>{averageCompletionRate}%</Text>
              <Text style={styles.commandMetricLabel}>30D Avg</Text>
            </View>
            <View style={styles.commandMetric}>
              <Text style={[styles.commandMetricValue, { color: trendLabelTone }]}>
                {weekDelta > 0 ? `+${weekDelta}` : weekDelta}
              </Text>
              <Text style={styles.commandMetricLabel}>7D DR</Text>
            </View>
          </View>
        </View>

        <View style={styles.signalMap}>
          <View style={styles.signalCard}>
            <Text style={styles.signalLabel}>Strong Zone</Text>
            <Text style={styles.signalValue} numberOfLines={1}>{strongestCategory}</Text>
            <Text style={styles.signalMeta}>
              {bestCategory ? `${bestCategory.completionPct}% current follow-through` : "Awaiting data"}
            </Text>
          </View>
          <View style={styles.signalCard}>
            <Text style={styles.signalLabel}>Pressure Zone</Text>
            <Text style={styles.signalValue} numberOfLines={1}>{weakestCategory}</Text>
            <Text style={styles.signalMeta}>
              {riskCategory ? `${riskCategory.completionPct}% current follow-through` : "Awaiting data"}
            </Text>
          </View>
          <View style={styles.signalCard}>
            <Text style={styles.signalLabel}>Today</Text>
            <Text style={styles.signalValue}>{todayRate}%</Text>
            <Text style={styles.signalMeta}>{completedToday}/{totalToday} quests complete</Text>
          </View>
          <View style={styles.signalCard}>
            <Text style={styles.signalLabel}>Recovery</Text>
            <Text style={styles.signalValue}>{recoverySignal}/3</Text>
            <Text style={styles.signalMeta}>recent days above baseline</Text>
          </View>
        </View>

        <View style={styles.trendPanel}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.eyebrow}>Trajectory</Text>
              <Text style={styles.cardTitle}>DR Pulse</Text>
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
                <Text style={styles.mutedMeta}>Live rank pressure</Text>
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
              <Text style={styles.eyebrow}>Consistency Heat</Text>
              <Text style={styles.cardTitle}>Discipline Calendar</Text>
            </View>
            <Text style={styles.mutedMeta}>30 days</Text>
          </View>
          <DisciplineCalendar days={disciplineCalendarDays} colors={colors} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.eyebrow}>Behavior Notes</Text>
              <Text style={styles.cardTitle}>Discipline Patterns</Text>
            </View>
          </View>
          <DisciplinePatterns days={disciplineCalendarDays} colors={colors} />
        </View>

        <View style={styles.categoryPanel}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.eyebrow}>Category Loadout</Text>
              <Text style={styles.cardTitle}>Execution Balance</Text>
            </View>
            <Text style={styles.mutedMeta}>{categoryBreakdown.length} domains</Text>
          </View>
          <View style={styles.categoryGrid}>
            {categoryBreakdown.map((item) => (
              <View key={item.id} style={styles.categoryCard}>
                <View style={styles.categoryTopRow}>
                  <Text style={styles.categoryLabel} numberOfLines={1}>{item.label}</Text>
                  <Text style={styles.categoryPct}>{item.completionPct}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: item.completionPct === 0 ? "0%" : `${Math.max(3, item.completionPct)}%`,
                        opacity: 0.6 + item.completionPct / 250,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.categoryMeta}>{item.completed}/{item.total} complete</Text>
              </View>
            ))}
          </View>
        </View>
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
      paddingBottom: ui.spacing.xl * 3 + ui.spacing.lg,
      gap: ui.spacing.sm,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: ui.spacing.sm,
      paddingTop: 2,
      paddingBottom: ui.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: withAlpha(colors.divider, 0.62),
    },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: ui.radius.button,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: withAlpha(colors.accentPrimary, 0.24),
      backgroundColor: withAlpha(colors.accentPrimary, 0.075),
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 24,
      lineHeight: 29,
      fontWeight: "900",
      letterSpacing: 0,
    },
    subtitle: {
      color: withAlpha(colors.textSecondary, 0.82),
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
      marginTop: 3,
    },
    commandPanel: {
      ...heroSurface,
      gap: ui.spacing.sm,
      borderColor: withAlpha(colors.accentPrimary, 0.18),
    },
    commandTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: ui.spacing.sm,
    },
    rankSlot: {
      width: 58,
      height: 58,
      borderRadius: ui.radius.md,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: withAlpha(colors.accentPrimary, 0.18),
      backgroundColor: withAlpha(colors.bg, 0.32),
    },
    commandCopy: {
      flex: 1,
      minWidth: 0,
    },
    commandEyebrowRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: ui.spacing.xs,
    },
    eyebrow: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "900",
      letterSpacing: 0.75,
      textTransform: "uppercase",
    },
    commandTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      lineHeight: 26,
      fontWeight: "800",
      marginTop: 4,
    },
    detailsButton: {
      borderWidth: 1,
      borderColor: withAlpha(colors.accentPrimary, 0.22),
      borderRadius: 999,
      backgroundColor: withAlpha(colors.accentPrimary, 0.065),
      paddingHorizontal: ui.spacing.xs,
      paddingVertical: 4,
    },
    detailsButtonPressed: {
      opacity: 0.72,
    },
    detailsButtonText: {
      color: withAlpha(colors.accentPrimary, 0.92),
      fontSize: 9,
      lineHeight: 11,
      fontWeight: "900",
      letterSpacing: 0.45,
      textTransform: "uppercase",
    },
    commandDetails: {
      color: withAlpha(colors.textSecondary, 0.82),
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "700",
      paddingTop: 2,
    },
    commandDivider: {
      height: 1,
      backgroundColor: withAlpha(colors.border, 0.22),
    },
    commandMetrics: {
      flexDirection: "row",
      gap: ui.spacing.xs,
    },
    commandMetricPrimary: {
      ...tileSurface,
      flex: 1.2,
      borderColor: withAlpha(colors.accentPrimary, 0.28),
      backgroundColor: withAlpha(colors.accentPrimary, 0.075),
      paddingHorizontal: ui.spacing.sm,
      paddingVertical: ui.spacing.sm,
      minWidth: 0,
      minHeight: 76,
      justifyContent: "center",
    },
    commandMetric: {
      ...tileSurface,
      flex: 1,
      paddingHorizontal: ui.spacing.sm,
      paddingVertical: ui.spacing.sm,
      minWidth: 0,
      minHeight: 76,
      justifyContent: "center",
    },
    commandMetricValue: {
      color: colors.textPrimary,
      fontSize: 26,
      lineHeight: 30,
      fontWeight: "900",
    },
    commandMetricLabel: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 9,
      lineHeight: 12,
      fontWeight: "900",
      letterSpacing: 0.45,
      textTransform: "uppercase",
      marginTop: 2,
    },
    signalMap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: ui.spacing.xs,
    },
    signalCard: {
      ...tileSurface,
      width: "48.8%",
      minHeight: 102,
      paddingHorizontal: ui.spacing.sm,
      paddingVertical: ui.spacing.sm,
      justifyContent: "flex-start",
      gap: 7,
    },
    signalLabel: {
      color: withAlpha(colors.textSecondary, 0.76),
      fontSize: 9,
      lineHeight: 12,
      fontWeight: "900",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    signalValue: {
      color: colors.textPrimary,
      fontSize: 20,
      lineHeight: 24,
      fontWeight: "900",
    },
    signalMeta: {
      color: withAlpha(colors.textSecondary, 0.74),
      fontSize: 11,
      lineHeight: 15,
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
      lineHeight: 13,
      fontWeight: "900",
      letterSpacing: 0.45,
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
      letterSpacing: -0.5,
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
      letterSpacing: 0.45,
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
      lineHeight: 12,
      fontWeight: "900",
      letterSpacing: 0.5,
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
      lineHeight: 13,
      fontWeight: "800",
      letterSpacing: 0.25,
      textTransform: "uppercase",
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
      backgroundColor: colors.accentPrimary,
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
    categoryLabel: {
      color: colors.textPrimary,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: "900",
      flex: 1,
      minWidth: 0,
    },
    categoryPct: {
      color: colors.accentPrimary,
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
      backgroundColor: colors.accentPrimary,
    },
    categoryMeta: {
      color: withAlpha(colors.textSecondary, 0.72),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "800",
      letterSpacing: 0.2,
    },
  });
}
