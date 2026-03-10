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
    defaultDrHistory,
    defaultQuests,
} from "./_utils/defaultData";
import { createCardSurface, ui, withAlpha } from "./_utils/designSystem";
import { getRankFromDR } from "./_utils/rank";
import { useTheme } from "./_utils/themeContext";
import type { Category, DrHistoryEntry, Quest, StoredState } from "./_utils/types";
import { STORAGE_KEY } from "./_utils/types";

const MAIN_CATEGORIES = getMainCategoryDisplayEntries();

type CategoryInsight = {
  id: string;
  label: string;
  completionPct: number;
  completed: number;
  total: number;
};

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

function buildFallbackTrend(currentDr: number): number[] {
  const start = Math.max(0, currentDr - 6);
  return [
    start,
    Math.max(0, start + 1),
    Math.max(0, start + 2),
    Math.max(0, start + 2),
    Math.max(0, start + 3),
    Math.max(0, start + 4),
    Math.max(0, currentDr),
  ];
}

function getInsightMessage(rows: CategoryInsight[], weekDelta: number): string {
  if (!rows.length) {
    return "Keep logging quests daily to unlock your first trend insight.";
  }

  const strongest = rows[0];
  const weakest = rows[rows.length - 1];

  if (weakest.completionPct < 40) {
    return `${weakest.label} is your weakest lane at ${weakest.completionPct}%. Add one easy ${weakest.label.toLowerCase()} quest tomorrow to lift consistency.`;
  }

  if (weekDelta > 0) {
    return `Your DR is climbing this week. Protect momentum by repeating your ${strongest.label.toLowerCase()} routine where you're already strongest.`;
  }

  return `You're steady overall. Converting one ${weakest.label.toLowerCase()} quest into a non-negotiable daily habit should improve balance next week.`;
}

function formatWeekChange(delta: number): string {
  if (delta > 0) return `+${delta} vs 7d ago`;
  if (delta < 0) return `${delta} vs 7d ago`;
  return "No change in 7d";
}

function toDateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeEntryDateKey(raw: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return toDateKey(parsed);
}

function buildMockCalendarData(totalDays: number): DisciplineCalendarDay[] {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  return Array.from({ length: totalDays }, (_, idx) => {
    const offset = totalDays - idx - 1;
    const date = new Date(today);
    date.setDate(today.getDate() - offset);

    const raw = Math.round(50 + Math.sin(idx / 2.2) * 26 + ((idx * 17) % 21 - 10));
    const completionPct = Math.max(0, Math.min(100, raw));

    return {
      date: toDateKey(date),
      completionPct,
    };
  });
}

function buildDisciplineCalendarDays(
  drHistory: DrHistoryEntry[],
  totalDays = 30
): DisciplineCalendarDay[] {
  const pctByDate = new Map<string, number>();

  for (const entry of drHistory) {
    const key = normalizeEntryDateKey(entry.date);
    if (!key) continue;
    const pct = Math.max(0, Math.min(100, Math.round(entry.pct)));
    pctByDate.set(key, pct);
  }

  if (pctByDate.size === 0) {
    return buildMockCalendarData(totalDays);
  }

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const days: DisciplineCalendarDay[] = [];

  for (let idx = totalDays - 1; idx >= 0; idx -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - idx);
    const dateKey = toDateKey(date);
    days.push({
      date: dateKey,
      completionPct: pctByDate.get(dateKey) ?? 0,
    });
  }

  return days;
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
  const [drHistory, setDrHistory] = useState<DrHistoryEntry[]>(defaultDrHistory);
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
      setDrHistory(
        Array.isArray(parsed.drHistory)
          ? parsed.drHistory
              .filter((entry): entry is DrHistoryEntry => isDrHistoryEntry(entry))
              .slice(-30)
          : defaultDrHistory
      );
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

  const latest7 = drHistory.slice(-7).map((entry) => entry.dr);
  const trendPoints = latest7.length >= 2 ? latest7 : buildFallbackTrend(disciplineRating);
  const disciplineCalendarDays = buildDisciplineCalendarDays(drHistory, 30);
  const weekDelta = trendPoints[trendPoints.length - 1] - trendPoints[0];
  const trendLabelTone = weekDelta > 0 ? colors.positive : weekDelta < 0 ? colors.negative : colors.textSecondary;
  const insightMessage = getInsightMessage(categoryBreakdown, weekDelta);
  const averageCompletionRate =
    categoryBreakdown.length > 0
      ? Math.round(
          categoryBreakdown.reduce((sum, category) => sum + category.completionPct, 0) /
            categoryBreakdown.length
        )
      : 0;
  const strongestCategory = categoryBreakdown[0]?.label ?? "N/A";
  const weakestCategory = categoryBreakdown[categoryBreakdown.length - 1]?.label ?? "N/A";
  const currentRank = getRankFromDR(disciplineRating);

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
            <Text style={[styles.trendLabel, { color: trendLabelTone }]}>{formatWeekChange(weekDelta)}</Text>
          </View>
          <View style={styles.drValueRow}>
            <Text style={styles.drValue}>{disciplineRating}</Text>
            <Text style={styles.drLabel}>Current DR</Text>
          </View>
          <MiniTrendChart
            points={trendPoints}
            chartWrapStyle={styles.chartWrap}
            chartBarStyle={styles.chartBar}
          />
          <Text style={styles.mutedMeta}>Last 7 evaluations</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Discipline Calendar</Text>
          <DisciplineCalendar days={disciplineCalendarDays} colors={colors} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Discipline Patterns</Text>
          <DisciplinePatterns
            days={disciplineCalendarDays}
            categories={categoryBreakdown.map((item) => ({
              label: item.label,
              completionPct: item.completionPct,
            }))}
            colors={colors}
          />
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
