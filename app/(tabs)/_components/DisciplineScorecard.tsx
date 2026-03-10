import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { createCardSurface, ui, withAlpha } from "../_utils/designSystem";
import { useTheme } from "../_utils/themeContext";

interface DisciplineScorecardProps {
  averageCompletionRate: number;
  strongestCategory: string;
  weakestCategory: string;
  currentRank: string;
  sevenDayDrChange: number;
}

function formatSigned(value: number): string {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

export function DisciplineScorecard({
  averageCompletionRate,
  strongestCategory,
  weakestCategory,
  currentRank,
  sevenDayDrChange,
}: DisciplineScorecardProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const deltaTone =
    sevenDayDrChange > 0
      ? colors.positive
      : sevenDayDrChange < 0
      ? colors.negative
      : colors.textSecondary;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Discipline Scorecard</Text>
        <Text style={styles.supporting}>At-a-glance snapshot</Text>
      </View>

      <View style={styles.metricsGrid}>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Avg Completion</Text>
          <Text style={styles.metricValue}>{averageCompletionRate}%</Text>
        </View>

        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Current Rank</Text>
          <Text style={styles.metricValue}>{currentRank}</Text>
        </View>

        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Strongest</Text>
          <Text style={styles.metricValue}>{strongestCategory}</Text>
        </View>

        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Weakest</Text>
          <Text style={styles.metricValue}>{weakestCategory}</Text>
        </View>

        <View style={[styles.metricCell, styles.metricCellWide]}>
          <Text style={styles.metricLabel}>7-Day DR Change</Text>
          <Text style={[styles.metricValue, { color: deltaTone }]}>{formatSigned(sevenDayDrChange)}</Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    card: {
      ...createCardSurface(colors, {
        padding: ui.spacing.md,
        radius: ui.radius.lg,
        borderOpacity: 0.62,
        glowOpacity: 0.07,
        backgroundColor: withAlpha(colors.surface2, 0.9),
      }),
      gap: ui.spacing.sm,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: ui.spacing.xs,
    },
    title: {
      ...ui.typography.heading,
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: "800",
    },
    supporting: {
      ...ui.typography.caption,
      color: withAlpha(colors.textSecondary, 0.86),
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    metricsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: ui.spacing.xs,
      columnGap: ui.spacing.xs,
    },
    metricCell: {
      width: "48.5%",
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.5),
      borderRadius: ui.radius.md,
      backgroundColor: withAlpha(colors.surface, 0.58),
      paddingVertical: ui.spacing.xs,
      paddingHorizontal: ui.spacing.sm,
      gap: 2,
    },
    metricCellWide: {
      width: "100%",
      alignItems: "center",
      backgroundColor: withAlpha(colors.accentPrimary, 0.1),
      borderColor: withAlpha(colors.accentPrimary, 0.35),
    },
    metricLabel: {
      ...ui.typography.caption,
      color: withAlpha(colors.textSecondary, 0.85),
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.45,
    },
    metricValue: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "800",
      letterSpacing: 0.1,
    },
  });
}