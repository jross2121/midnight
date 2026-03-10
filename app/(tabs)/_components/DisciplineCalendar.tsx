import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ui, withAlpha } from "../_utils/designSystem";
import type { ThemeColors } from "../_utils/themeContext";

export type DisciplineCalendarDay = {
  date: string;
  completionPct: number;
};

type DisciplineCalendarProps = {
  days: DisciplineCalendarDay[];
  colors: ThemeColors;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getHeatColor(completionPct: number, colors: ThemeColors): string {
  const pct = clampPercent(completionPct);
  if (pct === 0) return withAlpha(colors.bg, 0.85);
  if (pct <= 30) return withAlpha(colors.accentPrimary, 0.28);
  if (pct <= 60) return withAlpha(colors.accentPrimary, 0.45);
  if (pct <= 90) return withAlpha(colors.accentPrimary, 0.64);
  return withAlpha(colors.accentPrimary, 0.82);
}

export function DisciplineCalendar({ days, colors }: DisciplineCalendarProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {days.map((day) => (
          <View
            key={day.date}
            style={[styles.cell, { backgroundColor: getHeatColor(day.completionPct, colors) }]}
          />
        ))}
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.metaLabel}>Last {days.length} days</Text>
        <View style={styles.legendRow}>
          <Text style={styles.legendText}>Low</Text>
          {[0, 20, 50, 80, 100].map((value) => (
            <View
              key={`legend-${value}`}
              style={[styles.legendCell, { backgroundColor: getHeatColor(value, colors) }]}
            />
          ))}
          <Text style={styles.legendText}>High</Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      marginTop: ui.spacing.xs,
      gap: ui.spacing.xs,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    cell: {
      width: 14,
      height: 14,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.42),
    },
    footerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 2,
      gap: ui.spacing.xs,
    },
    metaLabel: {
      ...ui.typography.caption,
      color: withAlpha(colors.textSecondary, 0.8),
      fontSize: 10,
      letterSpacing: 0.25,
    },
    legendRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    legendText: {
      ...ui.typography.caption,
      color: withAlpha(colors.textSecondary, 0.74),
      fontSize: 9,
      letterSpacing: 0.2,
    },
    legendCell: {
      width: 10,
      height: 10,
      borderRadius: 3,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.4),
    },
  });
}
