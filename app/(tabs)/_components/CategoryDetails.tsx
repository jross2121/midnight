import React from "react";
import { Text, View } from "react-native";
import { createStyles } from "../_styles";
import { getCategoryDisplayName } from "../_utils/categoryLabels";
import { ui, withAlpha } from "../_utils/designSystem";
import type { ThemeColors } from "../_utils/themeContext";
import { useTheme } from "../_utils/themeContext";
import type { Category } from "../_utils/types";

interface CategoryDetailsProps {
  category: Category;
}

const getCategoryColor = (categoryId: string, colors: ThemeColors): string => {
  const colorMap: { [key: string]: string } = {
    health: colors.accentPrimary,
    money: colors.accentSecondary,
    career: colors.accentTertiary,
    social: colors.accentPrimary,
    home: colors.accentSecondary,
    fun: colors.accentTertiary,
  };
  return colorMap[categoryId] || colors.accentPrimary;
};

const getCategoryDescription = (categoryId: string): string => {
  const descriptions: { [key: string]: string } = {
    health: "Physical and mental wellbeing",
    money: "Financial growth and management",
    career: "Professional development and growth",
    social: "Relationships and connections",
    home: "Living space and domestic life",
    fun: "Personal reset and intentional enjoyment",
  };
  return descriptions[categoryId] || "";
};

export function CategoryDetails({ category }: CategoryDetailsProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const color = getCategoryColor(category.id, colors);
  const description = getCategoryDescription(category.id);

  // Calculate XP progress to next level
  const xpPercent = Math.min((category.xp / category.xpToNext) * 100, 100);

  // Calculate next milestone
  const xpNeeded = category.xpToNext - category.xp;

  // Calculate estimated days to next level (assuming ~50 XP per day average)
  const estimatedDaysToNextLevel = Math.ceil(xpNeeded / 50);

  return (
    <View style={[styles.card, { borderColor: withAlpha(color, 0.35), borderWidth: 1 }]}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <View>
          <Text style={[styles.cardTitle, { color }]}>{getCategoryDisplayName(category)}</Text>
          <Text style={[styles.questMeta, { marginTop: 4 }]}>{description}</Text>
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={[styles.level, { color, fontSize: 24 }]}>Lv {category.level}</Text>
        </View>
      </View>

      {/* XP Progress */}
      <View style={{ gap: 8, marginBottom: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={styles.xpText}>Progress to Lv {category.level + 1}</Text>
          <Text style={[styles.xpText, { color }]}>
            {category.xp} / {category.xpToNext} XP
          </Text>
        </View>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              {
                backgroundColor: color,
                width: `${xpPercent}%`,
              },
            ]}
          />
        </View>
      </View>

      {/* Stats Grid */}
      <View
        style={{
          flexDirection: "row",
          gap: ui.spacing.xs,
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: withAlpha(colors.bg, 0.22),
            borderRadius: ui.radius.md,
            padding: 12,
            borderWidth: 1,
            borderColor: withAlpha(colors.border, 0.22),
          }}
        >
          <Text style={[styles.questMeta, { fontSize: 11, color: colors.textSecondary }]}>XP Needed</Text>
          <Text style={[styles.pillValue, { color, fontSize: 14, marginTop: 4 }]}>
            {xpNeeded}
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            backgroundColor: withAlpha(colors.bg, 0.22),
            borderRadius: ui.radius.md,
            padding: 12,
            borderWidth: 1,
            borderColor: withAlpha(colors.border, 0.22),
          }}
        >
          <Text style={[styles.questMeta, { fontSize: 11, color: colors.textSecondary }]}>Est. Days</Text>
          <Text style={[styles.pillValue, { color, fontSize: 14, marginTop: 4 }]}>
            ~{estimatedDaysToNextLevel}
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            backgroundColor: withAlpha(colors.bg, 0.22),
            borderRadius: ui.radius.md,
            padding: 12,
            borderWidth: 1,
            borderColor: withAlpha(colors.border, 0.22),
          }}
        >
          <Text style={[styles.questMeta, { fontSize: 11, color: colors.textSecondary }]}>Mastery</Text>
          <Text style={[styles.pillValue, { color, fontSize: 14, marginTop: 4 }]}>
            {Math.min(Math.round((category.level / 10) * 100), 100)}%
          </Text>
        </View>
      </View>

      {/* Achievement milestones */}
      <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: withAlpha(colors.border, 0.22) }}>
        <Text style={[styles.smallLabel, { color, marginBottom: 8 }]}>Next Milestones</Text>
        <View style={{ gap: 8 }}>
          {[category.level + 1, category.level + 2, category.level + 3].map((lvl) => {
            const isCurrent = lvl === category.level + 1;
            return (
              <View
                key={lvl}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: 8,
                  paddingHorizontal: 8,
                  backgroundColor: isCurrent ? withAlpha(colors.bg, 0.22) : "transparent",
                  borderRadius: ui.radius.sm,
                  borderWidth: isCurrent ? 1 : 0,
                  borderColor: withAlpha(color, 0.3),
                }}
              >
                <Text style={[styles.questMeta, { color: isCurrent ? color : colors.textSecondary }]}>
                  Level {lvl}
                </Text>
                <View
                  style={{
                    paddingVertical: 4,
                    paddingHorizontal: 8,
                    backgroundColor: color,
                    borderRadius: 999,
                    opacity: isCurrent ? 1 : 0.5,
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 11 }}>
                    {isCurrent ? "Next" : "Upcoming"}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}
