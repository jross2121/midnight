import { IconSymbol } from "@/components/ui/icon-symbol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DisciplineCalendar, type DisciplineCalendarDay } from "./_components/DisciplineCalendar";
import { DisciplinePatterns } from "./_components/DisciplinePatterns";
import { DisciplineScorecard } from "./_components/DisciplineScorecard";
import { getMainCategoryDisplayEntries } from "./_utils/categoryLabels";
import {
    defaultCategories,
    defaultDisciplineRating,
    defaultQuests,
} from "./_utils/defaultData";
import { createCardSurface, ui, withAlpha } from "./_utils/designSystem";
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
  const categoryFromHistory = getLatestCategoriesFromHistory(evaluationHistory);
  const strongestCategory = categoryFromHistory.strongestCategory ?? categoryBreakdown[0]?.label ?? "N/A";
  const weakestCategory =
    categoryFromHistory.weakestCategory ??
    categoryBreakdown[categoryBreakdown.length - 1]?.label ??
    "N/A";
  const currentRank = getCurrentRankFromHistory(evaluationHistory) ?? getRankFromDR(disciplineRating);
  const currentDrValue = latest7History[latest7History.length - 1]?.drAfter ?? disciplineRating;

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <IconSymbol name="chart.bar.fill" size={22} color={colors.accentPrimary} />
          <Text style={styles.title}>Insights</Text>
        </View>
        <Text style={styles.subtitle}>Your discipline patterns over time</Text>

        <DisciplineScorecard
          averageCompletionRate={averageCompletionRate}
          strongestCategory={strongestCategory}
          weakestCategory={weakestCategory}
          currentRank={currentRank}
          sevenDayDrChange={weekDelta}
        />

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>DR Trend</Text>
            <Text style={[styles.trendLabel, { color: trendLabelTone }]}>
              {formatWeekChange(weekDelta, hasSufficientTrend)}
            </Text>
          </View>
          <View style={styles.drValueRow}>
            <Text style={styles.drValue}>{currentDrValue}</Text>
            <Text style={styles.drLabel}>Current DR</Text>
          </View>
          {hasHistory ? (
            <MiniTrendChart
              points={trendPoints}
              chartWrapStyle={styles.chartWrap}
              chartBarStyle={styles.chartBar}
            />
          ) : (
            <Text style={styles.mutedMeta}>No evaluation history yet.</Text>
          )}
          <Text style={styles.mutedMeta}>Last {Math.min(7, latest7History.length)} evaluations</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Discipline Calendar</Text>
          <DisciplineCalendar days={disciplineCalendarDays} colors={colors} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Discipline Patterns</Text>
          <DisciplinePatterns days={disciplineCalendarDays} colors={colors} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Category Breakdown</Text>
          <View style={styles.categoryList}>
            {categoryBreakdown.map((item) => (
              <View key={item.id} style={styles.categoryRow}>
                <View style={styles.categoryTopRow}>
                  <Text style={styles.categoryLabel}>{item.label}</Text>
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
                <Text style={styles.categoryMeta}>{item.completed}/{item.total} completed</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.card, styles.insightCard]}>
          <Text style={styles.cardTitle}>Insight of the Day</Text>
          <Text style={styles.insightText}>{insightMessage}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createInsightsStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    container: {
      paddingHorizontal: ui.spacing.screen,
      paddingTop: ui.spacing.screen,
      paddingBottom: ui.spacing.xl + ui.spacing.md,
      gap: ui.spacing.md,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: ui.spacing.xs,
    },
    title: {
      ...ui.typography.title,
      color: colors.textPrimary,
      fontSize: 26,
      fontWeight: "900",
      letterSpacing: 0.4,
    },
    subtitle: {
      marginTop: -4,
      color: withAlpha(colors.textSecondary, 0.85),
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.2,
    },
    card: {
      ...createCardSurface(colors, {
        padding: ui.spacing.md,
        radius: ui.radius.lg,
        borderOpacity: 0.6,
        glowOpacity: 0.06,
        backgroundColor: withAlpha(colors.surface2, 0.86),
      }),
      gap: ui.spacing.xs,
    },
    cardHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 2,
    },
    cardTitle: {
      ...ui.typography.heading,
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: "800",
      letterSpacing: 0.2,
    },
    trendLabel: {
      ...ui.typography.caption,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    drValueRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: ui.spacing.xs,
      marginTop: 2,
    },
    drValue: {
      ...ui.typography.drHero,
      color: colors.textPrimary,
      fontSize: 44,
      lineHeight: 46,
      fontWeight: "900",
      letterSpacing: -0.8,
    },
    drLabel: {
      ...ui.typography.caption,
      color: withAlpha(colors.textSecondary, 0.86),
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.45,
      textTransform: "uppercase",
    },
    mutedMeta: {
      ...ui.typography.caption,
      color: withAlpha(colors.textSecondary, 0.8),
      fontSize: 10,
      letterSpacing: 0.4,
      marginTop: 2,
    },
    chartWrap: {
      height: 46,
      marginTop: ui.spacing.xs,
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 6,
    },
    chartBar: {
      flex: 1,
      borderRadius: 999,
      backgroundColor: colors.accentPrimary,
    },
    categoryList: {
      marginTop: ui.spacing.xs,
      gap: ui.spacing.sm,
    },
    categoryRow: {
      gap: 6,
    },
    categoryTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    categoryLabel: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "700",
    },
    categoryPct: {
      color: colors.accentPrimary,
      fontSize: 13,
      fontWeight: "900",
    },
    progressTrack: {
      width: "100%",
      height: 8,
      borderRadius: 999,
      backgroundColor: withAlpha(colors.bg, 0.92),
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.5),
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
      fontWeight: "600",
      letterSpacing: 0.2,
    },
    insightCard: {
      borderColor: withAlpha(colors.accentPrimary, 0.38),
      backgroundColor: withAlpha(colors.surface, 0.94),
    },
    insightText: {
      color: colors.textPrimary,
      fontSize: 14,
      lineHeight: 22,
      fontWeight: "600",
      marginTop: 4,
    },
  });
}
