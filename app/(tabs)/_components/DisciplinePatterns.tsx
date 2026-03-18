import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ui, withAlpha } from "../_utils/designSystem";
import type { ThemeColors } from "../_utils/themeContext";

export type DisciplinePatternInsightInput = {
  date: string;
  completionPct: number;
};

type DisciplinePatternsProps = {
  days: DisciplinePatternInsightInput[];
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

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / values.length;
  return Math.sqrt(variance);
}

function buildPatternInsights(
  days: DisciplinePatternInsightInput[]
): string[] {
  const insights: string[] = [];
  const nonZeroDays = days.filter((day) => day.completionPct > 0);

  const weekdayValues: number[] = [];
  const weekendValues: number[] = [];
  for (const day of nonZeroDays) {
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

  const latest7 = nonZeroDays.slice(-7).map((day) => day.completionPct);
  const latest3 = nonZeroDays.slice(-3).map((day) => day.completionPct);

  if (latest7.length >= 3 && latest3.length >= 2) {
    const avg7 = average(latest7);
    const avg3 = average(latest3);
    const trendGap = avg3 - avg7;

    if (trendGap >= 8) {
      insights.push(
        `Your recent pace is improving: ${avg3}% over the last 3 days versus ${avg7}% across 7 days.`
      );
    } else if (trendGap <= -8) {
      insights.push(
        `Recent follow-through softened: ${avg3}% in the last 3 days versus ${avg7}% across 7 days. Reset with one must-do quest tomorrow morning.`
      );
    } else {
      insights.push(
        `Recent performance is stable (${avg3}% over 3 days, ${avg7}% over 7 days). A fixed first quest can turn stability into growth.`
      );
    }
  }

  if (latest7.length >= 4) {
    const deviation = standardDeviation(latest7);
    if (deviation <= 12) {
      insights.push(
        "Consistency is strengthening week to week. Keep the same completion window to preserve this reliability."
      );
    } else {
      insights.push(
        "Your completion swings are wide across recent days. Narrow the plan to fewer high-priority quests for steadier execution."
      );
    }
  }

  if (insights.length === 0) {
    return [
      "Your history is still building. Complete a few Midnight Evaluations to unlock stronger pattern coaching.",
      "Start simple: finish one priority quest early each day to establish a stable baseline.",
    ];
  }

  return insights.slice(0, 3);
}

export function DisciplinePatterns({ days, colors }: DisciplinePatternsProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insights = useMemo(() => buildPatternInsights(days), [days]);

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
