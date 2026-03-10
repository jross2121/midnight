import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ui, withAlpha } from "../_utils/designSystem";
import type { ThemeColors } from "../_utils/themeContext";

export type DisciplinePatternInsightInput = {
  date: string;
  completionPct: number;
};

export type DisciplinePatternCategoryInput = {
  label: string;
  completionPct: number;
};

type DisciplinePatternsProps = {
  days: DisciplinePatternInsightInput[];
  categories: DisciplinePatternCategoryInput[];
  colors: ThemeColors;
};

function parseWeekday(key: string): number | null {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  const day = date.getDay();
  return Number.isFinite(day) ? day : null;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round(total / values.length);
}

function buildPatternInsights(
  days: DisciplinePatternInsightInput[],
  categories: DisciplinePatternCategoryInput[]
): string[] {
  const insights: string[] = [];

  const weekdayValues: number[] = [];
  const weekendValues: number[] = [];
  for (const day of days) {
    const weekday = parseWeekday(day.date);
    if (weekday === null) continue;
    if (weekday === 0 || weekday === 6) {
      weekendValues.push(day.completionPct);
    } else {
      weekdayValues.push(day.completionPct);
    }
  }

  const weekdayAvg = average(weekdayValues);
  const weekendAvg = average(weekendValues);
  const gap = weekdayAvg - weekendAvg;

  if (weekdayValues.length > 0 && weekendValues.length > 0) {
    if (gap >= 8) {
      insights.push(
        `You perform best on weekdays (${weekdayAvg}% avg). Keep one light weekend anchor quest to protect momentum.`
      );
    } else if (gap <= -8) {
      insights.push(
        `Weekends are your strong zone (${weekendAvg}% avg). Carry that rhythm into Monday with one easy first-win quest.`
      );
    } else {
      insights.push(
        `Your weekday and weekend consistency is balanced. A fixed daily kickoff ritual can push both a bit higher.`
      );
    }
  }

  if (categories.length > 0) {
    const sorted = [...categories].sort((a, b) => b.completionPct - a.completionPct);
    const strongest = sorted[0];
    const weakest = sorted[sorted.length - 1];

    if (strongest) {
      insights.push(
        `${strongest.label} quests are consistently strong at ${strongest.completionPct}%. Use that momentum as your daily starting category.`
      );
    }

    if (weakest && weakest !== strongest) {
      insights.push(
        `${weakest.label} quests trail at ${weakest.completionPct}%. Reduce friction by scheduling one smaller ${weakest.label.toLowerCase()} action earlier in the day.`
      );
    }
  }

  if (insights.length === 0) {
    return [
      "Your tracking is getting started. Keep logging daily completions to unlock stronger pattern coaching.",
      "A simple rule for now: finish one priority quest early to build a reliable win streak.",
    ];
  }

  return insights.slice(0, 3);
}

export function DisciplinePatterns({ days, categories, colors }: DisciplinePatternsProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insights = useMemo(() => buildPatternInsights(days, categories), [days, categories]);

  return (
    <View style={styles.wrap}>
      {insights.map((line, idx) => (
        <View key={`pattern-${idx}`} style={styles.insightRow}>
          <View style={styles.bullet} />
          <Text style={styles.insightText}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      marginTop: ui.spacing.xs,
      gap: ui.spacing.sm,
    },
    insightRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: ui.spacing.xs,
      paddingVertical: 2,
    },
    bullet: {
      width: 6,
      height: 6,
      borderRadius: 999,
      marginTop: 7,
      backgroundColor: withAlpha(colors.accentPrimary, 0.8),
      borderWidth: 1,
      borderColor: withAlpha(colors.accentPrimary, 0.35),
    },
    insightText: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 13,
      lineHeight: 20,
      fontWeight: "600",
      letterSpacing: 0.1,
    },
  });
}
